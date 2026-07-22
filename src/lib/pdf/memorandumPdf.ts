export interface MemorandumPdfData {
  projectName: string
  projectNumber: string
  projectType: string
  typeLabel: string
  location: string
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

export type PdfGenerationStep =
  | 'Daten prüfen'
  | 'jsPDF laden'
  | 'Bilder laden'
  | 'Seite 1 erzeugen'
  | 'Seite 2 erzeugen'
  | 'Blob erzeugen'

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
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safeNumber(value))
}

function money(value: unknown) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(safeNumber(value))
}

function assertValidData(data: MemorandumPdfData) {
  if (!data || typeof data !== 'object') {
    throw new PdfGenerationError('Daten prüfen', 'Es wurden keine Projektdaten übergeben.')
  }
  if (!safeText(data.projectName, '').trim()) {
    throw new PdfGenerationError('Daten prüfen', 'Der Projektname fehlt.')
  }
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
  try {
    doc.addImage(image.dataUrl, image.format, x, y, width, height, undefined, 'FAST')
  } catch {
    // A malformed optional image must never abort the PDF.
  }
}

function footer(doc: JsPdfDoc, page: number) {
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(12, 198, 285, 198)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text('EMA Enterprise GmbH · Gabriel-von-Seidl-Str. 56 · 67550 Worms', 12, 203)
  doc.text('www.ema-enterprise.de · info@ema-enterprise.de', 148.5, 203, { align: 'center' })
  doc.text(String(page), 285, 203, { align: 'right' })
}

function sectionHeading(doc: JsPdfDoc, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text(label.toUpperCase(), x, y)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.8)
  doc.line(x, y + 2, x + 15, y + 2)
}

function metricCard(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string) {
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(x, y, width, 19, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.4)
  doc.setTextColor(...GREEN)
  doc.text(label.toUpperCase(), x + width / 2, y + 6, { align: 'center' })
  doc.setTextColor(...NAVY)
  doc.setFontSize(9)
  const lines = doc.splitTextToSize(value || '—', width - 6)
  doc.text(lines, x + width / 2, y + 12.5, { align: 'center' })
}

