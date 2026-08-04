'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

function parseDelimitedLine(line: string): ProjectListRow | null {
  const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : null
  if (!delimiter) return null
  const cells = line.split(delimiter).map((cell) => cleanLine(cell)).filter(Boolean)
  if (cells.length < 7 || !/^\d{1,5}$/.test(cells[0])) return null
  const mwp = parseNumber(cells[3])
  const base = {
    externalNumber: cells[0],
    region: cells[1] ?? '',
    projectName: `FR-${String(cells[1] ?? 'XX').padStart(2, '0')}-${String(cells[0]).padStart(3, '0')}`,
    permissionDate: normalizeDate(cells[2] ?? ''),
    pvKwp: mwp !== null ? mwp * 1000 : null,
    gridDistanceKm: parseNumber(cells[4]),
    structure: cells[5] ?? 'PV Freifläche',
    studiesStart: normalizeDate(cells[6] ?? ''),
    commissioning: normalizeDate(cells[7] ?? ''),
    securedLandHa: parseNumber(cells[8]),
    specificYield: parseNumber(cells[9]),
  }
  return { ...base, selected: true, warnings: buildWarnings(base) }
}

function parseWhitespaceLine(line: string): ProjectListRow | null {
  const normalized = cleanLine(line)
  if (!/^\d{1,5}\s+/.test(normalized)) return null
  const tokens = normalized.split(' ')
  const dates = [...normalized.matchAll(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g)].map((match) => ({ value: match[0], index: match.index ?? 0 }))
  if (dates.length < 2) return null

  const externalNumber = tokens[0]
  const region = tokens[1] ?? ''
  const firstDate = dates[0]
  const afterFirst = normalized.slice(firstDate.index + firstDate.value.length).trim()
  const numericAfterDate = [...afterFirst.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => ({ value: match[0], index: match.index ?? 0 }))
  if (numericAfterDate.length < 4) return null

  const mwp = parseNumber(numericAfterDate[0].value)
  const gridDistanceKm = parseNumber(numericAfterDate[1].value)
  const structureStart = numericAfterDate[1].index + numericAfterDate[1].value.length
  const secondDateInTail = afterFirst.match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/)
  const structureEnd = secondDateInTail?.index ?? structureStart
  const structure = cleanLine(afterFirst.slice(structureStart, structureEnd)) || 'PV Freifläche'
  const trailingNumbers = numericAfterDate.slice(-2)
  const base = {
    externalNumber,
    region,
    projectName: `FR-${String(region || 'XX').padStart(2, '0')}-${String(externalNumber).padStart(3, '0')}`,
    permissionDate: normalizeDate(firstDate.value),
    pvKwp: mwp !== null ? mwp * 1000 : null,
    gridDistanceKm,
    structure,
    studiesStart: normalizeDate(dates[1]?.value ?? ''),
    commissioning: normalizeDate(dates[2]?.value ?? dates[1]?.value ?? ''),
    securedLandHa: parseNumber(trailingNumbers[0]?.value),
    specificYield: parseNumber(trailingNumbers[1]?.value),
  }
  return { ...base, selected: true, warnings: buildWarnings(base) }
}

function parseProjectList(text: string) {
  const rows: ProjectListRow[] = []
  const seen = new Set<string>()
  for (const rawLine of text.replace(/\r/g, '\n').split('\n')) {
    const line = cleanLine(rawLine)
    if (!line) continue
    const row = parseDelimitedLine(line) ?? parseWhitespaceLine(line)
    if (!row) continue
    const key = `${row.externalNumber}-${row.region}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(row)
  }
  return rows.slice(0, 500)
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
  let combinedText = ''

  for (const [index, path] of paths.entries()) {
    const name = names[index] ?? ''
    if (!name.toLowerCase().endsWith('.pdf') && !name.toLowerCase().endsWith('.txt') && !name.toLowerCase().endsWith('.csv')) continue
    const { data: blob } = await supabase.storage.from('project-imports').download(path)
    if (!blob) continue
    const buffer = Buffer.from(await blob.arrayBuffer())
    if (name.toLowerCase().endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default
      const parsed = await pdfParse(buffer)
      combinedText += `\n${parsed.text || ''}`
    } else {
      combinedText += `\n${buffer.toString('utf-8')}`
    }
  }

  const projects = parseProjectList(combinedText)
  return { success: true, projects, isProjectList: projects.length > 1 }
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
