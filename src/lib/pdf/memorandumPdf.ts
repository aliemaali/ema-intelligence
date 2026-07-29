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
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text(label.toUpperCase(), x, y)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.9)
  doc.line(x, y + 2, x + 14, y + 2)
}

function drawMetricIcon(doc: JsPdfDoc, label: string, cx: number, cy: number, highlighted: boolean) {
  const ink = highlighted ? [255, 255, 255] as [number, number, number] : NAVY
  const key = label.toLowerCase()
  doc.setDrawColor(...ink)
  doc.setTextColor(...ink)
  doc.setLineWidth(0.7)
  if (key.includes('amort') || key.includes('payback')) {
    doc.circle(cx, cy, 3.2, 'S')
    doc.line(cx, cy, cx, cy - 1.9)
    doc.line(cx, cy, cx + 1.5, cy + 1)
    return
  }
  if (key.includes('kaufpreis') || key.includes('purchase') || key.includes('investitions')) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('€', cx, cy + 2.4, { align: 'center' })
    return
  }
  if (key.includes('leistung') || key.includes('capacity') || key.includes('pv-')) {
    doc.line(cx + 1, cy - 3.2, cx - 1, cy)
    doc.line(cx - 1, cy, cx + 0.4, cy)
    doc.line(cx + 0.4, cy, cx - 1.2, cy + 3.2)
    doc.line(cx - 1.2, cy + 3.2, cx + 2, cy - 0.5)
    doc.line(cx + 2, cy - 0.5, cx + 0.6, cy - 0.5)
    return
  }
  if (key.includes('vergütung') || key.includes('tariff')) {
    doc.circle(cx, cy, 3.1, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.text('€', cx, cy + 2, { align: 'center' })
    return
  }
  if (key.includes('ertrag') || key.includes('yield') || key.includes('produktion')) {
    doc.line(cx - 3, cy + 2.5, cx - 1, cy + 0.5)
    doc.line(cx - 1, cy + 0.5, cx + 0.5, cy + 1.3)
    doc.line(cx + 0.5, cy + 1.3, cx + 3, cy - 2.4)
    doc.line(cx + 1.2, cy - 2.4, cx + 3, cy - 2.4)
    doc.line(cx + 3, cy - 2.4, cx + 3, cy - 0.6)
    return
  }
  doc.roundedRect(cx - 3, cy - 3, 6, 6, 1, 1, 'S')
  doc.line(cx - 1.6, cy + 1.6, cx - 1.6, cy - 0.8)
  doc.line(cx, cy + 1.6, cx, cy - 2)
  doc.line(cx + 1.6, cy + 1.6, cx + 1.6, cy - 0.1)
}

