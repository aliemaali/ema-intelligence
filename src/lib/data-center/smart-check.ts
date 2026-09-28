export type SmartCheckFacts = {
  location: string
  gridMw: number | null
  gridStatus: 'unknown' | 'indicated' | 'requested' | 'grid_study_ongoing' | 'generally_feasible' | 'confirmed_in_writing' | 'contractually_secured'
  pricePerMw: number | null
  totalPrice: number | null
  priceReference: 'unknown' | 'grid' | 'it'
  planning: 'unknown' | 'indicated' | 'permitted_claimed' | 'conflict'
  offtaker: 'unknown' | 'none' | 'searching' | 'loi' | 'binding_contract'
  projectModel: 'unknown' | 'greenfield' | 'existing_building' | 'brownfield_conversion' | 'shell' | 'powered_shell' | 'turnkey'
}

export type SmartCheckAssessment = {
  verdict: 'WEITERVERFOLGEN – ERST KLÄREN' | 'ERST GRUNDLAGEN KLÄREN' | 'KRITISCH – FACHLICH PRÜFEN'
  explanation: string
  itMw: number | null
  calculatedPrice: number | null
  questions: string[]
}

export const emptySmartCheckFacts: SmartCheckFacts = {
  location: '', gridMw: null, gridStatus: 'unknown', pricePerMw: null,
  totalPrice: null, priceReference: 'unknown', planning: 'unknown',
  offtaker: 'unknown', projectModel: 'unknown',
}

export function assessSmartCheck(facts: SmartCheckFacts): SmartCheckAssessment {
  const gridMw = facts.gridMw !== null && Number.isFinite(facts.gridMw) && facts.gridMw > 0 ? facts.gridMw : null
  const itMw = gridMw === null ? null : gridMw / 1.25
  const priceBasis = facts.priceReference === 'grid' ? gridMw : facts.priceReference === 'it' ? itMw : null
  const calculatedPrice = facts.totalPrice !== null && facts.totalPrice > 0
    ? facts.totalPrice
    : facts.pricePerMw !== null && facts.pricePerMw > 0 && priceBasis !== null
      ? facts.pricePerMw * priceBasis : null

  const questions: string[] = []
  if (!facts.location.trim()) questions.push('Wo genau liegt der Standort (Adresse oder Ort)?')
  if (gridMw === null) questions.push('Wie viele MW Netzleistung sind vorgesehen?')
  else questions.push('Gibt es eine schriftliche Bestätigung des Netzbetreibers für diese MW?')
  if (facts.planning === 'conflict') questions.push('Welcher baurechtliche Konflikt besteht konkret und wie soll er gelöst werden?')
  else questions.push('Ist die Nutzung als Rechenzentrum baurechtlich bestätigt?')
  if (facts.pricePerMw !== null && facts.priceReference === 'unknown') questions.push('Bezieht sich der Preis pro MW auf Netz- oder IT-Leistung?')
  if (facts.offtaker === 'loi') questions.push('Gibt es über den LOI hinaus einen verbindlichen Offtake-Vertrag?')
  if (facts.pricePerMw === null && facts.totalPrice === null) questions.push('Wie hoch ist der Projektkaufpreis?')

  const verdict = facts.planning === 'conflict'
    ? 'KRITISCH – FACHLICH PRÜFEN'
    : gridMw !== null && facts.location.trim()
      ? 'WEITERVERFOLGEN – ERST KLÄREN'
      : 'ERST GRUNDLAGEN KLÄREN'
  const explanation = facts.planning === 'conflict'
    ? 'Ein baurechtlicher Konflikt wurde angegeben. Die konkrete Rechenzentrumsnutzung muss fachlich geprüft werden.'
    : gridMw === null
      ? 'Ohne Netzleistung ist eine erste Kapazitätseinschätzung nicht möglich.'
      : !facts.location.trim()
        ? 'Die Netzleistung wurde genannt, der Standort fehlt für eine Standortprüfung.'
        : facts.gridStatus === 'requested'
          ? `${mwText(gridMw)} sind nur angefragt. Ein Netzanschluss ist noch nicht bestätigt.`
          : ['confirmed_in_writing', 'contractually_secured'].includes(facts.gridStatus)
            ? 'Eine Netzbestätigung wurde behauptet, aber das Dokument ist noch nicht geprüft.'
            : 'Die Netzleistung stammt aus einer Nachricht und ist ohne geprüften Nachweis nicht bestätigt.'

  return { verdict, explanation, itMw, calculatedPrice, questions: questions.slice(0, 3) }
}

function mwText(value: number) {
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} MW`
}
