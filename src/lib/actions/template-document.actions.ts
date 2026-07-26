'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type DocumentEntityType = 'partner' | 'investor' | 'project'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

function revalidateDocuments() {
  revalidatePath('/dokumente')
  revalidatePath('/musterformulare')
}

export async function getTemplateDocuments() {
  const { supabase, userId } = await requireUser()
  const { data, error } = await (supabase as any).from('template_documents').select('*').eq('user_id', userId).eq('is_archived', false).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getDocumentFolders() {
  const { supabase, userId } = await requireUser()
  const { data, error } = await (supabase as any).from('document_folders').select('id, name, created_at').eq('user_id', userId).order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createDocumentFolder(name: string) {
  const cleanName = name.trim()
  if (!cleanName) return { error: 'Bitte einen Ordnernamen eingeben.' }
  const { supabase, userId } = await requireUser()
  const { error } = await (supabase as any).from('document_folders').insert({ user_id: userId, name: cleanName })
  if (error) return { error: error.code === '23505' ? 'Dieser Ordner existiert bereits.' : error.message }
  revalidateDocuments()
  return { success: true }
}

export async function moveDocumentToFolder(documentId: string, folderId: string | null) {
  const { supabase, userId } = await requireUser()
  if (folderId) {
    const { data: folder } = await (supabase as any).from('document_folders').select('id').eq('id', folderId).eq('user_id', userId).single()
    if (!folder) return { error: 'Ordner nicht gefunden.' }
  }
  const { error } = await (supabase as any).from('template_documents').update({ folder_id: folderId }).eq('id', documentId).eq('user_id', userId)
  if (error) return { error: error.message }
  revalidateDocuments()
  return { success: true }
}

export async function renameTemplateDocument(documentId: string, displayName: string) {
  const cleanName = displayName.trim()
  if (!cleanName) return { error: 'Bitte einen Dokumentnamen eingeben.' }
  if (cleanName.length > 160) return { error: 'Der Dokumentname darf maximal 160 Zeichen lang sein.' }
  const { supabase, userId } = await requireUser()
  const { error } = await (supabase as any).from('template_documents').update({ display_name: cleanName }).eq('id', documentId).eq('user_id', userId)
  if (error) return { error: error.message }
  revalidateDocuments()
  return { success: true }
}

export async function deleteDocumentFolder(folderId: string) {
  const { supabase, userId } = await requireUser()
  await (supabase as any).from('template_documents').update({ folder_id: null }).eq('folder_id', folderId).eq('user_id', userId)
  const { error } = await (supabase as any).from('document_folders').delete().eq('id', folderId).eq('user_id', userId)
  if (error) return { error: error.message }
  revalidateDocuments()
  return { success: true }
}

export async function createTemplateDocumentRecord(params: { displayName: string; category: string; fileName: string; filePath: string; fileSizeBytes: number; mimeType: string; folderId?: string | null }) {
  const { supabase, userId } = await requireUser()
  const { data, error } = await (supabase as any).from('template_documents').insert({ user_id: userId, display_name: params.displayName, category: params.category, file_name: params.fileName, file_path: params.filePath, file_size_bytes: params.fileSizeBytes, mime_type: params.mimeType, folder_id: params.folderId ?? null }).select('id').single()
  if (error) return { error: error.message }
  revalidateDocuments()
  return { success: true, id: data.id }
}

export async function getTemplateDocumentUrl(filePath: string) {
  const { supabase, userId } = await requireUser()
  if (!filePath.startsWith(`${userId}/`)) return { error: 'Kein Zugriff auf diese Datei.' }
  const { data, error } = await supabase.storage.from('template-documents').createSignedUrl(filePath, 3600)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

export async function saveDocumentAssignments(params: { documentId: string; assignments: Array<{ entityType: DocumentEntityType; entityId: string }> }) {
  const { supabase, userId } = await requireUser()
  const { data: document } = await supabase.from('template_documents').select('id').eq('id', params.documentId).eq('user_id', userId).single()
  if (!document) return { error: 'Dokument nicht gefunden.' }
  const uniqueAssignments = Array.from(new Map(params.assignments.map((item) => [`${item.entityType}:${item.entityId}`, item])).values())
  const { error: deleteError } = await (supabase as any).from('document_assignments').delete().eq('document_id', params.documentId).eq('user_id', userId)
  if (deleteError) return { error: deleteError.message }
  if (uniqueAssignments.length > 0) {
    const { error: insertError } = await (supabase as any).from('document_assignments').insert(uniqueAssignments.map((item) => ({ document_id: params.documentId, user_id: userId, entity_type: item.entityType, entity_id: item.entityId })))
    if (insertError) return { error: insertError.message }
  }
  revalidateDocuments()
  return { success: true }
}

export async function archiveTemplateDocument(id: string) {
  const { supabase, userId } = await requireUser()
  const { error } = await supabase.from('template_documents').update({ is_archived: true } as never).eq('id', id).eq('user_id', userId)
  if (error) return { error: error.message }
  revalidateDocuments()
  return { success: true }
}
