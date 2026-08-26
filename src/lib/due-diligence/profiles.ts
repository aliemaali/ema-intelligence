export type DdProjectProfile = 'bess' | 'pv' | 'pv_bess'
export type DdReviewLens = 'engineering' | 'investor' | 'legal'

export type ProfessionalDdCheck = {
  id: string
  lens: DdReviewLens
  category: string
  label: string
  hardGate?: boolean
  appliesTo: DdProjectProfile[]
}

const ALL: DdProjectProfile[] = ['bess', 'pv', 'pv_bess']

export const PROFESSIONAL_DD_CHECKS: ProfessionalDdCheck[] = [
  { id:'eng-grid', lens:'engineering', category:'Netz', label:'Netzverknüpfungspunkt, Anschlussleistung und technische Anschlussbedingungen belastbar', hardGate:true, appliesTo:ALL },
  { id:'eng-layout', lens:'engineering', category:'Layout', label:'Layout, Zufahrt, Abstände, Kabelwege und technische Flächennutzung plausibel', appliesTo:ALL },
  { id:'eng-permits', lens:'engineering', category:'Genehmigung', label:'Technische Genehmigungsanforderungen und Fachnachweise vollständig identifiziert', hardGate:true, appliesTo:ALL },
  { id:'eng-bess', lens:'engineering', category:'Speichertechnik', label:'Batterie, PCS, Transformatoren, Brandschutz und Sicherheitskonzept technisch plausibel', appliesTo:['bess','pv_bess'] },
  { id:'eng-pv', lens:'engineering', category:'PV-Technik', label:'Modulbelegung, Wechselrichter, Trafokonzept, Erschließung und Erzeugungsleistung plausibel', appliesTo:['pv','pv_bess'] },
  { id:'eng-hybrid', lens:'engineering', category:'Hybrid-Schnittstellen', label:'PV/BESS-Leistungsflüsse, gemeinsamer Netzanschluss und Betriebsgrenzen widerspruchsfrei', hardGate:true, appliesTo:['pv_bess'] },

  { id:'inv-capex', lens:'investor', category:'Wirtschaftlichkeit', label:'CAPEX vollständig, nachvollziehbar und mit Projektstand konsistent', appliesTo:ALL },
  { id:'inv-opex', lens:'investor', category:'Wirtschaftlichkeit', label:'OPEX, Pacht, Netz- und laufende Kosten nachvollziehbar', appliesTo:ALL },
  { id:'inv-revenue', lens:'investor', category:'Erlöse', label:'Erlösmodell und Vermarktungsannahmen dokumentiert und plausibilisierbar', appliesTo:ALL },
  { id:'inv-rtb', lens:'investor', category:'RTB', label:'RTB-Meilensteine, Restbudget, Zeitplan und Verantwortlichkeiten belastbar', hardGate:true, appliesTo:ALL },
  { id:'inv-exit', lens:'investor', category:'Transaktion', label:'Bankability, Exit-/Hold-Szenario und wesentliche Deal-Risiken transparent', appliesTo:ALL },

  { id:'law-land', lens:'legal', category:'Grundstück', label:'Flächensicherung, Laufzeit, Optionen und Nutzungsrechte rechtlich belastbar', hardGate:true, appliesTo:ALL },
  { id:'law-transfer', lens:'legal', category:'Verträge', label:'Abtretung, Übertragbarkeit, Change-of-Control und Finanziererrechte geprüft', hardGate:true, appliesTo:ALL },
  { id:'law-grid', lens:'legal', category:'Netz', label:'Netzanschlussdokumente, Bindungswirkung, Fristen und Bedingungen rechtlich geprüft', hardGate:true, appliesTo:ALL },
  { id:'law-permit', lens:'legal', category:'Genehmigung', label:'Genehmigungen, Nebenbestimmungen, Laufzeiten und Übertragbarkeit geprüft', hardGate:true, appliesTo:ALL },
  { id:'law-spv', lens:'legal', category:'SPV', label:'Projektgesellschaft, Eigentumsstruktur und wesentliche Projektverträge transparent', appliesTo:ALL },
]

export function getProfessionalDdChecks(profile: DdProjectProfile) {
  return PROFESSIONAL_DD_CHECKS.filter(check => check.appliesTo.includes(profile))
}

export const REVIEW_LENS_LABELS: Record<DdReviewLens, string> = {
  engineering: 'Engineering Review',
  investor: 'Investor Review',
  legal: 'Legal Review',
}
