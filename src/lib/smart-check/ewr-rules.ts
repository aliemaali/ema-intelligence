import type {CheckInput, Finding, Source} from './model'

export const EWR_DOCUMENT = {
  url:'https://www.ewr-netz.de/fileadmin/data/downloads/Partner/Installateure/Formulare_und_Richtlinien/EWR_TAB_2023_v2_Final_16-09-2025.pdf',
  sha256:'905f77b60cc97a0cfeefa8dacae267e8916a19a0c2ff37857b8ce1ccaa784a05',
  version:'TAB 2023 v2.0 einschließlich EWR-Ergänzungen, Stand 01.09.2025',
  reviewedAt:'2026-10-27',
} as const
export type RuleDocumentStatus = 'matched' | 'changed' | 'unavailable' | 'not-listed'
const sections = [
  {id:'ewr-change',page:38,locator:'7.4.1–7.4.2; Fortsetzung Seite 39'},
  {id:'ewr-table',page:58,locator:'Anhang G, insbesondere Änderungsvariante 3 und Fußnote 4'},
  {id:'ewr-duty',page:70,locator:'EWR-Ergänzung zu 7.1; Ausnahme auf Seite 71'},
  {id:'ewr-disconnect',page:71,locator:'EWR-Ergänzung zu 7.2 / VDE-AR-N 4100 Kapitel 7.5'},
  {id:'ewr-process',page:67,locator:'EWR-Ergänzung zu 4.2.1 / VDE-AR-N 4100 Kapitel 4.4'},
] as const
export function ewrSources():Source[] {
  return sections.map(section=>({id:section.id,title:'EWR-TAB · '+section.locator,url:EWR_DOCUMENT.url+'#page='+section.page,version:EWR_DOCUMENT.version,locator:`PDF-Seite ${section.page} von 80 · ${section.locator}`,checkedAt:EWR_DOCUMENT.reviewedAt,scope:'Inhaltlich ausgewertete Dokumentfassung; unabhängige Fachprüfung, Projektgültigkeit und neuere übergeordnete Vorgaben bleiben offen.'}))
}

