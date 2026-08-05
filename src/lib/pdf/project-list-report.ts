export type ProjectListReportRow = {
  externalNumber: string
  region: string
  projectName: string
  pvKwp: number | null
  gridDistanceKm: number | null
  structure: string
  commissioning: string
  securedLandHa: number | null
  specificYield: number | null
  warnings: string[]
}

const NAVY: [number, number, number] = [7, 20, 47]
const GREEN: [number, number, number] = [92, 184, 0]
const LIGHT: [number, number, number] = [244, 247, 251]
const MUTED: [number, number, number] = [91, 105, 128]

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(value)
}

function safeFileName(value: string) {
  return value.replace(/\.[^.]+$/, '').replace(/[^a-z0-9äöüß-]+/gi, '-').replace(/^-+|-+$/g, '') || 'Projektliste'
}

export async function createProjectListReport(rows: ProjectListReportRow[], sourceName = 'Projektliste.pdf') {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const selected = rows.filter((row) => row.pvKwp && row.pvKwp > 0)
  const totalKwp = selected.reduce((sum, row) => sum + (row.pvKwp ?? 0), 0)
  const regions = [...new Set(selected.map((row) => row.region).filter(Boolean))]
  const warningRows = selected.filter((row) => row.warnings.length > 0)
  const avgKwp = selected.length ? totalKwp / selected.length : 0
  const maxKwp = Math.max(0, ...selected.map((row) => row.pvKwp ?? 0))
  const minKwp = Math.min(...selected.map((row) => row.pvKwp ?? 0).filter((value) => value > 0), 0)
  const title = safeFileName(sourceName)
  const created = new Intl.DateTimeFormat('de-DE').format(new Date())
  const documentId = `EMA-PL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

  function logo(x = 14, y = 16) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...NAVY)
    doc.text('EMA', x, y)
    doc.setFontSize(7)
    doc.setTextColor(...GREEN)
    doc.text('ENTERPRISE', x + 0.5, y + 5)
  }

  function footer(page: number) {
    doc.setDrawColor(...GREEN)
    doc.setLineWidth(0.5)
    doc.line(14, 286, 42, 286)
    doc.setFontSize(7)
    doc.setTextColor(...NAVY)
    doc.text('EMA ENTERPRISE GMBH', 14, 291)
    doc.text(`SEITE ${page}`, 196, 291, { align: 'right' })
  }

  function header(page: number, section: string) {
    logo(14, 14)
    doc.setFontSize(8)
    doc.setTextColor(...NAVY)
    doc.text(`PROJEKTLISTE – ${title.toUpperCase()}`, 196, 10, { align: 'right' })
    doc.text(documentId, 196, 15, { align: 'right' })
    doc.setDrawColor(210, 218, 230)
    doc.line(14, 22, 196, 22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...GREEN)
    doc.text(section, 14, 31)
    footer(page)
  }

  function metric(x: number, y: number, w: number, value: string, label: string) {
    doc.setFillColor(...NAVY)
    doc.roundedRect(x, y, w, 28, 2, 2, 'F')
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(value, x + w / 2, y + 12, { align: 'center' })
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.text(label.toUpperCase(), x + w / 2, y + 21, { align: 'center' })
  }

  // Cover
  logo(14, 20)
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('EMA PROJEKTLISTE', 196, 12, { align: 'right' })
  doc.text(`DOKUMENT-ID: ${documentId}`, 196, 17, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(29)
  doc.text('PROJEKTLISTE', 14, 64)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(17)
  doc.setTextColor(...GREEN)
  doc.text(title, 14, 76)
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`Erstellt am: ${created}`, 14, 97)
  doc.text(`Quelle: ${sourceName}`, 14, 105)
  doc.text(`Erkannte Projekte: ${selected.length}`, 14, 113)

  // France-inspired location graphic
  doc.setFillColor(235, 240, 246)
  const shape = [[135,65],[154,57],[172,68],[177,91],[164,112],[144,118],[126,102],[123,81]]
  shape.forEach(([x, y], index) => {
    const next = shape[(index + 1) % shape.length]
    doc.setDrawColor(205, 214, 226)
    doc.line(x, y, next[0], next[1])
  })
  doc.setFillColor(...NAVY)
  doc.circle(151, 88, 4.5, 'F')
  doc.setFillColor(255, 255, 255)
  doc.circle(151, 88, 1.5, 'F')

  metric(14, 132, 42, String(selected.length), 'Projekte')
  metric(60, 132, 42, `${formatNumber(totalKwp / 1000, 1)} MWp`, 'Gesamtleistung')
  metric(106, 132, 42, String(regions.length), 'Regionen')
  metric(152, 132, 44, String(warningRows.length), 'Zu prüfen')

  // Renewable-energy illustration
  doc.setFillColor(230, 238, 248)
  doc.rect(0, 178, 210, 105, 'F')
  doc.setFillColor(215, 229, 202)
  doc.rect(0, 226, 210, 57, 'F')
  doc.setFillColor(255, 210, 90)
  doc.circle(168, 198, 9, 'F')
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const x = 16 + col * 30 + row * 4
      const y = 222 + row * 15
      doc.setFillColor(20, 53, 91)
      doc.setDrawColor(255, 255, 255)
      doc.rect(x, y, 25, 11, 'FD')
      doc.line(x + 8.3, y, x + 8.3, y + 11)
      doc.line(x + 16.6, y, x + 16.6, y + 11)
      doc.line(x, y + 5.5, x + 25, y + 5.5)
    }
  }
  doc.setFillColor(...NAVY)
  doc.rect(0, 276, 210, 21, 'F')
  footer(1)

  // Table pages
  const pageSize = 24
  let page = 2
  for (let start = 0; start < selected.length; start += pageSize) {
    doc.addPage()
    header(page, 'PROJEKTÜBERSICHT')
    const chunk = selected.slice(start, start + pageSize)
    const widths = [11, 20, 54, 23, 18, 18, 28]
    const headers = ['NR.', 'REGION', 'PROJEKT', 'LEISTUNG', 'NETZ', 'FLÄCHE', 'STRUKTUR']
    let y = 38
    let x = 14
    doc.setFillColor(...NAVY)
    doc.rect(14, y, 182, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(255, 255, 255)
    headers.forEach((label, index) => {
      doc.text(label, x + 2, y + 5.8)
      x += widths[index]
    })
    y += 9
    chunk.forEach((row, index) => {
      const fill = index % 2 === 0 ? 250 : 244
      doc.setFillColor(fill, fill + 2, Math.min(255, fill + 5))
      doc.rect(14, y, 182, 9.5, 'F')
      doc.setDrawColor(225, 231, 239)
      doc.line(14, y + 9.5, 196, y + 9.5)
      doc.setTextColor(...NAVY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.4)
      const cells = [
        row.externalNumber,
        row.region,
        row.projectName,
        `${formatNumber((row.pvKwp ?? 0) / 1000, 2)} MWp`,
        row.gridDistanceKm ? `${formatNumber(row.gridDistanceKm, 1)} km` : '–',
        row.securedLandHa ? `${formatNumber(row.securedLandHa, 1)} ha` : '–',
        row.structure || 'PV',
      ]
      x = 14
      cells.forEach((cell, cellIndex) => {
        const clipped = doc.splitTextToSize(String(cell), widths[cellIndex] - 3)[0] ?? ''
        doc.text(clipped, x + 2, y + 6)
        x += widths[cellIndex]
      })
      y += 9.5
    })
    doc.setFillColor(236, 247, 227)
    doc.roundedRect(14, 273, 182, 8, 1.5, 1.5, 'F')
    doc.setTextColor(54, 96, 25)
    doc.setFontSize(6.5)
    doc.text(`Einträge ${start + 1}–${Math.min(start + pageSize, selected.length)} von ${selected.length}`, 18, 278)
    page += 1
  }

  // Summary
  doc.addPage()
  header(page, 'ZUSAMMENFASSUNG')
  const summaryPage = page
  const summary = [
    ['PROJEKTE', String(selected.length)],
    ['GESAMTLEISTUNG', `${formatNumber(totalKwp / 1000, 1)} MWp`],
    ['DURCHSCHNITT', `${formatNumber(avgKwp / 1000, 1)} MWp`],
    ['GRÖSSTES PROJEKT', `${formatNumber(maxKwp / 1000, 1)} MWp`],
    ['KLEINSTES PROJEKT', `${formatNumber(minKwp / 1000, 1)} MWp`],
    ['REGIONEN', String(regions.length)],
  ]
  summary.forEach(([label, value], index) => {
    const y = 40 + index * 25
    doc.setFillColor(...LIGHT)
    doc.roundedRect(14, y, 42, 20, 2, 2, 'F')
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(value, 35, y + 8, { align: 'center' })
    doc.setTextColor(...NAVY)
    doc.setFontSize(6)
    doc.text(label, 35, y + 15, { align: 'center' })
  })

  const byRegion = selected.reduce<Record<string, number>>((acc, row) => {
    const key = row.region || 'Ohne Region'
    acc[key] = (acc[key] ?? 0) + (row.pvKwp ?? 0)
    return acc
  }, {})
  const topRegions = Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 9)
  const maxRegion = Math.max(1, ...topRegions.map(([, value]) => value))
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('LEISTUNG NACH REGION', 68, 42)
  topRegions.forEach(([region, value], index) => {
    const y = 52 + index * 15
    doc.setFontSize(6.5)
    doc.setTextColor(...MUTED)
    doc.text(region, 68, y)
    doc.setFillColor(229, 235, 242)
    doc.roundedRect(110, y - 4, 66, 5, 1, 1, 'F')
    doc.setFillColor(...GREEN)
    doc.roundedRect(110, y - 4, 66 * (value / maxRegion), 5, 1, 1, 'F')
    doc.setTextColor(...NAVY)
    doc.text(`${formatNumber(value / 1000, 1)} MWp`, 180, y)
  })

  doc.setFillColor(239, 247, 233)
  doc.roundedRect(68, 195, 128, 55, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text('QUALITÄTSÜBERSICHT', 74, 207)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(`Vollständige Leistungsangaben: ${selected.length - rows.filter((row) => !row.pvKwp).length}/${selected.length}`, 74, 219)
  doc.text(`Zeilen mit Prüfhinweisen: ${warningRows.length}/${selected.length}`, 74, 230)
  doc.text(`Regionen erkannt: ${regions.length}`, 74, 241)
  footer(summaryPage)
  page += 1

  // Notes
  doc.addPage()
  header(page, 'HINWEISE & NÄCHSTE SCHRITTE')
  const score = Math.max(0, Math.round(100 - (warningRows.length / Math.max(1, selected.length)) * 100))
  doc.setFillColor(239, 247, 233)
  doc.roundedRect(14, 42, 182, 36, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GREEN)
  doc.setFontSize(25)
  doc.text(`${score}/100`, 180, 62, { align: 'right' })
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text('EMA QUALITY SCORE', 22, 58)

  const notes = [
    ['GUTE DATENQUALITÄT', `${selected.length - warningRows.length} Projekte enthalten keine automatischen Prüfhinweise.`],
    ['EMPFEHLUNGEN', `${warningRows.length} markierte Zeilen vor externer Weitergabe prüfen. Fehlende Netz-, Flächen- oder Ertragsdaten ergänzen.`],
    ['NÄCHSTE SCHRITTE', 'PDF intern freigeben, ausgewählte Projekte priorisieren und erst danach als einzelne Projektordner übernehmen.'],
  ]
  notes.forEach(([heading, text], index) => {
    const y = 91 + index * 48
    doc.setFillColor(index === 1 ? 255 : 247, index === 1 ? 247 : 249, index === 1 ? 229 : 252)
    doc.roundedRect(14, y, 182, 36, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(index === 1 ? 174 : 7, index === 1 ? 92 : 20, index === 1 ? 0 : 47)
    doc.text(heading, 21, y + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...NAVY)
    doc.text(doc.splitTextToSize(text, 164), 21, y + 20)
  })
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(`Originaldatei: ${sourceName}`, 14, 253)
  doc.text(`Erstellt durch EMA Intelligence am ${created}`, 14, 260)
  footer(page)

  doc.save(`EMA-Projektliste-${safeFileName(sourceName)}.pdf`)
}
