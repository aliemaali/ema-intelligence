import type {Assessment,CheckInput,Finding} from './model'
import type {CriterionResult} from './criteria'

export function criterionLabel(c:CriterionResult):string {
  if(c.status==='red')return 'Konkreter Verdacht'
  if(c.status==='green')return 'Sichtbefund unauffällig'
  if(c.status==='yellow')return 'Fachlich klären'
  return c.observationState==='observed'?'Teilweise sichtbar · offen':'Offen'
}

export function resultHeadline(result:Assessment) {
  if(result.status==='red')return {title:result.engineVersion==='1.4.0'?'Konkreter Sicherheitsverdacht':'Gespeicherter Verdacht',summary:result.findings.find(f=>f.status==='red')?.detail||'Den gespeicherten Verdachtsbefund fachlich klären.',status:'red' as const}
  return {title:'PV-Eignung noch offen',summary:'Noch keine belastbare Entscheidung zu Weiterverwendung oder Umbau. Kläre zuerst die unten genannten Punkte.',status:'yellow' as const}
}

export function priorityCriteria(criteria:CriterionResult[]):CriterionResult[] {
  return ['protection','metering','space','legacy','condition'].flatMap(id=>criteria.filter(c=>c.id===id&&c.status!=='green'&&c.status!=='red')).slice(0,3)
}

// Existing offer flags identify planning suggestions, not proven retrofit requirements.
export function inspectionMeasures(findings:Finding[]):Finding[] {
  return findings.filter(f=>f.offer&&f.status!=='red'&&f.status!=='green')
}
export function inspectionMeasureText(f:Finding):string {
  return `Prüfleistung – ${f.title}: ${f.action}`.slice(0,365)+' Keine bestätigte Umbaupflicht.'
}

export function scopedAlternatives(input:CheckInput,alternatives:string[]):string[] {
  return input.area==='heatpump'||input.heatKw!==null?alternatives:alternatives.filter(text=>!/Wärmepump|Wärmepumpen/i.test(text))
}
