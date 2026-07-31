import { jsPDF } from 'jspdf'
import type { ProjectAuditRecord } from '@/lib/actions/project-audit.actions'

export type Severity = 'ok' | 'warning' | 'error' | 'missing'
export interface CheckResult { severity: Severity; label: string; detail: string }
export interface ProjectAuditEvaluation {
  project: ProjectAuditRecord
  checks: CheckResult[]
  worst: Severity
  affectedCount: number
  pricePerKwp: number | null
}

const money = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

function relDiff(a: number, b: number) {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1)
}

export function statusRank(value: Severity) {
  return value === 'error' ? 3 : value === 'missing' ? 2 : value === 'warning' ? 1 : 0
}

export function projectPricePerKwp(project: ProjectAuditRecord) {
  const amount = project.purchasePrice ?? project.investmentVolume
  return amount && project.pvKwp ? amount / project.pvKwp : null
}

export function checkProject(project: ProjectAuditRecord): CheckResult[] {
  const checks: CheckResult[] = []
  const isPv = ['pv_dach', 'pv_freiflaeche', 'hybrid'].includes(project.projectType)
  const isBess = ['bess', 'hybrid'].includes(project.projectType)

  const add = (severity: Severity, label: string, detail: string) => checks.push({ severity, label, detail })

  if (isPv) {
    if (!project.pvKwp) add('missing', 'PV-Leistung', 'Wert fehlt')
    else if (project.pvKwp < 10 || project.pvKwp > 2_000_000) add('error', 'PV-Leistung', `${number.format(project.pvKwp)} kWp wirkt unplausibel`)
    else add('ok', 'PV-Leistung', `${number.format(project.pvKwp)} kWp`)

    if (!project.specificYield) add('missing', 'Spezifischer Ertrag', 'Wert fehlt')
    else if (project.specificYield < 650 || project.specificYield > 1_500) add('warning', 'Spezifischer Ertrag', `${number.format(project.specificYield)} kWh/kWp prüfen`)
    else add('ok', 'Spezifischer Ertrag', `${number.format(project.specificYield)} kWh/kWp`)

    if (!project.feedInTariff) add('missing', 'Vergütung', 'Wert fehlt')
    else {
      const ct = project.feedInTariff <= 1 ? project.feedInTariff * 100 : project.feedInTariff
      if (ct < 2 || ct > 30) add('warning', 'Vergütung', `${number.format(ct)} ct/kWh prüfen`)
      else add('ok', 'Vergütung', `${number.format(ct)} ct/kWh`)
    }

    if (project.pvKwp && project.specificYield && project.annualYield) {
      const expected = project.pvKwp * project.specificYield
      const diff = relDiff(project.annualYield, expected)
      add(diff > 0.1 ? 'error' : diff > 0.03 ? 'warning' : 'ok', 'Jahresertrag', `${number.format(project.annualYield)} kWh · Soll ${number.format(expected)} kWh`)
    } else add('missing', 'Jahresertrag', 'Nicht vollständig berechenbar')

    const calculatedPrice = projectPricePerKwp(project)
    if (calculatedPrice) {
      add(calculatedPrice < 30 || calculatedPrice > 3_500 ? 'warning' : 'ok', 'Preis pro kWp', `${money.format(calculatedPrice)} / kWp`)
      if (project.storedPricePerKwp) {
        const diff = relDiff(project.storedPricePerKwp, calculatedPrice)
        if (diff > 0.02) add('error', 'Gespeicherter €/kWp', `${money.format(project.storedPricePerKwp)} statt berechnet ${money.format(calculatedPrice)}`)
      }
    } else add('missing', 'Preis pro kWp', 'Kaufpreis oder Leistung fehlt')

    if (project.annualOpex && project.pvKwp) {
      const calculated = project.annualOpex / project.pvKwp
      add(calculated < 2 || calculated > 40 ? 'warning' : 'ok', 'OPEX', `${money.format(project.annualOpex)} p.a. · ${money.format(calculated)}/kWp`)
    } else add('missing', 'OPEX', 'Nicht berechenbar')
  }

  if (isBess) {
    if (!project.bessMw) add('missing', 'BESS-Leistung', 'MW fehlt')
    if (!project.bessMwh) add('missing', 'BESS-Kapazität', 'MWh fehlt')
    if (project.bessMw && project.bessMwh) {
      const duration = project.bessMwh / project.bessMw
      add(duration < 0.5 || duration > 8 ? 'warning' : 'ok', 'Speicherdauer', `${number.format(duration)} Stunden`)
    }
  }

  if (!project.purchasePrice && !project.investmentVolume) add('missing', 'Kaufpreis / Investitionsvolumen', 'Kein Wert hinterlegt')
  else if ((project.purchasePrice ?? project.investmentVolume ?? 0) <= 0) add('error', 'Kaufpreis / Investitionsvolumen', 'Wert muss größer als 0 sein')
  else add('ok', 'Kaufpreis / Investitionsvolumen', money.format(project.purchasePrice ?? project.investmentVolume ?? 0))

  if (project.annualRevenue && project.annualOpex && project.annualNetCashFlow) {
    const expected = project.annualRevenue - project.annualOpex
    const diff = relDiff(project.annualNetCashFlow, expected)
    add(diff > 0.1 ? 'error' : diff > 0.03 ? 'warning' : 'ok', 'Netto-Cashflow', `${money.format(project.annualNetCashFlow)} · Soll ${money.format(expected)}`)
  }

  if (project.amortisationYears) {
    add(project.amortisationYears < 1 || project.amortisationYears > 35 ? 'warning' : 'ok', 'Amortisation', `${number.format(project.amortisationYears)} Jahre`)
    if (project.leaseTermYears && project.amortisationYears >= project.leaseTermYears) add('error', 'Pachtdauer', `Amortisation ${number.format(project.amortisationYears)} J. ≥ Laufzeit ${number.format(project.leaseTermYears)} J.`)
  } else add('missing', 'Amortisation', 'Nicht berechenbar')

  if (project.landAreaSqm && project.pvKwp && ['pv_freiflaeche', 'hybrid'].includes(project.projectType)) {
    const sqmPerKwp = project.landAreaSqm / project.pvKwp
    add(sqmPerKwp < 4 || sqmPerKwp > 25 ? 'warning' : 'ok', 'Flächenverhältnis', `${number.format(sqmPerKwp)} m²/kWp`)
  }

  if (project.gridConnection === null) add('missing', 'Netzanschluss', 'Status offen')
  else add(project.gridConnection ? 'ok' : 'warning', 'Netzanschluss', project.gridConnection ? 'Bestätigt' : 'Nicht bestätigt')

  return checks
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function evaluateProjectPortfolio(projects: ProjectAuditRecord[]): ProjectAuditEvaluation[] {
  const peerPrices = new Map<string, number[]>()
  for (const project of projects) {
    const price = projectPricePerKwp(project)
    if (!price) continue
    const values = peerPrices.get(project.projectType) ?? []
    values.push(price)
    peerPrices.set(project.projectType, values)
  }

  return projects.map((project) => {
    const checks = checkProject(project)
    const pricePerKwp = projectPricePerKwp(project)
    const peers = peerPrices.get(project.projectType) ?? []
    const peerMedian = median(peers)

    if (pricePerKwp && peerMedian && peers.length >= 3) {
      const ratio = pricePerKwp / peerMedian
      if (ratio < 0.6 || ratio > 1.65) {
        checks.push({
          severity: 'warning',
          label: 'Portfoliovergleich',
          detail: `${money.format(pricePerKwp)} / kWp liegt ${ratio < 1 ? 'deutlich unter' : 'deutlich über'} dem Median ähnlicher Projekte (${money.format(peerMedian)} / kWp).`,
        })
      }
    }

    const worst = checks.reduce<Severity>((current, item) => statusRank(item.severity) > statusRank(current) ? item.severity : current, 'ok')
    return {
      project,
      checks,
      worst,
      affectedCount: checks.filter((check) => check.severity !== 'ok').length,
      pricePerKwp,
    }
  })
}

export function severityLabel(value: Severity) {
  return value === 'ok' ? 'OK' : value === 'warning' ? 'PRÜFEN' : value === 'error' ? 'FEHLER' : 'FEHLT'
}

type PdfColor = [number, number, number]

const PDF_COLORS = {
  navy: [31, 42, 68] as PdfColor,
  green: [92, 184, 0] as PdfColor,
  greenDark: [72, 145, 0] as PdfColor,
  surface: [246, 248, 251] as PdfColor,
  border: [224, 229, 237] as PdfColor,
  muted: [103, 116, 139] as PdfColor,
  error: [190, 45, 55] as PdfColor,
  warning: [220, 145, 0] as PdfColor,
  missing: [93, 105, 128] as PdfColor,
  info: [40, 105, 190] as PdfColor,
}

function pdfSafeText(value: string) {
  return value
    .replace(/[–—−]/g, '-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/·/g, '|')
    .replace(/\u00a0/g, ' ')
}

function projectTypeLabel(value: string) {
  const labels: Record<string, string> = {
    pv_dach: 'PV Dachanlage',
    pv_freiflaeche: 'PV Freifläche',
    bess: 'BESS',
    hybrid: 'Hybrid',
    wind: 'Windkraft',
    datacenter: 'Rechenzentrum',
    rechenzentrum: 'Rechenzentrum',
    sonstiges: 'Sonstiges',
  }
  return labels[value] ?? (value.replaceAll('_', ' ') || 'Sonstiges')
}

function severityColor(value: Severity): PdfColor {
  if (value === 'error') return PDF_COLORS.error
  if (value === 'warning') return PDF_COLORS.warning
  if (value === 'missing') return PDF_COLORS.missing
  return PDF_COLORS.greenDark
}

function clippedText(doc: jsPDF, value: string, maxWidth: number) {
  const safe = pdfSafeText(value)
  if (doc.getTextWidth(safe) <= maxWidth) return safe
  let clipped = safe
  while (clipped.length > 1 && doc.getTextWidth(`${clipped}...`) > maxWidth) clipped = clipped.slice(0, -1)
  return `${clipped.trim()}...`
}

function drawBrand(doc: jsPDF, x: number, y: number, inverse = true) {
  doc.setFillColor(...PDF_COLORS.green)
  doc.roundedRect(x, y, 8, 8, 1.8, 1.8, 'F')
  doc.setTextColor(...(inverse ? [255, 255, 255] as PdfColor : PDF_COLORS.navy))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('EMA', x + 11, y + 6.2)
}

function drawMetricCard(doc: jsPDF, options: {
  x: number
  y: number
  width: number
  height: number
  label: string
  value: string
  accent?: PdfColor
  compact?: boolean
}) {
  const { x, y, width, height, label, value, accent = PDF_COLORS.green, compact = false } = options
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...PDF_COLORS.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'FD')
  doc.setFillColor(...accent)
  doc.roundedRect(x, y, 2.3, height, 1.1, 1.1, 'F')
  doc.setTextColor(...PDF_COLORS.muted)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(compact ? 6.8 : 7.3)
  doc.text(pdfSafeText(label).toUpperCase(), x + 6, y + (compact ? 7 : 8))
  doc.setTextColor(...PDF_COLORS.navy)
  doc.setFontSize(compact ? 11 : 13)
  doc.text(clippedText(doc, value, width - 10), x + 6, y + (compact ? 17 : 21))
}

function drawStatusCard(doc: jsPDF, x: number, y: number, width: number, label: string, value: number, color: PdfColor) {
  doc.setFillColor(...PDF_COLORS.surface)
  doc.setDrawColor(...PDF_COLORS.border)
  doc.roundedRect(x, y, width, 23, 2.5, 2.5, 'FD')
  doc.setFillColor(...color)
  doc.circle(x + 7, y + 7, 2.2, 'F')
  doc.setTextColor(...PDF_COLORS.navy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(String(value), x + 12, y + 9.5)
  doc.setTextColor(...PDF_COLORS.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.3)
  doc.text(pdfSafeText(label), x + 7, y + 17.5)
}

function drawOverviewTable(doc: jsPDF, audits: ProjectAuditEvaluation[], startIndex: number, startY: number) {
  const margin = 14
  const widths = [18, 42, 26, 35, 22, 25, 14]
  const headers = ['Nr.', 'Projekt', 'Art', 'Standort', 'Leistung', 'Volumen', 'Status']
  const rowHeight = 11.5
  const maxRows = Math.max(1, Math.floor((278 - startY - 10) / rowHeight))
  const pageItems = audits.slice(startIndex, startIndex + maxRows)

  doc.setFillColor(...PDF_COLORS.navy)
  doc.roundedRect(margin, startY, 182, 9, 1.7, 1.7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.6)
  let x = margin + 2.5
  headers.forEach((header, index) => {
    doc.text(header, x, startY + 6)
    x += widths[index]
  })

  pageItems.forEach(({ project, worst }, index) => {
    const y = startY + 9 + index * rowHeight
    doc.setFillColor(...(index % 2 ? [250, 251, 253] as PdfColor : [255, 255, 255] as PdfColor))
    doc.setDrawColor(...PDF_COLORS.border)
    doc.rect(margin, y, 182, rowHeight, 'FD')
    doc.setTextColor(...PDF_COLORS.navy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.6)
    const amount = project.purchasePrice ?? project.investmentVolume
    const capacity = project.pvKwp
      ? `${number.format(project.pvKwp)} kWp`
      : project.bessMwh ? `${number.format(project.bessMwh)} MWh` : '-'
    const values = [
      project.projectNumber,
      project.projectName,
      projectTypeLabel(project.projectType),
      project.location,
      capacity,
      amount ? money.format(amount) : '-',
    ]
    x = margin + 2.5
    values.forEach((value, valueIndex) => {
      if (valueIndex > 0) doc.setFont('helvetica', 'normal')
      doc.text(clippedText(doc, value, widths[valueIndex] - 4), x, y + 7.1)
      x += widths[valueIndex]
    })
    const badgeColor = severityColor(worst)
    doc.setFillColor(...badgeColor)
    doc.roundedRect(x, y + 3, widths[6] - 3, 5.5, 1.4, 1.4, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.4)
    doc.text(severityLabel(worst), x + (widths[6] - 3) / 2, y + 6.9, { align: 'center' })
  })

  return startIndex + pageItems.length
}

function drawPageFooter(doc: jsPDF, pageNumber: number, pageCount: number, date: string) {
  const pageHeight = 297
  doc.setDrawColor(...PDF_COLORS.border)
  doc.setLineWidth(0.25)
  doc.line(14, pageHeight - 13, 196, pageHeight - 13)
  doc.setTextColor(...PDF_COLORS.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('EMA Enterprise GmbH | Vertraulich | Automatisierte Prüfung, keine Due Diligence', 14, pageHeight - 7)
  doc.text(`${date} | Seite ${pageNumber} von ${pageCount}`, 196, pageHeight - 7, { align: 'right' })
}

export function generateProjectAuditPdf(projects: ProjectAuditRecord[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const margin = 14
  const audits = evaluateProjectPortfolio(projects)
  const counts = { ok: 0, warning: 0, error: 0, missing: 0 }
  audits.forEach((item) => { counts[item.worst] += 1 })
  const date = new Intl.DateTimeFormat('de-DE').format(new Date())
  const totalPv = projects.reduce((sum, item) => sum + (item.pvKwp ?? 0), 0)
  const totalBess = projects.reduce((sum, item) => sum + (item.bessMwh ?? 0), 0)
  const totalPrice = projects.reduce((sum, item) => sum + (item.purchasePrice ?? item.investmentVolume ?? 0), 0)

  // Portfolio cover and management overview
  doc.setFillColor(...PDF_COLORS.navy)
  doc.rect(0, 0, pageWidth, 51, 'F')
  drawBrand(doc, margin, 10)
  doc.setTextColor(215, 223, 235)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`PORTFOLIOBERICHT | ${date}`, pageWidth - margin, 16, { align: 'right' })
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.text('Projektprüfung und Portfolioübersicht', margin, 33)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Automatische Plausibilitätskontrolle aller zentralen Projektdaten', margin, 42)

  const metricGap = 3
  const metricWidth = (182 - metricGap * 3) / 4
  const metrics = [
    ['Projekte gesamt', number.format(projects.length), PDF_COLORS.navy],
    ['PV-Leistung', `${number.format(totalPv)} kWp`, PDF_COLORS.green],
    ['BESS-Kapazität', `${number.format(totalBess)} MWh`, PDF_COLORS.info],
    ['Gesamtvolumen', money.format(totalPrice), PDF_COLORS.green],
  ] as const
  metrics.forEach(([label, value, accent], index) => drawMetricCard(doc, {
    x: margin + index * (metricWidth + metricGap), y: 61, width: metricWidth, height: 31,
    label, value, accent,
  }))

  doc.setTextColor(...PDF_COLORS.navy)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Prüfstatus', margin, 106)
  const statusGap = 3
  const statusWidth = (182 - statusGap * 3) / 4
  const statuses = [
    ['Plausible Projekte', counts.ok, PDF_COLORS.greenDark],
    ['Hinweise', counts.warning, PDF_COLORS.info],
    ['Fehlende Werte', counts.missing, PDF_COLORS.warning],
    ['Fehler', counts.error, PDF_COLORS.error],
  ] as const
  statuses.forEach(([label, value, color], index) => drawStatusCard(doc, margin + index * (statusWidth + statusGap), 112, statusWidth, label, value, color))

  doc.setTextColor(...PDF_COLORS.navy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Projektübersicht', margin, 151)
  doc.setTextColor(...PDF_COLORS.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Alle Projekte auf Basis der aktuell hinterlegten Stammdaten', margin, 157)

  let overviewIndex = drawOverviewTable(doc, audits, 0, 162)
  while (overviewIndex < audits.length) {
    doc.addPage()
    drawBrand(doc, margin, 12, false)
    doc.setTextColor(...PDF_COLORS.navy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Projektübersicht', margin, 35)
    doc.setTextColor(...PDF_COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Fortsetzung der Gesamtübersicht', margin, 43)
    overviewIndex = drawOverviewTable(doc, audits, overviewIndex, 51)
  }

  audits.forEach(({ project, checks: projectChecks, worst }) => {
    doc.addPage()
    doc.setFillColor(...PDF_COLORS.navy)
    doc.rect(0, 0, pageWidth, 39, 'F')
    drawBrand(doc, margin, 9)
    doc.setTextColor(215, 223, 235)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('PROJEKTPRÜFUNG', pageWidth - margin, 15, { align: 'right' })
    doc.setTextColor(255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15.5)
    doc.text(clippedText(doc, `${project.projectNumber} | ${project.projectName}`, 143), margin, 29)

    const badgeColor = severityColor(worst)
    doc.setFillColor(...badgeColor)
    doc.roundedRect(164, 23, 32, 9, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7.2)
    doc.text(severityLabel(worst), 180, 28.8, { align: 'center' })

    doc.setTextColor(...PDF_COLORS.navy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(projectTypeLabel(project.projectType), margin, 51)
    doc.setTextColor(...PDF_COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`${pdfSafeText(project.location)} | ${pdfSafeText(project.stage)}`, margin, 58)

    const detailGap = 3
    const detailWidth = (182 - detailGap * 3) / 4
    const amount = project.purchasePrice ?? project.investmentVolume
    const detailMetrics = [
      ['PV-Leistung', project.pvKwp ? `${number.format(project.pvKwp)} kWp` : '-'],
      ['BESS-Kapazität', project.bessMwh ? `${number.format(project.bessMwh)} MWh` : '-'],
      ['Kaufpreis / Volumen', amount ? money.format(amount) : '-'],
      ['Preis pro kWp', projectPricePerKwp(project) ? `${money.format(projectPricePerKwp(project) ?? 0)}/kWp` : '-'],
    ] as const
    detailMetrics.forEach(([label, value], metricIndex) => drawMetricCard(doc, {
      x: margin + metricIndex * (detailWidth + detailGap), y: 67, width: detailWidth, height: 25,
      label, value, compact: true, accent: metricIndex === 1 ? PDF_COLORS.info : PDF_COLORS.green,
    }))

    doc.setTextColor(...PDF_COLORS.navy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Prüfergebnisse', margin, 108)
    doc.setTextColor(...PDF_COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`${projectChecks.filter((check) => check.severity !== 'ok').length} Auffälligkeiten bei ${projectChecks.length} Prüfpunkten`, margin, 114)

    let y = 121
    projectChecks.forEach((check) => {
      const detailLines = doc.splitTextToSize(pdfSafeText(check.detail), 126) as string[]
      const visibleLines = detailLines.slice(0, 2)
      const rowHeight = Math.max(11.5, 7.2 + visibleLines.length * 3)
      if (y + rowHeight > 279) {
        doc.addPage()
        drawBrand(doc, margin, 12, false)
        doc.setTextColor(...PDF_COLORS.navy)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.text(clippedText(doc, `${project.projectNumber} | ${project.projectName}`, 150), margin, 35)
        doc.setTextColor(...PDF_COLORS.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text('Prüfergebnisse - Fortsetzung', margin, 43)
        y = 53
      }
      const color = severityColor(check.severity)
      doc.setFillColor(...PDF_COLORS.surface)
      doc.setDrawColor(...PDF_COLORS.border)
      doc.setLineWidth(0.25)
      doc.roundedRect(margin, y, pageWidth - margin * 2, rowHeight, 2, 2, 'FD')
      doc.setFillColor(...color)
      doc.roundedRect(margin, y, 2.2, rowHeight, 1, 1, 'F')
      doc.setFillColor(...color)
      doc.circle(margin + 8, y + rowHeight / 2, 2, 'F')
      doc.setTextColor(...PDF_COLORS.navy)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(clippedText(doc, check.label, 42), margin + 13, y + rowHeight / 2 + 1.6)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.2)
      doc.text(visibleLines, margin + 57, y + 5.2)
      doc.setTextColor(...color)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.text(severityLabel(check.severity), pageWidth - margin - 4, y + rowHeight / 2 + 2, { align: 'right' })
      y += rowHeight + 1.4
    })
  })

  // Footers are added after pagination so every page has an exact page count.
  const pageCount = doc.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)
    drawPageFooter(doc, pageNumber, pageCount, date)
  }

  doc.save(`EMA_Projektpruefung_${new Date().toISOString().slice(0, 10)}.pdf`)
}