function metricCard(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string, highlighted = false) {
  if (highlighted) {
    doc.setFillColor(...GREEN)
    doc.setDrawColor(...GREEN)
  } else {
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...BORDER)
  }
  doc.roundedRect(x, y, width, 23, 2.5, 2.5, 'FD')
  doc.setFillColor(...(highlighted ? [76, 154, 0] as [number, number, number] : [239, 244, 247] as [number, number, number]))
  doc.circle(x + 8, y + 8.2, 5, 'F')
  drawMetricIcon(doc, label, x + 8, y + 8.2, highlighted)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.8)
  doc.setTextColor(...(highlighted ? [235, 255, 220] as [number, number, number] : MUTED))
  doc.text(label.toUpperCase(), x + 15, y + 6.4)
  doc.setFontSize(9)
  doc.setTextColor(...(highlighted ? [255, 255, 255] as [number, number, number] : NAVY))
  doc.text(doc.splitTextToSize(value, width - 18), x + 15, y + 13)
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
  doc.roundedRect(x, y + 2, width, 3.3, 1.6, 1.6, 'F')
  doc.setFillColor(...GREEN)
  doc.roundedRect(x, y + 2, Math.max(0, Math.min(width, width * percentage / 100)), 3.3, 1.6, 1.6, 'F')
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
  addImageSafely(doc, logo, MARGIN, 7, 34, 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(...NAVY)
  doc.text('INVESTMENT MEMORANDUM', PAGE_W - MARGIN, 13, { align: 'right' })
  doc.setFontSize(6.5)
  doc.setTextColor(...GREEN)
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.typeLabel)}`.toUpperCase(), PAGE_W - MARGIN, 19, { align: 'right' })
  const heroY = 25
  const heroH = 70
  doc.setFillColor(...NAVY)
  doc.roundedRect(MARGIN, heroY, CONTENT_W, heroH, 3, 3, 'F')
  if (hero) addImageSafely(doc, hero, 82, heroY, 116, heroH)
  doc.setFillColor(...NAVY)
  doc.rect(MARGIN, heroY, 76, heroH, 'F')
  doc.setFillColor(...GREEN)
  doc.roundedRect(19, 34, 49, 7.5, 2, 2, 'F')
  doc.setFontSize(6.8)
  doc.setTextColor(255, 255, 255)
  doc.text(safeText(data.typeLabel).toUpperCase(), 43.5, 39, { align: 'center' })
  doc.setFontSize(18)
  doc.text(doc.splitTextToSize(safeText(data.projectName, 'Projekt'), 54), 19, 54)
  doc.setFontSize(7)
  addImageSafely(doc, flag, 19, 80, 8, 5)
  doc.text(`${safeText(data.location)} · ${safeText(data.country)} · ${safeText(data.status)}`, flag ? 30 : 19, 84)
  const metrics = data.metrics.filter((item) => hasValue(item.value) && !item.label.toLowerCase().includes('pachtdauer')).slice(0, 5)
  const cardGap = 2
  const cardW = (CONTENT_W - cardGap * Math.max(0, metrics.length - 1)) / Math.max(1, metrics.length)
  metrics.forEach((metric, index) => {
    const highlighted = metric.label.toLowerCase().includes('amort') || metric.label.toLowerCase().includes('payback')
    metricCard(doc, MARGIN + index * (cardW + cardGap), 101, cardW, safeText(metric.label), safeText(metric.value), highlighted)
  })
  const leftX = MARGIN
  const rightX = 108
  heading(doc, 'Executive Summary', leftX, 137)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(40, 52, 68)
  doc.text(doc.splitTextToSize(safeText(data.summary), 86), leftX, 147)
  heading(doc, 'Projektprofil', rightX, 137)
  data.profile.filter((row) => hasValue(row.value)).slice(0, 5).forEach((row, index) => {
    const y = 147 + index * 8
    doc.setDrawColor(...BORDER)
    doc.line(rightX, y + 2.7, PAGE_W - MARGIN, y + 2.7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.2)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row.label), rightX + 1, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(safeText(row.value), 40), PAGE_W - MARGIN - 1, y, { align: 'right' })
  })
  heading(doc, 'Visuelle Wirtschaftlichkeit', leftX, 194)
  if (data.showPvEconomics && data.pvEconomics) {
    const e = data.pvEconomics
    if (e.roi > 0) economyBar(doc, leftX, 204, 84, 'Rendite p.a.', `${number(e.roi, 2)} %`, Math.min(100, e.roi * 7))
    if (e.amortisation > 0) economyBar(doc, leftX, 216, 84, 'Amortisation', `${number(e.amortisation, 1)} Jahre`, Math.max(8, 100 - e.amortisation * 4))
    if (e.annualRevenue > 0) economyBar(doc, leftX, 228, 84, 'Jahreserlös', money(e.annualRevenue), e.purchasePrice > 0 ? Math.min(100, e.annualRevenue / e.purchasePrice * 700) : 0)
  }
  heading(doc, 'Investment Highlights', rightX, 194)
  data.highlights.filter(hasValue).slice(0, 4).forEach((highlight, index) => {
    const y = 203 + index * 12
    doc.setFillColor(...LIGHT)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(rightX, y - 4, 90, 10, 2, 2, 'FD')
    doc.setFillColor(...GREEN)
    doc.circle(rightX + 4, y, 1.2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.1)
    doc.setTextColor(40, 52, 68)
    doc.text(doc.splitTextToSize(safeText(highlight), 80), rightX + 7, y + 1)
  })
  heading(doc, data.showPvEconomics ? 'Wirtschaftliche Kennzahlen' : 'Projektkennzahlen', leftX, 252)
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
    const x = leftX + col * 62
    const y = 262 + line * 10
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
