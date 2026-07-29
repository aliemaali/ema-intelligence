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
const GREEN_DARK: [number, number, number] = [67, 139, 0]
const BORDER: [number, number, number] = [219, 226, 232]
const MUTED: [number, number, number] = [91, 104, 120]
const LIGHT: [number, number, number] = [246, 248, 250]
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

function validValue(value: unknown) {
  const text = safeText(value, '').trim().toLowerCase()
  return Boolean(text && text !== '—' && text !== 'noch offen' && text !== 'pending')
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
  doc.setLineWidth(0.9)
  doc.line(x, y + 2.1, x + 15, y + 2.1)
}

function drawMetricIcon(doc: JsPdfDoc, label: string, cx: number, cy: number, featured: boolean) {
  const normalized = label.toLowerCase()
  doc.setDrawColor(...(featured ? [255, 255, 255] as [number, number, number] : GREEN))
  doc.setFillColor(...(featured ? GREEN_DARK : [238, 248, 228] as [number, number, number]))
  doc.circle(cx, cy, 4.2, 'FD')
  doc.setLineWidth(0.65)

  if (normalized.includes('amort') || normalized.includes('payback')) {
    doc.circle(cx, cy, 2.2, 'S')
    doc.line(cx, cy, cx, cy - 1.5)
    doc.line(cx, cy, cx + 1.3, cy + 0.8)
  } else if (normalized.includes('preis') || normalized.includes('price') || normalized.includes('invest')) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.4)
    doc.setTextColor(...(featured ? [255, 255, 255] as [number, number, number] : GREEN_DARK))
    doc.text('€', cx, cy + 1.7, { align: 'center' })
  } else if (normalized.includes('leistung') || normalized.includes('capacity') || normalized.includes('kwp') || normalized.includes('mwh')) {
    doc.line(cx - 0.7, cy - 2.2, cx - 2, cy + 0.3)
    doc.line(cx - 2, cy + 0.3, cx, cy + 0.3)
    doc.line(cx, cy + 0.3, cx - 0.7, cy + 2.2)
    doc.line(cx - 0.7, cy + 2.2, cx + 2, cy - 0.5)
    doc.line(cx + 2, cy - 0.5, cx, cy - 0.5)
  } else if (normalized.includes('ertrag') || normalized.includes('yield') || normalized.includes('rendite') || normalized.includes('return')) {
    doc.line(cx - 2, cy + 1.7, cx - 0.3, cy)
    doc.line(cx - 0.3, cy, cx + 0.8, cy + 0.8)
    doc.line(cx + 0.8, cy + 0.8, cx + 2.1, cy - 1.7)
    doc.line(cx + 2.1, cy - 1.7, cx + 0.8, cy - 1.3)
  } else if (normalized.includes('vergütung') || normalized.includes('tariff')) {
    doc.circle(cx - 1.3, cy - 1, 0.55, 'F')
    doc.circle(cx + 1.3, cy + 1, 0.55, 'F')
    doc.line(cx - 1.7, cy + 1.8, cx + 1.7, cy - 1.8)
  } else {
    doc.rect(cx - 2, cy - 2, 4, 4, 'S')
    doc.line(cx - 1.2, cy + 1.1, cx - 0.2, cy + 0.1)
    doc.line(cx - 0.2, cy + 0.1, cx + 1.4, cy - 1.1)
  }
}

function metricCard(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string, featured = false) {
  doc.setFillColor(...(featured ? NAVY : [255, 255, 255] as [number, number, number]))
  doc.setDrawColor(...(featured ? NAVY : BORDER))
  doc.roundedRect(x, y, width, 23, 2.6, 2.6, 'FD')
  drawMetricIcon(doc, label, x + 9, y + 8, featured)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.7)
  doc.setTextColor(...(featured ? [193, 234, 150] as [number, number, number] : MUTED))
  doc.text(label.toUpperCase(), x + 16, y + 6.7)
  doc.setFontSize(featured ? 10.5 : 8.4)
  doc.setTextColor(...(featured ? [255, 255, 255] as [number, number, number] : NAVY))
  doc.text(doc.splitTextToSize(value, width - 19), x + 16, y + 14)
}

