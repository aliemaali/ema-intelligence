import { jsPDF } from 'jspdf'

export type PlaudNotePdfData = {
  title: string
  recordedAt: string | null
  durationMs: number | null
  language: 'de' | 'original'
  sourceLanguage: string | null
  summary: string
  transcript: string
  translationPending?: boolean
}

export type PlaudNotePdfAssets = {
  logoDataUrl?: string
  regularFontBase64?: string
  semiBoldFontBase64?: string
  boldFontBase64?: string
}

const COLORS = {
  navy: [31, 42, 68] as const,
  deepNavy: [7, 20, 47] as const,
  green: [92, 184, 0] as const,
  body: [51, 65, 85] as const,
  muted: [105, 116, 133] as const,
  border: [222, 228, 236] as const,
  panel: [247, 249, 252] as const,
}

const PAGE = { width: 210, height: 297, margin: 18, footerTop: 280 }

function cleanText(value: string) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
}

function configureFonts(doc: jsPDF, assets?: PlaudNotePdfAssets) {
  if (!assets?.regularFontBase64 || !assets.semiBoldFontBase64 || !assets.boldFontBase64) return 'helvetica'
  doc.addFileToVFS('Inter-Regular.ttf', assets.regularFontBase64)
  doc.addFileToVFS('Inter-SemiBold.ttf', assets.semiBoldFontBase64)
  doc.addFileToVFS('Inter-Bold.ttf', assets.boldFontBase64)
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  doc.addFont('Inter-SemiBold.ttf', 'Inter', 'bold')
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bolditalic')
  return 'Inter'
}

function dateLabel(value: string | null) {
  if (!value) return 'Datum nicht verfügbar'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Datum nicht verfügbar'
    : date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
}

function durationLabel(value: number | null) {
  if (!value) return ''
  const minutes = Math.max(1, Math.round(value / 60_000))
  return minutes < 60 ? `${minutes} Min.` : `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min.`
}

export function safePlaudPdfFilename(value: string, language: 'de' | 'original') {
  const title = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72)
  return `EMA-PLAUD-${title || 'Meeting'}-${language === 'de' ? 'DE' : 'Original'}.pdf`
}

