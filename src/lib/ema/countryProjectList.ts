export type CountryProjectListRow = {
  externalNumber: string
  region: string
  projectName: string
  pvKwp: number | null
  gridDistanceKm: number | null
  structure: string
  permissionDate: string
  studiesStart: string
  commissioning: string
  securedLandHa: number | null
  specificYield: number | null
}

function parseNumber(value: unknown): number | null {
  const raw = String(value ?? '').trim().replace(/\s/g, '').replace(/[^0-9,.-]/g, '')
  if (!raw) return null
  const comma = raw.lastIndexOf(',')
  const dot = raw.lastIndexOf('.')
  let normalized = raw
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.'
    normalized = raw.replace(decimal === ',' ? /\./g : /,/g, '').replace(decimal, '.')
  } else if (comma >= 0) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeDate(value: string) {
  const match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (!match) return ''
  const year = match[3].length === 2 ? `20${match[3]}` : match[3]
  return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

function cleanLine(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim()
}

function makeRow(values: {
  externalNumber: string
  region: string
  permissionDate?: string
  mwp: number | null
  gridDistanceKm: number | null
  structure: string
  studiesStart?: string
  commissioning?: string
  securedLandHa: number | null
  specificYield: number | null
}): CountryProjectListRow {
  return {
    externalNumber: values.externalNumber,
    region: values.region,
    projectName: `FR-${String(values.region || 'XX').padStart(2, '0')}-${String(values.externalNumber).padStart(3, '0')}`,
    permissionDate: normalizeDate(values.permissionDate ?? ''),
    pvKwp: values.mwp !== null ? values.mwp * 1000 : null,
    gridDistanceKm: values.gridDistanceKm,
    structure: values.structure || 'PV Freifläche',
    studiesStart: normalizeDate(values.studiesStart ?? ''),
    commissioning: normalizeDate(values.commissioning ?? ''),
    securedLandHa: values.securedLandHa,
    specificYield: values.specificYield,
  }
}

function parseDelimitedLine(line: string): CountryProjectListRow | null {
  const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : null
  if (!delimiter) return null
  const cells = line.split(delimiter).map((cell) => cleanLine(cell)).filter(Boolean)
  if (cells.length < 7 || !/^\d{1,5}$/.test(cells[0])) return null
  return makeRow({
    externalNumber: cells[0],
    region: cells[1] ?? '',
    permissionDate: cells[2] ?? '',
    mwp: parseNumber(cells[3]),
    gridDistanceKm: parseNumber(cells[4]),
    structure: cells[5] ?? 'PV Freifläche',
    studiesStart: cells[6] ?? '',
    commissioning: cells[7] ?? '',
    securedLandHa: parseNumber(cells[8]),
    specificYield: parseNumber(cells[9]),
  })
}

function parseWhitespaceLine(line: string): CountryProjectListRow | null {
  const normalized = cleanLine(line)
  const match = normalized.match(/^(\d{1,5})\s+(\d{2,3})\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(.+?)\s+(?:(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(\d{3,4})$/)
  if (!match) return null
  const structure = cleanLine(match[5])
  const grid = structure.match(/(?:PS\s*:\s*|grid\s*:?\s*)(\d+(?:[.,]\d+)?)/i)
  return makeRow({
    externalNumber: match[1],
    region: match[2],
    permissionDate: match[3],
    mwp: parseNumber(match[4]),
    gridDistanceKm: parseNumber(grid?.[1]),
    structure,
    studiesStart: match[6] ?? '',
    commissioning: match[7],
    securedLandHa: parseNumber(match[8]),
    specificYield: parseNumber(match[9]),
  })
}

function parseFlattenedPdf(text: string): CountryProjectListRow[] {
  const flattened = text
    .replace(/\u00a0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const rows: CountryProjectListRow[] = []
  const record = /(?:^|\s)(\d{1,5})\s+(\d{2,3})\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(.{2,180}?)\s+(?:(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(\d{3,4})(?=\s+(?:\d{1,5}\s+\d{2,3}\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|MWp\b|YEAR\b|Commissionning\b|$))/g

  for (const match of flattened.matchAll(record)) {
    const structure = cleanLine(match[5])
    const gridMatches = [...structure.matchAll(/(?:PS\s*:\s*|HTA\/BT\s*:\s*)(\d+(?:[.,]\d+)?)/gi)]
    rows.push(makeRow({
      externalNumber: match[1],
      region: match[2],
      permissionDate: match[3],
      mwp: parseNumber(match[4]),
      gridDistanceKm: gridMatches.length ? parseNumber(gridMatches.at(-1)?.[1]) : null,
      structure,
      studiesStart: match[6] ?? '',
      commissioning: match[7],
      securedLandHa: parseNumber(match[8]),
      specificYield: parseNumber(match[9]),
    }))
  }
  return rows
}

export function parseCountryProjectListText(text: string) {
  const candidates: CountryProjectListRow[] = []
  for (const rawLine of text.replace(/\r/g, '\n').split('\n')) {
    const line = cleanLine(rawLine)
    if (!line) continue
    const row = parseDelimitedLine(line) ?? parseWhitespaceLine(line)
    if (row) candidates.push(row)
  }
  if (candidates.length < 2) candidates.push(...parseFlattenedPdf(text))

  const rows: CountryProjectListRow[] = []
  const seen = new Set<string>()
  for (const row of candidates) {
    const key = `${row.externalNumber}-${row.region}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(row)
  }
  return rows.slice(0, 500)
}
