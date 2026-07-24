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
  try { doc.addImage(image.dataUrl, image.format, x, y, width, height, undefined, 'FAST') } catch { /* optional */ }
}

function sectionHeading(doc: JsPdfDoc, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(label.toUpperCase(), x, y)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.8)
  doc.line(x, y + 2, x + 11, y + 2)
}

function metricCard(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(x, y, width, 23, 2.5, 2.5, 'FD')
  doc.setFillColor(...GREEN)
  doc.circle(x + 7, y + 7, 2.1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.8)
  doc.setTextColor(...MUTED)
  doc.text(label.toUpperCase(), x + 12, y + 7.2)
  doc.setTextColor(...NAVY)
  doc.setFontSize(8.2)
  doc.text(doc.splitTextToSize(value || '—', width - 16), x + 12, y + 13.5)
}

function drawMap(doc: JsPdfDoc, x: number, y: number, width: number, height: number, data: MemorandumPdfData) {
  doc.setFillColor(237, 243, 232)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'FD')
  doc.setDrawColor(203, 213, 192)
  doc.setLineWidth(0.35)
  for (let offset = -height; offset < width + height; offset += 12) {
    doc.line(x + Math.max(0, offset), y + Math.max(0, -offset), x + Math.min(width, offset + height), y + Math.min(height, height + offset))
  }
  doc.setFillColor(255, 255, 255)
  doc.circle(x + width / 2, y + height / 2 - 2, 7, 'F')
  doc.setFillColor(...GREEN)
  doc.circle(x + width / 2, y + height / 2 - 2, 3.2, 'F')
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(x + 4, y + height - 15, width - 8, 11, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...NAVY)
  doc.text(doc.splitTextToSize(safeText(data.location), width - 14), x + 7, y + height - 10.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  doc.setTextColor(...MUTED)
  doc.text(safeText(data.country), x + 7, y + height - 5.5)
}

function drawEconomics(doc: JsPdfDoc, data: MemorandumPdfData, x: number, y: number) {
  const economics = data.pvEconomics
  const cards = [
    ['Jahreserlös', economics && economics.annualRevenue > 0 ? money(economics.annualRevenue) : 'Noch offen'],
    ['Amortisation', economics && economics.amortisation > 0 ? `${number(economics.amortisation, 1)} Jahre` : 'Noch offen'],
    ['Rendite', economics && economics.roi > 0 ? `${number(economics.roi, 1)} %` : 'Noch offen'],
  ]
  cards.forEach((item, index) => {
    const cardX = x + index * 31
    doc.setFillColor(...LIGHT)
    doc.roundedRect(cardX, y, 28, 19, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.4)
    doc.setTextColor(...MUTED)
    doc.text(item[0].toUpperCase(), cardX + 14, y + 6, { align: 'center' })
    doc.setTextColor(...GREEN)
    doc.setFontSize(8.5)
    doc.text(item[1], cardX + 14, y + 13.5, { align: 'center' })
  })
}

function drawChart(doc: JsPdfDoc, data: MemorandumPdfData, x: number, y: number, width: number, height: number) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'FD')
  const economics = data.pvEconomics
  if (!economics || economics.purchasePrice <= 0 || economics.annualRevenue <= 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize('Diagramm wird angezeigt, sobald Kaufpreis und Jahreserlös vorliegen.', width - 12), x + 6, y + 12)
    return
  }

  const chartX = x + 8
  const chartY = y + 9
  const chartW = width - 14
  const chartH = height - 17
  const years = 20
  const maxAbs = Math.max(economics.purchasePrice, economics.annualRevenue * years - economics.purchasePrice, economics.annualRevenue, 1)
  const zeroY = chartY + chartH * 0.55

  doc.setDrawColor(230, 234, 238)
  doc.setLineWidth(0.3)
  for (let i = 0; i <= 4; i++) {
    const gy = chartY + (chartH / 4) * i
    doc.line(chartX, gy, chartX + chartW, gy)
  }

  doc.setDrawColor(148, 163, 184)
  doc.line(chartX, zeroY, chartX + chartW, zeroY)

  const points: Array<[number, number]> = []
  for (let year = 0; year <= years; year++) {
    const cashflow = year === 0 ? -economics.purchasePrice : economics.annualRevenue
    const cumulative = -economics.purchasePrice + economics.annualRevenue * year
    const px = chartX + (year / years) * chartW
    const barHeight = Math.max(1.4, Math.abs(cashflow / maxAbs) * chartH * 0.42)
    doc.setFillColor(...GREEN)
    if (cashflow >= 0) doc.roundedRect(px - 1.1, zeroY - barHeight, 2.2, barHeight, 0.5, 0.5, 'F')
    else doc.roundedRect(px - 1.1, zeroY, 2.2, barHeight, 0.5, 0.5, 'F')
    const py = zeroY - (cumulative / maxAbs) * chartH * 0.42
    points.push([px, Math.max(chartY + 1, Math.min(chartY + chartH - 1, py))])
  }

  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.8)
  for (let i = 1; i < points.length; i++) doc.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  doc.setTextColor(...MUTED)
  ;[0, 5, 10, 15, 20].forEach((year) => doc.text(String(year), chartX + (year / years) * chartW, y + height - 3, { align: 'center' }))
}

