'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { extractProjectListFromPdf } from '@/lib/ai/project-list-vision'

type ProjectListRow = {
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
  selected: boolean
  warnings: string[]
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

function buildWarnings(row: Omit<ProjectListRow, 'warnings' | 'selected'>) {
  const warnings: string[] = []
  if (!row.externalNumber) warnings.push('Externe Projektnummer fehlt')
  if (!row.pvKwp || row.pvKwp <= 0) warnings.push('Leistung fehlt')
  if (row.pvKwp && row.pvKwp > 1_000_000) warnings.push('Leistung wirkt unplausibel')
  if (row.specificYield && (row.specificYield < 600 || row.specificYield > 2_500)) warnings.push('PVSYST-Ertrag prüfen')
  if (!row.region) warnings.push('Region fehlt')
  return warnings
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
}): ProjectListRow {
  const base = {
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
  return { ...base, selected: true, warnings: buildWarnings(base) }
}

function parseDelimitedLine(line: string): ProjectListRow | null {
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

function parseWhitespaceLine(line: string): ProjectListRow | null {
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

function parseFlattenedPdf(text: string): ProjectListRow[] {
  const flattened = text
    .replace(/\u00a0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const rows: ProjectListRow[] = []
  const record = /(?:^|\s)(\d{1,5})\s+(\d{2,3})\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(.{2,180}?)\s+(?:(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(\d{3,4})(?=\s+(?:\d{1,5}\s+\d{2,3}\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|MWp\b|YEAR\b|Commissionning\b|$))/g

  for (const match of flattened.matchAll(record)) {
    const structure = cleanLine(match[5])
    const gridMatches = [...structure.matchAll(/(?:PS\s*:\s*|HTA\/BT\s*:\s*)(\d+(?:[.,]\d+)?)/gi)]
    const gridDistanceKm = gridMatches.length ? parseNumber(gridMatches.at(-1)?.[1]) : null
    rows.push(makeRow({
      externalNumber: match[1],
      region: match[2],
      permissionDate: match[3],
      mwp: parseNumber(match[4]),
      gridDistanceKm,
      structure,
      studiesStart: match[6] ?? '',
      commissioning: match[7],
      securedLandHa: parseNumber(match[8]),
      specificYield: parseNumber(match[9]),
    }))
  }
  return rows
}

function uniqueRows(candidates: ProjectListRow[]) {
  const rows: ProjectListRow[] = []
  const seen = new Set<string>()
  for (const row of candidates) {
    const key = `${row.externalNumber}-${row.region}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(row)
  }
  return rows.slice(0, 500)
}

function parseProjectList(text: string) {
  const candidates: ProjectListRow[] = []
  for (const rawLine of text.replace(/\r/g, '\n').split('\n')) {
    const line = cleanLine(rawLine)
    if (!line) continue
    const row = parseDelimitedLine(line) ?? parseWhitespaceLine(line)
    if (row) candidates.push(row)
  }
  if (candidates.length < 2) candidates.push(...parseFlattenedPdf(text))
  return uniqueRows(candidates)
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, userId: user.id }
}

export async function prepareProjectListImport(importId: string) {
  const { supabase, userId } = await requireUser()
  const { data: projectImport, error } = await supabase
    .from('project_imports')
    .select('storage_paths, original_file_names')
    .eq('id', importId)
    .eq('user_id', userId)
    .single()
  if (error || !projectImport) return { error: 'Import wurde nicht gefunden.' }

  const paths = ((projectImport as any).storage_paths as string[]) ?? []
  const names = ((projectImport as any).original_file_names as string[]) ?? []
  const pdfFiles: Array<{ name: string; buffer: Buffer }> = []
  let combinedText = ''

  for (const [index, path] of paths.entries()) {
    const name = names[index] ?? ''
    const lowerName = name.toLowerCase()
    if (!lowerName.endsWith('.pdf') && !lowerName.endsWith('.txt') && !lowerName.endsWith('.csv')) continue
    const { data: blob } = await supabase.storage.from('project-imports').download(path)
    if (!blob) continue
    const buffer = Buffer.from(await blob.arrayBuffer())
    if (lowerName.endsWith('.pdf')) {
      pdfFiles.push({ name, buffer })
      const pdfParse = (await import('pdf-parse')).default
      const parsed = await pdfParse(buffer)
      combinedText += `\n${parsed.text || ''}`
    } else {
      combinedText += `\n${buffer.toString('utf-8')}`
    }
  }

  let projects = parseProjectList(combinedText)
  const looksLikeProjectList = /Power\s+asked|Planning\s+Permission|Commissionning|PVSYST|Secured\s+land/i.test(combinedText) || pdfFiles.length > 0
  let analysisMode: 'text' | 'visual' = 'text'
  let visualError = ''

  if (projects.length === 0 && pdfFiles.length > 0) {
    const visualRows: ProjectListRow[] = []
    for (const file of pdfFiles) {
      const visual = await extractProjectListFromPdf(file.buffer, file.name)
      if (visual.error) visualError = visual.error
      for (const row of visual.projects) {
        visualRows.push(makeRow({
          externalNumber: String(row.externalNumber ?? ''),
          region: String(row.region ?? ''),
          permissionDate: String(row.permissionDate ?? ''),
          mwp: parseNumber(row.mwp),
          gridDistanceKm: parseNumber(row.gridDistanceKm),
          structure: String(row.structure ?? ''),
          studiesStart: String(row.studiesStart ?? ''),
          commissioning: String(row.commissioning ?? ''),
          securedLandHa: parseNumber(row.securedLandHa),
          specificYield: parseNumber(row.specificYield),
        }))
      }
    }
    projects = uniqueRows(visualRows)
    if (projects.length > 0) analysisMode = 'visual'
  }

  if (looksLikeProjectList && projects.length === 0) {
    return { error: visualError || 'Die Projektliste konnte auch mit der visuellen Tabellenanalyse nicht sicher gelesen werden.' }
  }

  return {
    success: true,
    projects,
    isProjectList: projects.length > 0,
    looksLikeProjectList,
    analysisMode,
  }
}

function getField(formData: FormData, index: number, name: string) {
  const value = formData.get(`rows.${index}.${name}`)
  return typeof value === 'string' ? value.trim() : ''
}

export async function createVerifiedProjectsFromList(formData: FormData) {
  const { supabase, userId } = await requireUser()
  if (formData.get('confirmed') !== 'yes') return { error: 'Bitte bestätige den geprüften Sammelimport.' }
  const importId = String(formData.get('import_id') ?? '')
  const rowCount = Math.min(Number(formData.get('row_count') ?? 0), 500)
  if (!rowCount) return { error: 'Keine Projektzeilen vorhanden.' }

  const existingResult = await supabase.from('projects').select('project_name, notes').eq('user_id', userId).eq('is_archived', false)
  const existingKeys = new Set((existingResult.data ?? []).flatMap((project: any) => [String(project.project_name ?? '').toLowerCase(), String(project.notes ?? '')]))
  const rows: Record<string, unknown>[] = []
  const skipped: string[] = []

  for (let index = 0; index < rowCount; index += 1) {
    if (getField(formData, index, 'selected') !== 'yes') continue
    const externalNumber = getField(formData, index, 'externalNumber')
    const region = getField(formData, index, 'region')
    const projectName = getField(formData, index, 'projectName') || `FR-${region || 'XX'}-${externalNumber || index + 1}`
    const duplicateKey = projectName.toLowerCase()
    const sourceMarker = `Externe Projektnummer: ${externalNumber}`
    if (existingKeys.has(duplicateKey) || existingKeys.has(sourceMarker)) {
      skipped.push(projectName)
      continue
    }
    const pvKwp = parseNumber(getField(formData, index, 'pvKwp'))
    const specificYield = parseNumber(getField(formData, index, 'specificYield'))
    if (!pvKwp || pvKwp <= 0) {
      skipped.push(projectName)
      continue
    }
    rows.push({
      user_id: userId,
      project_name: projectName,
      project_type: 'pv_freiflaeche',
      status: 'lead',
      priority: 'mittel',
      marketing_status: 'nicht_gestartet',
      location_city: region ? `Département ${region}` : null,
      location_state: region || null,
      location_country: 'Frankreich',
      pv_mwp: pvKwp,
      specific_yield_kwh_kwp: specificYield,
      annual_yield_kwh: specificYield ? pvKwp * specificYield : null,
      values_verified_at: new Date().toISOString(),
      values_verified_by: userId,
      notes: [
        'Quelle: Projektlisten-Import',
        importId ? `Import-ID: ${importId}` : null,
        sourceMarker,
        getField(formData, index, 'gridDistanceKm') ? `Netzanschluss-Entfernung: ${getField(formData, index, 'gridDistanceKm')} km` : null,
        getField(formData, index, 'structure') ? `Struktur: ${getField(formData, index, 'structure')}` : null,
        getField(formData, index, 'permissionDate') ? `Genehmigung: ${getField(formData, index, 'permissionDate')}` : null,
        getField(formData, index, 'commissioning') ? `Geplante Inbetriebnahme: ${getField(formData, index, 'commissioning')}` : null,
        getField(formData, index, 'securedLandHa') ? `Gesicherte Fläche: ${getField(formData, index, 'securedLandHa')} ha` : null,
      ].filter(Boolean).join('\n'),
      tags: ['import', 'projektliste', 'geprueft', 'frankreich'],
      is_archived: false,
    })
  }

  if (!rows.length) return { error: 'Keine gültigen, neuen Projekte zum Importieren gefunden.', skipped }
  const { data, error } = await supabase.from('projects').insert(rows as never).select('id, project_name')
  if (error) return { error: `Sammelimport fehlgeschlagen: ${error.message}` }

  if (importId) {
    await supabase.from('project_imports').update({ import_status: 'created' } as never).eq('id', importId).eq('user_id', userId)
  }

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return { success: true, created: data?.length ?? rows.length, skipped }
}
