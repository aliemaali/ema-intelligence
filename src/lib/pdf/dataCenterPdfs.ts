'use client'

import { AcroFormCheckBox, AcroFormComboBox, AcroFormTextField, jsPDF } from 'jspdf'
import GermanyMap from '@svg-maps/germany'

const NAVY = '#071A3D'
const NAVY_DARK = '#031126'
const BLUE = '#194A82'
const GREEN = '#5CB800'
const INK = '#17233B'
const MUTED = '#66738A'
const BORDER = '#DDE5EF'
const SURFACE = '#F4F7FB'
const WHITE = '#FFFFFF'
const ORANGE = '#D98212'
const RED = '#C73949'

export type DataCenterAssessmentPdfData = {
  projectName: string
  address: string
  city: string
  state: string
  latitude: number | null
  longitude: number | null
  gridCapacityMw: number | null
  gridStatus: string
  gridOperator: string
  voltageLevel: string
  pointOfConnection: string
  availableFrom: string
  pue: number
  planningStatus: string
  dataCenterUseStatus: string
  connectivityStatus: string
  carriers: string
  routeDiversityStatus: string
  offtakerStatus: string
  offtakerName: string
  projectModel: string
  purchasePriceMode: string
  totalPurchasePrice: number | null
  pricePerMw: number | null
  referenceCapacity: string
  risks: Array<{ label: string; value: string }>
}

function safeText(value: string) {
  return value.replace(/[–—]/g, '-').replace(/€/g, 'EUR')
}

function download(doc: jsPDF, filename: string) {
  doc.save(filename)
}

