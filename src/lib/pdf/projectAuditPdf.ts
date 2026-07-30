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

export function generateProjectAuditPdf(projects: ProjectAuditRecord[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 14
  const navy: [number, number, number] = [7, 20, 47]
  const green: [number, number, number] = [92, 184, 0]
  const audits = evaluateProjectPortfolio(projects)
  const counts = { ok: 0, warning: 0, error: 0, missing: 0 }
  audits.forEach((item) => { counts[item.worst] += 1 })

  const footer = () => {
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`EMA Enterprise GmbH · Projektprüfung · ${new Intl.DateTimeFormat('de-DE').format(new Date())}`, margin, pageHeight - 7)
    doc.text(String(doc.getNumberOfPages()), pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  doc.setFillColor(...navy)
  doc.rect(0, 0, pageWidth, 54, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('EMA Projektprüfung – Prüfbericht', margin, 23)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Automatische Plausibilitätsprüfung aller Projektwerte', margin, 33)
  doc.setTextColor(...green)
  doc.setFont('helvetica', 'bold')
  doc.text(`${projects.length} Projekte geprüft`, margin, 44)

  const summary = [
    ['Fehler', counts.error], ['Fehlende Werte', counts.missing], ['Hinweise', counts.warning], ['Plausible Projekte', counts.ok],
  ] as const
  let sx = margin
  for (const [label, value] of summary) {
    doc.setFillColor(246, 248, 251)
    doc.roundedRect(sx, 64, 42, 25, 3, 3, 'F')
    doc.setTextColor(...navy)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(String(value), sx + 5, 75)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(label, sx + 5, 83)
    sx += 45
  }

  doc.setTextColor(...navy)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Gesamtportfolio', margin, 105)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const totalPv = projects.reduce((sum, item) => sum + (item.pvKwp ?? 0), 0)
  const totalBess = projects.reduce((sum, item) => sum + (item.bessMwh ?? 0), 0)
  const totalPrice = projects.reduce((sum, item) => sum + (item.purchasePrice ?? item.investmentVolume ?? 0), 0)
  doc.text(`PV-Leistung: ${number.format(totalPv)} kWp`, margin, 116)
  doc.text(`BESS-Kapazität: ${number.format(totalBess)} MWh`, margin, 124)
  doc.text(`Kaufpreis / Investitionsvolumen: ${money.format(totalPrice)}`, margin, 132)
  doc.text('Hinweis: Die Prüfung ist eine automatisierte Plausibilitätskontrolle und ersetzt keine technische, rechtliche oder steuerliche Due Diligence.', margin, 150, { maxWidth: pageWidth - margin * 2 })
  footer()

  audits.forEach(({ project, checks: projectChecks, worst }, index) => {
    doc.addPage()
    doc.setFillColor(...navy)
    doc.rect(0, 0, pageWidth, 34, 'F')
    doc.setTextColor(255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(`${project.projectNumber} · ${project.projectName}`, margin, 15, { maxWidth: 145 })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${project.location} · ${project.stage}`, margin, 24, { maxWidth: 145 })

    doc.setFillColor(worst === 'error' ? 180 : worst === 'missing' ? 90 : worst === 'warning' ? 215 : 92, worst === 'error' ? 35 : worst === 'missing' ? 100 : worst === 'warning' ? 145 : 184, worst === 'error' ? 35 : worst === 'missing' ? 120 : worst === 'warning' ? 0 : 0)
    doc.roundedRect(165, 10, 31, 10, 2, 2, 'F')
    doc.setTextColor(255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(severityLabel(worst), 180.5, 16.5, { align: 'center' })

    let y = 46
    projectChecks.forEach((check) => {
      if (y > 270) { footer(); doc.addPage(); y = 20 }
      const color: [number, number, number] = check.severity === 'error' ? [180, 35, 35] : check.severity === 'warning' ? [205, 130, 0] : check.severity === 'missing' ? [95, 105, 125] : [70, 145, 0]
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(margin, y, pageWidth - margin * 2, 14, 2, 2, 'F')
      doc.setFillColor(...color)
      doc.circle(margin + 5, y + 7, 2.2, 'F')
      doc.setTextColor(...navy)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(check.label, margin + 10, y + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(check.detail, margin + 10, y + 10.5, { maxWidth: 145 })
      doc.setTextColor(...color)
      doc.setFont('helvetica', 'bold')
      doc.text(severityLabel(check.severity), pageWidth - margin - 4, y + 8.5, { align: 'right' })
      y += 16
    })
    footer()
    if (index === audits.length - 1) return
  })

  doc.save(`EMA_Projektpruefung_${new Date().toISOString().slice(0, 10)}.pdf`)
}
