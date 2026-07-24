export interface MemorandumPdfData {
  projectName: string
  projectNumber: string
  projectType: string
  typeLabel: string
  location: string
  country: string
  countryFlag: string
  dateLabel: string
  status: string
  summary: string
  metrics: Array<{ label: string; value: string }>
  profile: Array<{ label: string; value: string }>
  highlights: string[]
  heroImage: string
  showPvEconomics: boolean
  pvEconomics: {
    annualYield: number
    annualRevenue: number
    purchasePrice: number
    tariffEurKwh: number
    roi: number
    amortisation: number
  } | null
}

export type PdfGenerationStep = 'Daten prüfen' | 'jsPDF laden' | 'Bilder laden' | 'Seite 1 erzeugen' | 'Blob erzeugen'

export class PdfGenerationError extends Error {
  readonly step: PdfGenerationStep
  readonly cause?: unknown
  constructor(step: PdfGenerationStep, message: string, cause?: unknown) {
    super(message)
    this.name = 'PdfGenerationError'
    this.step = step
    this.cause = cause
  }
}

const NAVY: [number, number, number] = [11, 22, 51]
const GREEN: [number, number, number] = [92, 184, 0]
const BORDER: [number, number, number] = [218, 226, 232]
const MUTED: [number, number, number] = [90, 104, 120]
const LIGHT: [number, number, number] = [247, 249, 250]
const IMAGE_FETCH_TIMEOUT_MS = 8000

type JsPdfDoc = InstanceType<typeof import('jspdf').default>
type LoadedImage = { dataUrl: string; format: 'JPEG' | 'PNG' }

function safeText(value: unknown, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function safeNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function number(value: unknown, digits = 0) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(safeNumber(value))
}

function money(value: unknown) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(safeNumber(value))
}

function assertValidData(data: MemorandumPdfData) {
  if (!data || typeof data !== 'object') throw new PdfGenerationError('Daten prüfen', 'Es wurden keine Projektdaten übergeben.')
  if (!safeText(data.projectName, '').trim()) throw new PdfGenerationError('Daten prüfen', 'Der Projektname fehlt.')
}

async function loadImageAsDataUrl(url: string): Promise<LoadedImage | null> {
  if (!url || url.toLowerCase().endsWith('.svg')) return null
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { cache: 'force-cache', signal: controller.signal })
    if (!response.ok) return null
    const blob = await response.blob()
    if (!blob.size) return null
    const mimeType = blob.type || ''
    const format: 'JPEG' | 'PNG' = mimeType.includes('png') ? 'PNG' : 'JPEG'
    if (!mimeType.includes('png') && !mimeType.includes('jpeg') && !mimeType.includes('jpg')) return null
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
    return dataUrl ? { dataUrl, format } : null
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}

async function loadJsPdfConstructor() {
  try {
    const module = await import('jspdf')
    return module.default
  } catch (error) {
    throw new PdfGenerationError('jsPDF laden', 'Die PDF-Bibliothek konnte nicht geladen werden.', error)
  }
}

function addImageSafely(doc: JsPdfDoc, image: LoadedImage | null, x: number, y: number, width: number, height: number) {
  if (!image) return
  try { doc.addImage(image.dataUrl, image.format, x, y, width, height, undefined, 'FAST') } catch { /* optional image */ }
}

function sectionHeading(doc: JsPdfDoc, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(label.toUpperCase(), x, y)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.8)
  doc.line(x, y + 2, x + 12, y + 2)
}

function metricCard(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(x, y, width, 17, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.8)
  doc.setTextColor(...GREEN)
  doc.text(label.toUpperCase(), x + width / 2, y + 5.2, { align: 'center' })
  doc.setTextColor(...NAVY)
  doc.setFontSize(7.5)
  doc.text(doc.splitTextToSize(value || '—', width - 5), x + width / 2, y + 10.8, { align: 'center' })
}

function economyBar(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string, percentage: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text(label, x, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY)
  doc.text(value, x + width, y, { align: 'right' })
  doc.setFillColor(232, 236, 240)
  doc.roundedRect(x, y + 2, width, 3, 1.5, 1.5, 'F')
  doc.setFillColor(...GREEN)
  doc.roundedRect(x, y + 2, Math.max(0, Math.min(width, width * percentage / 100)), 3, 1.5, 1.5, 'F')
}

