import type {CheckInput, Finding} from './model'

export function operatorFinding(input:CheckInput):Finding|null {
  if(input.operator && input.address && input.operatorConfirmed && input.operatorEvidence)return null
  return {id:'operator',status:'grey',title:input.operator?`${input.operator} – vom Nutzer angegeben`:'Netzbetreiber auswählen',detail:input.operator?'Die Auswahl wird für die Recherche der Netzbetreibervorgaben verwendet. Die adressgenaue Zuständigkeit wurde nicht unabhängig geprüft.':'Für die Recherche lokaler Vorgaben ist noch kein Netzbetreiber angegeben.',action:input.operator?'Zuständigkeit bei Bedarf anhand der Anschlussunterlagen abgleichen. Die Auswahl allein bestätigt keine EVU-Konformität.':'Zuständigen Netzbetreiber aus den Anschlussunterlagen auswählen.',basis:input.operator?'Netzbetreiberangabe des Nutzers; keine unabhängige Netzgebietsprüfung':'Keine Netzbetreiberangabe',sourceIds:[],offer:false}
}

// Display old reports with current wording without changing their saved assessment.
export function presentFindings(input:CheckInput,findings:Finding[]):Finding[] {
  const operator=operatorFinding(input)
  return findings.map(f=>f.id==='operator'&&operator?operator:f)
}

export function nextCheckSteps(input:CheckInput,findings:Finding[]):Finding[] {
  const visible=presentFindings(input,findings).filter(f=>f.id!=='image'&&!(f.id==='operator'&&input.operator))
  const evidencePriority=(f:Finding)=>['location','operator','ewr-scope','ewr-document'].includes(f.id)?0:/^(photo-|quality-)/.test(f.id)?1:2
  const open=visible.filter(f=>f.status==='grey').sort((a,b)=>evidencePriority(a)-evidencePriority(b))
  return [...visible.filter(f=>f.status==='red'),...visible.filter(f=>f.status==='yellow'),...open].filter((f,i,all)=>all.findIndex(other=>other.action===f.action)===i).slice(0,3)
}
