'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const uploadSchema = z.object({
  displayName: z.string().trim().min(1).max(180),
  fileName: z.string().trim().min(1).max(255),
  filePath: z.string().trim().min(1).max(1000),
  fileSizeBytes: z.number().int().positive().max(52_428_800),
  mimeType: z.string().trim().min(1).max(160),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  folderId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  documentType: z.enum(['expose', 'lageplan', 'netzanschluss', 'pachtvertrag', 'genehmigung', 'gutachten', 'bild', 'nda', 'loi', 'spa', 'sonstiges']).default('sonstiges'),
  isDataRoom: z.boolean().default(false),
  dataRoomProfile: z.enum(['pv', 'bess', 'pv_bess', 'wind', 'datacenter', 'other']).optional(),
})

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?redirectTo=/dms')
  return { supabase, user }
}

function revalidateDms() {
  revalidatePath('/dms')
  revalidatePath('/dokumente')
}

export async function findDmsDuplicate(sha256: string) {
  if (!/^[a-f0-9]{64}$/.test(sha256)) return { error: 'Ungültiger Datei-Fingerabdruck.' }
  const { supabase, user } = await requireUser()
  const { data, error } = await (supabase as any)
    .from('documents')
    .select('id, display_name, created_at')
    .eq('user_id', user.id)
    .eq('sha256', sha256)
    .eq('is_archived', false)
    .limit(1)
    .maybeSingle()
  if (error) return { error: error.message }
  return { document: data ?? null }
}

export async function registerDmsUpload(input: z.input<typeof uploadSchema>) {
  const parsed = uploadSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Dokumentdaten.' }

  const { supabase, user } = await requireUser()
  const values = parsed.data
  if (!values.filePath.startsWith(`${user.id}/`)) return { error: 'Ungültiger Speicherpfad.' }

  if (values.folderId) {
    const { data: folder } = await (supabase as any)
      .from('document_folders')
      .select('id')
      .eq('id', values.folderId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!folder) return { error: 'Ordner nicht gefunden.' }
  }

  if (values.projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', values.projectId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!project) return { error: 'Projekt nicht gefunden.' }
  }

  const duplicate = await findDmsDuplicate(values.sha256)
  if (duplicate.error) return { error: duplicate.error }
  if (duplicate.document) return { duplicate: duplicate.document }

  const { data: document, error } = await (supabase as any)
    .from('documents')
    .insert({
      user_id: user.id,
      project_id: values.projectId ?? null,
      document_type: values.documentType,
      display_name: values.displayName,
      file_name: values.fileName,
      file_path: values.filePath,
      file_size_bytes: values.fileSizeBytes,
      mime_type: values.mimeType,
      storage_bucket: 'ema-dms',
      source_app: 'external',
      source_kind: values.isDataRoom ? 'data_room' : 'project',
      sha256: values.sha256,
      folder_id: values.folderId ?? null,
      is_data_room_archive: values.isDataRoom,
      analysis_status: values.isDataRoom ? 'queued' : 'not_started',
    })
    .select('id')
    .single()
  if (error?.code === '23505') {
    const duplicate = await findDmsDuplicate(values.sha256)
    if (duplicate.document) return { duplicate: duplicate.document }
  }
  if (error || !document) return { error: error?.message ?? 'Dokument konnte nicht registriert werden.' }

  if (values.projectId) {
    const { error: linkError } = await (supabase as any).from('dms_document_links').insert({
      document_id: document.id,
      user_id: user.id,
      entity_type: 'project',
      entity_id: values.projectId,
    })
    if (linkError) {
      await (supabase as any).from('documents').delete().eq('id', document.id).eq('user_id', user.id)
      return { error: linkError.message }
    }
  }

  let dataRoomId: string | null = null
  if (values.isDataRoom) {
    const { data: dataRoom, error: dataRoomError } = await (supabase as any)
      .from('dms_data_rooms')
      .insert({
        user_id: user.id,
        project_id: values.projectId ?? null,
        archive_document_id: document.id,
        name: values.displayName,
        project_profile: values.dataRoomProfile ?? 'pv',
        status: 'uploaded',
      })
      .select('id')
      .single()
    if (dataRoomError || !dataRoom) {
      await (supabase as any).from('documents').delete().eq('id', document.id).eq('user_id', user.id)
      return { error: dataRoomError?.message ?? 'Datenraum konnte nicht angelegt werden.' }
    }
    dataRoomId = dataRoom.id
  }

  revalidateDms()
  return { success: true, documentId: document.id as string, dataRoomId }
}

export async function createDmsFolder(name: string, parentId?: string | null) {
  const cleanName = name.trim()
  if (!cleanName || cleanName.length > 80) return { error: 'Bitte einen gültigen Ordnernamen eingeben.' }
  const { supabase, user } = await requireUser()
  if (parentId) {
    const { data: parent } = await (supabase as any).from('document_folders').select('id').eq('id', parentId).eq('user_id', user.id).maybeSingle()
    if (!parent) return { error: 'Übergeordneter Ordner nicht gefunden.' }
  }
  const { error } = await (supabase as any).from('document_folders').insert({ user_id: user.id, name: cleanName, parent_id: parentId ?? null })
  if (error) return { error: error.code === '23505' ? 'Dieser Ordner existiert bereits.' : error.message }
  revalidateDms()
  return { success: true }
}

export async function getDmsDocumentUrl(documentId: string) {
  const { supabase, user } = await requireUser()
  const { data: document, error } = await (supabase as any)
    .from('documents')
    .select('storage_bucket, file_path')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .maybeSingle()
  if (error || !document) return { error: 'Dokument nicht gefunden.' }
  const { data, error: signedError } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.file_path, 3600)
  if (signedError || !data?.signedUrl) return { error: signedError?.message ?? 'Dokument konnte nicht geöffnet werden.' }
  return { url: data.signedUrl }
}

export async function archiveDmsDocument(documentId: string) {
  const { supabase, user } = await requireUser()
  const { error } = await (supabase as any).from('documents').update({ is_archived: true }).eq('id', documentId).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidateDms()
  return { success: true }
}
