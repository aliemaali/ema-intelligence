import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDdAssessment, type DdFinding } from './analysis'
import { getProfessionalDdChecks, type DdProjectProfile } from './profiles'

function findingsFor(profile: DdProjectProfile, status: DdFinding['status'] = 'verified'): DdFinding[] {
  return getProfessionalDdChecks(profile).map((check) => ({
    checkId: check.id,
    lens: check.lens,
    status,
    severity: status === 'critical' ? 'critical' : status === 'open' ? 'medium' : 'low',
    finding: 'Prüfbefund',
    consequence: 'Konsequenz',
    requiredAction: 'Maßnahme',
    sources: status === 'open' ? [] : [{ documentId: 'doc-1', documentName: 'Nachweis.pdf', page: 1 }],
    confidence: 0.95,
  }))
}

test('vollständig belegte PV-DD ergibt GO', () => {
  const assessment = buildDdAssessment('pv', findingsFor('pv'))
  assert.equal(assessment.decision, 'GO')
  assert.equal(assessment.overallScore, 100)
  assert.equal(assessment.hardGateFailures.length, 0)
  assert.equal(assessment.hardGateOpen.length, 0)
})

test('kritisches Hard Gate erzwingt NO-GO', () => {
  const findings = findingsFor('bess')
  const hardGate = getProfessionalDdChecks('bess').find((check) => check.hardGate)
  assert.ok(hardGate)
  const target = findings.find((finding) => finding.checkId === hardGate.id)
  assert.ok(target)
  target.status = 'critical'
  target.severity = 'critical'

  const assessment = buildDdAssessment('bess', findings)
  assert.equal(assessment.decision, 'NO-GO')
  assert.deepEqual(assessment.hardGateFailures, [hardGate.id])
})

test('fehlende Nachweise werden als INSUFFICIENT DATA bewertet', () => {
  const assessment = buildDdAssessment('pv_bess', [])
  assert.equal(assessment.decision, 'INSUFFICIENT DATA')
  assert.equal(assessment.verifiedCount, 0)
  assert.equal(assessment.openCount, getProfessionalDdChecks('pv_bess').length)
})
