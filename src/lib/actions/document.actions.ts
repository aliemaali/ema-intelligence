'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { DocumentType } from '@/lib/types/database.types'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH DOCUMENTS FOR PROJECT
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocuments(projectId: string) {
  const { supabase, userId } = await requireUser()

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD DOCUMENT
// Returns storage path for client-side upload + inserts DB record
// ─────────────────────────────────────────────────────────────────────────────

export async function createDocumentRecord(params: {
  projectId:    string
  displayName:  string
  fileName:     string
  filePath:     string
  fileSizeBytes: number
  mimeType:     string
  documentType: DocumentType
}) {
  const { supabase, userId } = await requireUser()

  // activity_log insert is handled by DB trigger on documents insert
  const { data, error } = await supabase
    .from('documents')
    .insert({
      project_id:     params.projectId,
      user_id:        userId,
      document_type:  params.documentType,
      display_name:   params.displayName,
      file_name:      params.fileName,
      file_path:      params.filePath,
      file_size_bytes: params.fileSizeBytes,
      mime_type:      params.mimeType,
      version:        1,
    } as never)
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/projects/${params.projectId}/documents`)
  return { success: true, documentId: data.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SIGNED URL for download
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocumentUrl(filePath: string) {
  const { supabase } = await requireUser()

  const { data, error } = await supabase
    .storage
    .from('project-documents')
    .createSignedUrl(filePath, 3600) // 1 hour

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE DOCUMENT (soft delete)
// ─────────────────────────────────────────────────────────────────────────────

export async function archiveDocument(documentId: string, projectId: string) {
  const { supabase, userId } = await requireUser()

  const { error } = await supabase
    .from('documents')
    .update({ is_archived: true } as never)
    .eq('id', documentId)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}/documents`)
  return { success: true }
}