function footer(doc: JsPdfDoc, data: MemorandumPdfData) {
  doc.setDrawColor(...BORDER)
  doc.line(12, 197, 285, 197)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text('EMA Enterprise GmbH · Gabriel-von-Seidl-Str. 56 · 67550 Worms', 12, 202)
  doc.text('www.ema-enterprise.de · info@ema-enterprise.de', 148.5, 202, { align: 'center' })
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.dateLabel)}`, 285, 202, { align: 'right' })
}

function renderPage(doc: JsPdfDoc, data: MemorandumPdfData, logo: LoadedImage | null, hero: LoadedImage | null, flag: LoadedImage | null) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 297, 210, 'F')
  addImageSafely(doc, logo, 12, 6, 30, 13)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...NAVY)
  doc.text('INVESTMENT MEMORANDUM', 285, 12, { align: 'right' })
  doc.setFontSize(7)
  doc.setTextColor(...GREEN)
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.typeLabel)}`.toUpperCase(), 285, 18, { align: 'right' })

  doc.setFillColor(...NAVY)
  doc.rect(12, 24, 273, 48, 'F')
  if (hero) {
    addImageSafely(doc, hero, 122, 24, 163, 48)
    doc.setFillColor(255, 255, 255)
    doc.setGState(new (doc as any).GState({ opacity: 0.12 }))
    doc.rect(122, 24, 163, 48, 'F')
    doc.setGState(new (doc as any).GState({ opacity: 1 }))
  }

  doc.setFillColor(...GREEN)
  doc.roundedRect(20, 30, 48, 7, 2, 2, 'F')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  doc.text(safeText(data.typeLabel).toUpperCase(), 44, 34.8, { align: 'center' })
  doc.setFontSize(19)
  doc.setTextColor(255, 255, 255)
  doc.text(doc.splitTextToSize(safeText(data.projectName, 'Projekt'), 95), 20, 48)
  doc.setFontSize(7.5)
  addImageSafely(doc, flag, 20, 60, 8, 5)
  doc.text(`${safeText(data.location)} · ${safeText(data.country)} · ${safeText(data.status)}`, flag ? 31 : 20, 64)

  const metrics = data.metrics.slice(0, 6)
  const cardWidth = 273 / Math.max(metrics.length, 1)
  metrics.forEach((metric, index) => metricCard(doc, 12 + index * cardWidth, 76, cardWidth - 1, safeText(metric.label), safeText(metric.value)))

  sectionHeading(doc, 'Executive Summary', 12, 102)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(40, 52, 68)
  doc.text(doc.splitTextToSize(safeText(data.summary), 82), 12, 111)

  sectionHeading(doc, 'Projektprofil', 103, 102)
  data.profile.slice(0, 5).forEach((row, index) => {
    const y = 111 + index * 7.2
    doc.setDrawColor(...BORDER)
    doc.line(103, y + 2.5, 193, y + 2.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.3)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row.label), 105, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(safeText(row.value), 48), 191, y, { align: 'right' })
  })

  sectionHeading(doc, 'Visuelle Wirtschaftlichkeit', 203, 102)
  if (data.showPvEconomics && data.pvEconomics) {
    const economics = data.pvEconomics
    economyBar(doc, 203, 113, 82, 'Rendite p.a.', `${number(economics.roi, 2)} %`, Math.min(100, economics.roi * 7))
    economyBar(doc, 203, 124, 82, 'Amortisation', `${number(economics.amortisation, 1)} Jahre`, Math.max(8, 100 - economics.amortisation * 4))
    economyBar(doc, 203, 135, 82, 'Jahreserlös', money(economics.annualRevenue), economics.purchasePrice > 0 ? Math.min(100, economics.annualRevenue / economics.purchasePrice * 700) : 0)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize('Wirtschaftliche Kennzahlen werden ergänzt, sobald belastbare Erlös- und Investitionsdaten vorliegen.', 80), 203, 113)
  }

  sectionHeading(doc, data.showPvEconomics ? 'Wirtschaftliche Kennzahlen' : 'Projektkennzahlen', 12, 154)
  const details = data.showPvEconomics && data.pvEconomics ? [
    ['Jahresproduktion', `${number(data.pvEconomics.annualYield)} kWh`],
    ['Jahreserlös', money(data.pvEconomics.annualRevenue)],
    ['Kaufpreis', money(data.pvEconomics.purchasePrice)],
    ['Vergütung', `${number(data.pvEconomics.tariffEurKwh, 3)} €/kWh`],
    ['Rendite p.a.', `${number(data.pvEconomics.roi, 2)} %`],
    ['Amortisation', `${number(data.pvEconomics.amortisation, 1)} Jahre`],
  ] : data.metrics.slice(0, 6).map((item) => [item.label, item.value])

  details.slice(0, 6).forEach((row, index) => {
    const column = index >= 3 ? 1 : 0
    const rowIndex = index % 3
    const x = 12 + column * 45
    const y = 164 + rowIndex * 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.3)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row[0]), x, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(safeText(row[1]), x + 41, y, { align: 'right' })
  })

  sectionHeading(doc, 'Investment Highlights', 112, 154)
  const highlights = data.highlights.length ? data.highlights : ['Projektunterlagen und Kennzahlen werden laufend ergänzt.']
  highlights.slice(0, 4).forEach((highlight, index) => {
    const column = index >= 2 ? 1 : 0
    const rowIndex = index % 2
    const x = 112 + column * 87
    const y = 164 + rowIndex * 13
    doc.setFillColor(...LIGHT)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(x, y - 4, 82, 10, 2, 2, 'FD')
    doc.setFillColor(...GREEN)
    doc.circle(x + 4, y, 1, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.2)
    doc.setTextColor(40, 52, 68)
    doc.text(doc.splitTextToSize(safeText(highlight), 72), x + 7, y + 1)
  })

  footer(doc, data)
}

export async function generateMemorandumPdf(data: MemorandumPdfData): Promise<Blob> {
  assertValidData(data)
  const JsPDF = await loadJsPdfConstructor()
  let logo: LoadedImage | null = null
  let hero: LoadedImage | null = null
  let flag: LoadedImage | null = null
  try {
    ;[logo, hero, flag] = await Promise.all([
      loadImageAsDataUrl('/ema-logo.jpeg'),
      loadImageAsDataUrl(data.heroImage),
      loadImageAsDataUrl(data.countryFlag),
    ])
  } catch (error) {
    throw new PdfGenerationError('Bilder laden', 'Die PDF-Bilder konnten nicht geladen werden.', error)
  }
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  try {
    renderPage(doc, data, logo, hero, flag)
  } catch (error) {
    throw new PdfGenerationError('Seite 1 erzeugen', 'Das einseitige Exposé konnte nicht erzeugt werden.', error)
  }
  try {
    return doc.output('blob')
  } catch (error) {
    throw new PdfGenerationError('Blob erzeugen', 'Die PDF-Datei konnte nicht fertiggestellt werden.', error)
  }
}