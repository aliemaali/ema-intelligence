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
const DARK_GREEN: [number, number, number] = [24, 108, 50]
const BORDER: [number, number, number] = [218, 226, 232]
const MUTED: [number, number, number] = [90, 104, 120]
const LIGHT: [number, number, number] = [247, 249, 250]
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 8
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

function hasValue(value: unknown) {
  const text = safeText(value, '').trim().toLowerCase()
  return Boolean(text && text !== '—' && text !== 'noch offen' && text !== 'pending' && text !== 'not available')
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
  doc.setFontSize(7.3)
  doc.setTextColor(...NAVY)
  doc.text(label.toUpperCase(), x, y)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.8)
  doc.line(x, y + 1.8, x + 12, y + 1.8)
}

function drawIcon(doc: JsPdfDoc, label: string, cx: number, cy: number, highlighted = false) {
  const key = label.toLowerCase()
  const ink = highlighted ? [255, 255, 255] as [number, number, number] : DARK_GREEN
  doc.setDrawColor(...ink)
  doc.setTextColor(...ink)
  doc.setLineWidth(0.8)

  if (key.includes('amort')) {
    doc.circle(cx, cy, 4.1, 'S')
    doc.line(cx, cy, cx, cy - 2.5)
    doc.line(cx, cy, cx + 2, cy + 1.2)
    return
  }
  if (key.includes('kaufpreis')) {
    doc.roundedRect(cx - 3.5, cy - 2.5, 7, 5.5, 0.8, 0.8, 'S')
    doc.line(cx - 1.7, cy - 2.5, cx - 1.7, cy - 4)
    doc.line(cx + 1.7, cy - 2.5, cx + 1.7, cy - 4)
    doc.line(cx - 1.7, cy - 4, cx + 1.7, cy - 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text('€', cx, cy + 1.7, { align: 'center' })
    return
  }
  if (key.includes('vergütung')) {
    doc.circle(cx - 1, cy, 3.6, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text('€', cx - 1, cy + 1.8, { align: 'center' })
    doc.line(cx + 2.7, cy + 2.6, cx + 4.4, cy + 2.6)
    doc.line(cx + 2.7, cy + 0.8, cx + 4.4, cy + 0.8)
    doc.line(cx + 2.7, cy - 1, cx + 4.4, cy - 1)
    return
  }
  if (key.includes('ertrag') || key.includes('rendite')) {
    doc.line(cx - 4, cy + 3, cx - 1.3, cy + 0.7)
    doc.line(cx - 1.3, cy + 0.7, cx + 0.8, cy + 1.8)
    doc.line(cx + 0.8, cy + 1.8, cx + 4, cy - 3)
    doc.line(cx + 1.8, cy - 3, cx + 4, cy - 3)
    doc.line(cx + 4, cy - 3, cx + 4, cy - 0.8)
    return
  }
  if (key.includes('leistung') || key.includes('produktion')) {
    doc.line(cx - 4, cy + 2.7, cx - 3, cy - 2.7)
    doc.line(cx - 3, cy - 2.7, cx + 2.4, cy - 2.7)
    doc.line(cx + 2.4, cy - 2.7, cx + 3.5, cy + 2.7)
    doc.line(cx + 3.5, cy + 2.7, cx - 4, cy + 2.7)
    doc.line(cx - 2.5, cy - 0.8, cx + 2.8, cy - 0.8)
    doc.line(cx - 2.8, cy + 0.9, cx + 3.1, cy + 0.9)
    doc.line(cx, cy + 2.7, cx, cy + 4)
    doc.line(cx - 2, cy + 4, cx + 2, cy + 4)
    return
  }
  doc.circle(cx, cy, 3.5, 'S')
}

function metricCard(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string, highlighted = false) {
  if (highlighted) {
    doc.setFillColor(...GREEN)
    doc.setDrawColor(...GREEN)
  } else {
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...BORDER)
  }
  doc.roundedRect(x, y, width, 35, 2.5, 2.5, 'FD')
  drawIcon(doc, label, x + width / 2, y + 9, highlighted)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.7)
  doc.setTextColor(...(highlighted ? [255, 255, 255] as [number, number, number] : NAVY))
  doc.text(label.toUpperCase(), x + width / 2, y + 18, { align: 'center' })
  doc.setFontSize(10.2)
  doc.text(doc.splitTextToSize(value, width - 5), x + width / 2, y + 25, { align: 'center' })
}