function renderPageOne(doc: JsPdfDoc, data: MemorandumPdfData, logo: LoadedImage | null, hero: LoadedImage | null) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 297, 210, 'F')

  addImageSafely(doc, logo, 12, 8, 34, 15)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text('INVESTMENT MEMORANDUM', 285, 13, { align: 'right' })
  doc.setFontSize(8)
  doc.setTextColor(...GREEN)
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.typeLabel)}`.toUpperCase(), 285, 19, { align: 'right' })

  doc.setFillColor(...NAVY)
  doc.rect(12, 28, 273, 62, 'F')
  if (hero) {
    addImageSafely(doc, hero, 126, 28, 159, 62)
    doc.setFillColor(255, 255, 255)
    doc.setGState(new (doc as any).GState({ opacity: 0.1 }))
    doc.rect(126, 28, 159, 62, 'F')
    doc.setGState(new (doc as any).GState({ opacity: 1 }))
  } else {
    doc.setFillColor(20, 42, 76)
    doc.rect(126, 28, 159, 62, 'F')
    doc.setDrawColor(...GREEN)
    doc.setLineWidth(1.2)
    for (let offset = 0; offset < 150; offset += 18) doc.line(126 + offset, 90, 170 + offset, 28)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(23)
  doc.setTextColor(255, 255, 255)
  doc.text(doc.splitTextToSize(safeText(data.projectName, 'Projekt'), 100), 21, 46)
  doc.setFontSize(9)
  doc.setTextColor(...GREEN)
  doc.text(safeText(data.typeLabel).toUpperCase(), 21, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text(safeText(data.location, 'Deutschland'), 21, 70)
  doc.text(safeText(data.dateLabel), 21, 76)
  doc.text(safeText(data.status, 'Projektstatus offen'), 21, 82)

  const metrics = data.metrics.slice(0, 6)
  const cardWidth = 273 / Math.max(metrics.length, 1)
  metrics.forEach((metric, index) => {
    metricCard(doc, 12 + index * cardWidth, 94, cardWidth, safeText(metric.label), safeText(metric.value))
  })

  sectionHeading(doc, 'Executive Summary', 12, 121)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(40, 52, 68)
  doc.text(doc.splitTextToSize(safeText(data.summary), 128), 12, 131)

  sectionHeading(doc, 'Projektprofil', 151, 121)
  data.profile.slice(0, 6).forEach((row, index) => {
    const y = 131 + index * 8.2
    doc.setDrawColor(...BORDER)
    doc.line(151, y + 3.2, 285, y + 3.2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.2)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row.label), 153, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(safeText(row.value), 78), 283, y, { align: 'right' })
  })

  sectionHeading(doc, data.showPvEconomics ? 'Wirtschaftliche Kennzahlen' : 'Projektkennzahlen', 12, 173)
  const details = data.showPvEconomics && data.pvEconomics
    ? [
        ['Jahresproduktion', `${number(data.pvEconomics.annualYield)} kWh`],
        ['Jahreserlös', money(data.pvEconomics.annualRevenue)],
        ['Kaufpreis', money(data.pvEconomics.purchasePrice)],
        ['Vergütung', `${number(data.pvEconomics.tariffEurKwh, 3)} €/kWh`],
        ['Rendite p.a.', `${number(data.pvEconomics.roi, 2)} %`],
        ['Amortisation', `${number(data.pvEconomics.amortisation, 1)} Jahre`],
      ]
    : data.metrics.slice(0, 6).map((item) => [item.label, item.value])

  details.slice(0, 6).forEach((row, index) => {
    const y = 181 + index * 2.4
    doc.setFont('helvetica', index === 0 ? 'bold' : 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(index === 0 ? NAVY[0] : MUTED[0], index === 0 ? NAVY[1] : MUTED[1], index === 0 ? NAVY[2] : MUTED[2])
    doc.text(safeText(row[0]), 14, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(safeText(row[1]), 140, y, { align: 'right' })
  })

  sectionHeading(doc, 'Investment Highlights', 151, 173)
  const highlights = data.highlights.length ? data.highlights : ['Projektunterlagen und Kennzahlen werden laufend ergänzt.']
  highlights.slice(0, 5).forEach((highlight, index) => {
    const y = 181 + index * 3.1
    doc.setFillColor(...GREEN)
    doc.circle(154, y - 1.1, 0.8, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(40, 52, 68)
    doc.text(doc.splitTextToSize(safeText(highlight), 124), 158, y)
  })

  footer(doc, 1)
}

function renderPageTwo(doc: JsPdfDoc, data: MemorandumPdfData, logo: LoadedImage | null) {
  doc.addPage('a4', 'landscape')
  doc.setFillColor(247, 249, 250)
  doc.rect(0, 0, 297, 210, 'F')
  addImageSafely(doc, logo, 12, 8, 34, 15)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text('PROJEKTDETAILS & TRANSAKTIONSPROZESS', 285, 14, { align: 'right' })
  doc.setFontSize(8)
  doc.setTextColor(...GREEN)
  doc.text(`${safeText(data.projectNumber)} · ${safeText(data.projectName)}`.toUpperCase(), 285, 20, { align: 'right' })

  sectionHeading(doc, 'Vollständige Projektkennzahlen', 12, 36)
  const rows = [...data.metrics, ...data.profile]
  rows.slice(0, 12).forEach((row, index) => {
    const column = index >= 6 ? 1 : 0
    const rowIndex = index % 6
    const x = column === 0 ? 12 : 151
    const y = 47 + rowIndex * 17
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(x, y, 134, 13, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(safeText(row.label), x + 4, y + 5.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(safeText(row.value), 72), x + 130, y + 5.5, { align: 'right' })
  })

  sectionHeading(doc, 'Transaktionsprozess', 12, 159)
  const process = [
    ['1', 'Interessenbekundung & NDA'],
    ['2', 'Datenraum & Q&A'],
    ['3', 'Indikatives Angebot'],
    ['4', 'Bestätigende Due Diligence'],
    ['5', 'Signing & Closing'],
  ]
  process.forEach(([numberLabel, label], index) => {
    const x = 12 + index * 54.6
    doc.setFillColor(...NAVY)
    doc.circle(x + 5, 173, 5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text(numberLabel, x + 5, 175.5, { align: 'center' })
    doc.setFontSize(7)
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(label, 41), x + 12, 171)
    if (index < process.length - 1) {
      doc.setDrawColor(...GREEN)
      doc.setLineWidth(0.8)
      doc.line(x + 45, 173, x + 53, 173)
    }
  })

  footer(doc, 2)
}

export async function generateMemorandumPdf(data: MemorandumPdfData): Promise<Blob> {
  assertValidData(data)
  const JsPDF = await loadJsPdfConstructor()

  let logo: LoadedImage | null = null
  let hero: LoadedImage | null = null
  try {
    ;[logo, hero] = await Promise.all([
      loadImageAsDataUrl('/ema-logo.jpeg'),
      loadImageAsDataUrl(data.heroImage),
    ])
  } catch (error) {
    throw new PdfGenerationError('Bilder laden', 'Die PDF-Bilder konnten nicht geladen werden.', error)
  }

  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })

  try {
    renderPageOne(doc, data, logo, hero)
  } catch (error) {
    throw new PdfGenerationError('Seite 1 erzeugen', 'Die erste PDF-Seite konnte nicht erzeugt werden.', error)
  }

  try {
    renderPageTwo(doc, data, logo)
  } catch (error) {
    throw new PdfGenerationError('Seite 2 erzeugen', 'Die zweite PDF-Seite konnte nicht erzeugt werden.', error)
  }

  try {
    return doc.output('blob')
  } catch (error) {
    throw new PdfGenerationError('Blob erzeugen', 'Die PDF-Datei konnte nicht fertiggestellt werden.', error)
  }
}
