import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPlaudNotePdf, safePlaudPdfFilename } from './note-pdf'

test('creates a readable multi-page PLAUD PDF for a long transcript', async () => {
  const pdf = buildPlaudNotePdf({
    title: 'Project Euler - Koray-Thomas',
    recordedAt: '2026-08-21T09:08:00.000Z',
    durationMs: 52 * 60_000,
    language: 'de',
    sourceLanguage: 'en',
    summary: 'Das Gespräch behandelte den Projektstatus und die nächsten Schritte.',
    transcript: Array.from({ length: 180 }, (_, index) => `Sprecher ${index % 3 + 1}: Abschnitt ${index + 1} mit vollständigem Inhalt und belastbaren Projektdetails.`).join('\n\n'),
  })

  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.ok(pdf.length > 10_000)
  const pageObjects = pdf.toString('latin1').match(/\/Type \/Page\b/g) || []
  assert.ok(pageObjects.length >= 3)
})

test('creates safe language-specific filenames', () => {
  assert.equal(safePlaudPdfFilename('Müller & Partner / Status', 'de'), 'EMA-PLAUD-Muller-Partner-Status-DE.pdf')
  assert.equal(safePlaudPdfFilename('Müller & Partner / Status', 'original'), 'EMA-PLAUD-Muller-Partner-Status-Original.pdf')
})