function economyBar(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string, percentage: number) {
  drawIcon(doc, label, x + 4, y + 1.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.setTextColor(...MUTED)
  doc.text(label, x + 11, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY)
  doc.text(value, x + width, y, { align: 'right' })
  doc.setFillColor(232, 236, 240)
  doc.roundedRect(x + 11, y + 2, width - 11, 3, 1.5, 1.5, 'F')
  doc.setFillColor(...GREEN)
  doc.roundedRect(x + 11, y + 2, Math.max(0, Math.min(width - 11, (width - 11) * percentage / 100)), 3, 1.5, 1.5, 'F')
}

function footer(doc: JsPdfDoc, data: MemorandumPdfData) {
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, 282, PAGE_W - MARGIN, 282)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  doc.setTextColor(...MUTED)
  doc.text('EMA Enterprise GmbH · Gabriel-von-Seidl-Str. 56 · 67550 Worms', MARGIN, 287)
  doc.text('info@ema-enterprise.de · www.ema-enterprise.de', PAGE_W / 2, 287, { align: 'center' })
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.dateLabel)}`, PAGE_W - MARGIN, 287, { align: 'right' })
}

function renderPage(doc: JsPdfDoc, data: MemorandumPdfData, logo: LoadedImage | null, hero: LoadedImage | null, flag: LoadedImage | null) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  addImageSafely(doc, logo, MARGIN, 5, 31, 13)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('INVESTMENT MEMORANDUM', PAGE_W - MARGIN, 11, { align: 'right' })
  doc.setFontSize(6.4)
  doc.setTextColor(...GREEN)
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.typeLabel)}`.toUpperCase(), PAGE_W - MARGIN, 17, { align: 'right' })

  const heroY = 23
  const heroH = 71
  doc.setFillColor(...NAVY)
  doc.roundedRect(MARGIN, heroY, CONTENT_W, heroH, 3, 3, 'F')
  if (hero) addImageSafely(doc, hero, 88, heroY, PAGE_W - MARGIN - 88, heroH)
  doc.setFillColor(...NAVY)
  doc.roundedRect(MARGIN, heroY, 86, heroH, 3, 3, 'F')
  doc.setFillColor(...GREEN)
  doc.roundedRect(14, 31, 39, 7, 1.7, 1.7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  doc.setTextColor(255, 255, 255)
  doc.text(safeText(data.typeLabel).toUpperCase(), 33.5, 35.7, { align: 'center' })
  doc.setFontSize(18)
  doc.text(doc.splitTextToSize(safeText(data.projectName, 'Projekt'), 67), 14, 51)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.8)
  doc.line(14, 61, 27, 61)
  addImageSafely(doc, flag, 14, 71, 9, 6)
  doc.setFontSize(7)
  doc.text(safeText(data.location), flag ? 27 : 14, 75)
  doc.text(`${safeText(data.country)} · ${safeText(data.status)}`, flag ? 27 : 14, 81)

  const metrics = data.metrics.filter((item) => hasValue(item.value) && !item.label.toLowerCase().includes('pachtdauer')).slice(0, 5)
  const gap = 2.5
  const cardW = (CONTENT_W - gap * 4) / 5
  metrics.forEach((metric, index) => {
    metricCard(doc, MARGIN + index * (cardW + gap), 99, cardW, safeText(metric.label), safeText(metric.value), metric.label.toLowerCase().includes('amort'))
  })

  const leftX = MARGIN
  const rightX = 101
  heading(doc, 'Executive Summary', leftX, 145)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(40, 52, 68)
  doc.text(doc.splitTextToSize(safeText(data.summary), 83), leftX, 154)

  heading(doc, 'Projektprofil', rightX, 145)
  data.profile.filter((row) => hasValue(row.value)).slice(0, 5).forEach((row, index) => {
    const y = 154 + index * 7.8
    doc.setDrawColor(...BORDER)
    doc.line(rightX, y + 2.5, PAGE_W - MARGIN, y + 2.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row.label), rightX + 1, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(safeText(row.value), 39), PAGE_W - MARGIN - 1, y, { align: 'right' })
  })

  heading(doc, 'Visuelle Wirtschaftlichkeit', leftX, 196)
  if (data.showPvEconomics && data.pvEconomics) {
    const e = data.pvEconomics
    if (e.roi > 0) economyBar(doc, leftX, 206, 87, 'Rendite p.a.', `${number(e.roi, 2)} %`, Math.min(100, e.roi * 7))
    if (e.amortisation > 0) economyBar(doc, leftX, 218, 87, 'Amortisation', `${number(e.amortisation, 1)} Jahre`, Math.max(8, 100 - e.amortisation * 4))
    if (e.annualRevenue > 0) economyBar(doc, leftX, 230, 87, 'Jahreserlös', money(e.annualRevenue), e.purchasePrice > 0 ? Math.min(100, e.annualRevenue / e.purchasePrice * 700) : 0)
  }

  heading(doc, 'Investment Highlights', rightX, 196)
  data.highlights.filter(hasValue).slice(0, 4).forEach((highlight, index) => {
    const y = 205 + index * 10.6
    doc.setFillColor(...LIGHT)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(rightX, y - 4.5, PAGE_W - MARGIN - rightX, 9, 2, 2, 'FD')
    doc.setFillColor(...DARK_GREEN)
    doc.circle(rightX + 4, y, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.text('✓', rightX + 4, y + 1.8, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.9)
    doc.setTextColor(40, 52, 68)
    doc.text(doc.splitTextToSize(safeText(highlight), PAGE_W - MARGIN - rightX - 10), rightX + 8, y + 1)
  })

  heading(doc, data.showPvEconomics ? 'Wirtschaftliche Kennzahlen' : 'Projektkennzahlen', leftX, 251)
  doc.setFillColor(...LIGHT)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(leftX, 255, CONTENT_W, 23, 2.5, 2.5, 'FD')

  const details = data.showPvEconomics && data.pvEconomics ? [
    data.pvEconomics.annualYield > 0 ? ['Jahresproduktion', `${number(data.pvEconomics.annualYield)} kWh`] : null,
    data.pvEconomics.annualRevenue > 0 ? ['Jahreserlös', money(data.pvEconomics.annualRevenue)] : null,
    data.pvEconomics.purchasePrice > 0 ? ['Kaufpreis', money(data.pvEconomics.purchasePrice)] : null,
    data.pvEconomics.tariffEurKwh > 0 ? ['Vergütung', `${number(data.pvEconomics.tariffEurKwh, 3)} €/kWh`] : null,
    data.pvEconomics.roi > 0 ? ['Rendite p.a.', `${number(data.pvEconomics.roi, 2)} %`] : null,
    data.pvEconomics.amortisation > 0 ? ['Amortisation', `${number(data.pvEconomics.amortisation, 1)} Jahre`] : null,
  ].filter(Boolean) as string[][] : data.metrics.filter((item) => hasValue(item.value)).slice(0, 6).map((item) => [item.label, item.value])

  details.slice(0, 6).forEach((row, index) => {
    const col = index % 3
    const line = Math.floor(index / 3)
    const x = leftX + col * (CONTENT_W / 3)
    const y = 262 + line * 10
    drawIcon(doc, row[0], x + 7, y + 1)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.4)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row[0]).toUpperCase(), x + 15, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...NAVY)
    doc.text(safeText(row[1]), x + 15, y + 4.8)
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
