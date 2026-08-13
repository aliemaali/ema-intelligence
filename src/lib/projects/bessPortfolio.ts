export type BessPortfolioSite = {
  name: string
  state: string
  mw: number | null
  mwh: number | null
  durationH: number | null
  gridOperator: string
  gridStatus: string
  landStatus: string
  permitStatus: string
}

export type BessPortfolio = {
  isPackageSale: true
  sites: BessPortfolioSite[]
  sourceLabel?: string
}

export type BessPortfolioTotals = {
  siteCount: number
  mw: number
  mwh: number
  durationH: number | null
}

const MAX_SITES = 30

function text(value: unknown, max = 180) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function number(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function cleanSite(value: unknown): BessPortfolioSite | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const name = text(raw.name, 100)
  if (!name) return null
  return {
    name,
    state: text(raw.state, 100),
    mw: number(raw.mw),
    mwh: number(raw.mwh),
    durationH: number(raw.durationH),
    gridOperator: text(raw.gridOperator, 120),
    gridStatus: text(raw.gridStatus, 180),
    landStatus: text(raw.landStatus, 180),
    permitStatus: text(raw.permitStatus, 180),
  }
}

export function normalizeBessPortfolio(value: unknown): BessPortfolio | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const sites = Array.isArray(raw.sites)
    ? raw.sites.slice(0, MAX_SITES).map(cleanSite).filter((site): site is BessPortfolioSite => Boolean(site))
    : []
  if (sites.length < 2) return null
  return { isPackageSale: true, sites, sourceLabel: text(raw.sourceLabel, 160) || undefined }
}

export function portfolioFromSourceMetadata(value: unknown): BessPortfolio | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return normalizeBessPortfolio((value as Record<string, unknown>).bessPortfolio)
}

export function calculateBessPortfolioTotals(portfolio: BessPortfolio | null): BessPortfolioTotals {
  if (!portfolio) return { siteCount: 0, mw: 0, mwh: 0, durationH: null }
  const mw = portfolio.sites.reduce((sum, site) => sum + (site.mw ?? 0), 0)
  const mwh = portfolio.sites.reduce((sum, site) => sum + (site.mwh ?? 0), 0)
  return {
    siteCount: portfolio.sites.length,
    mw,
    mwh,
    durationH: mw > 0 && mwh > 0 ? mwh / mw : null,
  }
}

function canonicalName(value: string) {
  return value.replace(/\s+/g, ' ').replace(/\s+(?:MW|MWh).*$/i, '').trim()
}

function siteState(source: string, siteName: string) {
  const escaped = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escaped}\\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:-[A-Za-zÄÖÜäöüß]+)?)\\s*[·|]\\s*[\\d.,]+\\s*MW`, 'i'))
  return match?.[1]?.trim() ?? ''
}

function siteWindow(source: string, heading: string, siteName: string, nextNames: string[]) {
  const sectionStart = source.toLocaleLowerCase('de-DE').indexOf(heading.toLocaleLowerCase('de-DE'))
  if (sectionStart < 0) return ''
  const section = source.slice(sectionStart)
  const siteStart = section.toLocaleLowerCase('de-DE').indexOf(siteName.toLocaleLowerCase('de-DE'))
  if (siteStart < 0) return ''
  const tail = section.slice(siteStart + siteName.length)
  const next = nextNames
    .map((name) => tail.toLocaleLowerCase('de-DE').indexOf(name.toLocaleLowerCase('de-DE')))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0]
  return tail.slice(0, next ?? 420).replace(/\s+/g, ' ').trim()
}

export function extractBessPortfolioFromText(input: string): BessPortfolio | null {
  const source = input.replace(/\u00a0/g, ' ').replace(/\r/g, '\n')
  if (!/BESS[-\s]?Portfolio/i.test(source)) return null

  const profilePattern = /Projektprofil:\s*([^\n]+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*h\s+MW\s+MWh\s+Speicherdauer/gi
  const matches = [...source.matchAll(profilePattern)]
  const baseSites = matches.map((match) => ({
    name: canonicalName(match[1]),
    state: siteState(source, canonicalName(match[1])),
    mw: number(match[2]),
    mwh: number(match[3]),
    durationH: number(match[4]),
  }))

  const unique = new Map(baseSites.filter((site) => site.name).map((site) => [site.name.toLocaleLowerCase('de-DE'), site]))
  if (unique.size < 2) return null
  const siteNames = [...unique.values()].map((site) => site.name)

  const sites = [...unique.values()].map((site) => {
    const otherNames = siteNames.filter((name) => name !== site.name)
    const grid = siteWindow(source, 'Netzanschlussstatus', site.name.replace(' Nord', ''), otherNames)
    const land = siteWindow(source, 'Grundstück & Flächensicherung', site.name.replace(' Nord', ''), otherNames)
    const gridOperator = /Netze\s+ODR/i.test(grid) ? 'Netze ODR' : /MITNETZ/i.test(grid) ? 'MITNETZ STROM' : ''
    const gridStatus = /Netzanschlusszusage\s*\+\s*Vertrag|Netzanschlussvertrag/i.test(grid)
      ? 'Netzanschlussvertrag vorhanden'
      : /VOG\s*\d+/i.test(grid)
        ? `${grid.match(/VOG\s*\d+/i)?.[0] ?? 'Positive Stellungnahme'} · Reservierung/Vertrag offen`
        : grid.slice(0, 180)
    const landStatus = land.match(/(Unterzeichneter\s+Flächenmietvertrag[^.·]*|Flächenmietvertrag[^.·]*|Notarieller\s+Grundstückskaufvertragsentwurf[^.·]*)/i)?.[0]?.trim() ?? land.slice(0, 180)
    return {
      ...site,
      gridOperator,
      gridStatus,
      landStatus,
      permitStatus: 'Nicht dokumentiert',
    }
  })

  return { isPackageSale: true, sites, sourceLabel: 'Automatisch aus BESS-Portfolio-PDF erkannt' }
}

export function parseBessPortfolioJson(value: unknown): BessPortfolio | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try { return normalizeBessPortfolio(JSON.parse(value)) } catch { return null }
}
