export const INVESTOR_COUNTRIES = [
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
  'USA',
  'Kanada',
  'Vereinigte Arabische Emirate',
] as const

const COUNTRY_CODES: Record<string, string> = {
  Deutschland: 'de',
  Italien: 'it',
  Türkei: 'tr',
  Österreich: 'at',
  Schweiz: 'ch',
  Frankreich: 'fr',
  Spanien: 'es',
  Portugal: 'pt',
  Niederlande: 'nl',
  Belgien: 'be',
  Luxemburg: 'lu',
  Polen: 'pl',
  Tschechien: 'cz',
  Slowakei: 'sk',
  Ungarn: 'hu',
  Rumänien: 'ro',
  Bulgarien: 'bg',
  Griechenland: 'gr',
  Kroatien: 'hr',
  Slowenien: 'si',
  Dänemark: 'dk',
  Schweden: 'se',
  Finnland: 'fi',
  Norwegen: 'no',
  Irland: 'ie',
  'Vereinigtes Königreich': 'gb',
  USA: 'us',
  Kanada: 'ca',
  'Vereinigte Arabische Emirate': 'ae',
}

export function getInvestorFlagUrl(country?: string | null): string | null {
  const code = country ? COUNTRY_CODES[country] : null
  return code ? `https://flagcdn.com/w40/${code}.png` : null
}

export function normalizeInvestorWebsite(value?: string | null): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    return new URL(normalized).toString()
  } catch {
    return null
  }
}

export function getAutomaticInvestorLogoUrl(website?: string | null): string | null {
  const normalized = normalizeInvestorWebsite(website)
  if (!normalized) return null
  try {
    return `${new URL(normalized).origin}/favicon.ico`
  } catch {
    return null
  }
}

export function getInvestorInitials(companyName: string): string {
  const words = companyName.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'IN'
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('')
}