function footer(doc: JsPdfDoc, data: MemorandumPdfData) {
  doc.setDrawColor(...BORDER)
  doc.line(MARGIN, 283, PAGE_W - MARGIN, 283)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  doc.setTextColor(...MUTED)
  doc.text('EMA Enterprise GmbH · Gabriel-von-Seidl-Str. 56 · 67550 Worms', MARGIN, 288)
  doc.text('www.ema-enterprise.de · info@ema-enterprise.de', PAGE_W / 2, 288, { align: 'center' })
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.dateLabel)}`, PAGE_W - MARGIN, 288, { align: 'right' })
}

function renderPage(doc: JsPdfDoc, data: MemorandumPdfData, logo: LoadedImage | null, hero: LoadedImage | null, flag: LoadedImage | null) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  addImageSafely(doc, logo, MARGIN, 7, 34, 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...NAVY)
  doc.text('INVESTMENT MEMORANDUM', PAGE_W - MARGIN, 13, { align: 'right' })
  doc.setFontSize(6.2)
  doc.setTextColor(...GREEN)
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.typeLabel)}`.toUpperCase(), PAGE_W - MARGIN, 19, { align: 'right' })

  const heroY = 25
  const heroH = 72
  doc.setFillColor(...NAVY)
  doc.roundedRect(MARGIN, heroY, CONTENT_W, heroH, 3, 3, 'F')
  if (hero) addImageSafely(doc, hero, 75, heroY, 123, heroH)
  doc.setFillColor(...NAVY)
  doc.rect(MARGIN, heroY, 67, heroH, 'F')
  doc.setFillColor(...GREEN)
  doc.roundedRect(19, 35, 47, 7, 2, 2, 'F')
  doc.setFontSize(6.4)
  doc.setTextColor(255, 255, 255)
  doc.text(safeText(data.typeLabel).toUpperCase(), 42.5, 39.7, { align: 'center' })
  doc.setFontSize(18)
  doc.text(doc.splitTextToSize(safeText(data.projectName, 'Projekt'), 52), 19, 54)
  doc.setFontSize(6.8)
  addImageSafely(doc, flag, 19, 82, 8, 5)
  doc.text(`${safeText(data.location)} · ${safeText(data.country)} · ${safeText(data.status)}`, flag ? 30 : 19, 86)

  const filteredMetrics = data.metrics.filter((item) => item.label !== 'Pachtdauer' && validValue(item.value))
  const amortisationMetric = data.pvEconomics && data.pvEconomics.amortisation > 0
    ? { label: 'Amortisation', value: `${number(data.pvEconomics.amortisation, 1)} Jahre` }
    : null
  const metrics = [
    ...filteredMetrics.slice(0, 1),
    ...(amortisationMetric ? [amortisationMetric] : []),
    ...filteredMetrics.slice(1),
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.label === item.label) === index).slice(0, 5)

  const gap = 2.2
  const cardW = (CONTENT_W - gap * Math.max(0, metrics.length - 1)) / Math.max(1, metrics.length)
  metrics.forEach((metric, index) => {
    metricCard(doc, MARGIN + index * (cardW + gap), 102, cardW, metric.label, metric.value, metric.label.toLowerCase().includes('amort'))
  })

  const leftX = MARGIN
  const rightX = 108
  heading(doc, 'Executive Summary', leftX, 137)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(40, 52, 68)
  doc.text(doc.splitTextToSize(safeText(data.summary), 86), leftX, 147)

  heading(doc, 'Projektprofil', rightX, 137)
  const profile = data.profile.filter((row) => validValue(row.value)).slice(0, 5)
  profile.forEach((row, index) => {
    const y = 147 + index * 8.2
    doc.setDrawColor(...BORDER)
    doc.line(rightX, y + 2.7, PAGE_W - MARGIN, y + 2.7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.2)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row.label), rightX + 1, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(safeText(row.value), 43), PAGE_W - MARGIN - 1, y, { align: 'right' })
  })

  const economics = data.showPvEconomics && data.pvEconomics
    ? [
        data.pvEconomics.amortisation > 0 ? ['Amortisation', `${number(data.pvEconomics.amortisation, 1)} Jahre`] : null,
        data.pvEconomics.annualYield > 0 ? ['Jahresproduktion', `${number(data.pvEconomics.annualYield)} kWh`] : null,
        data.pvEconomics.annualRevenue > 0 ? ['Jahreserlös', money(data.pvEconomics.annualRevenue)] : null,
        data.pvEconomics.roi > 0 ? ['Rendite p.a.', `${number(data.pvEconomics.roi, 2)} %`] : null,
      ].filter(Boolean) as string[][]
    : []

  heading(doc, 'Wirtschaftlichkeit', leftX, 197)
  economics.slice(0, 4).forEach((row, index) => {
    const col = index % 2
    const line = Math.floor(index / 2)
    const x = leftX + col * 44
    const y = 207 + line * 18
    const featured = row[0].toLowerCase().includes('amort')
    doc.setFillColor(...(featured ? NAVY : LIGHT))
    doc.setDrawColor(...(featured ? NAVY : BORDER))
    doc.roundedRect(x, y - 5, 41, 14, 2, 2, 'FD')
    drawMetricIcon(doc, row[0], x + 6, y + 1, featured)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.4)
    doc.setTextColor(...(featured ? [194, 234, 150] as [number, number, number] : MUTED))
    doc.text(row[0].toUpperCase(), x + 12, y - 0.5)
    doc.setFontSize(7.2)
    doc.setTextColor(...(featured ? [255, 255, 255] as [number, number, number] : NAVY))
    doc.text(row[1], x + 12, y + 4)
  })

  heading(doc, 'Investment Highlights', rightX, 197)
  const highlights = data.highlights.filter(validValue).slice(0, 4)
  highlights.forEach((highlight, index) => {
    const y = 207 + index * 11
    doc.setFillColor(...LIGHT)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(rightX, y - 5, 90, 9, 2, 2, 'FD')
    doc.setFillColor(...GREEN)
    doc.circle(rightX + 5, y - 0.5, 1.2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(40, 52, 68)
    doc.text(doc.splitTextToSize(safeText(highlight), 79), rightX + 9, y + 1)
  })

  const details = economics.length ? economics : metrics.map((item) => [item.label, item.value])
  if (details.length) {
    heading(doc, data.showPvEconomics ? 'Wirtschaftliche Kennzahlen' : 'Projektkennzahlen', leftX, 257)
    details.slice(0, 6).forEach((row, index) => {
      const col = index % 3
      const line = Math.floor(index / 3)
      const x = leftX + col * 62
      const y = 267 + line * 9.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.7)
      doc.setTextColor(...MUTED)
      doc.text(safeText(row[0]), x, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...NAVY)
      doc.text(safeText(row[1]), x + 57, y, { align: 'right' })
    })
  }

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
