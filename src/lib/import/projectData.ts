import { calculateBessPortfolioTotals, extractBessPortfolioFromText, type BessPortfolio } from '@/lib/projects/bessPortfolio'

export type ExtractedProjectImport = {
  partner_project_number?: string | null
  project_name?: string | null
  plant_type?: string | null
  location_address?: string | null
  location_city?: string | null
  location_state?: string | null
  pv_kwp?: number | null
  bess_mw?: number | null
  bess_mwh?: number | null
  bess_duration_h?: number | null
  bess_portfolio?: BessPortfolio | null
  feed_in_type?: string | null
  purchase_price?: number | null
  tariff?: string | null
  specific_yield?: string | null
  confidence_score?: number | null
  raw_extracted_text?: string | null
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const cleaned = String(value)
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

function cleanText(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return null
}

export function extractUploadedProjectData(text: string): ExtractedProjectImport {
  const normalized = cleanText(text)
  const bessPortfolio = extractBessPortfolioFromText(normalized)
  const portfolioTotals = calculateBessPortfolioTotals(bessPortfolio)

  const describedProject = normalized.match(/\b(BESS|PV|Data Center|Rechenzentrum)\s+([^\n:]+?)(?=\s+in\s|\s+aufmerksam|\n|$)/i)
  const projectName = firstMatch(normalized, [
    /(?:Projektname|Projekttitel)\s*:?\s*([^\n]+)/i,
    /Projekt\s*:\s*([^\n]+)/i,
  ]) ?? (describedProject ? `${describedProject[1]} ${describedProject[2]}`.trim() : null)

  const plantType = firstMatch(normalized, [
    /Anlagenart\s*:?\s*([^\n]+)/i,
    /(Aufdachanlage|Freifl[aä]chenanlage|Dachanlage|PV[-\s]?Anlage)/i,
  ])

  const pvText = firstMatch(normalized, [
    /Anlagengr[oö][ßs]e\s*:?\s*([\d.,]+)\s*kWp/i,
    /PV[-\s]?Leistung\s*:?\s*([\d.,]+)\s*kWp/i,
    /Leistung\s*:?\s*([\d.,]+)\s*kWp/i,
    /([\d.,]+)\s*kWp/i,
  ])

  const bessText = firstMatch(normalized, [
    /BESS[-\s]?(?:Leistung|Kapazit[aä]t)\s*:?\s*([\d.,]+)\s*MWh/i,
    /Speicher(?:kapazit[aä]t)?\s*:?\s*([\d.,]+)\s*MWh/i,
    /([\d.,]+)\s*MWh/i,
  ])

  const priceLine = normalized.match(/(?:EK[-\s]*(?:Kaufpreis|Preis)|Einkaufspreis|Kaufpreis|Preis)\s*:\s*([^\n]+)/i)?.[1] ?? ''
  const explicitTotal = priceLine.match(/([\d.,]+)\s*(?:€|EUR)\s*(?:gesamt|total)/i)?.[1]
  const purchaseText = explicitTotal ?? (/\/\s*(?:kW|MW|m²|m2|ha)\b/i.test(priceLine) ? null : priceLine.match(/^([\d.,]+)\s*(?:€|EUR)(?:\s|$)/i)?.[1] ?? null)
  const powerText = firstMatch(normalized, [/\b([\d.,]+)\s*MW\b/i])

  const tariff = firstMatch(normalized, [
    /Einspeiseverg[uü]tung\*?\s*:?\s*([\d.,]+\s*(?:EUR|€)\s*\/\s*kWh)/i,
    /Verg[uü]tung\*?\s*:?\s*([\d.,]+\s*(?:EUR|€)\s*\/\s*kWh)/i,
    /([\d.,]+\s*(?:EUR|€)\s*\/\s*kWh)/i,
  ])

  const specificYield = firstMatch(normalized, [
    /spezifischer\s+Ertrag\s*:?\s*([\d.,]+\s*kWh\s*\/\s*kWp)/i,
    /Ertrag\s*:?\s*([\d.,]+\s*kWh\s*\/\s*kWp)/i,
    /([\d.,]+\s*kWh\s*\/\s*kWp)/i,
  ])

  const feedInType = /PPA/i.test(normalized)
    ? 'PPA'
    : /Volleinspeisung|Voll/i.test(normalized)
      ? 'Voll'
      : /EEG/i.test(normalized)
        ? 'EEG'
        : null

  const city = firstMatch(normalized, [
    /(?:Ort|Standort)\s*:?\s*([^\n,]+)/i,
    /Projekt\s+(?:PVA\s+|PV\s+)?([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+)/,
  ]) ?? describedProject?.[2]?.trim() ?? null
  const state = firstMatch(normalized, [/\bin\s+(Brandenburg|Bayern|Hessen|Sachsen(?:-Anhalt)?|Thüringen|Niedersachsen|Nordrhein-Westfalen|Schleswig-Holstein|Mecklenburg-Vorpommern|Baden-Württemberg|Rheinland-Pfalz|Saarland|Berlin|Hamburg|Bremen)\b/i])

  const found = [projectName, plantType, pvText, purchaseText, tariff, specificYield].filter(Boolean).length

  return {
    project_name: bessPortfolio ? 'BESS-Portfolio Deutschland' : projectName,
    plant_type: bessPortfolio ? 'BESS-Portfolio · Paketverkauf' : plantType,
    location_city: bessPortfolio ? null : city,
    location_state: bessPortfolio ? null : state,
    pv_kwp: normalizeNumber(pvText),
    bess_mw: bessPortfolio ? portfolioTotals.mw : normalizeNumber(powerText),
    bess_mwh: bessPortfolio ? portfolioTotals.mwh : normalizeNumber(bessText),
    bess_duration_h: bessPortfolio ? portfolioTotals.durationH : null,
    bess_portfolio: bessPortfolio,
    purchase_price: normalizeNumber(purchaseText),
    feed_in_type: feedInType,
    tariff,
    specific_yield: specificYield,
    confidence_score: bessPortfolio ? 0.95 : Math.min(1, found / 6),
    raw_extracted_text: normalized.slice(0, 12000),
  }
}

