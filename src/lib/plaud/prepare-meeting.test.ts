import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPlaudTranslationProgress,
  getPlaudTranslationStatus,
  hidePlaudTranslationProgress,
  isGermanPlaudLanguage,
  splitPlaudTranscript,
} from './prepare-meeting'

test('splits long transcripts into short deterministic sections', () => {
  const transcript = 'a'.repeat(13_000)
  const parts = splitPlaudTranscript(transcript)

  assert.equal(parts.length, 3)
  assert.ok(parts.every((part) => part.length <= 6_000))
  assert.equal(parts.join(''), transcript)
})

test('stores translation progress without exposing it as transcript text', () => {
  const progress = createPlaudTranslationProgress('a'.repeat(13_000))

  assert.deepEqual(getPlaudTranslationStatus(progress), { done: false, completed: 0, total: 3 })
  assert.equal(hidePlaudTranslationProgress(progress), null)
})

test('recognizes completed and German transcripts', () => {
  assert.deepEqual(getPlaudTranslationStatus('Fertiges Transkript'), { done: true, completed: 1, total: 1 })
  assert.deepEqual(getPlaudTranslationStatus(null), { done: true, completed: 0, total: 0 })
  assert.equal(hidePlaudTranslationProgress('Fertiges Transkript'), 'Fertiges Transkript')
  assert.equal(isGermanPlaudLanguage('de-DE'), true)
  assert.equal(isGermanPlaudLanguage('en-US'), false)
})
