// src/lib/capex/calculations.ts
//
// Adapter zwischen dem bestehenden CAPEX-UI-Modell und der zentralen EMA Finance Engine.
// Die Oberfläche bleibt unverändert, sämtliche Finanzkennzahlen kommen jedoch aus
// `src/lib/finance/calculate.ts`.

import { calculateProjectFinancials } from '@/lib/finance/calculate'
import type { CapexCalcResult, CapexPosition, CapexProject, CapexYearCashflow } from '@/lib/types/capex.types'

export function calcAll(p: CapexProject): CapexCalcResult {
  const kwp = Number(p.anlagenleistungKwp) || 0

  const moduleCount = kwp > 0 ? Math.ceil((kwp * 1000) / (Number(p.modulleistungWp) || 1)) : 0
  const moduleCost = moduleCount * (Number(p.preisProModul) || 0)
  const actualKwp = (moduleCount * (Number(p.modulleistungWp) || 0)) / 1000

  const wrTotal = (Number(p.wrEinzelpreis) || 0) * (Number(p.wrAnzahl) || 0)
  const wrEurPerKwp = kwp > 0 ? wrTotal / kwp : 0
  const ukTotal = (Number(p.ukPreisProKwp) || 0) * kwp
  const dcTotal = (Number(p.dcPreisProKwp) || 0) * kwp
  const acTotal = (Number(p.acPreisProKwp) || 0) * kwp

  const rawPositions: Array<{ name: string; cost: number }> = [
    { name: 'PV-Module', cost: moduleCost },
    { name: 'Wechselrichter', cost: wrTotal },
    { name: 'Unterkonstruktion / Montagesystem', cost: ukTotal },
    { name: 'Elektroinstallation (AC)', cost: acTotal },
    { name: 'Montagearbeiten (DC)', cost: dcTotal },
    { name: 'Planung, Genehmigung & Engineering', cost: Number(p.planungEngineering) || 0 },
    { name: 'Bauliche Maßnahmen / Erdarbeiten', cost: Number(p.baulicheMassnahmen) || 0 },
    { name: 'Logistik & Transport', cost: Number(p.logistikTransport) || 0 },
    { name: 'Inbetriebnahme & Abnahme', cost: Number(p.inbetriebnahme) || 0 },
    { name: 'Sonstige Kosten / Unvorhergesehenes (Contingency)', cost: Number(p.contingency) || 0 },
    { name: 'Einmalige Pachtzahlung (Vorauszahlung gesamte Laufzeit)', cost: (Number(p.pachtzahlungProKwp) || 0) * kwp },
    { name: 'Einmalige Zahlung für Projektrechte', cost: (Number(p.projektrechteProKwp) || 0) * kwp },
  ]

  const totalCapex = rawPositions.reduce((sum, position) => sum + position.cost, 0)
  const positions: CapexPosition[] = rawPositions.map((position) => ({
    ...position,
    share: totalCapex > 0 ? position.cost / totalCapex : 0,
    eurPerKwp: kwp > 0 ? position.cost / kwp : 0,
  }))

  const emptyResult: CapexCalcResult = {
    moduleCount,
    moduleCost,
    actualKwp,
    wrTotal,
    wrEurPerKwp,
    ukTotal,
    dcTotal,
    acTotal,
    positions,
    totalCapex,
    specificCapex: kwp > 0 ? totalCapex / kwp : 0,
    energyY1: 0,
    revenueY1: 0,
    opexY1: 0,
    ncfY1: 0,
    staticPayback: null,
    years: [{ year: 0, energy: null, price: null, revenue: null, opex: null, ncf: -totalCapex, cum: -totalCapex }],
    irr: 0,
    npv: 0,
    dynPayback: null,
  }

  if (kwp <= 0 || totalCapex <= 0 || Number(p.spezErtragKwhKwp) <= 0 || Number(p.strompreisEurKwh) <= 0) {
    return emptyResult
  }

  const engineResult = calculateProjectFinancials({
    leistung_kwp: kwp,
    spez_ertrag_kwh_kwp: Number(p.spezErtragKwhKwp),
    performance_ratio: null,
    degradation_pct_pa: Number(p.degradationPct) || 0,
    betrachtungszeitraum_jahre: 20,
    erloesmodell: 'eeg_einspeiseverguetung',
    eeg_verguetung_ct_kwh: Number(p.strompreisEurKwh) * 100,
    direktvermarktung_ct_kwh: null,
    ppa_preis_ct_kwh: null,
    verguetungsdauer_jahre: 20,
    eigenverbrauchsquote_pct: null,
    strompreis_eigenverbrauch_ct_kwh: null,
    strompreissteigerung_pct_pa: Number(p.strompreissteigerungPct) || 0,
    opex_betriebsfuehrung_eur_pa: totalCapex * ((Number(p.betriebskostenPct) || 0) / 100),
    opex_wartung_eur_pa: 0,
    opex_versicherung_eur_pa: 0,
    opex_pacht_eur_pa: 0,
    opex_sonstige_eur_pa: 0,
    ruecklage_rueckbau_eur_pa: 0,
    opex_steigerung_pct_pa: 0,
    ek_quote_pct: null,
    fk_zins_pct: null,
    fk_laufzeit_jahre: null,
    diskontsatz_pct: Number(p.waccPct) || 0,
    capex_positions: rawPositions.map((position, index) => ({
      kategorie: 'sonstige',
      bezeichnung: position.name,
      menge: 1,
      einheit: 'pauschal',
      einzelpreis_eur: position.cost,
      betrag_eur: position.cost,
      sortierung: index + 1,
    })),
  })

  if (!engineResult.ok) return emptyResult

  const priceGrowth = (Number(p.strompreissteigerungPct) || 0) / 100
  const basePrice = Number(p.strompreisEurKwh) || 0
  const years: CapexYearCashflow[] = engineResult.data.cashflow_reihe.map((row) => ({
    year: row.jahr,
    energy: row.ertrag_kwh,
    price: row.jahr === 0 ? null : basePrice * Math.pow(1 + priceGrowth, row.jahr - 1),
    revenue: row.erloes_eur,
    opex: row.opex_eur,
    ncf: row.cashflow_vor_finanzierung_eur,
    cum: row.kumulierter_cashflow_eur,
  }))

  const yearOne = years[1]
  const staticPayback = yearOne && yearOne.ncf > 0 ? totalCapex / yearOne.ncf : null

  return {
    moduleCount,
    moduleCost,
    actualKwp,
    wrTotal,
    wrEurPerKwp,
    ukTotal,
    dcTotal,
    acTotal,
    positions,
    totalCapex: engineResult.data.capex_gesamt_eur,
    specificCapex: engineResult.data.capex_eur_pro_kwp,
    energyY1: yearOne?.energy ?? 0,
    revenueY1: yearOne?.revenue ?? 0,
    opexY1: yearOne?.opex ?? 0,
    ncfY1: yearOne?.ncf ?? 0,
    staticPayback,
    years,
    irr: (engineResult.data.irr_projekt_pct ?? 0) / 100,
    npv: engineResult.data.npv_eur,
    dynPayback: engineResult.data.payback_jahre,
  }
}
