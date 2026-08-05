'use server'

type VisualProject = {
  externalNumber: string
  region: string
  permissionDate: string
  mwp: number | null
  gridDistanceKm: number | null
  structure: string
  studiesStart: string
  commissioning: string
  securedLandHa: number | null
  specificYield: number | null
}

type VisualExtractionResult = {
  projects: VisualProject[]
  error?: string
}

type PdfTextItem = {
  str?: string
  transform?: number[]
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

function cleanLine(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim()
}

function buildProject(match: RegExpMatchArray): VisualProject {
  const structure = cleanLine(match[5] ?? '')
  const gridMatches = [...structure.matchAll(/(?:PS\s*:\s*|HTA\/BT\s*:\s*|grid\s*:?\s*)(\d+(?:[.,]\d+)?)/gi)]
  const gridDistanceKm = gridMatches.length ? parseNumber(gridMatches.at(-1)?.[1]) : null

  return {
    externalNumber: match[1] ?? '',
    region: match[2] ?? '',
    permissionDate: match[3] ?? '',
    mwp: parseNumber(match[4]),
    gridDistanceKm,
    structure,
    studiesStart: match[6] ?? '',
    commissioning: match[7] ?? '',
    securedLandHa: parseNumber(match[8]),
    specificYield: parseNumber(match[9]),
  }
}

function parseRows(text: string): VisualProject[] {
  const candidates: VisualProject[] = []
  const rowPattern = /^(\d{1,5})\s+(\d{2,3})\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(.+?)\s+(?:(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(\d{3,4})$/

  for (const rawLine of text.replace(/\r/g, '\n').split('\n')) {
    const line = cleanLine(rawLine)
    if (!line) continue
    const match = line.match(rowPattern)
    if (match) candidates.push(buildProject(match))
  }

  if (candidates.length === 0) {
    const flattened = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
    const flattenedPattern = /(?:^|\s)(\d{1,5})\s+(\d{2,3})\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(.{2,180}?)\s+(?:(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(\d{3,4})(?=\s+(?:\d{1,5}\s+\d{2,3}\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|MWp\b|YEAR\b|Commissionning\b|$))/g
    for (const match of flattened.matchAll(flattenedPattern)) {
      candidates.push(buildProject(match))
    }
  }

  const unique: VisualProject[] = []
  const seen = new Set<string>()
  for (const project of candidates) {
    const key = `${project.externalNumber}-${project.region}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(project)
  }
  return unique.slice(0, 500)
}

async function renderPageWithLayout(pageData: any) {
  const textContent = await pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
  const items = (textContent.items ?? []) as PdfTextItem[]
  const rows = new Map<number, Array<{ x: number; text: string }>>()

  for (const item of items) {
    const text = cleanLine(item.str ?? '')
    const transform = item.transform ?? []
    if (!text || transform.length < 6) continue
    const x = Number(transform[4]) || 0
    const y = Math.round((Number(transform[5]) || 0) / 3) * 3
    const row = rows.get(y) ?? []
    row.push({ x, text })
    rows.set(y, row)
  }

  return [...rows.entries()]
    .sort(([yA], [yB]) => yB - yA)
    .map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '))
    .join('\n')
}

export async function extractProjectListFromPdf(buffer: Buffer, _filename: string): Promise<VisualExtractionResult> {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const parsed = await pdfParse(buffer, { pagerender: renderPageWithLayout })
    const projects = parseRows(parsed.text || '')

    if (projects.length > 0) return { projects }

    return {
      projects: [],
      error: 'Die PDF enthält keine zuverlässig auslesbare Textebene. Bitte lade die Projektliste als Excel oder CSV hoch.',
    }
  } catch (error) {
    console.error('Local project-list PDF extraction error', error)
    return {
      projects: [],
      error: 'Die lokale PDF-Tabellenanalyse konnte nicht abgeschlossen werden.',
    }
  }
}