export function buildPlaudNotePdf(data: PlaudNotePdfData, assets?: PlaudNotePdfAssets) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true })
  const font = configureFonts(doc, assets)
  const contentWidth = PAGE.width - PAGE.margin * 2
  const lineHeight = 4.75
  let y = 0

  const drawBrand = (continuation = false) => {
    doc.setFillColor(...COLORS.green)
    doc.rect(0, 0, PAGE.width, 3, 'F')
    if (assets?.logoDataUrl) {
      doc.addImage(assets.logoDataUrl, 'PNG', PAGE.margin, 10, 39, 18.1, 'EMA_PLAUD_LOGO', 'FAST')
    } else {
      doc.setFont(font, 'bold')
      doc.setFontSize(17)
      doc.setTextColor(...COLORS.deepNavy)
      doc.text('EMA', PAGE.margin, 21)
      doc.setFontSize(6.5)
      doc.setTextColor(...COLORS.muted)
      doc.text('ENTERPRISE GMBH', PAGE.margin, 27)
    }
    doc.setFont(font, 'bold')
    doc.setFontSize(7.4)
    doc.setTextColor(...COLORS.green)
    doc.text('PLAUD GESPRÄCHSNOTIZ', PAGE.width - PAGE.margin, 17, { align: 'right' })
    doc.setFont(font, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.muted)
    doc.text(continuation ? 'FORTSETZUNG' : data.language === 'de' ? 'DEUTSCHE FASSUNG' : 'ORIGINALFASSUNG', PAGE.width - PAGE.margin, 23, { align: 'right' })
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.35)
    doc.line(PAGE.margin, 34, PAGE.width - PAGE.margin, 34)
    doc.setDrawColor(...COLORS.green)
    doc.setLineWidth(1.1)
    doc.line(PAGE.margin, 34, 50, 34)
    y = 44
  }

  const addPage = () => {
    doc.addPage()
    drawBrand(true)
  }

  const ensureSpace = (height: number) => {
    if (y + height > PAGE.footerTop - 4) addPage()
  }

  const heading = (label: string) => {
    ensureSpace(16)
    doc.setFont(font, 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...COLORS.deepNavy)
    doc.text(label, PAGE.margin, y)
    doc.setFillColor(...COLORS.green)
    doc.rect(PAGE.margin, y + 4, 22, 1.1, 'F')
    y += 12
  }

  const paragraph = (value: string) => {
    const paragraphs = cleanText(value).split(/\n{2,}/)
    doc.setFont(font, 'normal')
    doc.setFontSize(9.2)
    doc.setTextColor(...COLORS.body)
    for (const block of paragraphs) {
      const normalized = block.replace(/\n/g, ' ').trim()
      if (!normalized) continue
      const lines = doc.splitTextToSize(normalized, contentWidth) as string[]
      let offset = 0
      while (offset < lines.length) {
        if (y + lineHeight > PAGE.footerTop - 4) {
          addPage()
          doc.setFont(font, 'normal')
          doc.setFontSize(9.2)
          doc.setTextColor(...COLORS.body)
        }
        const available = Math.max(1, Math.floor((PAGE.footerTop - 4 - y) / lineHeight))
        const pageLines = lines.slice(offset, offset + available)
        doc.text(pageLines, PAGE.margin, y, { lineHeightFactor: 1.42, maxWidth: contentWidth })
        y += pageLines.length * lineHeight
        offset += pageLines.length
      }
      y += 3.5
    }
  }

  drawBrand()
  doc.setFont(font, 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...COLORS.deepNavy)
  const titleLines = (doc.splitTextToSize(cleanText(data.title) || 'PLAUD-Meeting', contentWidth) as string[]).slice(0, 4)
  doc.text(titleLines, PAGE.margin, y, { lineHeightFactor: 1.15 })
  y += titleLines.length * 9.5 + 3
  doc.setFont(font, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLORS.muted)
  const meta = [dateLabel(data.recordedAt), durationLabel(data.durationMs)].filter(Boolean).join(' · ')
  doc.text(meta, PAGE.margin, y)
  y += 10

  doc.setFillColor(...COLORS.panel)
  doc.setDrawColor(...COLORS.border)
  doc.roundedRect(PAGE.margin, y, contentWidth, 13, 3, 3, 'FD')
  doc.setFont(font, 'bold')
  doc.setFontSize(7.4)
  doc.setTextColor(...COLORS.green)
  doc.text(data.language === 'de' ? 'DEUTSCH' : `ORIGINAL${data.sourceLanguage ? ` · ${data.sourceLanguage.toUpperCase()}` : ''}`, PAGE.margin + 5, y + 8.2)
  y += 23

  heading('Zusammenfassung')
  paragraph(data.summary || 'Keine Zusammenfassung verfügbar.')

  if (data.transcript) {
    y += 2
    heading('Vollständiges Transkript')
    paragraph(data.transcript)
  } else if (data.translationPending && data.language === 'de') {
    ensureSpace(25)
    doc.setFillColor(239, 248, 231)
    doc.roundedRect(PAGE.margin, y, contentWidth, 20, 3, 3, 'F')
    doc.setFont(font, 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(47, 125, 0)
    doc.text('Das deutsche Transkript wird noch erstellt.', PAGE.margin + 5, y + 8)
    doc.setFont(font, 'normal')
    doc.setTextColor(...COLORS.body)
    doc.text('Das Original ist bereits über die Originalfassung verfügbar.', PAGE.margin + 5, y + 14)
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.25)
    doc.line(PAGE.margin, 283, PAGE.width - PAGE.margin, 283)
    doc.setFont(font, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.muted)
    doc.text('EMA Enterprise GmbH · Vertrauliche PLAUD-Gesprächsnotiz', PAGE.margin, 289)
    doc.text(`${page} / ${pages}`, PAGE.width - PAGE.margin, 289, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
