import type {CheckInput, Finding, Vision} from './model'

export const PV_CHECK_TASK = 'Prüfe den fotografierten Zählerschrank auf Eignung für eine neue PV-Anlage in Deutschland anhand der sieben vereinbarten Kriterien. Benenne erkennbare Ausstattung, mögliche Hindernisse und nächste Schritte. Trenne sichtbare Befunde von Vermutungen und fehlenden Nachweisen. Eine Umbaupflicht oder EVU-Konformität darf nur aus belastbaren projektbezogenen Nachweisen und anwendbaren Vorgaben abgeleitet werden; keine Sicherheitsfreigabe oder Abnahme.'

export const CABINET_CRITERIA = [
  {id:'space',title:'Zählerschrank und Platzangebot',focus:'Bauform, erkennbare Reserveplätze und lesbare Hersteller/Typen. Maße oder verdeckte Bereiche nicht schätzen.'},
  {id:'protection',title:'Schutztechnik: SLS und Überspannungsschutz',focus:'Sichtbare Schutzgeräte mit Bildstelle benennen. Nicht sichtbar bedeutet nicht fehlend. Funktion und passende Bemessung nicht allein aus Fotos bestätigen.'},
  {id:'metering',title:'Zählerplatz, APZ und Steuertechnik',focus:'Zählerfelder, APZ, RfZ und Steuer-/Kommunikationsbereiche sichten. Keine lokale Nachrüstpflicht ohne anwendbare Vorgaben ableiten.'},
  {id:'condition',title:'Sicherer Anlagenzustand',focus:'Sichtbare Schäden, Verfärbungen oder fehlende Abdeckungen als konkreten Verdacht mit Bildbeleg erfassen. Ohne Messungen keine elektrische Sicherheit bestätigen.'},
  {id:'legacy',title:'Veraltete Technik',focus:'Technik und lesbare Typen dokumentieren, Alter nicht raten. Ältere Bauart allein belegt weder Unsicherheit noch Austauschpflicht; Erweiterungseignung gesondert prüfen.'},
  {id:'acceptance',title:'Mögliche Probleme bei der Netzbetreiber-Abnahme',focus:'Aus Befunden offene Klärungspunkte nennen. Keine Ablehnung oder Zusage des Netzbetreibers prognostizieren oder behaupten.'},
  {id:'evu',title:'EVU-Konformität',focus:'Netzgebietszuordnung, aktuelle lokale TAB, Ergänzungen, Anwendbarkeit und technische Nachweise prüfen. Ohne verifizierte Quelle, Version und Fundstelle bleibt Konformität offen.'},
] as const

export type CriterionId = typeof CABINET_CRITERIA[number]['id']
export type CriterionObservation = {id:CriterionId; state:'observed'|'concern'|'unknown'; detail:string; evidenceFileId:string; evidence:string; missing:string}
export type CriterionResult = {id:CriterionId; title:string; status:'grey'|'yellow'|'red'; observationState?:'observed'|'concern'|'unknown'; summary:string; evidence:string; nextStep:string}

export function buildCabinetCriteria(input:CheckInput,vision:Vision|null,findings:Finding[]):CriterionResult[] {
  return CABINET_CRITERIA.map((criterion):CriterionResult=>{
    const observation=vision?.criteria?.find(item=>item.id===criterion.id)
    const common={id:criterion.id,title:criterion.title,observationState:observation?.state,evidence:observation?.evidence||'Kein belastbarer Einzelbeleg dokumentiert.'}
    if(criterion.id==='evu')return {...common,observationState:'unknown',status:'grey',summary:'EVU-Konformität nicht bestätigt.',nextStep:'Zuständigen Netzbetreiber und aktuell anwendbare TAB einschließlich Ergänzungen mit Fundstellen sowie technische Nachweise prüfen.'}
    if(criterion.id==='acceptance')return {...common,observationState:'unknown',status:'grey',summary:'Mögliche Abnahmehindernisse sind mit dem Netzbetreiber zu klären.',nextStep:observation?.missing||'Befunde und Anschluss-/Messkonzept projektbezogen abstimmen; keine Abnahmezusage aus Fotos.'}
    if(criterion.id==='condition'&&findings.some(f=>f.status==='red'))return {...common,status:'red',summary:'Konkreter Sicherheitsverdacht – fachlich prüfen.',evidence:findings.find(f=>f.status==='red')!.basis,nextStep:'Anlage nicht öffnen oder berühren; Elektrofachbetrieb mit der Prüfung beauftragen.'}
    const declaredMissing=criterion.id==='protection'&&(input.sls==='no'||input.spd==='no')||criterion.id==='metering'&&(input.apz==='no'||input.rfz==='no')
    if(declaredMissing)return {...common,status:'yellow',summary:'Laut Benutzerangabe sind Komponenten nicht vorhanden.',nextStep:'Prüfen, ob diese Komponenten für die geplante Erweiterung vorgeschrieben und nachzurüsten sind.'}
    if(observation?.state==='concern')return {...common,status:'yellow',summary:observation.detail,nextStep:criterion.id==='legacy'?'Erweiterungseignung fachlich prüfen. Alter oder Bauart allein begründen keinen Austausch.':observation.missing||'Befund fachlich bestätigen und Anpassungen anhand der Projektvorgaben klären.'}
    return {...common,status:'grey',summary:observation?.detail||'Mit den vorliegenden Informationen nicht ausreichend beurteilbar.',nextStep:observation?.missing||(criterion.id==='condition'?'Mess-/Prüfprotokoll und fachliche Zustandsprüfung ergänzen.':'Übersichtsaufnahme, lesbare Typen und erforderliche technische Nachweise ergänzen.')}
  })
}
