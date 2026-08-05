const deNumber = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

function clean(value: number | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Formats PV/grid power stored in kWp. */
export function formatPowerFromKwp(value: number | null | undefined) {
  const kwp = clean(value)
  if (Math.abs(kwp) >= 1_000_000) return `${deNumber.format(kwp / 1_000_000)} GW`
  if (Math.abs(kwp) >= 1_000) return `${deNumber.format(kwp / 1_000)} MW`
  return `${deNumber.format(kwp)} kWp`
}

/** Formats power values that are already stored in MW. */
export function formatPowerFromMw(value: number | null | undefined) {
  const mw = clean(value)
  if (Math.abs(mw) >= 1_000) return `${deNumber.format(mw / 1_000)} GW`
  return `${deNumber.format(mw)} MW`
}

/** Formats BESS energy stored in MWh. */
export function formatEnergyFromMwh(value: number | null | undefined) {
  const mwh = clean(value)
  if (Math.abs(mwh) >= 1_000) return `${deNumber.format(mwh / 1_000)} GWh`
  return `${deNumber.format(mwh)} MWh`
}
