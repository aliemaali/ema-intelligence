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
const LIGHT: [number, number, number] = [246, 248, 251]
const MUTED: [number, number, number] = [91, 105, 128]
const BORDER: [number, number, number] = [220, 227, 236]

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(value)
}

function safeFileName(value: string) {
  return value.replace(/\.[^.]+$/, '').replace(/[^a-z0-9äöüß-]+/gi, '-').replace(/^-+|-+$/g, '') || 'Projektliste'
}

function createSolarImage() {
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 620
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const sky = ctx.createLinearGradient(0, 0, 0, 400)
  sky.addColorStop(0, '#7db7e8')
  sky.addColorStop(0.62, '#dbeaf5')
  sky.addColorStop(1, '#f4c777')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, canvas.width, 400)

  const glow = ctx.createRadialGradient(1040, 280, 15, 1040, 280, 180)
  glow.addColorStop(0, 'rgba(255,235,165,.95)')
  glow.addColorStop(1, 'rgba(255,220,120,0)')
  ctx.fillStyle = glow
  ctx.fillRect(820, 60, 450, 420)

  ctx.fillStyle = '#54734e'
  ctx.beginPath()
  ctx.moveTo(0, 365)
  ctx.lineTo(230, 300)
  ctx.lineTo(430, 352)
  ctx.lineTo(690, 275)
  ctx.lineTo(930, 350)
  ctx.lineTo(1160, 290)
  ctx.lineTo(1400, 345)
  ctx.lineTo(1400, 620)
  ctx.lineTo(0, 620)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#6b8b55'
  ctx.fillRect(0, 400, 1400, 220)

  for (let row = 0; row < 4; row += 1) {
    const y = 395 + row * 54
    const scale = 1 - row * 0.08
    for (let col = 0; col < 8; col += 1) {
      const x = 35 + col * 170 + row * 26
      const w = 138 * scale
      const h = 42 * scale
      ctx.fillStyle = '#17365f'
      ctx.strokeStyle = '#9fc1df'
      ctx.lineWidth = 2
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
      ctx.beginPath()
      ctx.moveTo(x + w / 3, y)
      ctx.lineTo(x + w / 3, y + h)
      ctx.moveTo(x + (w * 2) / 3, y)
      ctx.lineTo(x + (w * 2) / 3, y + h)
      ctx.moveTo(x, y + h / 2)
      ctx.lineTo(x + w, y + h / 2)
      ctx.stroke()
    }
  }
  return canvas.toDataURL('image/jpeg', 0.88)
}

