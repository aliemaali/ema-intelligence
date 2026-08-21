import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlaudRecording, resolvePlaudBlocks } from '@/lib/plaud/api'
import { preparePlaudMeeting } from '@/lib/plaud/prepare-meeting'
import { getPlaudAccessToken } from '@/lib/plaud/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function validDueAt(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { fileId?: string }
  const fileId = String(body.fileId || '').trim()
  if (!fileId) return NextResponse.json({ error: 'Ungültige PLAUD-Aufnahme.' }, { status: 400 })

  const { data: existing } = await supabase.from('plaud_import_decisions')
    .select('decision').eq('user_id', user.id).eq('external_id', fileId).maybeSingle()
  if (existing?.decision === 'imported') return NextResponse.json({ ok: true, alreadyImported: true })
  if (existing?.decision === 'rejected') return NextResponse.json({ error: 'Diese Aufnahme wurde bereits abgelehnt.' }, { status: 409 })

  try {
    const token = await getPlaudAccessToken(user.id)
    if (!token) return NextResponse.json({ error: 'PLAUD ist nicht verbunden.' }, { status: 409 })
    const recording = await getPlaudRecording(token, fileId)
    const [transcript, notes] = await Promise.all([
      resolvePlaudBlocks(recording.source_list),
      resolvePlaudBlocks(recording.note_list),
    ])
    if (!transcript) return NextResponse.json({ error: 'Für diese Aufnahme ist noch kein Transkript verfügbar.' }, { status: 409 })
    const prepared = await preparePlaudMeeting({
      userId: user.id,
      title: recording.name || 'PLAUD-Aufnahme',
      transcript,
      notes,
    })
    const recordedAt = recording.start_at || recording.created_at || new Date().toISOString()
    const now = new Date().toISOString()
    const { error: noteError } = await supabase.from('plaud_notes').upsert({
      user_id: user.id,
      external_id: fileId,
      title: prepared.titleDe,
      recorded_at: recordedAt,
      duration_ms: Number(recording.duration || 0),
      source_language: prepared.sourceLanguage,
      summary_original: notes || null,
      summary_de: prepared.summaryDe,
      transcript_original: transcript,
      transcript_de: prepared.transcriptDe,
      imported_at: now,
      archived_at: null,
      updated_at: now,
    }, { onConflict: 'user_id,external_id' })
    if (noteError) throw noteError

    if (prepared.suggestions.length) {
      const rows = prepared.suggestions.map((item, index) => ({
        user_id: user.id,
        external_id: `${fileId}:${index + 1}`,
        note_external_id: fileId,
        kind: item.type,
        title: item.title,
        detail: item.detail || null,
        source: 'Aus PLAUD-Meeting erkannt',
        status: 'suggested',
        due_at: validDueAt(item.due_at),
        updated_at: now,
      }))
      const { error: itemsError } = await supabase.from('plaud_items').upsert(rows, { onConflict: 'user_id,external_id' })
      if (itemsError) throw itemsError
    }
    const { error: decisionError } = await supabase.from('plaud_import_decisions').upsert({
      user_id: user.id,
      external_id: fileId,
      decision: 'imported',
      decided_at: now,
    }, { onConflict: 'user_id,external_id' })
    if (decisionError) throw decisionError
    return NextResponse.json({ ok: true, title: prepared.titleDe, suggestionCount: prepared.suggestions.length })
  } catch (error) {
    console.error('PLAUD import failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PLAUD-Aufnahme konnte nicht übernommen werden.' }, { status: 502 })
  }
}