function drawHeader(doc: jsPDF, title: string, subtitle: string, pageNumber: number) {
  doc.setFillColor(NAVY)
  doc.rect(0, 0, 210, 26, 'F')
  doc.setFillColor(GREEN)
  doc.rect(0, 26, 210, 1.8, 'F')
  doc.setTextColor(WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('EMA', 15, 11)
  doc.setFontSize(9)
  doc.text(title, 37, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text(subtitle, 37, 17)
  doc.setDrawColor(BORDER)
  doc.line(15, 284, 195, 284)
  doc.setTextColor(MUTED)
  doc.setFontSize(6.5)
  doc.text('EMA INTELLIGENCE | VERTRAULICH / CONFIDENTIAL', 15, 290)
  doc.text(String(pageNumber), 192, 290, { align: 'right' })
}

function drawSection(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(SURFACE)
  doc.setDrawColor(BORDER)
  doc.roundedRect(15, y, 180, 10, 2, 2, 'FD')
  doc.setFillColor(GREEN)
  doc.roundedRect(15, y, 2.5, 10, 1, 1, 'F')
  doc.setTextColor(NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(safeText(title), 21, y + 6.4)
  return y + 15
}

function addTextField(doc: jsPDF, name: string, label: string, x: number, y: number, width = 84, height = 8, multiline = false) {
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  doc.text(safeText(label), x, y)
  const field = new AcroFormTextField()
  field.fieldName = name
  field.x = x
  field.y = y + 2
  field.width = width
  field.height = height
  field.fontSize = 8
  field.multiline = multiline
  doc.addField(field)
  doc.setDrawColor(BORDER)
  doc.setFillColor(WHITE)
  doc.roundedRect(x, y + 2, width, height, 1.2, 1.2, 'FD')
}

function addSelectField(doc: jsPDF, name: string, label: string, options: string[], x: number, y: number, width = 84) {
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  doc.text(safeText(label), x, y)
  const field = new AcroFormComboBox()
  field.fieldName = name
  field.x = x
  field.y = y + 2
  field.width = width
  field.height = 8
  field.fontSize = 7
  field.setOptions(options.map(safeText))
  field.value = safeText(options[0])
  field.defaultValue = field.value
  field.commitOnSelChange = true
  doc.addField(field)
  doc.setDrawColor(GREEN)
  doc.setFillColor(WHITE)
  doc.roundedRect(x, y + 2, width, 8, 1.2, 1.2, 'FD')
}

function addCheck(doc: jsPDF, name: string, label: string, x: number, y: number) {
  const field = new AcroFormCheckBox()
  field.fieldName = name
  field.x = x
  field.y = y
  field.width = 4
  field.height = 4
  field.appearanceState = 'Off'
  doc.addField(field)
  doc.setDrawColor(GREEN)
  doc.rect(x, y, 4, 4, 'S')
  doc.setTextColor(INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text(safeText(label), x + 6, y + 3.2)
}

function drawFactSheetFooter(doc: jsPDF, pageNumber: number) {
  doc.setDrawColor(BORDER)
  doc.line(15, 284, 195, 284)
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('EMA INTELLIGENCE | VERTRAULICH / CONFIDENTIAL', 15, 290)
  doc.text(`${pageNumber} / 2`, 195, 290, { align: 'right' })
}

export async function buildDataCenterFactSheetPdf() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true })
  doc.setProperties({ title: 'EMA Data Center Project Key Facts', author: 'EMA Enterprise GmbH', creator: 'EMA Data Center Analyzer' })
  const hero = await imageToJpegDataUrl('/hero-datacenter.webp')

  doc.setFillColor(NAVY_DARK)
  doc.rect(0, 0, 210, 80, 'F')
  if (hero) doc.addImage(hero, 'JPEG', 0, 0, 210, 72, undefined, 'FAST')
  doc.setFillColor(NAVY)
  doc.rect(0, 45, 210, 35, 'F')
  doc.setFillColor(GREEN)
  doc.rect(0, 78, 210, 2, 'F')
  doc.setTextColor(GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('EMA INTELLIGENCE', 15, 54)
  doc.setTextColor(WHITE)
  doc.setFontSize(17)
  doc.text('DATA CENTER PROJECT KEY FACTS', 15, 65)
  doc.setFontSize(7.5)
  doc.text('PROJEKT-ECKDATEN / PROJECT KEY FACTS', 15, 73)

  let y = drawSection(doc, 'A. PROJEKT & STANDORT / PROJECT & LOCATION', 87)
  addTextField(doc, 'project_name', 'Projektname / Project name', 15, y, 180)
  y += 14
  addTextField(doc, 'street', 'Strasse / Street', 15, y)
  addTextField(doc, 'house_number', 'Hausnummer / Number', 111, y, 36)
  addTextField(doc, 'postal_code', 'PLZ / Postal code', 155, y, 40)
  y += 14
  addTextField(doc, 'city', 'Ort / City', 15, y)
  addTextField(doc, 'state', 'Bundesland / State', 111, y)
  y += 14
  addTextField(doc, 'site_area', 'Grundstuecksgroesse m2 / Site area sqm (optional)', 15, y, 180)

  y = drawSection(doc, 'B. NETZANSCHLUSS / GRID CONNECTION', y + 15)
  addTextField(doc, 'grid_capacity_mw', 'Netzanschlussleistung MW / Grid capacity MW', 15, y)
  addTextField(doc, 'grid_operator', 'Netzbetreiber / Grid operator', 111, y)
  y += 14
  addSelectField(doc, 'voltage_level', 'Netzebene / Voltage level', ['Nicht bekannt / Unknown', '10 kV', '20 kV', '30 kV', '110 kV', '220 kV', '380 kV'], 15, y)
  addTextField(doc, 'point_of_connection', 'Uebergabepunkt / Point of connection', 111, y)
  y += 14
  addTextField(doc, 'available_from', 'Verfuegbar ab / Available from', 15, y)
  addSelectField(doc, 'grid_status', 'Netzstatus / Grid status', ['nur angegeben / indicated', 'angefragt / requested', 'Netzpruefung laeuft / grid study ongoing', 'grundsaetzlich moeglich / generally feasible', 'schriftlich bestaetigt / confirmed in writing', 'vertraglich gesichert / contractually secured'], 111, y)
  y += 14
  addCheck(doc, 'grid_confirmation_yes', 'Schriftlicher Netznachweis vorhanden / Written grid evidence available', 15, y)
  drawFactSheetFooter(doc, 1)

  doc.addPage()
  drawHeader(doc, 'DATA CENTER PROJECT KEY FACTS', 'PROJEKT-ECKDATEN / PROJECT KEY FACTS', 2)
  y = drawSection(doc, 'C. BAURECHT / PLANNING', 34)
  addSelectField(doc, 'planning_status', 'Aktueller Status / Current planning status', ['Nicht bekannt / Unknown', 'B-Plan vorhanden / Development plan', 'Gewerbegebiet / Commercial area', 'Industriegebiet / Industrial area', 'Section 34 BauGB', 'Section 35 BauGB', 'Bauvorbescheid / Preliminary permit', 'Baugenehmigung / Building permit'], 15, y, 180)
  y += 14
  addSelectField(doc, 'data_center_use', 'Rechenzentrumsnutzung / Data center use', ['Nicht bestaetigt / Not confirmed', 'Teilweise bestaetigt / Partially verified', 'Schriftlich bestaetigt / Confirmed in writing', 'Nicht zulaessig / Not permitted'], 15, y, 180)

  y = drawSection(doc, 'D. GLASFASER / CONNECTIVITY', y + 15)
  addSelectField(doc, 'fiber_available', 'Glasfaser vorhanden / Fiber available', ['Nicht bekannt / Unknown', 'Ja / Yes', 'In Planung / Planned', 'Nein / No'], 15, y)
  addTextField(doc, 'known_carriers', 'Bekannte Carrier / Known carriers', 111, y)
  y += 14
  addTextField(doc, 'fiber_distance', 'Entfernung / Distance', 15, y)
  addSelectField(doc, 'route_diversity', 'Redundante Trassen / Diverse routes', ['Nicht bestaetigt / Not confirmed', 'In Pruefung / Under review', 'Bestaetigt / Confirmed'], 111, y)

  y = drawSection(doc, 'E. PROJEKTMODELL & OFFTAKER / PROJECT MODEL & OFFTAKER', y + 15)
  addSelectField(doc, 'project_model', 'Projektmodell / Project model', ['Greenfield', 'Bestandsgebaeude / Existing building', 'Brownfield conversion', 'Shell', 'Powered shell', 'Turnkey / Colocation facility'], 15, y, 180)
  y += 14
  addSelectField(doc, 'offtaker_status', 'Offtaker-Status', ['keiner / None', 'wird gesucht / Searching', 'Erstkontakt / Initial contact', 'NDA', 'Interesse / Interest', 'LOI', 'HoT / Term sheet', 'verbindlicher Vertrag / Binding contract'], 15, y, 180)
  y += 14
  addTextField(doc, 'offtaker_name', 'Offtaker-Name', 15, y)
  addTextField(doc, 'offtaker_mw', 'Angefragte MW / Requested MW', 111, y)

  y = drawSection(doc, 'F. PROJEKTKAUFPREIS / PROJECT PURCHASE PRICE', y + 15)
  addSelectField(doc, 'price_mode', 'Preisart / Price mode', ['Gesamtpreis / Total purchase price', 'Preis pro MW / Price per MW'], 15, y)
  addSelectField(doc, 'reference_capacity', 'Bezugsbasis / Reference capacity', ['Nicht ausgewaehlt / Not selected', 'GRID MW', 'IT MW'], 111, y)
  y += 14
  addTextField(doc, 'total_purchase_price', 'Gesamtkaufpreis EUR / Total purchase price', 15, y)
  addTextField(doc, 'price_per_mw', 'Preis EUR/MW / Price per MW', 111, y)

  y = drawSection(doc, 'G. ENTSCHEIDUNGSRELEVANTE NACHWEISE / KEY DOCUMENTS', y + 15)
  const documents = [
    ['doc_grid_confirmation', 'Netzbestaetigung / Grid confirmation'], ['doc_grid_agreement', 'Netzvertrag / Grid agreement'],
    ['doc_development_plan', 'B-Plan / Development plan'], ['doc_building_permit', 'Baugenehmigung / Building permit'],
    ['doc_fiber', 'Carrier-Nachweis / Fiber evidence'], ['doc_offtaker', 'Offtaker-Nachweis / Offtaker evidence'],
    ['doc_site_plan', 'Lageplan / Site plan'], ['doc_land_register', 'Grundbuch / Land register'],
  ]
  documents.forEach(([name, label], index) => addCheck(doc, name, label, index % 2 === 0 ? 15 : 111, y + Math.floor(index / 2) * 7))
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('Angaben gelten bis zur Pruefung der Nachweise als nicht bestaetigt. / Information remains unverified until evidence has been reviewed.', 15, 279)
  drawFactSheetFooter(doc, 2)
  return doc
}

function money(value: number | null) {
  return value === null ? 'NOT AVAILABLE' : `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value)} EUR`
}

function mw(value: number | null) {
  return value === null ? 'NOT AVAILABLE' : `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} MW`
}

async function imageToJpegDataUrl(url: string) {
  if (typeof document === 'undefined') return null
  return new Promise<string | null>((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) return resolve(null)
      context.drawImage(image, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    image.onerror = () => resolve(null)
    image.src = url
  })
}

async function germanyMapDataUrl(latitude: number | null, longitude: number | null) {
  if (typeof document === 'undefined') return null
  const longitudeRatio = longitude === null ? null : Math.min(1, Math.max(0, (longitude - 5.866) / (15.042 - 5.866)))
  const latitudeRatio = latitude === null ? null : Math.min(1, Math.max(0, (55.1 - latitude) / (55.1 - 47.27)))
  const markerX = longitudeRatio === null ? null : (20 + longitudeRatio * 60) * 5.86
  const markerY = latitudeRatio === null ? null : (7 + latitudeRatio * 85) * 7.93
  const paths = GermanyMap.locations.map((location) => `<path d="${location.path}" fill="#082647" stroke="#4F7DBA" stroke-width="1.3"/>`).join('')
  const marker = markerX === null || markerY === null ? '' : `<circle cx="${markerX}" cy="${markerY}" r="15" fill="#70E52D" stroke="#FFFFFF" stroke-width="6"/><circle cx="${markerX}" cy="${markerY}" r="4" fill="#07142F"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${GermanyMap.viewBox}" width="586" height="793"><rect width="586" height="793" rx="30" fill="#03142C"/>${paths}${marker}</svg>`
  return new Promise<string | null>((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 586
      canvas.height = 793
      const context = canvas.getContext('2d')
      if (!context) return resolve(null)
      context.drawImage(image, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    image.onerror = () => resolve(null)
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

function drawAssessmentHeader(doc: jsPDF, title: string, pageNumber: number) {
  drawHeader(doc, title, 'PROJEKTANALYSE / PROJECT ASSESSMENT', pageNumber)
}

function drawMetric(doc: jsPDF, x: number, y: number, width: number, label: string, value: string, status: string, color = GREEN) {
  doc.setFillColor(WHITE)
  doc.setDrawColor(BORDER)
  doc.roundedRect(x, y, width, 26, 2.5, 2.5, 'FD')
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.8)
  doc.text(safeText(label), x + 4, y + 6)
  doc.setTextColor(NAVY)
  doc.setFontSize(11)
  doc.text(safeText(value), x + 4, y + 15)
  doc.setTextColor(color)
  doc.setFontSize(5.5)
  doc.text(safeText(status), x + 4, y + 21.5)
}

function drawRows(doc: jsPDF, rows: Array<[string, string]>, startY: number) {
  rows.forEach(([label, value], index) => {
    const y = startY + index * 12
    doc.setTextColor(MUTED)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.text(safeText(label), 18, y)
    doc.setTextColor(INK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.2)
    doc.text(doc.splitTextToSize(safeText(value || 'NOT AVAILABLE'), 92), 100, y)
    doc.setDrawColor(BORDER)
    doc.line(18, y + 4, 192, y + 4)
  })
}

export async function buildDataCenterAssessmentPdf(data: DataCenterAssessmentPdfData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true })
  const hero = await imageToJpegDataUrl('/hero-datacenter.webp')
  const map = await germanyMapDataUrl(data.latitude, data.longitude)
  const itCapacity = data.gridCapacityMw && data.pue > 0 ? data.gridCapacityMw / data.pue : null
  const price = data.purchasePriceMode === 'total'
    ? data.totalPurchasePrice
    : data.pricePerMw && data.referenceCapacity
      ? data.pricePerMw * (data.referenceCapacity === 'grid' ? (data.gridCapacityMw ?? 0) : (itCapacity ?? 0))
      : null
  const critical = [
    !data.gridCapacityMw || !['confirmed_in_writing', 'contractually_secured'].includes(data.gridStatus),
    data.planningStatus === 'planning_conflict',
    data.risks.some((risk) => risk.value === 'red'),
  ].filter(Boolean).length
  const stage = critical ? 'CRITICAL' : data.gridCapacityMw && data.address ? 'DEVELOPMENT' : 'EARLY STAGE'

  doc.setFillColor(NAVY_DARK)
  doc.rect(0, 0, 210, 297, 'F')
  if (hero) doc.addImage(hero, 'JPEG', 0, 0, 210, 118, undefined, 'FAST')
  doc.setFillColor(NAVY)
  doc.rect(0, 105, 210, 192, 'F')
  doc.setFillColor(GREEN)
  doc.rect(0, 105, 210, 2, 'F')
  doc.setTextColor(GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('EMA INTELLIGENCE', 18, 132)
  doc.setTextColor(WHITE)
  doc.setFontSize(22)
  doc.text('DATA CENTER PROJECT', 18, 150)
  doc.text('ASSESSMENT', 18, 163)
  doc.setFontSize(8)
  doc.text('PROJEKTANALYSE / PROJECT ASSESSMENT', 18, 175)
  doc.setFontSize(18)
  doc.text(doc.splitTextToSize(safeText(data.projectName || data.city || 'DATA CENTER PROJECT'), 170), 18, 202)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor('#C4D0E0')
  doc.text(doc.splitTextToSize(safeText(data.address || data.city || 'Standort nicht angegeben / Location not provided'), 170), 18, 220)
  doc.setDrawColor(BLUE)
  doc.setFillColor(BLUE)
  doc.roundedRect(18, 242, 82, 27, 3, 3, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('PROJECT STAGE / PROJEKTSTUFE', 24, 251)
  doc.setTextColor(stage === 'CRITICAL' ? '#FF91A0' : '#8AE33B')
  doc.setFontSize(12)
  doc.text(stage, 24, 261)
  doc.setTextColor('#C4D0E0')
  doc.setFontSize(7)
  doc.text(`Analysedatum / Analysis date: ${new Date().toLocaleDateString('de-DE')}`, 18, 283)

  doc.addPage()
  drawAssessmentHeader(doc, 'PROJECT OVERVIEW / PROJEKTUEBERSICHT', 2)
  drawMetric(doc, 15, 36, 56, 'NETZLEISTUNG / GRID CAPACITY', mw(data.gridCapacityMw), 'NOT VERIFIED', ORANGE)
  drawMetric(doc, 77, 36, 56, 'IT-LEISTUNG / IT CAPACITY', mw(itCapacity), 'ESTIMATED', BLUE)
  drawMetric(doc, 139, 36, 56, 'PROJEKTKAUFPREIS / PURCHASE PRICE', money(price), data.referenceCapacity === 'it' ? 'ESTIMATED BASIS' : 'INDICATED', data.referenceCapacity === 'it' ? ORANGE : GREEN)
  let y = drawSection(doc, 'STANDORT / LOCATION', 70)
  doc.setTextColor(NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(doc.splitTextToSize(safeText(data.address || 'NOT AVAILABLE'), 95), 18, y)
  doc.setTextColor(MUTED)
  doc.setFontSize(7)
  doc.text(safeText([data.city, data.state].filter(Boolean).join(' | ')), 18, y + 10)
  if (map) doc.addImage(map, 'JPEG', 112, y - 4, 70, 95, undefined, 'FAST')
  else {
    doc.setFillColor(SURFACE)
    doc.setDrawColor(BORDER)
    doc.roundedRect(112, y - 4, 70, 95, 3, 3, 'FD')
    doc.text('Map not available', 130, y + 42)
  }
  drawRows(doc, [
    ['Grid status / Netzstatus', data.gridStatus.replaceAll('_', ' ')],
    ['Planning / Baurecht', data.planningStatus || 'NOT AVAILABLE'],
    ['Connectivity / Glasfaser', data.connectivityStatus || 'NOT AVAILABLE'],
    ['Route diversity / Trassenredundanz', data.routeDiversityStatus || 'NOT VERIFIED'],
    ['Offtaker', `${data.offtakerStatus.replaceAll('_', ' ')}${data.offtakerName ? ` | ${data.offtakerName}` : ''}`],
    ['Project model / Projektmodell', data.projectModel.replaceAll('_', ' ')],
  ], y + 115)

  doc.addPage()
  drawAssessmentHeader(doc, 'TECHNICAL & COMMERCIAL SCREENING', 3)
  y = drawSection(doc, 'NETZANSCHLUSS / GRID CONNECTION', 34)
  drawRows(doc, [
    ['Netzleistung / Grid capacity', mw(data.gridCapacityMw)],
    ['Status', data.gridStatus.replaceAll('_', ' ')],
    ['Netzbetreiber / Grid operator', data.gridOperator],
    ['Netzebene / Voltage level', data.voltageLevel],
    ['Uebergabepunkt / Point of connection', data.pointOfConnection],
    ['Verfuegbar ab / Available from', data.availableFrom],
  ], y)
  y = drawSection(doc, 'GESCHAETZTE IT-LEISTUNG / ESTIMATED IT CAPACITY', y + 78)
  ;[1.2, 1.25, 1.3].forEach((pue, index) => drawMetric(doc, 15 + index * 62, y, 56, `PUE ${pue.toFixed(2)}`, mw(data.gridCapacityMw ? data.gridCapacityMw / pue : null), 'SCREENING ESTIMATE', BLUE))
  y = drawSection(doc, 'PROJEKTKAUFPREIS / PROJECT PURCHASE PRICE', y + 34)
  drawRows(doc, [
    ['Preisart / Price mode', data.purchasePriceMode],
    ['Preis pro MW / Price per MW', money(data.pricePerMw)],
    ['Bezugsbasis / Reference capacity', data.referenceCapacity === 'it' ? 'IT MW - ESTIMATED BASIS' : data.referenceCapacity === 'grid' ? 'GRID MW' : 'NOT SELECTED'],
    ['Berechneter Kaufpreis / Calculated price', money(price)],
  ], y)
  doc.addPage()
  drawAssessmentHeader(doc, 'PROJECT STATUS / PROJEKTSTATUS', 4)
  y = drawSection(doc, 'BAURECHT, CONNECTIVITY & OFFTAKER', 34)
  drawRows(doc, [
    ['Data-Center-Nutzung / Data center use', data.dataCenterUseStatus],
    ['Carrier', data.carriers],
    ['Trassenredundanz / Route diversity', data.routeDiversityStatus],
    ['Offtaker status', data.offtakerStatus.replaceAll('_', ' ')],
  ], y)
  y = drawSection(doc, 'BESTAETIGT / VERIFIED', y + 57)
  const verifiedItems = [
    data.dataCenterUseStatus === 'confirmed' ? 'Data-Center-Nutzung schriftlich bestaetigt / Data center use confirmed in writing' : '',
    data.routeDiversityStatus === 'confirmed' ? 'Physische Trassenredundanz dokumentiert / Physical route diversity documented' : '',
    data.offtakerStatus === 'binding_contract' ? 'Verbindlicher Offtake-Vertrag angegeben / Binding offtake agreement indicated' : '',
  ].filter(Boolean)
  doc.setTextColor(verifiedItems.length ? GREEN : MUTED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(doc.splitTextToSize(safeText(verifiedItems.join(' | ') || 'Keine Position ist ohne geprueften Nachweis als VERIFIED eingestuft / No item is classified as VERIFIED without reviewed evidence'), 170), 18, y)
  y = drawSection(doc, 'FEHLENDE UNTERLAGEN / MISSING DOCUMENTS', y + 28)
  const missingDocuments = [
    !['confirmed_in_writing', 'contractually_secured'].includes(data.gridStatus) ? 'Netzanschlussbestaetigung / Grid confirmation' : '',
    data.dataCenterUseStatus !== 'confirmed' ? 'Bestaetigung Data-Center-Nutzung / Confirmation of data center use' : '',
    data.routeDiversityStatus !== 'confirmed' ? 'Nachweis Trassenredundanz / Route diversity evidence' : '',
    data.offtakerStatus !== 'binding_contract' ? 'Verbindliche Offtaker-Unterlagen / Binding offtaker documents' : '',
  ].filter(Boolean)
  doc.setTextColor(ORANGE)
  doc.text(doc.splitTextToSize(safeText(missingDocuments.join(' | ') || 'Keine fehlenden Unterlagen aus den aktuellen Eingaben abgeleitet'), 170), 18, y)
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(doc.splitTextToSize('Statushinweis / Status note: Angaben im Analyzer ersetzen keine Dokumentenpruefung. Nicht auffindbare Informationen werden nicht als risikofrei bewertet.', 170), 18, y + 35)

  doc.addPage()
  drawAssessmentHeader(doc, 'RISKS & NEXT STEPS / RISIKEN & NAECHSTE SCHRITTE', 5)
  y = drawSection(doc, 'STANDORT-RISIKOANALYSE / SITE RISK ANALYSIS', 34)
  data.risks.forEach((risk, index) => {
    const rowY = y + index * 12
    const color = risk.value === 'red' ? RED : risk.value === 'orange' ? ORANGE : risk.value === 'green' ? GREEN : MUTED
    doc.setFillColor(color)
    doc.circle(19, rowY - 1.5, 2, 'F')
    doc.setTextColor(NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(safeText(risk.label), 25, rowY)
    doc.setTextColor(color)
    doc.text(risk.value.toUpperCase(), 190, rowY, { align: 'right' })
    doc.setDrawColor(BORDER)
    doc.line(18, rowY + 4, 192, rowY + 4)
  })
  y = drawSection(doc, 'KRITISCH / CRITICAL', y + data.risks.length * 12 + 8)
  const criticalItems = [
    !data.gridCapacityMw ? 'Netzanschlussleistung fehlt / Grid capacity missing' : !['confirmed_in_writing', 'contractually_secured'].includes(data.gridStatus) ? 'Netzanschluss nicht bestaetigt / Grid connection not confirmed' : '',
    data.planningStatus === 'planning_conflict' ? 'Baurechtlicher Konflikt angegeben / Planning conflict indicated' : '',
    ...data.risks.filter((risk) => risk.value === 'red').map((risk) => `${risk.label}: RED`),
  ].filter(Boolean)
  doc.setTextColor(criticalItems.length ? RED : GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(doc.splitTextToSize(safeText(criticalItems.join(' | ') || 'Keine kritischen Punkte aus den aktuellen Eingaben / No critical items from current inputs'), 170), 18, y)
  y = drawSection(doc, 'ZU PRUEFEN / TO VERIFY', y + 28)
  const verify = [
    data.dataCenterUseStatus !== 'confirmed' ? 'Data-Center-Nutzung bestaetigen / Confirm data center use' : '',
    data.routeDiversityStatus !== 'confirmed' ? 'Physische Glasfaserredundanz pruefen / Verify physical route diversity' : '',
    data.offtakerStatus !== 'binding_contract' ? 'Verbindlichen Offtake-Vertrag pruefen / Verify binding offtake agreement' : '',
  ].filter(Boolean)
  doc.setTextColor(ORANGE)
  doc.text(doc.splitTextToSize(safeText(verify.join(' | ') || 'Keine offenen Punkte aus den aktuellen Eingaben'), 170), 18, y)
  y = drawSection(doc, 'EMA CONCLUSION', y + 28)
  doc.setTextColor(INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const conclusion = `${data.city || 'Der Standort'} befindet sich in der Projektstufe ${stage}. ${data.gridCapacityMw ? `Die erfasste Netzleistung betraegt ${mw(data.gridCapacityMw)} und ist bis zur Dokumentenpruefung nicht bestaetigt.` : 'Eine Netzanschlussleistung ist noch nicht verfuegbar.'} ${itCapacity ? `Bei PUE ${data.pue.toFixed(2)} ergibt sich eine geschaetzte IT-Leistung von ${mw(itCapacity)}.` : ''} Vor einer Investor- oder Offtaker-Ansprache sind die offenen Nachweise abschliessend zu pruefen.`
  doc.text(doc.splitTextToSize(safeText(conclusion), 170), 18, y)
  return doc
}

export async function downloadDataCenterFactSheetPdf() {
  download(await buildDataCenterFactSheetPdf(), 'EMA_Data_Center_Project_Key_Facts_DE_EN.pdf')
}

export async function downloadDataCenterAssessmentPdf(data: DataCenterAssessmentPdfData) {
  download(await buildDataCenterAssessmentPdf(data), `EMA_Data_Center_Project_Assessment_${(data.projectName || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`)
}
