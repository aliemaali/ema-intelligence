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

/**
 * Legacy note: the database column is still named `pv_mwp`, but the current
 * project form and production data store this value in kWp.
 * Do not multiply it by 1,000.
 */
export function projectPvCapacityKwp(project: Record<string, unknown>): number | null {
  return positiveNumber(firstProjectValue(project, [
    'pv_kwp',
    'capacity_kwp',
    'plant_capacity_kwp',
    'anlagenleistung_kwp',
    'pv_mwp',
  ]))
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
  const storedTotal = positiveNumber(firstProjectValue(project, ['purchase_price', 'deal_purchase_price', 'total_purchase_price']))
  const perKwp = normalizedPricePerKwp(firstProjectValue(project, ['purchase_per_kwp', 'price_per_kwp', 'purchase_price_per_kwp', 'ek_price_per_kwp']))
  const derivedTotal = pvKwp !== null && perKwp !== null ? pvKwp * perKwp : null

  if (derivedTotal === null) return storedTotal
  if (storedTotal === null) return derivedTotal

  const relativeDifference = Math.abs(storedTotal - derivedTotal) / Math.max(storedTotal, derivedTotal, 1)
  return relativeDifference > 0.1 ? derivedTotal : storedTotal
}
