import type {
  CalculationResult,
  CashflowJahr,
  ProjectFinancialInput,
} from './types'

const REQUIRED_NUMBERS: Array<keyof ProjectFinancialInput> = [
  'leistung_kwp',
  'spez_ertrag_kwh_kwp',
  'degradation_pct_pa',
  'betrachtungszeitraum_jahre',
  'verguetungsdauer_jahre',
  'strompreissteigerung_pct_pa',
  'diskontsatz_pct',
]

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function sumNullable(values: Array<number | null>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
}

function resolveVerguetungEurKwh(input: ProjectFinancialInput): number | null {
  switch (input.erloesmodell) {
    case 'eeg_einspeiseverguetung':
      return input.eeg_verguetung_ct_kwh === null
        ? null
        : input.eeg_verguetung_ct_kwh / 100
    case 'direktvermarktung':
      return input.direktvermarktung_ct_kwh === null
        ? null
        : input.direktvermarktung_ct_kwh / 100
    case 'ppa':
      return input.ppa_preis_ct_kwh === null ? null : input.ppa_preis_ct_kwh / 100
    case 'mieterstrom':
    case 'eigenverbrauch':
    case 'hybrid':
      return input.strompreis_eigenverbrauch_ct_kwh === null
        ? null
        : input.strompreis_eigenverbrauch_ct_kwh / 100
  }
}

/**
 * Robuste Projekt-IRR für konventionelle Cashflows mit genau einem
 * Vorzeichenwechsel. Mehrdeutige oder nicht vorhandene IRRs werden nicht als
 * scheinbar valide Prozentzahl ausgegeben.
 */
export function calculateIrr(cashflows: number[]): number | null {
  const nonZeroCashflows = cashflows.filter((cashflow) => Math.abs(cashflow) > 1e-9)
  let signChanges = 0

  for (let index = 1; index < nonZeroCashflows.length; index += 1) {
    if (Math.sign(nonZeroCashflows[index]) !== Math.sign(nonZeroCashflows[index - 1])) {
      signChanges += 1
    }
  }

  // Ohne genau einen Vorzeichenwechsel ist keine eindeutige Projekt-IRR definiert.
  if (signChanges !== 1) return null

  const npvAt = (rate: number): number =>
    cashflows.reduce(
      (sum, cashflow, index) => sum + cashflow / Math.pow(1 + rate, index),
      0
    )

  let lower = -0.999999
  let upper = 1
  let lowerValue = npvAt(lower)
  let upperValue = npvAt(upper)

  // Sehr profitable Projekte können eine IRR von über 100 % haben. Die obere
  // Grenze wird kontrolliert erweitert, statt einen unkonvergierten Newton-Wert
  // als vermeintliches Ergebnis auszugeben.
  while (Math.sign(lowerValue) === Math.sign(upperValue) && upper < 1_000_000) {
    upper *= 2
    upperValue = npvAt(upper)
  }

  if (
    !Number.isFinite(lowerValue) ||
    !Number.isFinite(upperValue) ||
    Math.sign(lowerValue) === Math.sign(upperValue)
  ) {
    return null
  }

  for (let index = 0; index < 200; index += 1) {
    const middle = (lower + upper) / 2
    const middleValue = npvAt(middle)

    if (!Number.isFinite(middleValue)) return null
    if (Math.abs(middleValue) < 0.01 || Math.abs(upper - lower) < 1e-10) return middle

    if (Math.sign(middleValue) === Math.sign(lowerValue)) {
      lower = middle
      lowerValue = middleValue
    } else {
      upper = middle
      upperValue = middleValue
    }
  }

  return (lower + upper) / 2
}

