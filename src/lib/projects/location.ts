export const PROJECT_COUNTRIES = [
  'Deutschland',
  'Italien',
  'Türkei',
  'Österreich',
  'Schweiz',
  'Frankreich',
  'Spanien',
  'Portugal',
  'Niederlande',
  'Belgien',
  'Luxemburg',
  'Polen',
  'Tschechien',
  'Slowakei',
  'Ungarn',
  'Rumänien',
  'Bulgarien',
  'Griechenland',
  'Kroatien',
  'Slowenien',
  'Dänemark',
  'Schweden',
  'Finnland',
  'Norwegen',
  'Irland',
  'Vereinigtes Königreich',
] as const

const PROJECT_COUNTRY_FLAGS: Record<string, string> = {
  Deutschland: '🇩🇪',
  Italien: '🇮🇹',
  Türkei: '🇹🇷',
  Österreich: '🇦🇹',
  Schweiz: '🇨🇭',
  Frankreich: '🇫🇷',
  Spanien: '🇪🇸',
  Portugal: '🇵🇹',
  Niederlande: '🇳🇱',
  Belgien: '🇧🇪',
  Luxemburg: '🇱🇺',
  Polen: '🇵🇱',
  Tschechien: '🇨🇿',
  Slowakei: '🇸🇰',
  Ungarn: '🇭🇺',
  Rumänien: '🇷🇴',
  Bulgarien: '🇧🇬',
  Griechenland: '🇬🇷',
  Kroatien: '🇭🇷',
  Slowenien: '🇸🇮',
  Dänemark: '🇩🇰',
  Schweden: '🇸🇪',
  Finnland: '🇫🇮',
  Norwegen: '🇳🇴',
  Irland: '🇮🇪',
  'Vereinigtes Königreich': '🇬🇧',
}

export function getProjectCountryFlag(value: unknown): string {
  const country = normalizeProjectCountry(value)
  return PROJECT_COUNTRY_FLAGS[country] ?? '🌍'
}

export function formatProjectCountryLabel(value: unknown): string {
  const country = normalizeProjectCountry(value)
  return `${getProjectCountryFlag(country)} ${country}`
}

const COUNTRY_ALIASES: Record<string, string> = {
  de: 'Deutschland',
  deutschland: 'Deutschland',
  germany: 'Deutschland',
  it: 'Italien',
  italien: 'Italien',
  italy: 'Italien',
  italia: 'Italien',
  tr: 'Türkei',
  türkei: 'Türkei',
  turkei: 'Türkei',
  turkey: 'Türkei',
  türkiye: 'Türkei',
  turkiye: 'Türkei',
  at: 'Österreich',
  österreich: 'Österreich',
  osterreich: 'Österreich',
  austria: 'Österreich',
  ch: 'Schweiz',
  schweiz: 'Schweiz',
  switzerland: 'Schweiz',
}

const INVALID_LOCATION_HEADINGS = new Set([
  'zusammenfassung',
  'summary',
  'executive summary',
  'projektubersicht',
  'projekt ubersicht',
  'project overview',
  'ubersicht',
  'overview',
  'inhaltsverzeichnis',
  'contents',
  'allgemeine daten',
  'general information',
  'standort',
  'location',
  'ort',
  'city',
])

function normalizedText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function normalizeProjectCountry(value: unknown, fallback = 'Deutschland'): string {
  const raw = String(value ?? '').trim()
  if (!raw) return fallback
  return COUNTRY_ALIASES[normalizedText(raw)] ?? raw
}

export function isGermanProjectCountry(value: unknown): boolean {
  return normalizeProjectCountry(value) === 'Deutschland'
}

export function sanitizeImportedLocationCity(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const normalized = normalizedText(raw)
  if (INVALID_LOCATION_HEADINGS.has(normalized)) return ''
  if (/^(seite|page)\s+\d+$/.test(normalized)) return ''

  return raw
}
