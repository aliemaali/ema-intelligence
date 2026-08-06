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
  latitude?: number | null
  longitude?: number | null
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

type JsPdfDoc = InstanceType<typeof import('jspdf').default>
type LoadedImage = { dataUrl: string; format: 'JPEG' | 'PNG'; aspect?: number }
type Point = { x: number; y: number }

const STATE_POINTS: Record<string, Point> = {
  'schleswig-holstein': { x: 49, y: 10 }, hamburg: { x: 48, y: 19 }, bremen: { x: 36, y: 27 },
  niedersachsen: { x: 42, y: 31 }, 'mecklenburg-vorpommern': { x: 66, y: 23 }, brandenburg: { x: 67, y: 41 },
  berlin: { x: 70, y: 40 }, sachsen: { x: 68, y: 59 }, 'sachsen-anhalt': { x: 56, y: 45 },
  thüringen: { x: 54, y: 57 }, hessen: { x: 43, y: 58 }, 'nordrhein-westfalen': { x: 28, y: 49 },
  'rheinland-pfalz': { x: 31, y: 66 }, saarland: { x: 24, y: 73 }, 'baden-württemberg': { x: 38, y: 82 },
  bayern: { x: 59, y: 79 },
}

const CITY_POINTS: Record<string, Point> = {
  worms: { x: 34, y: 69 }, berlin: { x: 70, y: 40 }, hamburg: { x: 48, y: 19 }, münchen: { x: 59, y: 89 },
  stuttgart: { x: 39, y: 79 }, frankfurt: { x: 41, y: 62 }, leipzig: { x: 61, y: 53 }, dresden: { x: 70, y: 57 },
  köln: { x: 28, y: 52 }, hannover: { x: 43, y: 35 }, polßen: { x: 67, y: 41 }, polssen: { x: 67, y: 41 },
}

function safeText(value: unknown, fallback = '—') {
  return value === null || value === undefined || value === '' ? fallback : String(value)
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

async function loadImageAsDataUrl(url: string): Promise<LoadedImage | null> {
  if (!url || url.toLowerCase().endsWith('.svg')) return null
  try {
    const response = await fetch(url, { cache: 'force-cache' })
    if (!response.ok) return null
    const blob = await response.blob()
    const mime = blob.type || ''
    if (!blob.size || (!mime.includes('png') && !mime.includes('jpeg') && !mime.includes('jpg'))) return null
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
    return dataUrl ? { dataUrl, format: mime.includes('png') ? 'PNG' : 'JPEG' } : null
  } catch { return null }
}

function resolveMapPoint(data: MemorandumPdfData): Point {
  const location = safeText(data.location, '').toLowerCase()
  const city = Object.entries(CITY_POINTS).find(([name]) => location.includes(name))?.[1]
  if (city) return city
  const state = Object.entries(STATE_POINTS).find(([name]) => location.includes(name))?.[1]
  return state ?? { x: 50, y: 50 }
}

async function createDashboardMapImage(data: MemorandumPdfData): Promise<LoadedImage | null> {
  try {
    const svgMaps = await import('@svg-maps/germany')
    const germany = svgMaps.default
    const point = resolveMapPoint(data)
    const [minX, minY, vbW, vbH] = germany.viewBox.split(' ').map(Number)
    const markerX = minX + (point.x / 100) * vbW
    const markerY = minY + (point.y / 100) * vbH
    const aspect = vbW > 0 && vbH > 0 ? vbW / vbH : 0.75
    const canvasH = 1020
    const canvasW = Math.round(canvasH * aspect)
    const border = Math.max(vbW, vbH) * 0.008
    const paths = germany.locations.map((location) => `<path d="${location.path}" fill="url(#fill)" stroke="#1F2A44" stroke-width="${border}" stroke-linejoin="round" stroke-linecap="round"/>`).join('')
    const radius = Math.max(vbW, vbH) * 0.034
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${germany.viewBox}" width="${canvasW}" height="${canvasH}"><defs><linearGradient id="fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#EDF4E4"/><stop offset="100%" stop-color="#CFE3B4"/></linearGradient></defs>${paths}<circle cx="${markerX}" cy="${markerY}" r="${radius * 1.7}" fill="#FFFFFF" opacity="0.97"/><circle cx="${markerX}" cy="${markerY}" r="${radius * 1.2}" fill="#1F2A44"/><circle cx="${markerX}" cy="${markerY}" r="${radius}" fill="#5CB800"/><circle cx="${markerX}" cy="${markerY}" r="${radius * 0.34}" fill="#FFFFFF"/></svg>`
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    const loaded = await new Promise<boolean>((resolve) => { image.onload = () => resolve(true); image.onerror = () => resolve(false); image.src = url })
    if (!loaded) { URL.revokeObjectURL(url); return null }
    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH
    const context = canvas.getContext('2d')
    if (!context) { URL.revokeObjectURL(url); return null }
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    return { dataUrl: canvas.toDataURL('image/png'), format: 'PNG', aspect }
  } catch { return null }
}

function addImage(doc: JsPdfDoc, image: LoadedImage | null, x: number, y: number, width: number, height: number) {
  if (!image) return
  try { doc.addImage(image.dataUrl, image.format, x, y, width, height, undefined, 'FAST') } catch { /* optional image */ }
}

function heading(doc: JsPdfDoc, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.3); doc.setTextColor(...NAVY); doc.text(label.toUpperCase(), x, y)
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.8); doc.line(x, y + 1.8, x + 12, y + 1.8)
}

