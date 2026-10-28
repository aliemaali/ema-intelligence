import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractUploadedProjectData } from './projectData'

test('BESS description identifies the project and combined power/capacity line', () => {
  const result = extractUploadedProjectData(`BESS Musterstadt in Bayern aufmerksam machen. Das
Projekt überzeugt vor allem durch niedrige Kosten:
- Pacht: 42.000 € netto p. a.
- Leistung / Kapazität: 6 MW / 15 MWh
- Kaufpreis: 150 €/kW (900.000 € gesamt)`)
  assert.equal(result.project_name, 'BESS Musterstadt')
  assert.equal(result.location_city, 'Musterstadt')
  assert.equal(result.location_state, 'Bayern')
  assert.equal(result.bess_mw, 6)
  assert.equal(result.bess_mwh, 15)
  assert.equal(result.purchase_price, 900000)
})
test('lease and unit amounts never become the total purchase price', () => {
  for (const text of ['Pacht: 42.000,00 € jährlich', 'Kaufpreis: 150 €/kW']) {
    assert.equal(extractUploadedProjectData(text).purchase_price, null)
  }
})
test('explicit project name and ordinary total purchase price are preserved', () => {
  const result = extractUploadedProjectData('Projektname: Solarpark Süd\nStandort: Leipzig\nPV-Leistung: 500 kWp\nKaufpreis: 400.000 €')
  assert.equal(result.project_name, 'Solarpark Süd')
  assert.equal(result.location_city, 'Leipzig')
  assert.equal(result.pv_kwp, 500)
  assert.equal(result.purchase_price, 400000)
})
