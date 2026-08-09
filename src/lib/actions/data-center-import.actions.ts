'use server'

import { createClient } from '@/lib/supabase/server'
import { extractDataCenterFromPdf } from '@/lib/ai/data-center-import'

export async function prepareDataCenterImport(importId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet.' }
  const { data: projectImport, error } = await supabase.from('project_imports').select('storage_paths, original_file_names').eq('id', importId).eq('user_id', user.id).single()
  if (error || !projectImport) return { error: 'Import wurde nicht gefunden.' }
  const paths = ((projectImport as any).storage_paths as string[]) ?? []
  const names = ((projectImport as any).original_file_names as string[]) ?? []
  const index = names.findIndex((name) => name.toLowerCase().endsWith('.pdf'))
  if (index < 0 || !paths[index]) return { error: 'Für Rechenzentrum bitte mindestens eine PDF hochladen.' }
  const { data: blob, error: downloadError } = await supabase.storage.from('project-imports').download(paths[index])
  if (downloadError || !blob) return { error: 'Die PDF konnte nicht geladen werden.' }
  const buffer = Buffer.from(await blob.arrayBuffer())
  return extractDataCenterFromPdf(buffer, names[index])
}
