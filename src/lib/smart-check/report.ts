import {jsPDF} from 'jspdf'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {AREAS,type Assessment,type CheckInput} from './model'
import {buildCabinetCriteria} from './criteria'

export function createShortCheckPdf(input:CheckInput,result:Assessment,version:number){
  const pdf=new jsPDF({unit:'mm',format:'a4'})
  for(const [style,weight] of [['normal','400'],['bold','700']] as const){
    const name=`Inter-${weight}.ttf`
    pdf.addFileToVFS(name,readFileSync(join(process.cwd(),'public/fonts/inter',`inter-latin-ext-${weight}.ttf`)).toString('base64'))
    pdf.addFont(name,'Inter',style)
  }
  const color=result.status==='red'?[186,54,74]:result.status==='yellow'?[153,120,30]:[91,117,135]
  const label=result.status==='red'?'Fachprüfung erforderlich':result.status==='yellow'?'Anpassung prüfen':'Noch nicht beurteilbar'
  const line=(text:string,y:number,size=9,bold=false)=>{pdf.setFont('Inter',bold?'bold':'normal');pdf.setFontSize(size);pdf.text(text,18,y)}
  pdf.setFillColor(5,19,34);pdf.rect(0,0,210,28,'F');pdf.setTextColor(239,247,252)
  line('EMA Smart Check · Kurzbericht',16,16,true)
  pdf.setTextColor(color[0],color[1],color[2]);pdf.setFillColor(color[0],color[1],color[2]);pdf.circle(21,42,3,'F')
  pdf.setFont('Inter','bold');pdf.setFontSize(17);pdf.text(label,29,44)
  pdf.setTextColor(74,93,111)
  line(`${AREAS[input.area]} · Version ${version} · ${new Date(result.createdAt).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'})}`,54,8)
  pdf.setFont('Inter','normal');pdf.setFontSize(8);pdf.text(pdf.splitTextToSize(`Netzbetreiber: ${input.operator||'nicht bekannt'} · Zuständigkeit und EVU-Konformität nicht bestätigt`,174).slice(0,2),18,61)
  const criteria=result.criteria||buildCabinetCriteria(input,result.vision,result.findings)
  let y=76
  criteria.forEach(c=>{
    const mark=c.status==='red'?'VERDACHT':c.status==='yellow'?'PRÜFEN':c.observationState==='observed'?'SICHTBEFUND':'OFFEN'
    pdf.setTextColor(21,47,65);line(c.title,y,9,true)
    pdf.setFontSize(7);pdf.text(mark,192,y,{align:'right'})
    pdf.setTextColor(78,99,116);pdf.setFont('Inter','normal');pdf.setFontSize(8)
    const summary=pdf.splitTextToSize(c.summary.slice(0,190),174).slice(0,2)
    pdf.text(summary,18,y+5)
    pdf.setFontSize(6.5);pdf.text(pdf.splitTextToSize('Beleg: '+c.evidence.slice(0,120),174).slice(0,1),18,y+14)
    pdf.setDrawColor(218,228,234);pdf.line(18,y+18,192,y+18)
    y+=24
  })
  pdf.setTextColor(29,60,75)
  line('Nächster Schritt',253,9,true)
  pdf.setFont('Inter','normal');pdf.setFontSize(8)
  const next=result.status==='red'?'Anlage nicht öffnen oder berühren. Konkreten Sicherheitsverdacht durch einen Elektrofachbetrieb prüfen lassen.':'Offene Befunde, anwendbare Netzbetreibervorgaben und erforderliche Messnachweise fachlich klären. Aus Grau folgt keine automatische Umbaupflicht.'
  pdf.text(pdf.splitTextToSize(next,174).slice(0,3),18,259)
  pdf.setTextColor(100,119,134)
  line('Vollständige Befunde, Maßnahmen und Quellen stehen in der gespeicherten Smart-Check-Prüfung.',276,6.5)
  line('Technische Vorprüfung. Keine Sicherheitsfreigabe, EVU-Bestätigung oder Abnahme.',283,7)
  return new Uint8Array(pdf.output('arraybuffer'))
}
export function createCheckPdf(input:CheckInput,result:Assessment,files:any[],version:number){
  const pdf=new jsPDF({unit:'mm',format:'a4'});let y=0,page=1
  for(const [style,weight] of [['normal','400'],['bold','700']] as const){
    const name=`Inter-${weight}.ttf`
    pdf.addFileToVFS(name,readFileSync(join(process.cwd(),'public/fonts/inter',`inter-latin-ext-${weight}.ttf`)).toString('base64'))
    pdf.addFont(name,'Inter',style)
  }
  const header=()=>{pdf.setFillColor(4,17,38);pdf.rect(0,0,210,28,'F');pdf.setTextColor(255,255,255);pdf.setFont('Inter','bold');pdf.setFontSize(17);pdf.text('EMA Smart Check',17,13);pdf.setFontSize(8);pdf.text(`Technische Vorprüfung · Version ${version} · ${new Date(result.createdAt).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'})}`,17,21);y=40}
  const footer=()=>{pdf.setFont('Inter','normal');pdf.setFontSize(7);pdf.setTextColor(95,110,125);pdf.text('Automatisierte Vorprüfung. Keine Sicherheitsfreigabe, Messung oder Abnahme.',17,288);pdf.text(`${page}`,193,288,{align:'right'})}
  const next=()=>{footer();pdf.addPage();page++;header()}
  const write=(title:string,text:string)=>{if(y>256)next();pdf.setFont('Inter','bold');pdf.setFontSize(10);pdf.setTextColor(14,37,63);for(const line of pdf.splitTextToSize(title,174)){if(y>273)next();pdf.setFont('Inter','bold');pdf.setFontSize(10);pdf.setTextColor(14,37,63);pdf.text(line,17,y);y+=5}y+=2;pdf.setFont('Inter','normal');pdf.setFontSize(9);for(const line of pdf.splitTextToSize(text||'Nicht angegeben',174)){if(y>273)next();pdf.setFont('Inter','normal');pdf.setFontSize(9);pdf.setTextColor(53,68,88);pdf.text(line,17,y);y+=4.6}y+=6}
  header();write('1. Projektdaten',`${input.title}\n${AREAS[input.area]} · ${input.building||'Gebäudeart nicht angegeben'}\n${input.address||'Standort nicht angegeben'}`)
  write('2. Standort und Netzbetreiber',`${input.operator||'Nicht bestimmt'} · ${input.operatorConfirmed?'vom Nutzer bestätigt':'nicht bestätigt'}\nZuordnungsbeleg: ${input.operatorEvidence||'fehlt'}`)
  write('3. Prüfgrundlage',`${input.mode==='ai'?'KI-gestützte Sichtung plus Regelprüfung':'Regelprüfung von Benutzereingaben, keine automatische Bildauswertung'}\n${files.map(f=>f.file_name).join('\n')||'Keine Dateien'}`)
  write('4. Geplante Erweiterung',`PV ${input.pvKwp??'?'} kWp · WR ${input.inverterKw??'?'} kW · Speicher ${input.storageKwh??'?'} kWh / Laden ${input.storageChargeKw??'?'} kW\nWärmepumpe thermisch ${input.heatKw??'?'} kW, elektrisch ${input.heatElectricKw??'?'} kW, Zusatzheizung ${input.heaterKw??'?'} kW\nWallbox ${input.wallboxKw??'?'} kW\nModell: ${input.deviceModel||'unbekannt'}`)
  write('5. Bestandsaufnahme',`Manuelle Angaben: SLS ${input.sls}, SPD ${input.spd}, APZ ${input.apz}, RfZ ${input.rfz}. Messprotokoll ${input.measurementProof?'laut Nutzer vorhanden':'nicht bestätigt'}.\nNotizen: ${input.notes||'keine'}`)
  if(result.vision){write('6. Erkannte Komponenten – KI, unbestätigt',result.vision.components.map(c=>`${c.name}: ${c.manufacturer||'Hersteller unbekannt'} / ${c.model||'Typ unbekannt'} · ${c.certainty}\nBeleg: ${c.evidence}`).join('\n\n'));write('Beobachtungen / fehlende Informationen',[...result.vision.observations,...result.vision.missing,...result.vision.limitations,...result.vision.pdfTextStatus].join('\n'));write('KI-Nutzung',`${result.vision.model}\nInput ${result.vision.usage.input} / Output ${result.vision.usage.output} Tokens\nRechnerischer Listenpreis: ca. ${result.vision.usage.estimatedUsd.toFixed(4)} USD; tatsächliche Abrechnung beim Anbieter.`)}
  write('7. Ergebnis / Prüfstatus',result.decision)
  result.findings.forEach((f,i)=>write(`8.${i+1} ${f.title} · ${f.status.toUpperCase()}`,`${f.detail}\nMaßnahme: ${f.action}\nGrundlage: ${f.basis}\nQuellenschlüssel: ${f.sourceIds.join(', ')||'Benutzereingabe / fehlender Nachweis'}`))
  write('9. Technische Alternativen',result.alternatives.join('\n\n'))
  if(result.sourceReview){const review=result.sourceReview;write('10. Dokumentierter offizieller Quellenabruf',`Zeitpunkt: ${review.checkedAt}\nAbrufstatus: ${review.status}\n${review.publisherUrl||'Kein verifizierter Einstieg'}\nSHA-256 der Einstiegsseite: ${review.sha256||'nicht verfügbar'}\n${review.limitation}\n${review.documents.map(d=>`${d.title}\n${d.url}`).join('\n\n')}`)}
  result.sources.forEach(s=>write(`10. Quelle ${s.id} – ${s.title}`,`${s.version}\nFundstelle: ${s.locator}\nGeltungsbereich: ${s.scope}\nBibliografisch geprüft: ${s.checkedAt}; keine automatische laufende Gültigkeitsbestätigung.\n${s.url}`))
  write('11. Fehlende Nachweise / Prüfgrenzen',result.limitations.join('\n'))
  for(const f of files.filter(f=>f.mime_type.startsWith('image/'))){next();write('12. Zugeordnete Aufnahme',`${f.file_name} · Original im privaten DMS`);try{const data=`data:${f.mime_type};base64,${Buffer.from(f.bytes).toString('base64')}`;const dim=pdf.getImageProperties(data);const scale=Math.min(174/dim.width,(275-y)/dim.height);pdf.addImage(data,f.mime_type==='image/png'?'PNG':'JPEG',17,y,dim.width*scale,dim.height*scale,undefined,'FAST')}catch{write('Bilddarstellung','Bild konnte im Bericht nicht dargestellt werden. Originaldatei separat prüfen.')}}
  footer();return new Uint8Array(pdf.output('arraybuffer'))
}
