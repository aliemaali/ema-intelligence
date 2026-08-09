export function positiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function firstProjectValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key]
    if (value !== null && value !== undefined && value !== '') return value
  }
  return null
}

function projectEmaAiValues(project: Record<string, unknown>): Record<string, unknown> {
  const details = project.ai_score_details
  if (!details || typeof details !== 'object') return {}
  const emaAi = (details as Record<string, unknown>).ema_ai
  return emaAi && typeof emaAi === 'object' ? emaAi as Record<string, unknown> : {}
}

/**
 * Combines the project row with its active deal and optional economics rows.
 * Values confirmed through EMA AI are applied after the deal, while dedicated
 * economics rows remain the most specific source.
 */
export function mergeProjectEconomicSources(
  project: Record<string, unknown>,
  deal?: Record<string, unknown> | null,
  optionalData: Record<string, unknown>[] = [],
): Record<string, unknown> {
  return Object.assign({}, project, deal ?? {}, projectEmaAiValues(project), ...optionalData)
}

/**
 * The legacy `pv_mwp` column contains a mix of MWp and kWp records. Prefer
 * explicit kWp fields and use annual production to disambiguate legacy rows.
 */
export function projectPvCapacityKwp(project: Record<string, unknown>): number | null {
  const explicitKwp = positiveNumber(firstProjectValue(project, [
    'pv_kwp',
    'capacity_kwp',
    'plant_capacity_kwp',
    'anlagenleistung_kwp',
  ]))
  if (explicitKwp !== null) return explicitKwp

  const legacyValue = positiveNumber(project.pv_mwp)
  if (legacyValue === null) return null

  // `pv_mwp` historically contained both MWp and kWp. When production and
  // specific yield are available, they reveal the intended unit reliably.
  const annualYield = positiveNumber(firstProjectValue(project, [
    'annual_yield_kwh',
    'annual_energy_kwh',
    'annual_production_kwh',
  ]))
  const specificYield = positiveNumber(firstProjectValue(project, [
    'specific_yield_kwh_kwp',
    'specific_yield',
    'yield_kwh_kwp',
    'spez_ertrag_kwh_kwp',
  ]))
  if (annualYield !== null && specificYield !== null) {
    const inferredKwp = annualYield / specificYield
    const asKwpDifference = Math.abs(inferredKwp - legacyValue)
    const asMwpDifference = Math.abs(inferredKwp - legacyValue * 1_000)
    if (asMwpDifference < asKwpDifference) return legacyValue * 1_000
  }

  return legacyValue
}

export function projectSpecificYieldKwhPerKwp(project: Record<string, unknown>): number | null {
  return positiveNumber(firstProjectValue(project, [
    'specific_yield',
    'specific_yield_kwh_kwp',
    'yield_kwh_kwp',
    'spez_ertrag_kwh_kwp',
  ]))
}

export function calculatedAnnualYieldKwh(project: Record<string, unknown>): number | null {
  const pvKwp = projectPvCapacityKwp(project)
  const specificYield = projectSpecificYieldKwhPerKwp(project)
  return pvKwp !== null && specificYield !== null ? pvKwp * specificYield : null
}

/**
 * Some historical imports stored German decimal values without the decimal
 * separator (for example 109266 instead of 1,092.66 €/kWp). Reduce only clearly
 * impossible values until they reach the accepted PV-project range.
 */
export function normalizedPricePerKwp(value: unknown): number | null {
  let parsed = positiveNumber(value)
  if (parsed === null) return null
  while (parsed > 5_000) parsed /= 100
  return parsed >= 20 && parsed <= 5_000 ? parsed : null
}

export function resolvedPurchasePrice(project: Record<string, unknown>): number | null {
  const pvKwp = projectPvCapacityKwp(project)
  const rawPurchasePrice = positiveNumber(firstProjectValue(project, ['purchase_price', 'deal_purchase_price', 'total_purchase_price']))
  const purchasePriceType = String(firstProjectValue(project, ['purchase_price_type', 'deal_purchase_price_type']) ?? '')
  const perKwp = normalizedPricePerKwp(firstProjectValue(project, ['purchase_per_kwp', 'price_per_kwp', 'purchase_price_per_kwp', 'ek_price_per_kwp']))
  const derivedTotal = pvKwp !== null && perKwp !== null ? pvKwp * perKwp : null

  let storedTotal = rawPurchasePrice
  if (storedTotal !== null && pvKwp !== null) {
    if (purchasePriceType === 'per_kwp' && storedTotal <= 5_000) {
      storedTotal *= pvKwp
    } else {
      // Some historical German decimal imports inflated the total price by
      // factors of 100. Reduce only while the implied €/kWp is impossible.
      while (storedTotal / pvKwp > 5_000) storedTotal /= 100
    }
  }

  if (derivedTotal === null) return storedTotal
  if (storedTotal === null) return derivedTotal

  const relativeDifference = Math.abs(storedTotal - derivedTotal) / Math.max(storedTotal, derivedTotal, 1)
  return relativeDifference > 0.1 ? derivedTotal : storedTotal
}

export function tariffEuroPerKwh(project: Record<string, unknown>): number | null {
  const raw = positiveNumber(firstProjectValue(project, [
    'feed_in_tariff_ct_kwh',
    'tariff_ct_kwh',
    'feed_in_tariff',
    'tariff_eur_kwh',
    'tariff',
  ]))
  if (raw === null) return null
  return raw <= 1 ? raw : raw / 100
}

export type PvEconomics = {
  pvKwp: number | null
  annualYieldKwh: number | null
  specificYieldKwhPerKwp: number | null
  tariffEurKwh: number | null
  purchasePrice: number | null
  annualRevenue: number | null
  amortisationYears: number | null
  roiPercent: number | null
}

/** Canonical gross PV economics used by every Investment Memorandum path. */
export function resolvePvEconomics(project: Record<string, unknown>): PvEconomics {
  const pvKwp = projectPvCapacityKwp(project)
  const storedAnnualYield = positiveNumber(firstProjectValue(project, [
    'annual_yield_kwh',
    'annual_energy_kwh',
    'annual_production_kwh',
  ]))
  const annualYieldKwh = storedAnnualYield ?? calculatedAnnualYieldKwh(project)
  const storedSpecificYield = projectSpecificYieldKwhPerKwp(project)
  const specificYieldKwhPerKwp = annualYieldKwh !== null && pvKwp !== null
    ? annualYieldKwh / pvKwp
    : storedSpecificYield
  const tariffEurKwh = tariffEuroPerKwh(project)
  const purchasePrice = resolvedPurchasePrice(project)
  const annualRevenue = annualYieldKwh !== null && tariffEurKwh !== null
    ? annualYieldKwh * tariffEurKwh
    : null
  const amortisationYears = purchasePrice !== null && annualRevenue !== null && annualRevenue > 0
    ? purchasePrice / annualRevenue
    : null
  const roiPercent = purchasePrice !== null && purchasePrice > 0 && annualRevenue !== null
    ? annualRevenue / purchasePrice * 100
    : null

  return {
    pvKwp,
    annualYieldKwh,
    specificYieldKwhPerKwp,
    tariffEurKwh,
    purchasePrice,
    annualRevenue,
    amortisationYears,
    roiPercent,
  }
}
