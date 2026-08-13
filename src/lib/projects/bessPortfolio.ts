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
    durationH: mw > 0 && mwh > 0 ? Math.round((mwh / mw) * 100) / 100 : null,
  }
}

function canonicalName(value: string) {
  return value.replace(/\s+/g, ' ').replace(/\s+(?:MW|MWh).*$/i, '').trim()
}

const GERMAN_STATES = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
] as const

function compactOcrText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLocaleLowerCase('de-DE')
    .replace(/[^a-z0-9]+/g, '')
}

function canonicalState(value: string) {
  const compact = compactOcrText(value)
  return [...GERMAN_STATES]
    .sort((a, b) => compactOcrText(b).length - compactOcrText(a).length)
    .find((state) => compact.includes(compactOcrText(state))) ?? ''
}

function siteState(source: string, siteName: string) {
  const escaped = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escaped}\\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:-[A-Za-zÄÖÜäöüß]+)?)\\s*[·|]\\s*[\\d.,]+\\s*MW`, 'i'))
  return canonicalState(match?.[1]?.trim() ?? '')
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
  if (!/BESS[-\s]?Portfolio/i.test(source) && !/BESS-?PORTFOLIO/i.test(source.replace(/\s+/g, ''))) return null

  const profileHeadings = [...source.matchAll(/Projektprofil:\s*([^\n]+)/gi)]
  const baseSites = profileHeadings.flatMap((heading, index) => {
    const name = canonicalName(heading[1])
    const start = (heading.index ?? 0) + heading[0].length
    const end = profileHeadings[index + 1]?.index ?? source.length
    const section = source.slice(start, Math.min(end, start + 2600))
    const metrics = section.match(/([\d.,]+)\s*MW\s*([\d.,]+)\s*MWh\s*([\d.,]+)\s*h\s*Speicherdauer/i)
    if (!name || !metrics) return []
    const profileState = section.match(/Standort\s+([\s\S]{1,100}?)\s+Netzstatus/i)?.[1] ?? ''
    return [{
      name,
      state: canonicalState(profileState) || siteState(source, name),
      mw: number(metrics[1]),
      mwh: number(metrics[2]),
      durationH: number(metrics[3]),
    }]
  })

  // Fallback für PDFs, deren Textschicht die drei Kennzahlen vor die Einheiten stellt.
  if (baseSites.length < 2) {
    const compactProfilePattern = /Projektprofil:\s*([^\n]+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*h\s+MW\s+MWh\s+Speicherdauer/gi
    for (const match of source.matchAll(compactProfilePattern)) {
      const name = canonicalName(match[1])
      baseSites.push({
        name,
        state: siteState(source, name),
        mw: number(match[2]),
        mwh: number(match[3]),
        durationH: number(match[4]),
      })
    }
  }

  const unique = new Map(baseSites.filter((site) => site.name).map((site) => [site.name.toLocaleLowerCase('de-DE'), site]))
  if (unique.size < 2) return null
  const siteNames = [...unique.values()].map((site) => site.name)

  const sites = [...unique.values()].map((site) => {
    const otherNames = siteNames.filter((name) => name !== site.name)
    const grid = siteWindow(source, 'Netzanschlussstatus', site.name.replace(' Nord', ''), otherNames)
    const land = siteWindow(source, 'Grundstück & Flächensicherung', site.name.replace(' Nord', ''), otherNames)
    const compactGrid = compactOcrText(grid)
    const compactLand = compactOcrText(land)
    const vog = grid.match(/VOG\s*((?:\d[\s]*){6})/i)?.[1]?.replace(/\s/g, '')
    const gridOperator = compactGrid.includes('netzeodr') ? 'Netze ODR' : compactGrid.includes('mitnetz') ? 'MITNETZ STROM' : ''
    const gridStatus = compactGrid.includes('netzanschlusszusagevertrag') || compactGrid.includes('netzanschlussvertrag')
      ? 'Netzanschlussvertrag vorhanden'
      : vog
        ? `VOG ${vog} · Reservierung/Vertrag offen`
        : grid.slice(0, 180)
    const landStatus = compactLand.includes('notariellergrundstuckskaufvertragsentwurf')
      ? 'Notarieller Grundstückskaufvertragsentwurf'
      : compactLand.includes('unterzeichneterflachenmietvertrag')
        ? 'Unterzeichneter Flächenmietvertrag'
        : compactLand.includes('flachenmietvertrag')
          ? 'Flächenmietvertrag'
          : land.slice(0, 180)
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
