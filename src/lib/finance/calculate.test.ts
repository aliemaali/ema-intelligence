import { describe, expect, it } from 'vitest'
import { calculateProjectFinancials } from './calculate'
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
    strompreissteigerung_pct_pa: 2,
    opex_betriebsfuehrung_eur_pa: 9480.75,
    opex_wartung_eur_pa: 0,
    opex_versicherung_eur_pa: 0,
    opex_pacht_eur_pa: 0,
    opex_sonstige_eur_pa: 0,
    ruecklage_rueckbau_eur_pa: 0,
    opex_steigerung_pct_pa: 0,
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

describe('calculateProjectFinancials', () => {
  it('reproduziert die Referenzwerte des hochgeladenen CAPEX-Rechners', () => {
    const result = calculateProjectFinancials(referenceInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.capex_gesamt_eur).toBeCloseTo(632050, 0)
    expect(result.data.capex_eur_pro_kwp).toBeCloseTo(632.05, 2)
    expect(result.data.cashflow_jahr1_eur).toBeCloseTo(66519.25, 0)
    expect(result.data.payback_jahre).toBe(9)
    expect(result.data.irr_projekt_pct).toBeCloseTo(10.04, 2)
    expect(result.data.npv_eur).toBeCloseTo(238058, 0)
    expect(result.data.cashflow_reihe).toHaveLength(21)
  })

  it('liefert ein definiertes Fehlerergebnis bei fehlenden Pflichtwerten', () => {
    const input = referenceInput()
    input.leistung_kwp = null

    const result = calculateProjectFinancials(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join(' ')).toContain('leistung_kwp')
  })

  it('lehnt CAPEX = 0 ab', () => {
    const input = referenceInput()
    input.capex_positions[0].betrag_eur = 0

    const result = calculateProjectFinancials(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('CAPEX muss größer als 0 sein')
  })

  it('nutzt bei Direktvermarktung den Direktvermarktungspreis', () => {
    const input = referenceInput()
    input.erloesmodell = 'direktvermarktung'
    input.eeg_verguetung_ct_kwh = null
    input.direktvermarktung_ct_kwh = 9

    const result = calculateProjectFinancials(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.cashflow_reihe[1].erloes_eur).toBeCloseTo(85500, 0)
  })

  it('setzt den Erlös nach Ende der Vergütungsdauer auf null', () => {
    const input = referenceInput()
    input.betrachtungszeitraum_jahre = 25
    input.verguetungsdauer_jahre = 20

    const result = calculateProjectFinancials(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.cashflow_reihe).toHaveLength(26)
    expect(result.data.cashflow_reihe[20].erloes_eur).toBeGreaterThan(0)
    expect(result.data.cashflow_reihe[21].erloes_eur).toBe(0)
  })
})