export function calculateProjectFinancials(input: ProjectFinancialInput): CalculationResult {
  const errors: string[] = []

  for (const field of REQUIRED_NUMBERS) {
    if (!isFiniteNumber(input[field])) errors.push(`Pflichtwert fehlt oder ist ungültig: ${field}`)
  }

  const verguetungEurKwh = resolveVerguetungEurKwh(input)
  if (!isFiniteNumber(verguetungEurKwh)) {
    errors.push(`Für das Erlösmodell ${input.erloesmodell} fehlt der Vergütungspreis`)
  }

  if (!Array.isArray(input.capex_positions)) {
    errors.push('capex_positions fehlt')
  }

  if (errors.length > 0) return { ok: false, errors }

  const leistungKwp = input.leistung_kwp as number
  const spezErtrag = input.spez_ertrag_kwh_kwp as number
  const degradation = (input.degradation_pct_pa as number) / 100
  const yearsCount = Math.trunc(input.betrachtungszeitraum_jahre as number)
  const verguetungsdauer = Math.trunc(input.verguetungsdauer_jahre as number)
  const priceGrowth = (input.strompreissteigerung_pct_pa as number) / 100
  const diskontsatz = (input.diskontsatz_pct as number) / 100

  if (leistungKwp <= 0) return { ok: false, errors: ['leistung_kwp muss größer als 0 sein'] }
  if (spezErtrag <= 0) return { ok: false, errors: ['spez_ertrag_kwh_kwp muss größer als 0 sein'] }
  if (yearsCount <= 0) return { ok: false, errors: ['betrachtungszeitraum_jahre muss größer als 0 sein'] }
  if (verguetungsdauer < 0) return { ok: false, errors: ['verguetungsdauer_jahre darf nicht negativ sein'] }
  if (degradation < 0 || degradation >= 1) {
    return { ok: false, errors: ['degradation_pct_pa muss zwischen 0 und unter 100 liegen'] }
  }
  if (priceGrowth <= -1) {
    return { ok: false, errors: ['strompreissteigerung_pct_pa muss größer als -100 sein'] }
  }
  if (diskontsatz <= -1) {
    return { ok: false, errors: ['diskontsatz_pct muss größer als -100 sein'] }
  }

  const invalidCapexPosition = input.capex_positions.find(
    (position) => !isFiniteNumber(position.betrag_eur) || position.betrag_eur < 0
  )
  if (invalidCapexPosition) {
    return { ok: false, errors: [`Ungültige CAPEX-Position: ${invalidCapexPosition.bezeichnung}`] }
  }

  const capex = input.capex_positions.reduce(
    (sum, position) => sum + (isFiniteNumber(position.betrag_eur) ? position.betrag_eur : 0),
    0
  )

  if (capex <= 0) return { ok: false, errors: ['CAPEX muss größer als 0 sein'] }

  const opexYearOne = sumNullable([
    input.opex_betriebsfuehrung_eur_pa,
    input.opex_wartung_eur_pa,
    input.opex_versicherung_eur_pa,
    input.opex_pacht_eur_pa,
    input.opex_sonstige_eur_pa,
    input.ruecklage_rueckbau_eur_pa,
  ])
  const opexGrowth = (input.opex_steigerung_pct_pa ?? 0) / 100
  if (opexYearOne < 0) return { ok: false, errors: ['OPEX darf nicht negativ sein'] }
  if (opexGrowth <= -1) {
    return { ok: false, errors: ['opex_steigerung_pct_pa muss größer als -100 sein'] }
  }

  const cashflows: number[] = [-capex]
  const cashflowReihe: CashflowJahr[] = [
    {
      jahr: 0,
      ertrag_kwh: null,
      erloes_eur: null,
      opex_eur: null,
      kapitaldienst_eur: null,
      cashflow_vor_finanzierung_eur: -capex,
      cashflow_nach_finanzierung_eur: -capex,
      kumulierter_cashflow_eur: -capex,
    },
  ]

  let energy = leistungKwp * spezErtrag
  let price = verguetungEurKwh as number
  let cumulative = -capex
  let discountedEnergy = 0
  let discountedCosts = capex

  for (let year = 1; year <= yearsCount; year += 1) {
    if (year > 1) {
      energy *= 1 - degradation
      price *= 1 + priceGrowth
    }

    const revenue = year <= verguetungsdauer ? energy * price : 0
    const opex = opexYearOne * Math.pow(1 + opexGrowth, year - 1)
    const cashflowBeforeFinancing = revenue - opex

    // Die hochgeladene Vorlage enthält keine Finanzierungsrechnung.
    // Daher bleibt der Kapitaldienst null und der Nach-Finanzierungs-Cashflow identisch.
    const debtService: number | null = null
    const cashflowAfterFinancing = cashflowBeforeFinancing

    cumulative += cashflowAfterFinancing
    cashflows.push(cashflowBeforeFinancing)
    discountedEnergy += energy / Math.pow(1 + diskontsatz, year)
    discountedCosts += opex / Math.pow(1 + diskontsatz, year)

    cashflowReihe.push({
      jahr: year,
      ertrag_kwh: energy,
      erloes_eur: revenue,
      opex_eur: opex,
      kapitaldienst_eur: debtService,
      cashflow_vor_finanzierung_eur: cashflowBeforeFinancing,
      cashflow_nach_finanzierung_eur: cashflowAfterFinancing,
      kumulierter_cashflow_eur: cumulative,
    })
  }

  const irr = calculateIrr(cashflows)
  const npv = cashflows.reduce(
    (sum, cashflow, index) => sum + cashflow / Math.pow(1 + diskontsatz, index),
    0
  )

  let payback: number | null = null
  let discountedCumulative = -capex
  for (let year = 1; year < cashflows.length; year += 1) {
    const discountedCashflow = cashflows[year] / Math.pow(1 + diskontsatz, year)
    const previousCumulative = discountedCumulative
    discountedCumulative += discountedCashflow

    if (discountedCumulative >= 0 && discountedCashflow > 0) {
      const fractionOfYear = -previousCumulative / discountedCashflow
      payback = year - 1 + fractionOfYear
      break
    }
  }

  return {
    ok: true,
    data: {
      capex_gesamt_eur: capex,
      capex_eur_pro_kwp: capex / leistungKwp,
      irr_projekt_pct: irr === null ? null : irr * 100,
      irr_ek_pct: null,
      npv_eur: npv,
      payback_jahre: payback,
      lcoe_ct_kwh: discountedEnergy > 0 ? (discountedCosts / discountedEnergy) * 100 : null,
      cashflow_jahr1_eur: cashflowReihe[1]?.cashflow_vor_finanzierung_eur ?? 0,
      dscr_min: null,
      cashflow_reihe: cashflowReihe,
    },
  }
}
