'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { defaultDocumentFolderName } from '@/lib/templates/documentTypes'

export type DocumentEntityType = 'partner' | 'investor' | 'project'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

function revalidateDocuments() {
  revalidatePath('/dms')
  revalidatePath('/dokumente')
  revalidatePath('/musterformulare')
}

export async function getTemplateDocuments() {
  const { supabase, userId } = await requireUser()
  const { data, error } = await (supabase as any).from('documents').select('*').eq('user_id', userId).eq('source_kind', 'template').eq('is_archived', false).order('created_at', { ascending: false })
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
  const { error } = await (supabase as any).from('documents').update({ folder_id: folderId }).eq('id', documentId).eq('user_id', userId)
  if (error) return { error: error.message }
  revalidateDocuments()
  return { success: true }
}

export async function renameTemplateDocument(documentId: string, displayName: string) {
  const cleanName = displayName.trim()
  if (!cleanName) return { error: 'Bitte einen Dokumentnamen eingeben.' }
  if (cleanName.length > 160) return { error: 'Der Dokumentname darf maximal 160 Zeichen lang sein.' }
  const { supabase, userId } = await requireUser()
  const { error } = await (supabase as any).from('documents').update({ display_name: cleanName }).eq('id', documentId).eq('user_id', userId)
  if (error) return { error: error.message }
  revalidateDocuments()
  return { success: true }
}

export async function deleteDocumentFolder(folderId: string) {
  const { supabase, userId } = await requireUser()
  await (supabase as any).from('documents').update({ folder_id: null }).eq('folder_id', folderId).eq('user_id', userId)
  const { error } = await (supabase as any).from('document_folders').delete().eq('id', folderId).eq('user_id', userId)
  if (error) return { error: error.message }
  revalidateDocuments()
  return { success: true }
}

async function resolveTemplateDocumentFolderId(
  supabase: any,
  userId: string,
  category: string,
  requestedFolderId?: string | null,
) {
  if (requestedFolderId) {
    const { data, error } = await supabase
      .from('document_folders')
      .select('id')
      .eq('id', requestedFolderId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: 'Ordner nicht gefunden.' }
    return { folderId: data.id as string }
  }

  const defaultFolderName = defaultDocumentFolderName(category)
  if (!defaultFolderName) return { folderId: null }

  const { data: existing, error: selectError } = await supabase
    .from('document_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('name', defaultFolderName)
    .maybeSingle()
  if (selectError) return { error: selectError.message }
  if (existing) return { folderId: existing.id as string }

  const { data: created, error: insertError } = await supabase
    .from('document_folders')
    .insert({ user_id: userId, name: defaultFolderName })
    .select('id')
    .single()
  if (!insertError && created) return { folderId: created.id as string }

  if (insertError?.code === '23505') {
    const { data: concurrentFolder, error: retryError } = await supabase
      .from('document_folders')
      .select('id')
      .eq('user_id', userId)
      .eq('name', defaultFolderName)
      .single()
    if (!retryError && concurrentFolder) return { folderId: concurrentFolder.id as string }
    return { error: retryError?.message ?? insertError.message }
  }

  return { error: insertError?.message ?? 'NDA-Ordner konnte nicht erstellt werden.' }
}

export async function createTemplateDocumentRecord(params: { displayName: string; category: string; fileName: string; filePath: string; fileSizeBytes: number; mimeType: string; folderId?: string | null; investorId?: string | null }) {
  const { supabase, userId } = await requireUser()
  if (params.investorId) {
    const { data: investor } = await (supabase as any).from('investors').select('id').eq('id', params.investorId).eq('user_id', userId).eq('is_active', true).maybeSingle()
    if (!investor) return { error: 'Der ausgewählte Investor wurde nicht gefunden.' }
  }
  const resolvedFolder = await resolveTemplateDocumentFolderId(supabase, userId, params.category, params.folderId)
  if (resolvedFolder.error) return { error: resolvedFolder.error }
  const { data, error } = await (supabase as any).from('documents').insert({
    user_id: userId,
    project_id: null,
    document_type: params.category === 'nda' ? 'nda' : 'sonstiges',
    display_name: params.displayName,
    file_name: params.fileName,
    file_path: params.filePath,
    file_size_bytes: params.fileSizeBytes,
    mime_type: params.mimeType,
    folder_id: resolvedFolder.folderId,
    storage_bucket: 'template-documents',
    source_app: 'ema_intelligence',
    source_kind: 'template',
    analysis_status: 'not_started',
  }).select('id').single()
  if (error) return { error: error.message }
  if (params.investorId) {
    const { error: assignmentError } = await (supabase as any).from('dms_document_links').insert({ document_id: data.id, user_id: userId, entity_type: 'investor', entity_id: params.investorId })
    if (assignmentError) {
      await (supabase as any).from('documents').delete().eq('id', data.id).eq('user_id', userId)
      return { error: assignmentError.message }
    }
  }
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
  const { data: document } = await (supabase as any).from('documents').select('id').eq('id', params.documentId).eq('user_id', userId).single()
  if (!document) return { error: 'Dokument nicht gefunden.' }
  const uniqueAssignments = Array.from(new Map(params.assignments.map((item) => [`${item.entityType}:${item.entityId}`, item])).values())
  const { error: deleteError } = await (supabase as any).from('dms_document_links').delete().eq('document_id', params.documentId).eq('user_id', userId)
  if (deleteError) return { error: deleteError.message }
  if (uniqueAssignments.length > 0) {
    const { error: insertError } = await (supabase as any).from('dms_document_links').insert(uniqueAssignments.map((item) => ({ document_id: params.documentId, user_id: userId, entity_type: item.entityType, entity_id: item.entityId })))
    if (insertError) return { error: insertError.message }
  }
  revalidateDocuments()
  return { success: true }
}

export async function archiveTemplateDocument(id: string) {
  const { supabase, userId } = await requireUser()
  const { error } = await (supabase as any).from('documents').update({ is_archived: true }).eq('id', id).eq('user_id', userId)
  if (error) return { error: error.message }
  revalidateDocuments()
  return { success: true }
}
