import { jsPDF } from 'jspdf'
import type { ProjectAuditRecord } from '@/lib/actions/project-audit.actions'

type Severity = 'ok' | 'warning' | 'error' | 'missing'
interface CheckResult { severity: Severity; label: string; detail: string }

const money = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

function relDiff(a: number, b: number) {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1)
}

function statusRank(value: Severity) {
  return value === 'error' ? 3 : value === 'missing' ? 2 : value === 'warning' ? 1 : 0
}

function checkProject(project: ProjectAuditRecord): CheckResult[] {
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

    if (project.purchasePrice && project.pvKwp) {
      const calculated = project.purchasePrice / project.pvKwp
      const severity: Severity = calculated < 50 || calculated > 2_500 ? 'warning' : 'ok'
      add(severity, 'EK pro kWp', `${money.format(calculated)} / kWp`)
      if (project.storedPricePerKwp) {
        const diff = relDiff(project.storedPricePerKwp, calculated)
        if (diff > 0.02) add('error', 'Gespeicherter €/kWp', `${money.format(project.storedPricePerKwp)} statt berechnet ${money.format(calculated)}`)
      }
    } else add('missing', 'EK pro kWp', 'Kaufpreis oder Leistung fehlt')

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

  if (!project.purchasePrice && !project.investmentVolume) add('missing', 'Kaufpreis', 'Kein EK-Kaufpreis oder Investitionsvolumen')
  else if ((project.purchasePrice ?? project.investmentVolume ?? 0) <= 0) add('error', 'Kaufpreis', 'Wert muss größer als 0 sein')
  else add('ok', 'Kaufpreis', money.format(project.purchasePrice ?? project.investmentVolume ?? 0))

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

function severityLabel(value: Severity) {
  return value === 'ok' ? 'OK' : value === 'warning' ? 'PRÜFEN' : value === 'error' ? 'FEHLER' : 'FEHLT'
}

export function generateProjectAuditPdf(projects: ProjectAuditRecord[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 14
  const navy: [number, number, number] = [7, 20, 47]
  const green: [number, number, number] = [92, 184, 0]
  const checks = projects.map((project) => ({ project, checks: checkProject(project) }))
  const counts = { ok: 0, warning: 0, error: 0, missing: 0 }
  checks.forEach((item) => item.checks.forEach((check) => { counts[check.severity] += 1 }))

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
  doc.text('EMA Projektübersicht', margin, 23)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Automatische Plausibilitätsprüfung aller Projektwerte', margin, 33)
  doc.setTextColor(...green)
  doc.setFont('helvetica', 'bold')
  doc.text(`${projects.length} Projekte geprüft`, margin, 44)

  const summary = [
    ['Fehler', counts.error], ['Fehlende Werte', counts.missing], ['Hinweise', counts.warning], ['Plausible Prüfungen', counts.ok],
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

  checks.forEach(({ project, checks: projectChecks }, index) => {
    doc.addPage()
    doc.setFillColor(...navy)
    doc.rect(0, 0, pageWidth, 34, 'F')
    doc.setTextColor(255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(`${project.projectNumber} · ${project.projectName}`, margin, 15, { maxWidth: 160 })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${project.location} · ${project.stage}`, margin, 24, { maxWidth: 180 })

    const worst = projectChecks.reduce<Severity>((current, item) => statusRank(item.severity) > statusRank(current) ? item.severity : current, 'ok')
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
    if (index === checks.length - 1) return
  })

  doc.save(`EMA_Projektpruefung_${new Date().toISOString().slice(0, 10)}.pdf`)
}
