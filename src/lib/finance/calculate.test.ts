import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateIrr, calculateProjectFinancials } from './calculate'
import type { ProjectFinancialInput } from './types'

function referenceInput(): ProjectFinancialInput {
  return {
    leistung_kwp: 1000,
    spez_ertrag_kwh_kwp: 950,
    performance_ratio: null,
    degradation_pct_pa: 0.5,
    betrachtungszeitraum_jahre: 20,
    erloesmodell: 'eeg_einspeiseverguetung',
    eeg_verguetung_ct_kwh: 8,
    direktvermarktung_ct_kwh: null,
    ppa_preis_ct_kwh: null,
    verguetungsdauer_jahre: 20,
    eigenverbrauchsquote_pct: null,
    strompreis_eigenverbrauch_ct_kwh: null,
    strompreissteigerung_pct_pa: 0,
    opex_betriebsfuehrung_eur_pa: 9480.75,
    opex_wartung_eur_pa: 0,
    opex_versicherung_eur_pa: 0,
    opex_pacht_eur_pa: 0,
    opex_sonstige_eur_pa: 0,
    ruecklage_rueckbau_eur_pa: 0,
    opex_steigerung_pct_pa: 2,
    ek_quote_pct: null,
    fk_zins_pct: null,
    fk_laufzeit_jahre: null,
    diskontsatz_pct: 6,
    capex_positions: [
      {
        kategorie: 'sonstige',
        bezeichnung: 'CAPEX gemäß Referenzrechner',
        menge: 1,
        einheit: 'pauschal',
        einzelpreis_eur: 632050,
        betrag_eur: 632050,
        sortierung: 1,
      },
    ],
  }
}

function assertClose(actual: number | null, expected: number, tolerance: number) {
  assert.notEqual(actual, null)
  assert.ok(Math.abs((actual as number) - expected) <= tolerance, `${actual} ≠ ${expected}`)
}

describe('calculateProjectFinancials', () => {
  it('rechnet den konservativen EEG-Investor-Basisfall deterministisch', () => {
    const result = calculateProjectFinancials(referenceInput())
    assert.equal(result.ok, true)
    if (!result.ok) return

    assertClose(result.data.capex_gesamt_eur, 632050, 0.01)
    assertClose(result.data.capex_eur_pro_kwp, 632.05, 0.01)
    assertClose(result.data.cashflow_jahr1_eur, 66519.25, 0.01)
    assertClose(result.data.irr_projekt_pct, 7.58, 0.01)
    assertClose(result.data.npv_eur, 80183, 1)
    assertClose(result.data.payback_jahre, 15.85, 0.01)
    assert.equal(result.data.cashflow_reihe.length, 21)
  })

  it('lehnt fehlende Pflichtwerte und CAPEX = 0 ab', () => {
    const missingCapacity = referenceInput()
    missingCapacity.leistung_kwp = null
    const missingResult = calculateProjectFinancials(missingCapacity)
    assert.equal(missingResult.ok, false)
    if (!missingResult.ok) assert.match(missingResult.errors.join(' '), /leistung_kwp/)

    const zeroCapex = referenceInput()
    zeroCapex.capex_positions[0].betrag_eur = 0
    const zeroResult = calculateProjectFinancials(zeroCapex)
    assert.equal(zeroResult.ok, false)
    if (!zeroResult.ok) assert.ok(zeroResult.errors.includes('CAPEX muss größer als 0 sein'))
  })

  it('nutzt bei Direktvermarktung den richtigen Preis', () => {
    const input = referenceInput()
    input.erloesmodell = 'direktvermarktung'
    input.eeg_verguetung_ct_kwh = null
    input.direktvermarktung_ct_kwh = 9

    const result = calculateProjectFinancials(input)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assertClose(result.data.cashflow_reihe[1].erloes_eur, 85500, 0.01)
  })

  it('setzt den Erlös nach Ende der Vergütungsdauer auf null', () => {
    const input = referenceInput()
    input.betrachtungszeitraum_jahre = 25
    input.verguetungsdauer_jahre = 20

    const result = calculateProjectFinancials(input)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.data.cashflow_reihe.length, 26)
    assert.ok((result.data.cashflow_reihe[20].erloes_eur ?? 0) > 0)
    assert.equal(result.data.cashflow_reihe[21].erloes_eur, 0)
  })

  it('gibt bei nicht eindeutiger oder nicht vorhandener IRR null zurück', () => {
    assert.equal(calculateIrr([-100, 0, 0]), null)
    assert.equal(calculateIrr([-100, -10, -10]), null)
    assert.equal(calculateIrr([-100, 230, -132]), null)
  })

  it('validiert ökonomisch unmögliche Eingaben', () => {
    const input = referenceInput()
    input.degradation_pct_pa = 100
    const result = calculateProjectFinancials(input)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.errors.join(' '), /degradation_pct_pa/)
  })
})
