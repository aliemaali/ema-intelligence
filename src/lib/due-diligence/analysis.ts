import { getProfessionalDdChecks, type DdProjectProfile, type DdReviewLens } from './profiles'

export type DdFindingStatus = 'verified' | 'open' | 'critical'
export type DdSeverity = 'low' | 'medium' | 'high' | 'critical'

export type DdSource = {
  documentId: string
  documentName: string
  page: number | null
  excerpt?: string
}

export type DdFinding = {
  checkId: string
  lens: DdReviewLens
  status: DdFindingStatus
  severity: DdSeverity
  finding: string
  consequence: string
  requiredAction: string
  sources: DdSource[]
  confidence: number
}

export type DdDecision = 'GO' | 'CONDITIONAL GO' | 'NO-GO' | 'INSUFFICIENT DATA'

export type DdAssessment = {
  profile: DdProjectProfile
  findings: DdFinding[]
  lensScores: Record<DdReviewLens, number>
  overallScore: number
  decision: DdDecision
  hardGateFailures: string[]
  hardGateOpen: string[]
  criticalCount: number
  openCount: number
  verifiedCount: number
}

const scoreForStatus: Record<DdFindingStatus, number> = { verified: 100, open: 45, critical: 0 }

export function buildDdAssessment(profile: DdProjectProfile, findings: DdFinding[]): DdAssessment {
  const checks = getProfessionalDdChecks(profile)
  const byId = new Map(findings.map(f => [f.checkId, f]))
  const complete = checks.map(check => byId.get(check.id) ?? ({
    checkId: check.id,
    lens: check.lens,
    status: 'open' as const,
    severity: check.hardGate ? 'high' as const : 'medium' as const,
    finding: 'Kein belastbarer Nachweis im geprüften Datenraum.',
    consequence: check.hardGate ? 'RTB-/Investment-Freigabe kann ohne Nachweis nicht erteilt werden.' : 'Prüfung ist unvollständig.',
    requiredAction: 'Geeigneten Nachweis anfordern und fachlich prüfen.',
    sources: [],
    confidence: 1,
  }))

  const lensScores = Object.fromEntries((['engineering','investor','legal'] as DdReviewLens[]).map(lens => {
    const lensFindings = complete.filter(f => f.lens === lens)
    const score = lensFindings.length ? Math.round(lensFindings.reduce((sum, f) => sum + scoreForStatus[f.status], 0) / lensFindings.length) : 0
    return [lens, score]
  })) as Record<DdReviewLens, number>

  const hardGateFailures = checks.filter(c => c.hardGate && byId.get(c.id)?.status === 'critical').map(c => c.id)
  const hardGateOpen = checks.filter(c => c.hardGate && byId.get(c.id)?.status !== 'verified' && byId.get(c.id)?.status !== 'critical').map(c => c.id)
  const overallScore = Math.round((lensScores.engineering + lensScores.investor + lensScores.legal) / 3)
  const verifiedCount = complete.filter(f => f.status === 'verified').length
  const evidenceCoverage = complete.length ? verifiedCount / complete.length : 0

  let decision: DdDecision
  if (hardGateFailures.length > 0) decision = 'NO-GO'
  else if (hardGateOpen.length > 0 || evidenceCoverage < 0.6) decision = 'INSUFFICIENT DATA'
  else if (complete.some(f => f.status === 'open') || overallScore < 80) decision = 'CONDITIONAL GO'
  else decision = 'GO'

  return {
    profile,
    findings: complete,
    lensScores,
    overallScore,
    decision,
    hardGateFailures,
    hardGateOpen,
    criticalCount: complete.filter(f => f.status === 'critical').length,
    openCount: complete.filter(f => f.status === 'open').length,
    verifiedCount,
  }
}
