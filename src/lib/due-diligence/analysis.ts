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

export type DdDecision = 'GO' | 'CONDITIONAL GO' | 'NO-GO'

export type DdAssessment = {
  profile: DdProjectProfile
  findings: DdFinding[]
  lensScores: Record<DdReviewLens, number>
  overallScore: number
  decision: DdDecision
  hardGateFailures: string[]
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
    consequence: check.hardGate ? 'RTB-/Investment-Freigabe kann dadurch blockiert sein.' : 'Prüfung ist unvollständig.',
    requiredAction: 'Geeigneten Nachweis anfordern und fachlich prüfen.',
    sources: [],
    confidence: 1,
  }))

  const lensScores = Object.fromEntries((['engineering','investor','legal'] as DdReviewLens[]).map(lens => {
    const lensFindings = complete.filter(f => f.lens === lens)
    const score = lensFindings.length ? Math.round(lensFindings.reduce((sum, f) => sum + scoreForStatus[f.status], 0) / lensFindings.length) : 0
    return [lens, score]
  })) as Record<DdReviewLens, number>

  const hardGateFailures = checks.filter(c => c.hardGate && byId.get(c.id)?.status !== 'verified').map(c => c.id)
  const criticalHardGate = checks.some(c => c.hardGate && byId.get(c.id)?.status === 'critical')
  const overallScore = Math.round((lensScores.engineering + lensScores.investor + lensScores.legal) / 3)
  const decision: DdDecision = criticalHardGate || overallScore < 45 ? 'NO-GO' : hardGateFailures.length || overallScore < 80 ? 'CONDITIONAL GO' : 'GO'

  return {
    profile,
    findings: complete,
    lensScores,
    overallScore,
    decision,
    hardGateFailures,
    criticalCount: complete.filter(f => f.status === 'critical').length,
    openCount: complete.filter(f => f.status === 'open').length,
    verifiedCount: complete.filter(f => f.status === 'verified').length,
  }
}
