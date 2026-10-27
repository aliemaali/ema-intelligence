import type {CheckInput, Vision} from './model'

export const PHOTO_TASKS = [
  {kind:'overview',title:'Gesamtübersicht',hint:'Den ganzen Schrank mit sichtbaren Feldern aufnehmen. Nur zugängliche Türen öffnen, keine Abdeckungen oder Plomben entfernen.'},
  {kind:'metering',title:'Zählerfeld',hint:'Zähler und sichtbare Steuer-/Kommunikationsbereiche aufnehmen. Persönliche Zählernummern möglichst aussparen.'},
  {kind:'protection',title:'Schutzgeräte',hint:'Sichtbare Schalter und Beschriftungen lesbar aufnehmen. Keine Schutzabdeckungen entfernen.'},
  {kind:'nameplate',title:'Hersteller und Typenschild',hint:'Nur ein ohne Eingriff zugängliches Typenschild fotografieren. Ist es verdeckt, bleibt der Nachweis offen.'},
] as const
export type PhotoKind = typeof PHOTO_TASKS[number]['kind'] | 'document' | 'other'
export const PHOTO_LABELS:Record<PhotoKind,string> = {overview:'Gesamtübersicht',metering:'Zählerfeld',protection:'Schutzgeräte',nameplate:'Hersteller und Typenschild',document:'Technische Unterlage',other:'Noch nicht zugeordnet'}

// Assignment records the user's intent, not proof that the image contains the required detail.
export function photoCoverage(input:CheckInput,vision:Vision|null=null) {
  const assignments=(input.attachmentEvidence??[]).filter(item=>input.attachmentIds.includes(item.fileId))
  return PHOTO_TASKS.map(task=>{
    const assigned=assignments.filter(item=>item.kind===task.kind)
    const usable=assigned.some(item=>vision?.photoQuality?.some(q=>q.fileId===item.fileId&&q.state==='usable'))
    const poor=assigned.length>0&&assigned.every(item=>vision?.photoQuality?.some(q=>q.fileId===item.fileId&&q.state==='retake'))
    return {...task,state:usable?'reviewed' as const:poor?'retake' as const:assigned.length?'assigned' as const:'missing' as const}
  })
}