/** A publisher hash and user declarations never establish installation compliance. */
export function ewrFindings(input:CheckInput,documentStatus?:RuleDocumentStatus):Finding[] {
  if(input.operator!=='EWR Netz')return []
  const item=(id:string,status:'grey'|'yellow',title:string,detail:string,action:string,sourceIds:string[]):Finding=>({id,status,title,detail,action,sourceIds,basis:'Dokumentbasierter Prüfpunkt; Projektangaben des Nutzers, keine unabhängige Fachbestätigung.',offer:false})
  if(!input.address||!input.operatorConfirmed||!input.operatorEvidence)return [item('ewr-scope','grey','EWR-Prüfpunkte: Standortzuordnung offen','Die EWR-TAB wird erst projektbezogen herangezogen, wenn Standort und die Grundlage der Zuständigkeit angegeben und vom Nutzer bestätigt sind.','Standort und Netzbetreiber-Zuordnungsbeleg ergänzen und abgleichen.',['operator'])]
  if(documentStatus!=='matched')return [item('ewr-document','grey','EWR-Regelfassung aktuell nicht bestätigt',documentStatus==='changed'?'Das aktuell veröffentlichte EWR-PDF weicht von der ausgewerteten Fassung ab. Die hinterlegten Einzelregeln werden nicht angewandt.':'Die ausgewertete EWR-Fassung konnte für diesen Auftrag nicht als unverändertes offiziell verlinktes PDF bestätigt werden.','Aktuelle EWR-Unterlagen inhaltlich prüfen; bis dahin keine lokalen Einzelanforderungen aus diesem Regelpaket ableiten.',['operator'])]
  const findings=[
    item('ewr-change','grey','EWR: Bestandsanpassung im Einzelfall prüfen','Die TAB verlangt bei Änderungen eine Prüfung der weiteren Eignung. Veränderte Dauerlast kann Anpassungen auslösen; ein vollständiger Austausch folgt daraus nicht pauschal.','Bestandsausführung und neue Betriebsbedingungen fachlich vergleichen. Ertüchtigung und zusätzlichen Zählerschrank anhand der belegten Eignung bewerten.',['ewr-change','ewr-table']),
    item('ewr-duty','grey','EWR: Dauerstrombelastbarkeit nachweisen','EWR ordnet PV, Wärmepumpen, Speicher und Ladeeinrichtungen grundsätzlich dem Dauerbetrieb zu. Begründete Ausnahmen erfordern die Abstimmung mit EWR.','Herstellerunterlagen, Verdrahtung, Bemessung und thermische Belastbarkeit für den geplanten Betrieb prüfen lassen. Keine Eignungsbestätigung aus Fotos oder aus kWp/kWh allein.',['ewr-duty']),
    item('ewr-process','grey','EWR: Messsystem und Inbetriebsetzung abstimmen','Die Ergänzungen verweisen bei Änderungen bestehender Zählerplätze auf den FNN-Hinweis zu Messsystemen im Bestand. Die unterschriebene Fertigmeldung ist laut Dokument spätestens 14 Tage vor endgültiger Inbetriebsetzung vorzulegen.','Anwendbares Messkonzept, aktuelle FNN-Fassung und Verfahren mit dem eingetragenen Installateur prüfen; Termin und Unterlagen mit EWR abstimmen.',['ewr-process']),
  ]
  if(input.meterBoardType==='din43853')findings.push(item('ewr-table','yellow','EWR: angegebene Zählertafel bei Anlagenerweiterung klären','Laut Nutzer liegt eine Zählertafel nach DIN 43853 vor. Abschnitt 7.4.1 schließt solche Reservetafeln bei Erweiterungen aus; Anhang G empfiehlt bei geänderten Betriebsbedingungen für diese Bauform keine Weiterverwendung.','Bauform anhand belastbarer Unterlagen bestätigen und zulässige Anpassung planen. Keine Austauschentscheidung allein aus einer KI-Typvermutung treffen.',['ewr-change','ewr-table']))
  else if(input.meterBoardType!=='cabinet')findings.push(item('ewr-table','grey','EWR: Zählerplatz-Bauform bestimmen','Anhang G unterscheidet Zählertafeln und verschiedene Zählerschrank-Ausführungen. Das Gebäudealter ersetzt diese Zuordnung nicht.','Bauform und Ausführung anhand von Typenschild, Herstellerunterlagen und Fachprüfung bestimmen.',['ewr-table']))
  if(input.meteringChange==='new_meter_or_position')findings.push(item('ewr-disconnect',input.postMeterDisconnect==='no'?'yellow':'grey','EWR: Trennstelle hinter dem Zähler prüfen',`Für neue Zählerplätze/Zähler nennt EWR eine Trennstelle hinter der Messeinrichtung im anlagenseitigen Anschlussraum. Nutzerangabe zum Vorhandensein: ${input.postMeterDisconnect==='yes'?'vorhanden, Ausführung nicht geprüft':input.postMeterDisconnect==='no'?'nicht vorhanden':'unbekannt'}.`,'Zutreffenden Anwendungsfall und fachgerechte Ausführung durch den Installateur bestätigen lassen; bei bestätigtem Fehlen erforderliche Anpassung planen.',['ewr-disconnect']))
  else findings.push(item('ewr-disconnect','grey','EWR: Umfang der Zähleränderung klären','Die lokale Forderung zur Trennstelle nennt ausdrücklich neue Zählerplätze/Zähler. Sie wird nicht allein wegen einer bestehenden PV-Planung als bestätigte Nachrüstpflicht ausgegeben.','Klären, ob ein neuer Zähler oder Zählerplatz vorgesehen ist; danach die EWR-Anforderung projektbezogen prüfen.',['ewr-disconnect']))
  return findings
}
