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
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 12
const CONTENT_W = PAGE_W - MARGIN * 2
const IMAGE_FETCH_TIMEOUT_MS = 8000

type JsPdfDoc = InstanceType<typeof import('jspdf').default>
type LoadedImage = { dataUrl: string; format: 'JPEG' | 'PNG' }

function safeText(value: unknown, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function safeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
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
    const mimeType = blob.type || ''
    if (!blob.size || (!mimeType.includes('png') && !mimeType.includes('jpeg') && !mimeType.includes('jpg'))) return null
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
    return dataUrl ? { dataUrl, format: mimeType.includes('png') ? 'PNG' : 'JPEG' } : null
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
  try { doc.addImage(image.dataUrl, image.format, x, y, width, height, undefined, 'FAST') } catch { /* optional */ }
}

function heading(doc: JsPdfDoc, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text(label.toUpperCase(), x, y)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.8)
  doc.line(x, y + 2, x + 12, y + 2)
}

function metricCard(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(x, y, width, 18, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.6)
  doc.setTextColor(...GREEN)
  doc.text(label.toUpperCase(), x + width / 2, y + 5, { align: 'center' })
  doc.setTextColor(...NAVY)
  doc.setFontSize(7.2)
  doc.text(doc.splitTextToSize(value || '—', width - 4), x + width / 2, y + 11, { align: 'center' })
}

