'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

export async function getTemplateDocuments() {
  const { supabase, userId } = await requireUser()
  const { data, error } = await supabase
    .from('template_documents')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createTemplateDocumentRecord(params: {
  displayName: string
  category: string
  fileName: string
  filePath: string
  fileSizeBytes: number
  mimeType: string
}) {
  const { supabase, userId } = await requireUser()
  const { data, error } = await supabase
    .from('template_documents')
    .insert({
      user_id: userId,
      display_name: params.displayName,
      category: params.category,
      file_name: params.fileName,
      file_path: params.filePath,
      file_size_bytes: params.fileSizeBytes,
      mime_type: params.mimeType,
    } as never)
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/musterformulare')
  return { success: true, id: data.id }
}

export async function getTemplateDocumentUrl(filePath: string) {
  const { supabase, userId } = await requireUser()
  if (!filePath.startsWith(`${userId}/`)) return { error: 'Kein Zugriff auf diese Datei.' }

  const { data, error } = await supabase.storage
    .from('template-documents')
    .createSignedUrl(filePath, 3600)

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

export async function archiveTemplateDocument(id: string) {
  const { supabase, userId } = await requireUser()
  const { error } = await supabase
    .from('template_documents')
    .update({ is_archived: true } as never)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  revalidatePath('/musterformulare')
  return { success: true }
}
