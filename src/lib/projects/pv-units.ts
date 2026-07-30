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
