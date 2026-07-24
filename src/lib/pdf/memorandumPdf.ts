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
const BORDER: [number, number, number] = [225, 231, 236]
const MUTED: [number, number, number] = [95, 108, 124]
const LIGHT: [number, number, number] = [248, 250, 251]
const MAP_BG: [number, number, number] = [245, 248, 233]
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
  doc.setFontSize(7.4)
  doc.setTextColor(...NAVY)
  doc.text(label.toUpperCase(), x, y)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.8)
  doc.line(x, y + 2, x + 10, y + 2)
}

function drawMetricIcon(doc: JsPdfDoc, index: number, x: number, y: number) {
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.7)
  if (index === 0) {
    doc.rect(x - 2.2, y - 3, 4.4, 6)
    doc.line(x - 1, y - 1.8, x + 1, y - 1.8)
    doc.line(x - 1, y, x + 1, y)
    doc.line(x - 1, y + 1.8, x + 1, y + 1.8)
  } else if (index === 1) {
    doc.line(x + 1.5, y - 4, x - 1, y)
    doc.line(x - 1, y, x + 1, y)
    doc.line(x + 1, y, x - 1.5, y + 4)
  } else if (index === 2) {
    doc.circle(x, y, 3)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.8)
    doc.setTextColor(...GREEN)
    doc.text('€', x, y + 1.8, { align: 'center' })
  } else if (index === 3) {
    doc.line(x - 3, y + 2.5, x - 0.5, y)
    doc.line(x - 0.5, y, x + 1.2, y + 0.5)
    doc.line(x + 1.2, y + 0.5, x + 3, y - 2.8)
  } else if (index === 4) {
    doc.ellipse(x, y - 2, 3, 1.1)
    doc.ellipse(x, y, 3, 1.1)
    doc.ellipse(x, y + 2, 3, 1.1)
  } else {
    doc.rect(x - 2.5, y - 3.4, 5, 6.8)
    doc.line(x - 1.3, y - 1.4, x + 1.3, y - 1.4)
    doc.line(x - 1.3, y + 0.3, x + 1.3, y + 0.3)
  }
}

function metricCard(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string, index: number) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.35)
  doc.roundedRect(x, y, width, 20, 2.5, 2.5, 'FD')
  drawMetricIcon(doc, index, x + 8, y + 10)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.2)
  doc.setTextColor(...MUTED)
  doc.text(label.toUpperCase(), x + 15, y + 7)
  doc.setFontSize(7.2)
  doc.setTextColor(...NAVY)
  doc.text(doc.splitTextToSize(value || '—', width - 18), x + 15, y + 13)
}

function drawGermanyMap(doc: JsPdfDoc, x: number, y: number, width: number, height: number, location: string, country: string) {
  doc.setFillColor(...MAP_BG)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'FD')
  doc.setDrawColor(218, 224, 199)
  doc.setLineWidth(0.25)
  for (let i = 1; i < 5; i += 1) doc.line(x, y + (height / 5) * i, x + width, y + (height / 5) * i)
  for (let i = 1; i < 6; i += 1) doc.line(x + (width / 6) * i, y, x + (width / 6) * i, y + height)

  const cx = x + width * 0.52
  const cy = y + height * 0.42
  const pts = [
    [0, -24], [7, -22], [11, -16], [17, -14], [15, -7], [20, -1], [16, 6], [19, 13], [12, 18], [10, 25], [2, 28],
    [-4, 25], [-10, 29], [-15, 22], [-22, 20], [-23, 12], [-28, 7], [-24, 0], [-27, -7], [-21, -12], [-19, -19], [-11, -20], [-6, -25],
  ]
  doc.setFillColor(231, 237, 207)
  doc.setDrawColor(200, 212, 166)
  const scaleX = width / 90
  const scaleY = height / 70
  const path = (doc as any).path as ((lines: Array<{ op: string; c: number[] }>, style?: string) => void) | undefined
  if (path) {
    const lines = pts.map((point, index) => ({ op: index === 0 ? 'm' : 'l', c: [cx + point[0] * scaleX, cy + point[1] * scaleY] }))
    lines.push({ op: 'h', c: [] })
    path.call(doc, lines, 'FD')
  } else {
    doc.ellipse(cx, cy, width * 0.22, height * 0.38, 'FD')
  }

  const markerX = cx + width * 0.12
  const markerY = cy - height * 0.08
  doc.setFillColor(255, 255, 255)
  doc.circle(markerX, markerY, 5, 'F')
  doc.setFillColor(...GREEN)
  doc.circle(markerX, markerY, 2.8, 'F')

  doc.setFillColor(255, 255, 255)
  doc.roundedRect(x + 4, y + height - 18, width - 8, 14, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  doc.setTextColor(...NAVY)
  doc.text(doc.splitTextToSize(location, width - 14), x + 7, y + height - 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.6)
  doc.setTextColor(...MUTED)
  doc.text(country, x + 7, y + height - 6)
}

