// src/lib/capex/format.ts
//
// 1:1 migrierte Formatierungs-Helper aus EMA_CAPEX_Rechner.html.

export const eur = (v: number | null | undefined): string =>
  (v ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'

export const eurKwp = (v: number | null | undefined): string =>
  (v ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €/kWp'

export const pct = (v: number | null | undefined): string =>
  ((v ?? 0) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' %'

export const pct1 = pct

export const num = (v: number | null | undefined, digits = 0): string =>
  (v ?? 0).toLocaleString('de-DE', { maximumFractionDigits: digits })