export async function createProjectListReport(rows: ProjectListReportRow[], sourceName = 'Projektliste.pdf') {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const selected = rows.filter((row) => row.pvKwp && row.pvKwp > 0)
  const totalKwp = selected.reduce((sum, row) => sum + (row.pvKwp ?? 0), 0)
  const regions = [...new Set(selected.map((row) => row.region).filter(Boolean))]
  const avgKwp = selected.length ? totalKwp / selected.length : 0
  const maxKwp = Math.max(0, ...selected.map((row) => row.pvKwp ?? 0))
  const positiveValues = selected.map((row) => row.pvKwp ?? 0).filter((value) => value > 0)
  const minKwp = positiveValues.length ? Math.min(...positiveValues) : 0
  const title = safeFileName(sourceName)
  const created = new Intl.DateTimeFormat('de-DE').format(new Date())
  const documentId = `EMA-PL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  const solarImage = createSolarImage()

  function logo(x = 14, y = 16) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(23)
    doc.setTextColor(...NAVY)
    doc.text('EMA', x, y)
    doc.setFontSize(7)
    doc.setTextColor(...GREEN)
    doc.text('ENTERPRISE', x + 0.5, y + 5)
  }

  function footer(page: number) {
    doc.setDrawColor(...BORDER)
    doc.line(14, 282, 196, 282)
    doc.setDrawColor(...GREEN)
    doc.setLineWidth(0.6)
    doc.line(90, 289, 120, 289)
    doc.setFontSize(7)
    doc.setTextColor(...NAVY)
    doc.text('EMA ENTERPRISE GMBH', 14, 291)
    doc.text(`SEITE ${page}`, 196, 291, { align: 'right' })
  }

  function header(page: number, section: string) {
    logo(14, 13)
    doc.setFontSize(8)
    doc.setTextColor(...NAVY)
    doc.text(`PROJEKTLISTE – ${title.toUpperCase()}`, 196, 10, { align: 'right' })
    doc.text(documentId, 196, 15, { align: 'right' })
    doc.setDrawColor(...BORDER)
    doc.line(14, 23, 196, 23)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...GREEN)
    doc.text(section, 14, 33)
    footer(page)
  }

  function iconMetric(x: number, y: number, w: number, value: string, label: string, icon: 'panel' | 'bolt' | 'pin') {
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(x, y, w, 34, 2, 2, 'FD')
    doc.setDrawColor(...GREEN)
    doc.setFillColor(...GREEN)
    if (icon === 'panel') {
      doc.rect(x + w / 2 - 7, y + 5, 14, 6, 'F')
      doc.line(x + w / 2, y + 11, x + w / 2, y + 15)
      doc.line(x + w / 2 - 4, y + 15, x + w / 2 + 4, y + 15)
    } else if (icon === 'bolt') {
      doc.triangle(x + w / 2 + 2, y + 4, x + w / 2 - 4, y + 13, x + w / 2 + 1, y + 13, 'F')
      doc.triangle(x + w / 2 - 1, y + 12, x + w / 2 + 5, y + 12, x + w / 2 - 2, y + 20, 'F')
    } else {
      doc.circle(x + w / 2, y + 9, 4.2, 'F')
      doc.setFillColor(255, 255, 255)
      doc.circle(x + w / 2, y + 9, 1.5, 'F')
      doc.setDrawColor(...GREEN)
      doc.line(x + w / 2, y + 13, x + w / 2, y + 17)
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...NAVY)
    doc.text(value, x + w / 2, y + 24, { align: 'center' })
    doc.setFontSize(6.5)
    doc.text(label.toUpperCase(), x + w / 2, y + 30, { align: 'center' })
  }

  // Cover
  logo(14, 18)
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('EMA PROJEKTLISTE', 196, 11, { align: 'right' })
  doc.text(`DOKUMENT-ID: ${documentId}`, 196, 16, { align: 'right' })
  doc.text('VERSION: 1.0', 196, 21, { align: 'right' })
  doc.setDrawColor(...GREEN)
  doc.line(177, 25, 196, 25)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.text('PROJEKTLISTE', 14, 64)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(18)
  doc.setTextColor(...GREEN)
  doc.text(title, 14, 77)

  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(`ERSTELLT AM`, 14, 96)
  doc.text(created, 14, 102)
  doc.text('QUELLE', 14, 112)
  doc.text(sourceName, 14, 118)
  doc.text('ERKANNTE PROJEKTE', 14, 128)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(String(selected.length), 14, 136)

  // France silhouette with internal detail
  const france = [[136,72],[150,60],[164,65],[177,78],[173,94],[181,108],[170,122],[153,129],[137,121],[126,109],[129,94],[122,82]]
  doc.setFillColor(248, 249, 251)
  doc.setDrawColor(199, 209, 221)
  france.forEach(([x, y], index) => {
    const next = france[(index + 1) % france.length]
    doc.line(x, y, next[0], next[1])
  })
  for (let i = 0; i < 8; i += 1) {
    doc.setDrawColor(224, 229, 236)
    doc.line(132 + i * 5, 76 + (i % 3) * 8, 165 + (i % 2) * 7, 116 - i * 3)
  }
  doc.setFillColor(...GREEN)
  doc.circle(168, 110, 4.2, 'F')
  doc.setFillColor(255, 255, 255)
  doc.circle(168, 110, 1.3, 'F')

  iconMetric(14, 148, 56, String(selected.length), 'Projekte', 'panel')
  iconMetric(77, 148, 56, `${formatNumber(totalKwp / 1000, 1)} MWp`, 'Gesamtleistung', 'bolt')
  iconMetric(140, 148, 56, String(regions.length), 'Regionen', 'pin')

  if (solarImage) doc.addImage(solarImage, 'JPEG', 0, 190, 210, 82)
  doc.setFillColor(...NAVY)
  doc.rect(0, 272, 210, 25, 'F')
  footer(1)

  // Table pages
  const pageSize = 23
  let page = 2
  for (let start = 0; start < selected.length; start += pageSize) {
    doc.addPage()
    header(page, 'PROJEKTÜBERSICHT')
    const chunk = selected.slice(start, start + pageSize)
    const widths = [11, 22, 48, 24, 19, 18, 40]
    const headers = ['NR.', 'REGION', 'PROJEKT', 'LEISTUNG', 'NETZ', 'FLÄCHE', 'STRUKTUR']
    let y = 41
    let x = 14
    doc.setFillColor(...NAVY)
    doc.rect(14, y, 182, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.4)
    doc.setTextColor(255, 255, 255)
    headers.forEach((label, index) => {
      doc.text(label, x + 2, y + 5.8)
      x += widths[index]
    })
    y += 9
    chunk.forEach((row, index) => {
      doc.setFillColor(index % 2 === 0 ? 251 : 246, index % 2 === 0 ? 252 : 248, 253)
      doc.rect(14, y, 182, 9.5, 'F')
      doc.setDrawColor(228, 233, 240)
      doc.line(14, y + 9.5, 196, y + 9.5)
      const cells = [row.externalNumber, row.region, row.projectName, `${formatNumber((row.pvKwp ?? 0) / 1000, 2)} MWp`, row.gridDistanceKm ? `${formatNumber(row.gridDistanceKm, 1)} km` : '–', row.securedLandHa ? `${formatNumber(row.securedLandHa, 1)} ha` : '–', row.structure || 'PV']
      x = 14
      doc.setTextColor(...NAVY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.2)
      cells.forEach((cell, cellIndex) => {
        const clipped = doc.splitTextToSize(String(cell), widths[cellIndex] - 3)[0] ?? ''
        doc.text(clipped, x + 2, y + 6)
        x += widths[cellIndex]
      })
      y += 9.5
    })
    doc.setFillColor(239, 247, 233)
    doc.roundedRect(14, 271, 182, 8, 1.5, 1.5, 'F')
    doc.setTextColor(54, 96, 25)
    doc.setFontSize(6.5)
    doc.text('Alle Angaben basieren auf den Informationen in der Quelldatei.', 18, 276.5)
    page += 1
  }

  // Summary
  doc.addPage()
  header(page, 'ZUSAMMENFASSUNG')
  const metrics = [
    ['PROJEKTE', String(selected.length)],
    ['GESAMTLEISTUNG', `${formatNumber(totalKwp / 1000, 1)} MWp`],
    ['DURCHSCHNITT', `${formatNumber(avgKwp / 1000, 1)} MWp`],
    ['GRÖSSTES PROJEKT', `${formatNumber(maxKwp / 1000, 1)} MWp`],
    ['KLEINSTES PROJEKT', `${formatNumber(minKwp / 1000, 2)} MWp`],
    ['REGIONEN', String(regions.length)],
  ]
  metrics.forEach(([label, value], index) => {
    const y = 42 + index * 27
    doc.setFillColor(...LIGHT)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(14, y, 43, 22, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    doc.text(value, 35.5, y + 9, { align: 'center' })
    doc.setFontSize(6)
    doc.text(label, 35.5, y + 16, { align: 'center' })
  })

  const byRegion = selected.reduce<Record<string, number>>((acc, row) => {
    const key = row.region || 'Ohne Region'
    acc[key] = (acc[key] ?? 0) + (row.pvKwp ?? 0)
    return acc
  }, {})
  const topRegions = Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const maxRegion = Math.max(1, ...topRegions.map(([, value]) => value))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('LEISTUNG NACH REGION (MWp)', 68, 45)
  topRegions.forEach(([region, value], index) => {
    const y = 57 + index * 15
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.4)
    doc.setTextColor(...MUTED)
    doc.text(region, 68, y)
    doc.setFillColor(235, 239, 244)
    doc.roundedRect(113, y - 4, 58, 5, 1, 1, 'F')
    doc.setFillColor(...GREEN)
    doc.roundedRect(113, y - 4, 58 * (value / maxRegion), 5, 1, 1, 'F')
    doc.setTextColor(...NAVY)
    doc.text(`${formatNumber(value / 1000, 1)}`, 178, y)
  })
  footer(page)
  page += 1

  // Final overview page
  doc.addPage()
  header(page, 'KENNZAHLEN & NÄCHSTE SCHRITTE')
  iconMetric(14, 42, 56, String(selected.length), 'Projekte', 'panel')
  iconMetric(77, 42, 56, `${formatNumber(totalKwp / 1000, 1)} MWp`, 'Gesamtleistung', 'bolt')
  iconMetric(140, 42, 56, String(regions.length), 'Regionen', 'pin')
  if (solarImage) doc.addImage(solarImage, 'JPEG', 14, 82, 182, 76)

  const classes = [
    { label: '> 20 MWp', count: selected.filter((row) => (row.pvKwp ?? 0) > 20000).length },
    { label: '5 – 20 MWp', count: selected.filter((row) => (row.pvKwp ?? 0) > 5000 && (row.pvKwp ?? 0) <= 20000).length },
    { label: '1 – 5 MWp', count: selected.filter((row) => (row.pvKwp ?? 0) > 1000 && (row.pvKwp ?? 0) <= 5000).length },
    { label: '< 1 MWp', count: selected.filter((row) => (row.pvKwp ?? 0) <= 1000).length },
  ]
  doc.setFillColor(...LIGHT)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(14, 166, 88, 72, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('LEISTUNGSKLASSEN', 20, 178)
  classes.forEach((item, index) => {
    const y = 190 + index * 11
    doc.setFillColor(index === 0 ? GREEN[0] : 35 + index * 20, index === 0 ? GREEN[1] : 60 + index * 18, index === 0 ? GREEN[2] : 90 + index * 20)
    doc.circle(23, y - 1.5, 2.3, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...NAVY)
    doc.text(item.label, 29, y)
    doc.setFont('helvetica', 'bold')
    doc.text(String(item.count), 92, y, { align: 'right' })
  })

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(108, 166, 88, 72, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('NÄCHSTE SCHRITTE', 114, 178)
  const steps = ['Projekte priorisieren', 'Interessante Projekte übernehmen', 'Investor-Matching starten', 'Due Diligence vorbereiten']
  steps.forEach((step, index) => {
    const y = 190 + index * 11
    doc.setFillColor(...GREEN)
    doc.circle(116, y - 1.5, 2.2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...NAVY)
    doc.text(step, 122, y)
  })

  doc.setFillColor(239, 247, 233)
  doc.roundedRect(14, 246, 182, 25, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GREEN)
  doc.text('HINWEIS', 21, 257)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...NAVY)
  doc.text('Die Projektdaten wurden automatisch aus der Quelldatei extrahiert.', 21, 264)
  footer(page)

  doc.save(`EMA-Projektliste-${safeFileName(sourceName)}.pdf`)
}
