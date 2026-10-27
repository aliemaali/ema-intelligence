import { z } from 'zod'
import {operatorFinding} from './operator'
import type {SourceReview} from './source-review'
import {buildCabinetCriteria,type CriterionObservation,type CriterionResult} from './criteria'
import {photoCoverage} from './evidence'
import {ewrFindings,ewrSources} from './ewr-rules'
export const AREAS = { cabinet: 'Zählerschrank & Unterverteilung', pv: 'PV & Wechselrichter', storage: 'Batteriespeicher', heatpump: 'Wärmepumpe', wallbox: 'Wallbox & Ladeinfrastruktur' } as const
const number = z.number().finite().min(0).max(100000).nullable().default(null)
export const inputSchema = z.object({
  title: z.string().trim().min(2).max(160), projectId: z.string().uuid().nullable().default(null),
  area: z.enum(['cabinet','pv','storage','heatpump','wallbox']), address: z.string().trim().max(240).default(''),
  building: z.string().trim().max(100).default(''), operator: z.string().trim().max(120), operatorConfirmed: z.boolean().default(false),
  operatorEvidence: z.string().trim().max(240).default(''), rulesConfirmed: z.boolean().default(false),
  ruleVersion: z.string().trim().max(160).default(''), ruleLocator: z.string().trim().max(200).default(''),
  pvKwp: number, inverterKw: number, storageKwh: number, storageChargeKw: number,
  heatKw: number, heatElectricKw: number, heaterKw: number, wallboxKw: number,
  meteringChange:z.enum(['unknown','existing_extension','new_meter_or_position']).default('unknown'),
  meterBoardType:z.enum(['unknown','din43853','cabinet']).default('unknown'),
  postMeterDisconnect:z.enum(['yes','no','unknown']).default('unknown'),
  deviceModel: z.string().trim().max(200).default(''), notes: z.string().trim().max(2500).default(''),
  sls: z.enum(['yes','no','unknown']).default('unknown'), spd: z.enum(['yes','no','unknown']).default('unknown'),
  apz: z.enum(['yes','no','unknown']).default('unknown'), rfz: z.enum(['yes','no','unknown']).default('unknown'),
  measurementProof: z.boolean().default(false), hazard: z.boolean().default(false), hazardEvidence: z.string().trim().max(400).default(''),
  attachmentIds: z.array(z.string().uuid()).max(8).default([]), folderId: z.string().uuid().nullable().default(null),
  attachmentEvidence: z.array(z.object({fileId:z.string().uuid(),kind:z.enum(['overview','metering','protection','nameplate','document','other'])})).max(8).default([]),
  mode: z.enum(['rules','ai']).default('rules'), aiConsent: z.boolean().default(false), previousReportId: z.string().uuid().nullable().default(null),
}).superRefine((data, ctx) => {
  if (data.mode === 'ai' && !data.aiConsent) ctx.addIssue({ code: 'custom', message: 'Die KI-Übertragung und Verbrauchskosten müssen ausdrücklich bestätigt werden.', path: ['aiConsent'] })
  if (data.hazard && data.hazardEvidence.length < 5) ctx.addIssue({ code:'custom', message:'Bitte den konkreten Sicherheitsverdacht beschreiben.',path:['hazardEvidence'] })
  const ids=data.attachmentEvidence.map(item=>item.fileId)
  if(new Set(ids).size!==ids.length||ids.some(id=>!data.attachmentIds.includes(id)))ctx.addIssue({code:'custom',message:'Aufnahmezuordnungen müssen eindeutig sein und zu den Prüfdateien gehören.',path:['attachmentEvidence']})
})
export type CheckInput = z.infer<typeof inputSchema>
export type Status = 'grey' | 'yellow' | 'red'
export type Finding = { id: string; status: Status; title: string; detail: string; action: string; basis: string; sourceIds: string[]; offer: boolean }
export type Source = { id: string; title: string; url: string; version: string; locator: string; checkedAt: string; scope: string }
export type Vision = { photoQuality?:{fileId:string; state:'usable'|'retake'|'unknown'; reason:string}[]; criteria?:CriterionObservation[]; components: { name: string; manufacturer: string; model: string; evidence: string; certainty: string }[]; observations: string[]; risks: { detail:string; evidence:string }[]; missing: string[]; limitations: string[]; pdfTextStatus: string[]; model: string; usage: { input: number; output: number; estimatedUsd: number } }
export type Assessment = { criteria?:CriterionResult[]; status: Status; decision: string; findings: Finding[]; alternatives: string[]; sources: Source[]; vision: Vision | null; limitations: string[]; engineVersion: string; createdAt: string; sourceReview?: SourceReview }
export const STATUS = { grey: 'Nicht ausreichend beurteilbar', yellow: 'Weitere Prüfung notwendig', red: 'Kritischer Hinweis – Fachprüfung erforderlich' } as const
export const OPERATORS = [
  { name: 'EWR Netz', url: 'https://www.ewr-netz.de/partner/installateure/formulare-und-richtlinien/' },
  { name: 'Westnetz', url: 'https://www.westnetz.de/' },
  { name: 'Netze BW', url: 'https://www.netze-bw.de/unternehmen/veroeffentlichungen' },
  { name: 'Bayernwerk Netz', url: 'https://www.bayernwerk-netz.de/' },
  { name: 'Avacon Netz', url: 'https://www.avacon-netz.de/' },
  { name: 'Stromnetz Berlin', url: 'https://www.stromnetz.berlin/partner/installateure/installateur-unterlagen/' },
]
export function sourcesFor(operator: string): Source[] {
  const common: Source[] = [
    { id:'tar4100',title:'VDE FNN – TAR Niederspannung',url:'https://www.vde.com/tar-niederspannung',version:'VDE-AR-N 4100:2026-04; Änderungen/Übergänge gesondert prüfen',locator:'Neuerungen der gültigen Fassung / Zählerplätze in Bestandsanlagen',checkedAt:'2026-10-26',scope:'Deutschland, Niederspannung; öffentliche Beschreibung, kein lizenzierter Normvolltext' },
    { id:'tar4105',title:'VDE FNN – Erzeugungsanlagen',url:'https://www.vde.com/vde-ar-n-4105-2018',version:'VDE-AR-N 4105:2026-03',locator:'Gültige Fassung / Inhalte / FAQ 4.4',checkedAt:'2026-10-26',scope:'Erzeugungsanlagen, Niederspannung; öffentliche Informationen, kein Normvolltext' },
    { id:'14a',title:'Bundesnetzagentur – steuerbare Verbrauchseinrichtungen',url:'https://www.bundesnetzagentur.de/DE/Vportal/Energie/SteuerbareVBE/artikel.html',version:'Webveröffentlichung; anlagenbezogenen Geltungsbereich prüfen',locator:'Anwendungsbereich / Wärmepumpen / Speicher / Ladeeinrichtungen',checkedAt:'2026-10-26',scope:'Deutschland; elektrische Bezugsleistung, Inbetriebnahme und Ausnahmen beachten' },
  ]
  if (operator === 'EWR Netz') common.push({ id:'operator',title:'EWR Netz – TAB einschließlich Ergänzungen',url:'https://www.ewr-netz.de/fileadmin/data/downloads/Partner/Installateure/Formulare_und_Richtlinien/EWR_TAB_2023_v2_Final_16-09-2025.pdf',version:'TAB 2023 v2.0, Stand 01.09.2025',locator:'Ergänzungen: Kapitel 1, 4.1 und 7; aktuelle Ablösung und Übergangsregeln prüfen',checkedAt:'2026-10-26',scope:'Nur bestätigtes Netzgebiet EWR Netz; mit TAR-Neufassungen 2026 abgleichen' })
  else { const op=OPERATORS.find(x=>x.name===operator); if(op) common.push({id:'operator',title:`${op.name} – offizieller Einstieg`,url:op.url,version:'Projektbezogene TAB-Fassung noch zu ermitteln',locator:'Technische Anschlussbedingungen / Installateurunterlagen',checkedAt:'2026-10-26',scope:'Fundstelle; keine abgeschlossene Prüfung örtlicher Anforderungen'}) }
  if(operator==='EWR Netz')common.push(...ewrSources())
  return common
}
export function assess(input: CheckInput, vision: Vision | null = null, sourceReview?:SourceReview): Assessment {
  const findings: Finding[] = []
  const add = (id:string,status:Status,title:string,detail:string,action:string,basis:string,sourceIds:string[]=[],offer=false) => findings.push({id,status,title,detail,action,basis,sourceIds,offer})
  if (input.hazard) add('hazard','red','Konkreter Sicherheitsverdacht',input.hazardEvidence,'Anlage nicht öffnen oder berühren. Bei unmittelbarer Gefahr Abstand halten und Fachbetrieb bzw. örtlichen Notdienst verständigen.','Vom Benutzer gemeldeter Verdacht; noch keine Messung',[],false)
  for (const [i,risk] of (vision?.risks ?? []).entries()) add(`visual-risk-${i}`,'red','Visueller Sicherheitsverdacht',risk.detail,'Zeitnahe Prüfung durch Elektrofachbetrieb; keine Arbeiten unter Spannung.',`KI-Verdacht: ${risk.evidence}; unbestätigt`,[],false)
  findings.push(...ewrFindings(input,sourceReview?.ruleDocument?.status))
  const operator=operatorFinding(input); if(operator)findings.push(operator)
  add('rules','grey','Regelwerksprüfung eingeschränkt',input.rulesConfirmed ? `Benutzerangabe: ${input.ruleVersion || 'keine Fassung'}. Fundstelle: ${input.ruleLocator || 'nicht angegeben'}. Die Anwendbarkeit einschließlich Übergangsregeln ist nicht unabhängig verifiziert.` : 'Lokale TAB, Ergänzungen und vollständige lizenzierte Normen sind noch nicht abschließend projektbezogen geprüft.','Aktuelle TAB, Ergänzungen, Übergangsregeln und lizenzierte DIN-VDE-Nachweise mit dem Fachplaner abgleichen.','Öffentliche Quellen und gegebenenfalls manuelle Bestätigung; keine vollständige Normprüfung',['operator','tar4100','tar4105'],true)
  if(!input.address) add('location','grey','Standort ergänzen','Ohne Standort kann die lokale Zuständigkeit nicht nachvollzogen werden.','Adresse oder Ort und Postleitzahl ergänzen; den Netzbetreiber anhand der Anschlussunterlagen bestätigen.','Fehlende Projektangabe')
  if(input.area==='cabinet')for(const shot of photoCoverage(input,vision)){
    if(shot.state==='missing'||shot.state==='retake')add('photo-'+shot.kind,'grey',shot.state==='retake'?shot.title+' erneut aufnehmen':shot.title+' ergänzen',shot.state==='retake'?'Die zugeordnete Aufnahme ist laut KI nicht ausreichend auswertbar.':'Für diesen Aufnahmebereich ist noch kein Foto zugeordnet; daraus folgt kein fehlendes Bauteil.',shot.hint,'Aufnahmezuordnung des Nutzers / gegebenenfalls KI-Qualitätshinweis')
  }
  for(const quality of vision?.photoQuality??[])if(quality.state!=='usable')add('quality-'+quality.fileId,'grey','Aufnahmequalität klären',quality.reason,'Die betroffene Aufnahme mit lesbaren Beschriftungen, ruhiger Kamera und ohne Spiegelungen ergänzen. Keine Abdeckungen entfernen.','KI-Qualitätshinweis zur Datei '+quality.fileId)
  if (!input.attachmentIds.length) add('files','grey','Bestandsunterlagen fehlen','Keine Fotos oder technischen Unterlagen zugeordnet.','Übersichtsbild, Typenschild, Datenblatt und vorhandene Messprotokolle ergänzen.','Dateiverzeichnis',[],false)
  if (input.mode==='rules') add('image','grey','Keine automatische Bildauswertung','Fotos und PDFs werden als Originale hinterlegt; diese Prüfung bewertet strukturierte Benutzereingaben.','Bei Bedarf eine ausdrücklich freigegebene KI-Auswertung starten oder Befunde manuell dokumentieren.','Regelbasierter Prüfmodus',[],false)
  if (input.area==='cabinet' || input.pvKwp || input.heatKw || input.wallboxKw) {
    for(const [key,label] of [['sls','SLS-Schalter'],['spd','Überspannungsschutz'],['apz','APZ-Raum'],['rfz','Raum für Zusatzanwendungen']] as const) if(input[key]!=='yes') add(key,input[key]==='no'?'yellow':'grey',`${label} klären`,input[key]==='no'?'Laut Benutzerangabe nicht vorhanden. Daraus allein folgt noch keine pauschale Nachrüstpflicht.':'Vorhandensein und technische Ausführung nicht nachgewiesen.',`${label}: Bestand, Eignung und anwendbare TAB-Anforderungen prüfen; erst danach Maßnahmen festlegen.`,`Benutzerangabe: ${input[key]}`,['tar4100','operator'],true)
    add('cabinet-fit','grey','Eignung des Zählerplatzes nicht nachgewiesen','Ein Foto bestätigt weder Dauerstrombelastbarkeit noch Kurzschlussfestigkeit, Anschlussleitungen oder Berührungsschutz.','Hersteller, Typ, Maße, Schaltplan, Anschlussleistung und Messnachweise aufnehmen. Bestands-Ertüchtigung gegen Zusatzschrank fachlich vergleichen.','Fehlende technische Nachweise',['tar4100','operator'],true)
  }
  if (input.area==='heatpump' || input.heatKw !== null) {
    if (input.heatElectricKw === null || input.heaterKw === null) add('hp-electric','grey','Elektrische Wärmepumpenleistung fehlt',`Heizleistung ${input.heatKw ?? 'unbekannt'} kW ist keine elektrische Anschlussleistung. Die maximale Aufnahme und Zusatzheizung fehlen ganz oder teilweise.`,'Maximale elektrische Anschlussleistung einschließlich Heizstab aus Herstellerunterlagen ermitteln; Gleichzeitigkeits-/Betriebsvorgaben berücksichtigen.','Projektangaben',['14a'],false)
    else if(input.heatElectricKw+input.heaterKw>4.2) add('hp14a','yellow','§ 14a-Anwendungsbereich prüfen',`Erfasste elektrische Leistungen: Gerät ${input.heatElectricKw} kW, Zusatzheizung ${input.heaterKw} kW. Eine einfache Summe ersetzt die Hersteller-/Betriebsprüfung nicht.`,'Inbetriebnahmedatum, Netzbezug, Steuerbarkeit und lokales Steuer-/Messkonzept prüfen.','Erfasste Gerätedaten, keine Feststellung allein aus Heizleistung',['14a','operator'],true)
  }
  if (input.wallboxKw && input.wallboxKw>4.2) add('wallbox','yellow','Wallbox: Anmeldung und Steuerung planen',`${input.wallboxKw} kW Ladeleistung erfasst. Melde-/Zustimmungspflicht, Netzbezug und § 14a-Anwendbarkeit sind projektabhängig.`,'Lastmanagement, Anschlussleistung, geeignete Schutzmaßnahmen nach Herstellerangaben und TAB-/Steuerschnittstelle abstimmen.','Geplante Ladeleistung',['14a','tar4100','operator'],true)
  if(input.pvKwp || input.area==='pv') add('pv','grey','PV-/Wechselrichterauslegung nachweisen','Modulleistung (kWp) und Wechselrichterleistung (kW/kVA) sind getrennt zu betrachten.','String-/Spannungsauslegung, WR-Zertifikate, Netz-/Anlagenschutz, Einspeisebegrenzung und Messkonzept prüfen.','Planungsdaten; keine belastbare String-/Netzberechnung',['tar4105'],true)
  if(input.storageKwh || input.area==='storage') add('storage','grey','Speicher-Kompatibilität nachweisen','Speicherkapazität (kWh) belegt weder Ladeleistung noch WR-Kompatibilität oder sicheren Aufstellort.','Freigegebene Geräte-Kombination, Batterie-/WR-Datenblätter, Aufstellung, Netzbezug und Schutzkonzept prüfen.','Planungsdaten',['tar4105','14a'],true)
  if(!input.measurementProof) add('measurements','grey','Messungen und Fachprüfung fehlen','Schutzleiter, Isolationswerte, Abschaltbedingungen, Erdung und Anlagenzustand sind aus Fotos nicht feststellbar.','Mess- und Prüfprotokolle durch den zuständigen Elektrofachbetrieb erstellen bzw. bereitstellen lassen.','Kein bestätigtes Messprotokoll',[],true)
  const status: Status = findings.some(x=>x.status==='red')?'red':findings.some(x=>x.status==='grey')?'grey':'yellow'
  return {criteria:buildCabinetCriteria(input,vision,findings),status,decision:STATUS[status],findings,sources:sourcesFor(input.operator),vision,sourceReview,engineVersion:'1.3.0',createdAt:new Date().toISOString(),alternatives:['Bestand ertüchtigen: nur bei nachgewiesener Eignung und zulässigem lokalen Mess-/Anschlusskonzept.','Zusätzlicher Zählerschrank: Platzbedarf, Anschlussweg und TAB-konforme Ausführung vergleichen. Bestehende Verteilung nur nach Fachprüfung weiterverwenden.','Wärmepumpen-Messung: gemeinsamer oder separater Zähler erst nach Messkonzept-, Tarif- und Kostenvergleich auswählen.'],limitations:['Automatisierte Vorprüfung, keine Sicherheitsfreigabe, Messung oder Abnahme.','Kein lizenzierter vollständiger DIN-VDE-Normzugriff. Keine grüne Gesamtfreigabe aus Fotos.','Netzgebietszuordnung wird vom Nutzer bestätigt; keine automatische adressgenaue Netzbetreiberbestimmung.','Quellenstand und Projektgültigkeit sind bei jeder Prüfung erneut abzugleichen.']}
}