function drawChart(doc: JsPdfDoc, x: number, y: number, width: number, height: number, purchasePrice: number, annualRevenue: number) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'FD')
  const left = x + 7
  const right = x + width - 5
  const top = y + 8
  const bottom = y + height - 7
  doc.setDrawColor(230, 234, 238)
  doc.setLineWidth(0.25)
  for (let i = 0; i <= 4; i += 1) {
    const gy = top + ((bottom - top) / 4) * i
    doc.line(left, gy, right, gy)
  }

  const years = 20
  const maxAbs = Math.max(purchasePrice, annualRevenue * years - purchasePrice, annualRevenue, 1)
  const zeroY = top + (bottom - top) * 0.58
  doc.setDrawColor(154, 168, 182)
  doc.line(left, zeroY, right, zeroY)

  doc.setFillColor(...GREEN)
  for (let year = 0; year <= years; year += 1) {
    const cashflow = year === 0 ? -purchasePrice : annualRevenue
    const barHeight = Math.max(0.8, Math.abs(cashflow / maxAbs) * (bottom - top) * 0.42)
    const bx = left + ((right - left) / years) * year
    doc.rect(bx - 0.7, cashflow >= 0 ? zeroY - barHeight : zeroY, 1.4, barHeight, 'F')
  }

  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.8)
  let previousX = left
  let previousY = zeroY + (purchasePrice / maxAbs) * (bottom - top) * 0.42
  for (let year = 1; year <= years; year += 1) {
    const cumulative = -purchasePrice + annualRevenue * year
    const px = left + ((right - left) / years) * year
    const py = zeroY - (cumulative / maxAbs) * (bottom - top) * 0.42
    doc.line(previousX, previousY, px, py)
    previousX = px
    previousY = py
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.8)
  doc.setTextColor(...MUTED)
  ;[0, 5, 10, 15, 20].forEach((year) => doc.text(String(year), left + ((right - left) / years) * year, y + height - 2.5, { align: 'center' }))
}

function drawFooter(doc: JsPdfDoc, data: MemorandumPdfData) {
  doc.setFillColor(...NAVY)
  doc.rect(0, 276, 210, 21, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('e', 13, 289)
  doc.setTextColor(...GREEN)
  doc.text('e', 21, 289)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.3)
  doc.line(31, 281, 31, 292)
  doc.setFontSize(5.3)
  doc.setTextColor(255, 255, 255)
  doc.text('EMA ENTERPRISE GmbH', 35, 287)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.8)
  doc.setTextColor(205, 214, 225)
  doc.text('EMA Enterprise GmbH · Gabriel-von-Seidl-Str. 56 · 67550 Worms', 78, 284.5)
  doc.text('www.ema-enterprise.de · info@ema-enterprise.de', 78, 290)
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.dateLabel)}`, 198, 287, { align: 'right' })
}

function renderPage(doc: JsPdfDoc, data: MemorandumPdfData, logo: LoadedImage | null, hero: LoadedImage | null, flag: LoadedImage | null) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 210, 297, 'F')
  addImageSafely(doc, logo, 12, 8, 27, 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('INVESTMENT', 198, 12, { align: 'right' })
  doc.text('MEMORANDUM', 198, 18, { align: 'right' })
  doc.setFontSize(6)
  doc.setTextColor(...GREEN)
  doc.text(safeText(data.typeLabel).toUpperCase(), 198, 23, { align: 'right' })

  doc.setFillColor(245, 247, 249)
  doc.rect(0, 28, 210, 68, 'F')
  if (hero) addImageSafely(doc, hero, 92, 28, 118, 68)
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 28, 98, 68, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...NAVY)
  doc.text('INVESTMENT', 13, 44)
  doc.text('MEMORANDUM', 13, 52)
  doc.setFontSize(6)
  doc.setTextColor(...GREEN)
  doc.text(safeText(data.typeLabel).toUpperCase(), 13, 60)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.9)
  doc.line(13, 65, 23, 65)
  doc.setFontSize(13)
  doc.setTextColor(...NAVY)
  doc.text(doc.splitTextToSize(safeText(data.projectName), 72), 13, 75)
  doc.setFontSize(5.5)
  doc.text(`PROJEKT-NR. ${safeText(data.projectNumber)}`, 13, 89)
  addImageSafely(doc, flag, 74, 85, 8, 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  doc.text(`${safeText(data.location)} · ${safeText(data.country)}`, flag ? 84 : 74, 89)

  const cardWidth = 59
  const cardGap = 4.5
  data.metrics.slice(0, 6).forEach((metric, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    metricCard(doc, 13 + col * (cardWidth + cardGap), 102 + row * 24, cardWidth, safeText(metric.label), safeText(metric.value), index)
  })

  sectionHeading(doc, 'Executive Summary', 13, 157)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(46, 58, 73)
  doc.text(doc.splitTextToSize(safeText(data.summary), 75), 13, 166)

  sectionHeading(doc, 'Projektprofil', 104, 157)
  data.profile.slice(0, 9).forEach((row, index) => {
    const py = 165 + index * 5.2
    doc.setDrawColor(...BORDER)
    doc.line(104, py + 1.8, 198, py + 1.8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row.label), 106, py)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(safeText(row.value), 44), 196, py, { align: 'right' })
  })

  sectionHeading(doc, 'Standort', 13, 205)
  drawGermanyMap(doc, 13, 212, 76, 50, data.location, data.country)

  sectionHeading(doc, 'Cashflow & Amortisation', 104, 205)
  const economics = data.pvEconomics
  drawChart(doc, 104, 212, 94, 50, economics?.purchasePrice ?? 0, economics?.annualRevenue ?? 0)

  if (economics) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.2)
    doc.setTextColor(...MUTED)
    doc.text('JAHRESERLÖS', 104, 269)
    doc.text('AMORTISATION', 138, 269)
    doc.text('RENDITE', 174, 269)
    doc.setFontSize(8)
    doc.setTextColor(...GREEN)
    doc.text(money(economics.annualRevenue), 104, 274)
    doc.text(`${number(economics.amortisation, 1)} J.`, 138, 274)
    doc.text(`${number(economics.roi, 1)} %`, 174, 274)
  }

  drawFooter(doc, data)
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
    throw new PdfGenerationError('Seite 1 erzeugen', 'Das einseitige Exposé konnte nicht erzeugt werden.', error)
  }
  try {
    return doc.output('blob')
  } catch (error) {
    throw new PdfGenerationError('Blob erzeugen', 'Die PDF-Datei konnte nicht fertiggestellt werden.', error)
  }
}