function symbolKey(label: string) {
  return safeText(label, '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function drawSolarPanel(doc: JsPdfDoc, cx: number, cy: number) {
  doc.line(cx - 4.2, cy + 3, cx - 3, cy - 3); doc.line(cx - 3, cy - 3, cx + 3, cy - 3)
  doc.line(cx + 3, cy - 3, cx + 4.2, cy + 3); doc.line(cx + 4.2, cy + 3, cx - 4.2, cy + 3)
  doc.line(cx - 3.6, cy, cx + 3.6, cy); doc.line(cx - 1, cy - 3, cx - 1.4, cy + 3); doc.line(cx + 1, cy - 3, cx + 1.4, cy + 3)
}

function drawClock(doc: JsPdfDoc, cx: number, cy: number) {
  doc.circle(cx, cy, 4.2, 'S'); doc.line(cx, cy, cx, cy - 2.7); doc.line(cx, cy, cx + 2.1, cy + 1.3)
}

function drawBanknote(doc: JsPdfDoc, cx: number, cy: number) {
  doc.roundedRect(cx - 4.4, cy - 3, 8.8, 6, 1, 1, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.text('€', cx, cy + 2.1, { align: 'center' })
}

function drawEuroCircle(doc: JsPdfDoc, cx: number, cy: number) {
  doc.circle(cx, cy, 4.2, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); doc.text('€', cx, cy + 2.1, { align: 'center' })
}

function drawCoins(doc: JsPdfDoc, cx: number, cy: number, ink: [number, number, number]) {
  doc.setFillColor(...ink)
  doc.circle(cx - 1.3, cy + 1.2, 3.1, 'S'); doc.circle(cx + 1.6, cy - 1.2, 3.1, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.2); doc.text('€', cx + 1.6, cy + 0.5, { align: 'center' })
}

function drawRisingBars(doc: JsPdfDoc, cx: number, cy: number, ink: [number, number, number]) {
  doc.setFillColor(...ink)
  doc.rect(cx - 4.2, cy + 0.6, 1.9, 2.6, 'F')
  doc.rect(cx - 1.6, cy - 1.2, 1.9, 4.4, 'F')
  doc.rect(cx + 1, cy - 3.2, 1.9, 6.4, 'F')
  doc.line(cx - 4.6, cy + 3.4, cx + 4.4, cy + 3.4)
}

function drawYieldCurve(doc: JsPdfDoc, cx: number, cy: number, ink: [number, number, number]) {
  doc.setFillColor(...ink)
  doc.line(cx - 4.2, cy - 3.4, cx - 4.2, cy + 3.2); doc.line(cx - 4.2, cy + 3.2, cx + 4.2, cy + 3.2)
  doc.line(cx - 3.6, cy + 2, cx - 1.2, cy + 0.2); doc.line(cx - 1.2, cy + 0.2, cx + 0.8, cy + 1.1); doc.line(cx + 0.8, cy + 1.1, cx + 3.4, cy - 2.6)
  doc.triangle(cx + 3.4, cy - 2.6, cx + 1.5, cy - 2.2, cx + 3, cy - 0.7, 'F')
}

function drawDataSheet(doc: JsPdfDoc, cx: number, cy: number) {
  doc.roundedRect(cx - 3.4, cy - 4, 6.8, 8, 0.9, 0.9, 'S')
  doc.line(cx - 2, cy - 1.8, cx + 2, cy - 1.8); doc.line(cx - 2, cy, cx + 2, cy); doc.line(cx - 2, cy + 1.8, cx + 0.8, cy + 1.8)
}

function drawSymbol(doc: JsPdfDoc, label: string, cx: number, cy: number, highlighted = false) {
  const ink = highlighted ? [255, 255, 255] as [number, number, number] : DARK_GREEN
  doc.setDrawColor(...ink); doc.setTextColor(...ink); doc.setLineWidth(0.62)
  const key = symbolKey(label)

  // Spezifische Treffer immer vor dem allgemeinen Fallback prüfen.
  if (key.includes('amort')) { drawClock(doc, cx, cy); return }
  if (key.includes('kaufpreis')) { drawBanknote(doc, cx, cy); return }
  if (key.includes('leistung') || key.includes('produktion')) { drawSolarPanel(doc, cx, cy); return }
  if (key.includes('spezertrag') || key.includes('spezifischerertrag') || key.includes('spezifisch') || key.includes('ertragkwp') || key.includes('ertrag')) { drawYieldCurve(doc, cx, cy, ink); return }
  if (key.includes('rendite') || key.includes('irr') || key.includes('roi')) { drawRisingBars(doc, cx, cy, ink); return }
  if (key.includes('verguetung') || key.includes('vergutung') || key.includes('tarif') || key.includes('eeg')) { drawCoins(doc, cx, cy, ink); return }
  if (key.includes('erlos') || key.includes('umsatz') || key.includes('einnahme') || key.includes('cashflow')) { drawCoins(doc, cx, cy, ink); return }
  if (key.includes('preis') || key.includes('eur') || key.includes('capex') || key.includes('opex') || key.includes('wert')) { drawEuroCircle(doc, cx, cy); return }
  drawDataSheet(doc, cx, cy)
}

function parsePvKwp(metrics: MemorandumPdfData['metrics']) {
  const metric = metrics.find((item) => item.label.toLowerCase().includes('pv-leistung') || item.label.toLowerCase() === 'leistung')
  if (!metric) return 0
  const value = Number.parseFloat(metric.value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(value) ? value : 0
}

function metricCard(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string, highlighted: boolean, secondary = '') {
  doc.setFillColor(...(highlighted ? GREEN : [255, 255, 255] as [number, number, number])); doc.setDrawColor(...(highlighted ? GREEN : BORDER))
  doc.roundedRect(x, y, width, 35, 2.5, 2.5, 'FD')
  const cx = x + width / 2
  doc.setDrawColor(...(highlighted ? [255, 255, 255] as [number, number, number] : GREEN)); doc.circle(cx, y + 9.2, 7.2, 'S')
  drawSymbol(doc, label, cx, y + 9.2, highlighted)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.7); doc.setTextColor(...(highlighted ? [255,255,255] as [number,number,number] : NAVY)); doc.text(label.toUpperCase(), cx, y + 19, { align: 'center' })
  doc.setFontSize(10.2); doc.text(doc.splitTextToSize(value, width - 5), cx, y + 26, { align: 'center' })
  if (secondary) { doc.setFontSize(6.3); doc.setTextColor(...(highlighted ? [240,255,230] as [number,number,number] : MUTED)); doc.text(secondary, cx, y + 32, { align: 'center' }) }
}

function economyBar(doc: JsPdfDoc, x: number, y: number, width: number, label: string, value: string, percentage: number) {
  drawSymbol(doc, label, x + 4, y + 1.5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(...MUTED); doc.text(label, x + 11, y)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY); doc.text(value, x + width, y, { align: 'right' })
  doc.setFillColor(232,236,240); doc.roundedRect(x + 11, y + 2, width - 11, 3, 1.5, 1.5, 'F')
  doc.setFillColor(...GREEN); doc.roundedRect(x + 11, y + 2, Math.max(0, Math.min(width - 11, (width - 11) * percentage / 100)), 3, 1.5, 1.5, 'F')
}

function renderPage(doc: JsPdfDoc, data: MemorandumPdfData, logo: LoadedImage | null, hero: LoadedImage | null, flag: LoadedImage | null, map: LoadedImage | null) {
  doc.setFillColor(255,255,255); doc.rect(0,0,PAGE_W,PAGE_H,'F')
  addImage(doc, logo, MARGIN, 5, 31, 13)
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...NAVY); doc.text('INVESTMENT MEMORANDUM', PAGE_W-MARGIN, 11, { align:'right' })
  doc.setFontSize(6.4); doc.setTextColor(...GREEN); doc.text(`${safeText(data.projectNumber)} · ${safeText(data.typeLabel)}`.toUpperCase(), PAGE_W-MARGIN, 17, { align:'right' })

  const heroY=23, heroH=71
  doc.setFillColor(...NAVY); doc.roundedRect(MARGIN,heroY,CONTENT_W,heroH,3,3,'F'); addImage(doc,hero,76,heroY,PAGE_W-MARGIN-76,heroH)
  doc.setFillColor(...NAVY); doc.roundedRect(MARGIN,heroY,70,heroH,3,3,'F')
  doc.setFillColor(...GREEN); doc.roundedRect(14,31,39,7,1.7,1.7,'F'); doc.setTextColor(255,255,255); doc.setFontSize(6.2); doc.text(safeText(data.typeLabel).toUpperCase(),33.5,35.7,{align:'center'})
  doc.setFontSize(18); doc.text(doc.splitTextToSize(safeText(data.projectName,'Projekt'),60),14,51); doc.setDrawColor(...GREEN); doc.line(14,61,27,61)
  addImage(doc,flag,14,71,9,6); doc.setFontSize(7); doc.text(safeText(data.location),flag?27:14,75); doc.text(`${safeText(data.country)} · ${safeText(data.status)}`,flag?27:14,81)

  const metrics=data.metrics.filter((item)=>hasValue(item.value)&&!item.label.toLowerCase().includes('pachtdauer')).slice(0,5)
  const gap=2.5, cardW=(CONTENT_W-gap*4)/5, pvKwp=parsePvKwp(metrics)
  const pricePerKwp=data.pvEconomics&&pvKwp>0&&data.pvEconomics.purchasePrice>0?data.pvEconomics.purchasePrice/pvKwp:0
  metrics.forEach((metric,index)=>metricCard(doc,MARGIN+index*(cardW+gap),99,cardW,metric.label,metric.value,metric.label.toLowerCase().includes('amort'),metric.label.toLowerCase().includes('kaufpreis')&&pricePerKwp>0?`${number(pricePerKwp)} €/kWp`:''))

  const leftX=MARGIN,rightX=101
  heading(doc,'Executive Summary',leftX,145); doc.setFont('helvetica','normal'); doc.setFontSize(6.6); doc.setTextColor(40,52,68); doc.text(doc.splitTextToSize(safeText(data.summary),83),leftX,154)
  doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER); doc.roundedRect(leftX,166,83,24,2.5,2.5,'FD')
  doc.setFont('helvetica','bold'); doc.setFontSize(5.5); doc.setTextColor(...NAVY); doc.text('PROJEKTSTANDORT',leftX+4,171)
  const mapH=16, mapW=Math.min(24,mapH*(map?.aspect??0.75))
  addImage(doc,map,leftX+4+(24-mapW)/2,172,mapW,mapH)
  doc.setFontSize(6.2); doc.text(doc.splitTextToSize(data.location,45),leftX+34,177)
  doc.setFont('helvetica','normal'); doc.setFontSize(5.2); doc.setTextColor(...MUTED); doc.text('Identische Kartenbasis wie im Dashboard',leftX+34,185)

  heading(doc,'Projektprofil',rightX,145)
  data.profile.filter((row)=>hasValue(row.value)).slice(0,5).forEach((row,index)=>{const y=154+index*7.8;doc.setDrawColor(...BORDER);doc.line(rightX,y+2.5,PAGE_W-MARGIN,y+2.5);doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(...MUTED);doc.text(row.label,rightX+1,y);doc.setFont('helvetica','bold');doc.setTextColor(...NAVY);doc.text(doc.splitTextToSize(row.value,39),PAGE_W-MARGIN-1,y,{align:'right'})})

  heading(doc,'Visuelle Wirtschaftlichkeit',leftX,196)
  if(data.showPvEconomics&&data.pvEconomics){const e=data.pvEconomics;if(e.roi>0)economyBar(doc,leftX,206,87,'Rendite p.a.',`${number(e.roi,2)} %`,Math.min(100,e.roi*7));if(e.amortisation>0)economyBar(doc,leftX,218,87,'Amortisation',`${number(e.amortisation,1)} Jahre`,Math.max(8,100-e.amortisation*4));if(e.annualRevenue>0)economyBar(doc,leftX,230,87,'Jahreserlös',money(e.annualRevenue),e.purchasePrice>0?Math.min(100,e.annualRevenue/e.purchasePrice*700):0)}

  heading(doc,'Investment Highlights',rightX,196)
  data.highlights.filter(hasValue).slice(0,4).forEach((highlight,index)=>{const y=205+index*10.6;doc.setFillColor(...LIGHT);doc.setDrawColor(...BORDER);doc.roundedRect(rightX,y-4.5,PAGE_W-MARGIN-rightX,9,2,2,'FD');doc.setFillColor(...DARK_GREEN);doc.circle(rightX+4,y,2,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(5.5);doc.text('✓',rightX+4,y+1.8,{align:'center'});doc.setFont('helvetica','normal');doc.setFontSize(5.9);doc.setTextColor(40,52,68);doc.text(doc.splitTextToSize(highlight,PAGE_W-MARGIN-rightX-10),rightX+8,y+1)})

  heading(doc,data.showPvEconomics?'Wirtschaftliche Kennzahlen':'Projektkennzahlen',leftX,251)
  doc.setFillColor(...LIGHT);doc.setDrawColor(...BORDER);doc.roundedRect(leftX,255,CONTENT_W,23,2.5,2.5,'FD')
  const details=data.showPvEconomics&&data.pvEconomics?[
    data.pvEconomics.annualYield>0?['Jahresproduktion',`${number(data.pvEconomics.annualYield)} kWh`]:null,
    data.pvEconomics.annualRevenue>0?['Jahreserlös',money(data.pvEconomics.annualRevenue)]:null,
    data.pvEconomics.purchasePrice>0?['Kaufpreis',money(data.pvEconomics.purchasePrice)]:null,
    pricePerKwp>0?['Preis pro kWp',`${number(pricePerKwp)} €/kWp`]:null,
    data.pvEconomics.roi>0?['Rendite p.a.',`${number(data.pvEconomics.roi,2)} %`]:null,
    data.pvEconomics.amortisation>0?['Amortisation',`${number(data.pvEconomics.amortisation,1)} Jahre`]:null,
  ].filter(Boolean) as string[][]:metrics.slice(0,6).map((item)=>[item.label,item.value])
  details.slice(0,6).forEach((row,index)=>{const col=index%3,line=Math.floor(index/3),x=leftX+col*(CONTENT_W/3),y=262+line*10;drawSymbol(doc,row[0],x+7,y+1);doc.setFont('helvetica','normal');doc.setFontSize(5.4);doc.setTextColor(...MUTED);doc.text(row[0].toUpperCase(),x+15,y);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...NAVY);doc.text(row[1],x+15,y+4.8)})

  doc.setDrawColor(...GREEN);doc.setLineWidth(0.4);doc.line(MARGIN,282,PAGE_W-MARGIN,282);doc.setFont('helvetica','normal');doc.setFontSize(5.8);doc.setTextColor(...MUTED);doc.text('EMA Enterprise GmbH · Gabriel-von-Seidl-Str. 56 · 67550 Worms',MARGIN,287);doc.text('info@ema-enterprise.de · www.ema-enterprise.de',PAGE_W/2,287,{align:'center'});doc.text(`${safeText(data.projectNumber)} · ${safeText(data.dateLabel)}`,PAGE_W-MARGIN,287,{align:'right'})
}

export async function generateMemorandumPdf(data: MemorandumPdfData): Promise<Blob> {
  if (!data || !safeText(data.projectName,'').trim()) throw new PdfGenerationError('Daten prüfen','Der Projektname fehlt.')
  let JsPDF: typeof import('jspdf').default
  try { JsPDF=(await import('jspdf')).default } catch(error){throw new PdfGenerationError('jsPDF laden','Die PDF-Bibliothek konnte nicht geladen werden.',error)}
  const [logo,hero,flag,map]=await Promise.all([loadImageAsDataUrl('/ema-logo.jpeg'),loadImageAsDataUrl(data.heroImage),loadImageAsDataUrl(data.countryFlag),createDashboardMapImage(data)])
  const doc=new JsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true})
  try { renderPage(doc,data,logo,hero,flag,map) } catch(error){throw new PdfGenerationError('Seite 1 erzeugen','Das einseitige A4-Hochformat konnte nicht erzeugt werden.',error)}
  try { return doc.output('blob') } catch(error){throw new PdfGenerationError('Blob erzeugen','Die PDF-Datei konnte nicht fertiggestellt werden.',error)}
}

