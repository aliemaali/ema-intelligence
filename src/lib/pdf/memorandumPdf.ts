import jsPDF from 'jspdf'

export interface MemorandumPdfData {
  projectName: string
  projectNumber: string
  projectType: string
  location: string
  dateLabel: string
  status: string
  pvKwp: number
  purchasePrice: number
  specificYield: number
  tariffEurKwh: number
  annualRevenue: number
  amortisation: number
}

const NAVY: [number, number, number] = [7, 24, 47]
const GREEN: [number, number, number] = [121, 185, 0]
const BORDER: [number, number, number] = [218, 226, 232]

function money(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0)
}
function num(value: number, digits = 0) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value || 0)
}
function pct(value: number) { return `${num(value, 2)} %` }

async function imageData(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: 'force-cache' })
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

function heading(doc: jsPDF, text: string, x: number, y: number) {
  doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text(text.toUpperCase(), x, y)
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.8); doc.line(x, y + 2.2, x + 14, y + 2.2)
}

function footer(doc: jsPDF, page: number) {
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3); doc.line(12, 198, 285, 198)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 104, 120)
  doc.text('EMA Enterprise GmbH · Gabriel-von-Seidl-Str. 56 · 67550 Worms', 12, 203)
  doc.text('www.ema-enterprise.de · info@ema-enterprise.de', 148.5, 203, { align: 'center' })
  doc.text(String(page), 285, 203, { align: 'right' })
}

function metric(doc: jsPDF, x: number, y: number, w: number, label: string, value: string) {
  doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDER); doc.roundedRect(x, y, w, 18, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...GREEN)
  doc.text(label.toUpperCase(), x + w / 2, y + 6, { align: 'center' })
  doc.setFontSize(9); doc.setTextColor(...NAVY); doc.text(value, x + w / 2, y + 12.5, { align: 'center' })
}

