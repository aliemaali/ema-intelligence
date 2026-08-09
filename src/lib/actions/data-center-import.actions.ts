'use server'

import { createClient } from '@/lib/supabase/server'
import { extractDataCenterFromPdf } from '@/lib/ai/data-center-import'

type ImportRow = { storage_paths: string[] | null; original_file_names: string[] | null }

export async function prepareDataCenterImport(importId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet.' }
  const { data, error } = await supabase.from('project_imports').select('storage_paths, original_file_names').eq('id', importId).eq('user_id', user.id).single()
  if (error || !data) return { error: 'Import wurde nicht gefunden.' }
  const projectImport = data as unknown as ImportRow
  const paths = projectImport.storage_paths ?? []
  const names = projectImport.original_file_names ?? []
  const index = names.findIndex((name) => name.toLowerCase().endsWith('.pdf'))
  if (index < 0 || !paths[index]) return { error: 'Für Rechenzentrum bitte mindestens eine PDF hochladen.' }
  const { data: blob, error: downloadError } = await supabase.storage.from('project-imports').download(paths[index])
  if (downloadError || !blob) return { error: 'Die PDF konnte nicht geladen werden.' }
  return extractDataCenterFromPdf(Buffer.from(await blob.arrayBuffer()), names[index])
}
