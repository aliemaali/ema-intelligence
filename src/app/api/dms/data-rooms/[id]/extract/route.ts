import { createHash, randomUUID } from 'crypto'
import { basename, extname } from 'path'
import { NextResponse } from 'next/server'
import { unzipSync } from 'fflate'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_FILES = 250
const MAX_ENTRY_BYTES = 50 * 1024 * 1024
const MAX_TOTAL_BYTES = 250 * 1024 * 1024

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function safeArchivePath(value: string) {
  const normalized = value.replace(/\\/g, '/')
  return normalized.length <= 800
    && !normalized.startsWith('/')
    && !normalized.includes('\0')
    && !normalized.split('/').includes('..')
}

function displayName(path: string) {
  return basename(path).replace(/\.[^.]+$/, '').slice(0, 180) || 'Datenraum-Dokument';
}

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const { data: room, error: roomError } = await (supabase as any)
    .from('dms_data_rooms')
    .select('id, project_id, archive_document_id, status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (roomError || !room) return NextResponse.json({ error: 'Datenraum nicht gefunden.' }, { status: 404 })
  if (room.status === 'ready' || room.status === 'completed') return NextResponse.json({ ready: true, cached: true })

  const { data: archive } = await (supabase as any)
    .from('documents')
    .select('id, storage_bucket, file_path, file_name')
    .eq('id', room.archive_document_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!archive) return NextResponse.json({ error: 'ZIP-Original nicht gefunden.' }, { status: 404 })

  await (supabase as any).from('dms_data_rooms').update({ status: 'extracting', error_message: null }).eq('id', room.id).eq('user_id', user.id)
  await (supabase as any).from('documents').update({ analysis_status: 'processing', analysis_error: null }).eq('id', archive.id).eq('user_id', user.id)

  try {
    const { data: zipBlob, error: downloadError } = await supabase.storage.from(archive.storage_bucket).download(archive.file_path)
    if (downloadError || !zipBlob) throw new Error('ZIP-Datei konnte nicht geladen werden.')
    const zipBytes = new Uint8Array(await zipBlob.arrayBuffer())
    let acceptedFiles = 0
    let declaredTotal = 0

    const unzipped = unzipSync(zipBytes, {
      filter: (entry) => {
        if (!safeArchivePath(entry.name)) throw new Error('Der Datenraum enthält einen unsicheren Dateipfad.')
        if (entry.name.endsWith('/') || entry.name.startsWith('__MACOSX/')) return false
        const mimeType = MIME_BY_EXTENSION[extname(entry.name).toLowerCase()]
        if (!mimeType) return false
        acceptedFiles += 1
        declaredTotal += entry.originalSize
        if (acceptedFiles > MAX_FILES) throw new Error(`Der Datenraum enthält mehr als ${MAX_FILES} unterstützte Dateien.`)
        if (entry.originalSize > MAX_ENTRY_BYTES) throw new Error('Eine entpackte Datei überschreitet 50 MB.')
        if (declaredTotal > MAX_TOTAL_BYTES) throw new Error('Der entpackte Datenraum überschreitet das Sicherheitslimit von 250 MB.')
        if (entry.size > 0 && entry.originalSize / entry.size > 250) throw new Error('Der Datenraum weist ein unzulässiges Kompressionsverhältnis auf.')
        return true
      },
    })

    let imported = 0
    let totalBytes = 0
    for (const [archivePath, bytes] of Object.entries(unzipped)) {
      const extension = extname(archivePath).toLowerCase()
      const mimeType = MIME_BY_EXTENSION[extension]
      if (!mimeType) continue
      totalBytes += bytes.byteLength
      const hash = createHash('sha256').update(bytes).digest('hex')

      const { data: duplicate } = await (supabase as any)
        .from('documents')
        .select('id')
        .eq('user_id', user.id)
        .eq('sha256', hash)
        .eq('is_archived', false)
        .limit(1)
        .maybeSingle()

      let documentId = duplicate?.id as string | undefined
      if (!documentId) {
        const fileName = basename(archivePath).slice(0, 255)
        const storagePath = `${user.id}/data-rooms/${room.id}/${randomUUID()}-${fileName}`
        const { error: uploadError } = await supabase.storage.from('ema-dms').upload(storagePath, bytes, { contentType: mimeType, cacheControl: '3600', upsert: false })
        if (uploadError) throw new Error(`„${fileName}“ konnte nicht gespeichert werden.`)

        const { data: created, error: insertError } = await (supabase as any)
          .from('documents')
          .insert({
            user_id: user.id,
            project_id: room.project_id,
            document_type: 'sonstiges',
            display_name: displayName(archivePath),
            file_name: fileName,
            file_path: storagePath,
            file_size_bytes: bytes.byteLength,
            mime_type: mimeType,
            storage_bucket: 'ema-dms',
            source_app: 'external',
            source_kind: 'data_room_entry',
            sha256: hash,
            archive_entry_path: archivePath,
            analysis_status: mimeType === 'application/pdf' ? 'queued' : 'not_started',
          })
          .select('id')
          .single()
        if (insertError || !created) {
          await supabase.storage.from('ema-dms').remove([storagePath])
          throw new Error(`„${fileName}“ konnte nicht registriert werden.`)
        }
        documentId = created.id

        if (room.project_id) {
          await (supabase as any).from('dms_document_links').insert({ document_id: documentId, user_id: user.id, entity_type: 'project', entity_id: room.project_id })
        }
      }

      const { error: linkError } = await (supabase as any).from('dms_data_room_documents').insert({
        data_room_id: room.id,
        document_id: documentId,
        user_id: user.id,
        archive_entry_path: archivePath,
      })
      if (linkError && linkError.code !== '23505') throw new Error(`„${archivePath}“ konnte dem Datenraum nicht zugeordnet werden.`)
      imported += 1
    }

    await (supabase as any).from('dms_data_rooms').update({ status: 'ready', file_count: imported, total_uncompressed_bytes: totalBytes, error_message: null }).eq('id', room.id).eq('user_id', user.id)
    await (supabase as any).from('documents').update({ analysis_status: 'completed', analysis_error: null }).eq('id', archive.id).eq('user_id', user.id)
    return NextResponse.json({ ready: true, imported, total_uncompressed_bytes: totalBytes })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Datenraum konnte nicht entpackt werden.'
    await (supabase as any).from('dms_data_rooms').update({ status: 'failed', error_message: message }).eq('id', room.id).eq('user_id', user.id)
    await (supabase as any).from('documents').update({ analysis_status: 'failed', analysis_error: message }).eq('id', archive.id).eq('user_id', user.id)
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