function economyBar(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string, percentage: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.3)
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
  doc.line(MARGIN, 283, PAGE_W - MARGIN, 283)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text('EMA Enterprise GmbH · Gabriel-von-Seidl-Str. 56 · 67550 Worms', MARGIN, 288)
  doc.text('www.ema-enterprise.de · info@ema-enterprise.de', PAGE_W / 2, 288, { align: 'center' })
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.dateLabel)}`, PAGE_W - MARGIN, 288, { align: 'right' })
}

function renderPage(doc: JsPdfDoc, data: MemorandumPdfData, logo: LoadedImage | null, hero: LoadedImage | null, flag: LoadedImage | null) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  addImageSafely(doc, logo, MARGIN, 8, 28, 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('INVESTMENT MEMORANDUM', PAGE_W - MARGIN, 13, { align: 'right' })
  doc.setFontSize(6.5)
  doc.setTextColor(...GREEN)
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.typeLabel)}`.toUpperCase(), PAGE_W - MARGIN, 19, { align: 'right' })

  const heroY = 25
  const heroH = 66
  doc.setFillColor(...NAVY)
  doc.roundedRect(MARGIN, heroY, CONTENT_W, heroH, 2, 2, 'F')
  if (hero) {
    addImageSafely(doc, hero, 76, heroY, 122, heroH)
    doc.setFillColor(255, 255, 255)
    doc.setGState(new (doc as any).GState({ opacity: 0.1 }))
    doc.rect(76, heroY, 122, heroH, 'F')
    doc.setGState(new (doc as any).GState({ opacity: 1 }))
  }
  doc.setFillColor(...GREEN)
  doc.roundedRect(19, 34, 48, 7, 2, 2, 'F')
  doc.setFontSize(6.7)
  doc.setTextColor(255, 255, 255)
  doc.text(safeText(data.typeLabel).toUpperCase(), 43, 38.8, { align: 'center' })
  doc.setFontSize(17)
  doc.text(doc.splitTextToSize(safeText(data.projectName, 'Projekt'), 52), 19, 51)
  doc.setFontSize(7)
  addImageSafely(doc, flag, 19, 76, 8, 5)
  doc.text(`${safeText(data.location)} · ${safeText(data.country)} · ${safeText(data.status)}`, flag ? 30 : 19, 80)

  const metrics = data.metrics.slice(0, 6)
  const gap = 2
  const cardW = (CONTENT_W - gap * 2) / 3
  metrics.forEach((metric, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    metricCard(doc, MARGIN + col * (cardW + gap), 96 + row * 20, cardW, safeText(metric.label), safeText(metric.value))
  })

  const leftX = MARGIN
  const rightX = 108
  heading(doc, 'Executive Summary', leftX, 140)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(40, 52, 68)
  doc.text(doc.splitTextToSize(safeText(data.summary), 86), leftX, 149)

  heading(doc, 'Projektprofil', rightX, 140)
  data.profile.slice(0, 5).forEach((row, index) => {
    const y = 149 + index * 8
    doc.setDrawColor(...BORDER)
    doc.line(rightX, y + 2.5, PAGE_W - MARGIN, y + 2.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.2)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row.label), rightX + 1, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(safeText(row.value), 40), PAGE_W - MARGIN - 1, y, { align: 'right' })
  })

  heading(doc, 'Visuelle Wirtschaftlichkeit', leftX, 196)
  if (data.showPvEconomics && data.pvEconomics) {
    const e = data.pvEconomics
    economyBar(doc, leftX, 206, 84, 'Rendite p.a.', `${number(e.roi, 2)} %`, Math.min(100, e.roi * 7))
    economyBar(doc, leftX, 218, 84, 'Amortisation', `${number(e.amortisation, 1)} Jahre`, Math.max(8, 100 - e.amortisation * 4))
    economyBar(doc, leftX, 230, 84, 'Jahreserlös', money(e.annualRevenue), e.purchasePrice > 0 ? Math.min(100, e.annualRevenue / e.purchasePrice * 700) : 0)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize('Wirtschaftliche Kennzahlen werden ergänzt, sobald belastbare Erlös- und Investitionsdaten vorliegen.', 84), leftX, 206)
  }

  heading(doc, 'Investment Highlights', rightX, 196)
  const highlights = (data.highlights.length ? data.highlights : ['Projektunterlagen und Kennzahlen werden laufend ergänzt.']).slice(0, 4)
  highlights.forEach((highlight, index) => {
    const y = 205 + index * 12
    doc.setFillColor(...LIGHT)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(rightX, y - 4, 90, 10, 2, 2, 'FD')
    doc.setFillColor(...GREEN)
    doc.circle(rightX + 4, y, 1, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.1)
    doc.setTextColor(40, 52, 68)
    doc.text(doc.splitTextToSize(safeText(highlight), 80), rightX + 7, y + 1)
  })

  heading(doc, data.showPvEconomics ? 'Wirtschaftliche Kennzahlen' : 'Projektkennzahlen', leftX, 253)
  const details = data.showPvEconomics && data.pvEconomics ? [
    ['Jahresproduktion', `${number(data.pvEconomics.annualYield)} kWh`],
    ['Jahreserlös', money(data.pvEconomics.annualRevenue)],
    ['Kaufpreis', money(data.pvEconomics.purchasePrice)],
    ['Vergütung', `${number(data.pvEconomics.tariffEurKwh, 3)} €/kWh`],
    ['Rendite p.a.', `${number(data.pvEconomics.roi, 2)} %`],
    ['Amortisation', `${number(data.pvEconomics.amortisation, 1)} Jahre`],
  ] : data.metrics.slice(0, 6).map((item) => [item.label, item.value])
  details.slice(0, 6).forEach((row, index) => {
    const col = index % 3
    const line = Math.floor(index / 3)
    const x = leftX + col * 62
    const y = 263 + line * 10
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.8)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row[0]), x, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(safeText(row[1]), x + 57, y, { align: 'right' })
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
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  try {
    renderPage(doc, data, logo, hero, flag)
  } catch (error) {
    throw new PdfGenerationError('Seite 1 erzeugen', 'Das einseitige A4-Hochformat konnte nicht erzeugt werden.', error)
  }
  try {
    return doc.output('blob')
  } catch (error) {
    throw new PdfGenerationError('Blob erzeugen', 'Die PDF-Datei konnte nicht fertiggestellt werden.', error)
  }
}
