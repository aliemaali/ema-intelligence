import { renderMemorandumHtml } from '../pdf/projektliste/memorandumTemplate'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractExposeText } from './import'
import { applyExposeDraft, buildExposeSource, exposeDraftSchema } from './wizard'

const text = `BESS Musterstadt in Bayern aufmerksam machen. Das
Projekt überzeugt vor allem durch niedrige
Erschließungs- und Nebenkosten:
- Trassenlänge: nur ca. 70 m, Anschluss direkt am
Umspannwerk
- Pacht: 42.000 € netto p. a. (entspricht 7.000 €/MW p.
a.)
- Baukostenzuschuss: noch nicht festgesetzt, erwartet
max. 95 €/kW
Eckdaten
- Leistung / Kapazität: 6 MW / 15 MWh (Standalone-
Graustromspeicher)
- Netzbetreiber: MUSTERNETZ Strom, Mittelspannung
- Einspeise- und Bezugsleistung: technisch bestätigt und
verbindlich reserviert
Projektstand
- Bauantrag in Genehmigung, Privilegierung liegt vor
- Schallgutachten (TA Lärm) liegt vor
- Konzept: 4 Batteriecontainer, 2 Wechselrichter-/
Trafoeinheiten
- Geplante Inbetriebnahme: Q2 2027
Pachtvertrag
- Laufzeit 10 Jahre + 4 × 5 Jahre Verlängerungsoption
- Dienstbarkeit vorgesehen, Eintragung ausstehend
Konditionen
- Kaufpreis: 150 €/kW (900.000 € gesamt)
- Transaktion: Share-Deal (Projekt-GmbH)`

test('Musterstadt source preserves lease, total and unit purchase prices, estimates and pending permits', () => {
  const imported = extractExposeText(text, 'auszug.jpg')
  assert.equal(imported.title, 'BESS Musterstadt')
  assert.equal(imported.location, 'Musterstadt, Bayern')
  assert.deepEqual(imported.metrics, [{ label: 'Leistung', value: '6 MW' }, { label: 'Kapazität', value: '15 MWh' }])
  assert.equal(imported.profile.find(r => r.label === 'Kaufpreis')?.value, '150 €/kW (900.000 € gesamt)')
  assert.match(imported.profile.find(r => r.label === 'Baukostenzuschuss')!.value, /noch nicht festgesetzt, erwartet max\. 95/)
  const all = imported.profile.map(r => `${r.label}: ${r.value}`).join('\n')
  for (const term of ['42.000', '70 m', 'MUSTERNETZ', 'in Genehmigung', 'Eintragung ausstehend', 'Q2 2027', 'Share-Deal', '10 Jahre']) assert.ok(all.includes(term), term)
  assert.equal(imported.profile.length, 14)
})
test('import survives draft persistence and reaches PDF data without stale project facts', () => {
  const imported = extractExposeText(text, 'auszug.jpg')
  const draft = exposeDraftSchema.parse({ title: imported.title, summary: '', highlights: [], hero: 'type', imported })
  const restored = exposeDraftSchema.parse(JSON.parse(JSON.stringify(draft)))
  const source = { ...buildExposeSource({ project_type: 'bess', project_name: 'Alt', location_city: 'Berlin', bess_mw: 99, bess_mwh: 198 }), draft: null }
  const output = applyExposeDraft(source, restored)
  assert.equal(output.location, 'Musterstadt, Bayern')
  assert.deepEqual(output.metrics, imported.metrics)
  assert.deepEqual(output.profile, imported.profile)
  assert.equal(output.showPvEconomics, false)
  const html = renderMemorandumHtml(output, { heroImage: '', fontFaceCss: '', germanyMap: { locations: [] } as any })
  for (const term of ['Share-Deal', 'Eintragung ausstehend', 'Q2 2027', '900.000', 'max. 95', '42.000']) assert.ok(html.includes(term), `PDF contains ${term}`)
  assert.ok(html.includes('Projektangaben aus Upload'))
  assert.equal(source.data.location, 'Berlin')
})
test('unstructured or oversized input is rejected without inventing data', () => {
  assert.throws(() => extractExposeText('Kein lesbarer Inhalt', 'leer.txt'))
  assert.throws(() => extractExposeText('x'.repeat(12001), 'lang.txt'))
  assert.throws(() => extractExposeText('Dieses Dokument enthält leider keine Projektinformationen.', 'text.txt'))
})
test('PV source supports explicit title and location without assuming a storage project', () => {
  const imported = extractExposeText('Projektname: Solarpark\nStandort: Leipzig\nPV-Leistung: 2,5 MWp\nKaufpreis: 200.000 €', 'pv.txt')
  assert.equal(imported.title, 'Solarpark')
  assert.equal(imported.location, 'Leipzig')
  assert.deepEqual(imported.metrics, [{ label: 'PV-Leistung', value: '2,5 MWp' }])
})