export async function generateMemorandumPdf(data: MemorandumPdfData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const [logo, hero] = await Promise.all([imageData('/ema-logo.jpeg'), imageData('/hero-dashboard.png')])
  const annualProduction = data.pvKwp * data.specificYield
  const grossYield = data.purchasePrice > 0 ? (data.annualRevenue / data.purchasePrice) * 100 : 0
  const baseOpex = data.pvKwp * 7, optimisticOpex = data.pvKwp * 5
  const baseNet = Math.max(data.annualRevenue - baseOpex, 0), optimisticNet = Math.max(data.annualRevenue - optimisticOpex, 0)
  const baseYield = data.purchasePrice > 0 ? (baseNet / data.purchasePrice) * 100 : 0
  const optimisticYield = data.purchasePrice > 0 ? (optimisticNet / data.purchasePrice) * 100 : 0
  const basePayback = baseNet > 0 ? data.purchasePrice / baseNet : 0
  const optimisticPayback = optimisticNet > 0 ? data.purchasePrice / optimisticNet : 0

  doc.setFillColor(255,255,255); doc.rect(0,0,297,210,'F')
  if (logo) doc.addImage(logo, 'JPEG', 12, 8, 34, 15, undefined, 'FAST')
  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...NAVY)
  doc.text('INVESTMENT MEMORANDUM',285,13,{align:'right'})
  doc.setFontSize(8); doc.setTextColor(...GREEN)
  doc.text(`${data.projectNumber} · ${data.projectName}`.toUpperCase(),285,19,{align:'right'})

  doc.setFillColor(...NAVY); doc.rect(12,28,110,67,'F')
  doc.setDrawColor(...GREEN); doc.setLineWidth(1.2); doc.line(122,28,132,95)
  if (hero) doc.addImage(hero, 'PNG', 122, 28, 163, 67, undefined, 'FAST')
  doc.setFont('helvetica','bold'); doc.setFontSize(24); doc.setTextColor(255,255,255); doc.text(data.projectName,22,47)
  doc.setFontSize(9); doc.setTextColor(...GREEN); doc.text(data.projectType.toUpperCase(),22,55)
  doc.setFont('helvetica','normal'); doc.setTextColor(255,255,255); doc.setFontSize(8)
  doc.text(data.location,22,67); doc.text(data.dateLabel,22,73); doc.text(`${num(data.pvKwp,2)} kWp Leistung`,22,79)
  doc.text(`${num(data.specificYield)} kWh/kWp spezifischer Ertrag`,22,85)
  doc.setFillColor(255,255,255); doc.roundedRect(22,88,40,6,3,3,'F')
  doc.setTextColor(...NAVY); doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.text(data.status.toUpperCase(),42,92,{align:'center'})

  const labels=['Leistung','Kaufpreis','Spez. Ertrag','Vergütung','Jahreserlös','Amortisation']
  const values=[`${num(data.pvKwp,2)} kWp`,money(data.purchasePrice),`${num(data.specificYield)} kWh/kWp`,`${num(data.tariffEurKwh,3)} €/kWh`,money(data.annualRevenue),`${num(data.amortisation,1)} Jahre`]
  labels.forEach((label,i)=>metric(doc,12+i*45.5,91,45.5,label,values[i]))

  heading(doc,'Executive Summary',12,119)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(40,52,68)
  const summary=`PV-Projekt in ${data.location} mit ${num(data.pvKwp,2)} kWp installierter Leistung. Auf Basis eines spezifischen Ertrags von ${num(data.specificYield)} kWh/kWp und einer Vergütung von ${num(data.tariffEurKwh,3)} €/kWh ergibt sich eine klare wirtschaftliche Einordnung für professionelle Investoren.`
  doc.text(doc.splitTextToSize(summary,128),12,128)

  heading(doc,'Projektprofil',151,119)
  const profile=[['Standort',data.location],['Projektstatus',data.status],['Netzanschluss','Zu prüfen'],['Einspeiseart','—']]
  profile.forEach((row,i)=>{const y=127+i*8; doc.setDrawColor(...BORDER); doc.line(151,y+3.5,285,y+3.5); doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(90,104,120); doc.text(row[0],153,y); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY); doc.text(row[1],283,y,{align:'right'})})

  heading(doc,'Wirtschaftliche Kennzahlen',12,162)
  const financial=[['Jahresproduktion',`${num(annualProduction)} kWh`],['Jahreserlös',money(data.annualRevenue)],['Kaufpreis',money(data.purchasePrice)],['Vergütung',`${num(data.tariffEurKwh,3)} €/kWh`],['Rendite p.a.',pct(grossYield)]]
  financial.forEach((row,i)=>{const y=170+i*5.3; doc.setDrawColor(...BORDER); doc.line(12,y+2.2,142,y+2.2); doc.setFont('helvetica','normal'); doc.setFontSize(7.2); doc.setTextColor(90,104,120); doc.text(row[0],14,y); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY); doc.text(row[1],140,y,{align:'right'})})

  heading(doc,'Investment Highlights',151,162)
  const highlights=[`Hoher spezifischer Ertrag von ${num(data.specificYield)} kWh/kWp`,`Amortisation nach ca. ${num(data.amortisation,1)} Jahren`,`Attraktive Vergütung von ${num(data.tariffEurKwh,3)} €/kWh`,'Solides Ertragspotenzial und stabile Einnahmen',`Projektstatus: ${data.status}`]
  highlights.forEach((text,i)=>{const y=171+i*5.3; doc.setDrawColor(...GREEN); doc.circle(154,y-1,1.2); doc.setFont('helvetica','normal'); doc.setFontSize(7.2); doc.setTextColor(40,52,68); doc.text(text,158,y)})
  footer(doc,1)

  doc.addPage('a4','landscape'); doc.setFillColor(255,255,255); doc.rect(0,0,297,210,'F')
  doc.setFillColor(...NAVY); doc.rect(0,0,297,20,'F'); doc.setFillColor(...GREEN); doc.rect(0,20,297,1.3,'F')
  if (logo) doc.addImage(logo,'JPEG',12,4,26,12,undefined,'FAST')
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(255,255,255); doc.text('KENNZAHLEN & TRANSAKTIONSPROZESS',285,12,{align:'right'})
  doc.setFontSize(7); doc.setTextColor(...GREEN); doc.text(`${data.projectNumber} · ${data.projectName}`.toUpperCase(),285,17,{align:'right'})

  heading(doc,'OPEX-Szenarien (indikativ)',12,34)
  const tx=12,ty=40,tw=128,rowH=9
  doc.setFillColor(...NAVY); doc.rect(tx,ty,tw,rowH,'F'); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(7)
  doc.text('POSITION',tx+3,ty+5.8); doc.text('BASIS',tx+82,ty+5.8,{align:'center'}); doc.text('OPTIMISTISCH',tx+115,ty+5.8,{align:'center'})
  const opexRows=[['Jahreserlös',money(data.annualRevenue),money(data.annualRevenue)],['OPEX-Annahme','7 €/kWp','5 €/kWp'],['OPEX p.a.',`-${money(baseOpex)}`,`-${money(optimisticOpex)}`],['Nettoerlös p.a.',money(baseNet),money(optimisticNet)],['Nettoanfangsrendite',pct(baseYield),pct(optimisticYield)],['Amortisation (netto)',`${num(basePayback,1)} Jahre`,`${num(optimisticPayback,1)} Jahre`]]
  opexRows.forEach((row,i)=>{const y=ty+rowH*(i+1); if(i===3||i===4){doc.setFillColor(239,247,230);doc.rect(tx,y,tw,rowH,'F')} doc.setDrawColor(...BORDER);doc.rect(tx,y,tw,rowH);doc.setFont('helvetica',i===3||i===4?'bold':'normal');doc.setFontSize(7);doc.setTextColor(...NAVY);doc.text(row[0],tx+3,y+5.8);doc.text(row[1],tx+82,y+5.8,{align:'center'});doc.text(row[2],tx+115,y+5.8,{align:'center'})})

  heading(doc,'Sensitivität Bruttorendite',12,111)
  const baseTariff=data.tariffEurKwh, tariffs=[Math.max(baseTariff-0.005,0),baseTariff,baseTariff+0.005], factors=[0.95,1,1.05]
  const sx=12,sy=117,sw=128,sh=10
  doc.setFillColor(...NAVY);doc.rect(sx,sy,sw,sh,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7)
  doc.text('ERTRAG / VERGÜTUNG',sx+3,sy+6.5);tariffs.forEach((t,i)=>doc.text(`${num(t*100,1)} CT`,sx+68+i*29,sy+6.5,{align:'center'}))
  factors.forEach((f,r)=>{const y=sy+sh*(r+1);if(r===1){doc.setFillColor(239,247,230);doc.rect(sx,y,sw,sh,'F')}doc.setDrawColor(...BORDER);doc.rect(sx,y,sw,sh);doc.setTextColor(...NAVY);doc.setFont('helvetica',r===1?'bold':'normal');doc.setFontSize(7);doc.text(r===0?'-5 % Ertrag':r===1?'P50-Ertrag':'+5 % Ertrag',sx+3,y+6.5);tariffs.forEach((t,i)=>{const value=data.purchasePrice>0?((annualProduction*f*t)/data.purchasePrice)*100:0;doc.text(pct(value),sx+68+i*29,y+6.5,{align:'center'})})})

  heading(doc,'Transaktionsprozess',151,34)
  const steps=[['Interessenbekundung & NDA','Vertraulichkeitsvereinbarung und Freischaltung des Datenraums.'],['Datenraum & Q&A','Prüfung der technischen, rechtlichen und wirtschaftlichen Unterlagen.'],['Indikatives Angebot','Abgabe eines nicht bindenden Angebots.'],['Bestätigende Due Diligence','Vertiefte Prüfung und Standortbegehung.'],['Signing & Closing','Kaufvertrag, Vollzugsbedingungen und Übergang.']]
  steps.forEach((step,i)=>{const y=43+i*24;doc.setFillColor(...NAVY);doc.circle(156,y+3,3.2,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text(String(i+1),156,y+5,{align:'center'});doc.setTextColor(...NAVY);doc.setFontSize(8);doc.text(step[0],163,y+2);doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(90,104,120);doc.text(doc.splitTextToSize(step[1],112),163,y+8);doc.setDrawColor(...BORDER);doc.line(163,y+18,285,y+18)})
  doc.setFillColor(...NAVY);doc.roundedRect(151,166,134,24,2.5,2.5,'F');doc.setTextColor(...GREEN);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('DATENRAUMZUGANG ANFRAGEN',158,175)
  doc.setTextColor(255,255,255);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Qualifizierte Investoren erhalten nach NDA-Unterzeichnung Zugang zu vollständigen Projektunterlagen.',158,182);doc.text('info@ema-enterprise.de',278,182,{align:'right'})
  footer(doc,2)
  return doc.output('blob')
}
