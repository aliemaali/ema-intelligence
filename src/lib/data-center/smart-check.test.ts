import test from 'node:test'
import assert from 'node:assert/strict'
import { assessSmartCheck, emptySmartCheckFacts } from './smart-check'

test('10 MW requested stays unverified, IT is estimated, price basis remains open', () => {
  const result = assessSmartCheck({ ...emptySmartCheckFacts, location: 'Chemnitz', gridMw: 10, gridStatus: 'requested', pricePerMw: 600_000 })
  assert.equal(result.verdict, 'WEITERVERFOLGEN – ERST KLÄREN')
  assert.equal(result.itMw, 8)
  assert.equal(result.calculatedPrice, null)
  assert.ok(result.questions.includes('Bezieht sich der Preis pro MW auf Netz- oder IT-Leistung?'))
  assert.match(result.explanation, /nicht bestätigt/)
})

test('price per MW uses explicit reference only', () => {
  const base = { ...emptySmartCheckFacts, location: 'Chemnitz', gridMw: 10, pricePerMw: 600_000 }
  assert.equal(assessSmartCheck({ ...base, priceReference: 'grid' }).calculatedPrice, 6_000_000)
  assert.equal(assessSmartCheck({ ...base, priceReference: 'it' }).calculatedPrice, 4_800_000)
})

test('missing facts are not interpreted as no risk', () => {
  const result = assessSmartCheck(emptySmartCheckFacts)
  assert.equal(result.verdict, 'ERST GRUNDLAGEN KLÄREN')
  assert.equal(result.itMw, null)
  assert.ok(result.questions.some((item) => item.includes('Standort')))
})

test('indicated planning conflict triggers critical gate', () => {
  const result = assessSmartCheck({ ...emptySmartCheckFacts, location: 'Chemnitz', gridMw: 10, planning: 'conflict' })
  assert.equal(result.verdict, 'KRITISCH – FACHLICH PRÜFEN')
})
