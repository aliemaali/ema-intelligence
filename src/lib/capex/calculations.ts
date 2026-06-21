// src/lib/capex/calculations.ts
//
// 1:1-Migration der Berechnungslogik aus EMA_CAPEX_Rechner.html (`calcAll`).
// Reine, server- und clientseitig nutzbare Funktionen ohne React-Abhängigkeit.

import type { CapexCalcResult, CapexPosition, CapexProject, CapexYearCashflow } from '@/lib/types/capex.types'

export function calcAll(p: CapexProject): CapexCalcResult {
  const kwp = Number(p.anlagenleistungKwp) || 0

  // ── Module ───────────────────────────────────────────────────────────────
  const moduleCount = kwp > 0 ? Math.ceil((kwp * 1000) / (Number(p.modulleistungWp) || 1)) : 0
  const moduleCost = moduleCount * (Number(p.preisProModul) || 0)
  const actualKwp = (moduleCount * (Number(p.modulleistungWp) || 0)) / 1000

  // ── Wechselrichter ───────────────────────────────────────────────────────
  const wrTotal = (Number(p.wrEinzelpreis) || 0) * (Number(p.wrAnzahl) || 0)
  const wrEurPerKwp = kwp > 0 ? wrTotal / kwp : 0

  // ── Unterkonstruktion ────────────────────────────────────────────────────
  const ukTotal = (Number(p.ukPreisProKwp) || 0) * kwp

  // ── DC / AC ──────────────────────────────────────────────────────────────
  const dcTotal = (Number(p.dcPreisProKwp) || 0) * kwp
  const acTotal = (Number(p.acPreisProKwp) || 0) * kwp

  // ── CAPEX-Positionen ─────────────────────────────────────────────────────
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

  const totalCapex = rawPositions.reduce((s, x) => s + x.cost, 0)

  const positions: CapexPosition[] = rawPositions.map((x) => ({
    ...x,
    share: totalCapex > 0 ? x.cost / totalCapex : 0,
    eurPerKwp: kwp > 0 ? x.cost / kwp : 0,
  }))

  const specificCapex = kwp > 0 ? totalCapex / kwp : 0

  // ── Kennzahlen Jahr 1 ────────────────────────────────────────────────────
  const energyY1 = kwp * (Number(p.spezErtragKwhKwp) || 0)
  const revenueY1 = energyY1 * (Number(p.strompreisEurKwh) || 0)
  const opexY1 = totalCapex * ((Number(p.betriebskostenPct) || 0) / 100)
  const ncfY1 = revenueY1 - opexY1
  const staticPayback = ncfY1 > 0 ? totalCapex / ncfY1 : null

  // ── 20-Jahres-Cashflow ───────────────────────────────────────────────────
  const degr = (Number(p.degradationPct) || 0) / 100
  const priceGrowth = (Number(p.strompreissteigerungPct) || 0) / 100
  const wacc = (Number(p.waccPct) || 0) / 100
  const opexPct = (Number(p.betriebskostenPct) || 0) / 100

  const years: CapexYearCashflow[] = []
  const cashflows: number[] = [-totalCapex]
  let cum = -totalCapex
  let energy = energyY1
  let price = Number(p.strompreisEurKwh) || 0

  years.push({ year: 0, energy: null, price: null, revenue: null, opex: null, ncf: -totalCapex, cum })

  for (let y = 1; y <= 20; y++) {
    if (y > 1) {
      energy = energy * (1 - degr)
      price = price * (1 + priceGrowth)
    }
    const revenue = energy * price
    const opex = totalCapex * opexPct
    const ncf = revenue - opex
    cum += ncf
    cashflows.push(ncf)
    years.push({ year: y, energy, price, revenue, opex, ncf, cum })
  }

  // ── IRR via Newton-Verfahren ─────────────────────────────────────────────
  function irrFunc(rate: number): number {
    return cashflows.reduce((s, cf, i) => s + cf / Math.pow(1 + rate, i), 0)
  }
  function irrDeriv(rate: number): number {
    return cashflows.reduce((s, cf, i) => s - (i * cf) / Math.pow(1 + rate, i + 1), 0)
  }

  let irr = 0.1
  for (let i = 0; i < 100; i++) {
    const f = irrFunc(irr)
    const d = irrDeriv(irr)
    if (Math.abs(d) < 1e-9) break
    const next = irr - f / d
    if (Math.abs(next - irr) < 1e-7) {
      irr = next
      break
    }
    irr = next
  }
  if (!isFinite(irr) || isNaN(irr)) irr = 0

  // ── NPV ──────────────────────────────────────────────────────────────────
  const npv = cashflows.reduce((s, cf, i) => s + cf / Math.pow(1 + wacc, i), 0)

  // ── Dynamischer Payback ──────────────────────────────────────────────────
  let dynPayback: number | null = null
  for (let y = 0; y <= 20; y++) {
    if (years[y].cum >= 0) {
      dynPayback = y
      break
    }
  }

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
    totalCapex,
    specificCapex,
    energyY1,
    revenueY1,
    opexY1,
    ncfY1,
    staticPayback,
    years,
    irr,
    npv,
    dynPayback,
  }
}