function footer(doc: JsPdfDoc, data: MemorandumPdfData, logo: LoadedImage | null) {
  doc.setFillColor(...NAVY)
  doc.rect(0, 282, 210, 15, 'F')
  addImageSafely(doc, logo, 10, 284, 25, 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(255, 255, 255)
  doc.text('EMA Enterprise GmbH · Gabriel-von-Seidl-Str. 56 · 67550 Worms', 42, 288)
  doc.text('www.ema-enterprise.de · info@ema-enterprise.de', 42, 292)
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.dateLabel)}`, 200, 290, { align: 'right' })
}

function renderPage(doc: JsPdfDoc, data: MemorandumPdfData, logo: LoadedImage | null, hero: LoadedImage | null, flag: LoadedImage | null) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 210, 297, 'F')

  addImageSafely(doc, logo, 10, 8, 30, 13)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...NAVY)
  doc.text('INVESTMENT', 200, 11, { align: 'right' })
  doc.text('MEMORANDUM', 200, 17, { align: 'right' })
  doc.setFontSize(6.8)
  doc.setTextColor(...GREEN)
  doc.text(safeText(data.typeLabel).toUpperCase(), 200, 22, { align: 'right' })

  doc.setFillColor(239, 243, 246)
  doc.rect(0, 28, 210, 64, 'F')
  if (hero) addImageSafely(doc, hero, 88, 28, 122, 64)
  doc.setFillColor(255, 255, 255)
  doc.setGState(new (doc as any).GState({ opacity: 0.88 }))
  doc.rect(0, 28, 112, 64, 'F')
  doc.setGState(new (doc as any).GState({ opacity: 1 }))
  doc.setFillColor(255, 255, 255)
  doc.setGState(new (doc as any).GState({ opacity: 0.5 }))
  doc.triangle(92, 28, 118, 28, 92, 92, 'F')
  doc.setGState(new (doc as any).GState({ opacity: 1 }))

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...NAVY)
  doc.text('INVESTMENT', 12, 43)
  doc.text('MEMORANDUM', 12, 51)
  doc.setFontSize(7)
  doc.setTextColor(...GREEN)
  doc.text(safeText(data.typeLabel).toUpperCase(), 12, 59)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(1)
  doc.line(12, 64, 22, 64)
  doc.setFontSize(16)
  doc.setTextColor(...NAVY)
  doc.text(doc.splitTextToSize(safeText(data.projectName, 'Projekt'), 72), 12, 73)
  doc.setFontSize(6)
  doc.text(`PROJEKT-NR. ${safeText(data.projectNumber)}`.toUpperCase(), 12, 85)
  addImageSafely(doc, flag, 72, 81.5, 8, 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text(`${safeText(data.location)} · ${safeText(data.country)}`, 82, 85)

  const metrics = data.metrics.slice(0, 6)
  const gap = 3
  const cardWidth = (186 - gap * 2) / 3
  metrics.forEach((metric, index) => {
    const row = Math.floor(index / 3)
    const column = index % 3
    metricCard(doc, 12 + column * (cardWidth + gap), 98 + row * 26, cardWidth, safeText(metric.label), safeText(metric.value))
  })

  sectionHeading(doc, 'Executive Summary', 12, 156)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.7)
  doc.setTextColor(40, 52, 68)
  doc.text(doc.splitTextToSize(safeText(data.summary), 74), 12, 165)

  sectionHeading(doc, 'Projektprofil', 102, 156)
  data.profile.slice(0, 9).forEach((row, index) => {
    const py = 165 + index * 6
    doc.setDrawColor(...BORDER)
    doc.line(102, py + 2.2, 198, py + 2.2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.7)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row.label), 104, py)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(safeText(row.value), 46), 196, py, { align: 'right' })
  })

  sectionHeading(doc, 'Standort', 12, 197)
  drawMap(doc, 12, 204, 74, 49, data)

  sectionHeading(doc, 'Wirtschaftliche Kennzahlen', 102, 219)
  drawEconomics(doc, data, 102, 226)

  sectionHeading(doc, 'Cashflow & Amortisation', 102, 197)
  drawChart(doc, data, 102, 204, 96, 42)

  footer(doc, data, logo)
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
    throw new PdfGenerationError('Seite 1 erzeugen', 'Das einseitige Hochformat-Memorandum konnte nicht erzeugt werden.', error)
  }

  try {
    return doc.output('blob')
  } catch (error) {
    throw new PdfGenerationError('Blob erzeugen', 'Die PDF-Datei konnte nicht fertiggestellt werden.', error)
  }
}
