import { getProfessionalDdChecks, type DdProjectProfile, type DdReviewLens } from './profiles'

export type DdFindingStatus = 'pass' | 'warning' | 'fail' | 'missing'

export type DdEvidence = {
  documentId: string
  documentName: string
  page: number | null
  fact: string
}

export type DdFinding = {
  checkId: string
  lens: DdReviewLens
  category: string
  label: string
  hardGate: boolean
  status: DdFindingStatus
  confidence: 'high' | 'medium' | 'low'
  finding: string
  evidence: DdEvidence[]
  contradiction: string | null
  action: string | null
}

export type DdDecision = 'GO' | 'GO_WITH_CONDITIONS' | 'NO_GO' | 'INSUFFICIENT_DATA'

export type DdAssessment = {
  profile: DdProjectProfile
  decision: DdDecision
  score: number | null
  hardGateFailures: number
  findings: DdFinding[]
}

export function buildDdAssessment(profile: DdProjectProfile, findings: DdFinding[]): DdAssessment {
  const expected = getProfessionalDdChecks(profile)
  const byId = new Map(findings.map(f => [f.checkId, f]))
  const normalized = expected.map(check => byId.get(check.id) ?? ({
    checkId: check.id,
    lens: check.lens,
    category: check.category,
    label: check.label,
    hardGate: check.hardGate === true,
    status: 'missing' as const,
    confidence: 'low' as const,
    finding: 'Keine belastbare Evidenz im geprüften Datenraum.',
    evidence: [],
    contradiction: null,
    action: 'Erforderlichen Nachweis im Datenraum ergänzen.',
  }))

  const hardGateFailures = normalized.filter(f => f.hardGate && f.status === 'fail').length
  const hardGateMissing = normalized.filter(f => f.hardGate && f.status === 'missing').length
  const scored = normalized.filter(f => f.status !== 'missing')
  const points = scored.reduce((sum, f) => sum + (f.status === 'pass' ? 100 : f.status === 'warning' ? 50 : 0), 0)
  const score = scored.length ? Math.round(points / scored.length) : null

  let decision: DdDecision
  if (hardGateFailures > 0) decision = 'NO_GO'
  else if (hardGateMissing > 0 || scored.length < Math.ceil(normalized.length * 0.6)) decision = 'INSUFFICIENT_DATA'
  else if (normalized.some(f => f.status === 'warning' || f.status === 'missing')) decision = 'GO_WITH_CONDITIONS'
  else decision = 'GO'

  return { profile, decision, score, hardGateFailures, findings: normalized }
}
