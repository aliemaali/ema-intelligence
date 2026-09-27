'use server'

import { createClient } from '@/lib/supabase/server'
import { extractDataCenterFromPdf, type DataCenterImport } from '@/lib/ai/data-center-import'

type ImportRow = {
  storage_paths: string[] | null
  original_file_names: string[] | null
}

const GRID_RANK: Record<DataCenterImport['gridStatus'], number> = {
  unknown: 0, indicated: 1, requested: 2, grid_study_ongoing: 3,
  generally_feasible: 4, confirmed_in_writing: 5, contractually_secured: 6,
}

const OFFTAKER_RANK: Record<DataCenterImport['offtakerStatus'], number> = {
  unknown: 0, none: 1, searching: 2, initial_contact: 3, nda: 4,
  interest: 5, loi: 6, hot: 7, binding_contract: 8,
}

function mergeImports(current: DataCenterImport, next: DataCenterImport): DataCenterImport {
  const merged = { ...current } as Record<string, unknown>
  for (const [key, value] of Object.entries(next)) {
    const existing = merged[key]
    const missing = existing === '' || existing === null || existing === 'unknown'
    if (missing && value !== '' && value !== null && value !== 'unknown') merged[key] = value
  }
  if (GRID_RANK[next.gridStatus] > GRID_RANK[current.gridStatus]) merged.gridStatus = next.gridStatus
  if (OFFTAKER_RANK[next.offtakerStatus] > OFFTAKER_RANK[current.offtakerStatus]) merged.offtakerStatus = next.offtakerStatus
  if (next.routeDiversity === 'confirmed') merged.routeDiversity = 'confirmed'
  const notes = [current.additionalNotes, next.additionalNotes].filter(Boolean)
  merged.additionalNotes = [...new Set(notes)].join('\n\n')
  return merged as DataCenterImport
}

export async function prepareDataCenterImport(importId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet.' }

  const { data, error } = await supabase
    .from('project_imports')
    .select('storage_paths, original_file_names')
    .eq('id', importId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return { error: 'Import wurde nicht gefunden.' }

  const projectImport = data as unknown as ImportRow
  const paths = projectImport.storage_paths ?? []
  const names = projectImport.original_file_names ?? []
  const pdfIndexes = names
    .map((name, index) => name.toLowerCase().endsWith('.pdf') && paths[index] ? index : -1)
    .filter((index) => index >= 0)

  if (!pdfIndexes.length) {
    return { error: 'Für ein Rechenzentrum wird mindestens eine PDF benötigt.' }
  }

  let combined: DataCenterImport | null = null
  for (const pdfIndex of pdfIndexes.slice(0, 8)) {
    const { data: blob, error: downloadError } = await supabase
      .storage
      .from('project-imports')
      .download(paths[pdfIndex])
    if (downloadError || !blob) continue
    const result = await extractDataCenterFromPdf(Buffer.from(await blob.arrayBuffer()), names[pdfIndex])
    if ('data' in result && result.data) combined = combined ? mergeImports(combined, result.data) : result.data
  }

  return combined ? { data: combined } : { error: 'Die PDF-Unterlagen konnten nicht ausgewertet werden.' }
}
