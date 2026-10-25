import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { exposeKind, exposeKinds, exposeHero, exposeDraftSchema, buildExposeSource, applyExposeDraft } from './wizard'

test('three categories include both PV variants and hybrid without mixing Data Center and BESS', () => {
  assert.equal(exposeKinds.length, 3)
  for (const type of ['pv_dach', 'pv_freiflaeche', 'hybrid']) assert.equal(exposeKind(type), 'pv')
  assert.equal(exposeKind('bess'), 'bess')
  assert.equal(exposeKind('rechenzentrum'), 'data-center')
  assert.equal(exposeKind('wind'), null)
})
test('each type has its own bundled hero, never a user controlled filesystem path', () => {
  assert.equal(new Set(exposeKinds.map(kind => kind.hero)).size, 3)
  for (const kind of exposeKinds) assert.ok(fs.existsSync(path.join(process.cwd(), 'public', kind.hero)))
  assert.equal(exposeHero('../../etc/passwd'), '/pdf/hero-solarpark.jpg')
})
for (const type of ['bess', 'pv_freiflaeche', 'rechenzentrum']) {
  test(`${type}: correct hero and type-specific presentation are prepared`, () => {
    const source = buildExposeSource({ project_type: type, project_name: 'Testprojekt', location_city: 'Worms', location_country: 'Deutschland', pv_kwp: 1000, bess_mw: 5, bess_mwh: 10, data_center_grid_mw: 10 })
    assert.equal(source.data.heroImage, exposeHero(type))
    assert.equal(source.data.projectType, type)
    assert.ok(source.data.summary.includes('Worms'))
    if (type !== 'pv_freiflaeche') assert.equal(source.data.showPvEconomics, false)
  })
}
test('missing values are flagged instead of fabricated', () => {
  const source = buildExposeSource({ project_type: 'bess', project_name: 'Unvollständig' })
  assert.ok(source.warnings.some(w => w.includes('Projektort')))
  assert.ok(source.warnings.some(w => w.includes('Speicherkapazität')))
})
test('draft validation bounds persisted fields and rejects arbitrary hero URLs', () => {
  const draft = { title: 'Projekt', summary: 'Kurzbeschreibung', highlights: ['Netz prüfen'], hero: 'type' }
  assert.equal(exposeDraftSchema.safeParse(draft).success, true)
  for (const patch of [{ title: ' ' }, { summary: 'x'.repeat(1201) }, { highlights: Array(7).fill('x') }, { hero: 'https://external.invalid/test' }]) {
    assert.equal(exposeDraftSchema.safeParse({ ...draft, ...patch }).success, false)
  }
})
test('draft edits do not mutate project values and photo choice is explicit', () => {
  const prepared = buildExposeSource({ project_type: 'bess', project_name: 'Original', project_image_url: 'https://example.supabase.co/photo.jpg' })
  const source = { ...prepared, draft: null }
  const draft = { title: 'Exposé Titel', summary: 'Geprüfter Text', highlights: [''], hero: 'type' as const }
  const output = applyExposeDraft(source, draft)
  assert.equal(output.projectName, 'Exposé Titel')
  assert.equal(source.data.projectName, 'Original')
  assert.deepEqual(output.highlights, [])
  assert.equal(output.projectImage, undefined)
  assert.equal(applyExposeDraft(source, { ...draft, hero: 'project' }).projectImage, prepared.projectImage)
})
