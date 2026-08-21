import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  advancePlaudTranslation,
  getPlaudTranslationStatus,
  isGermanPlaudLanguage,
} from '@/lib/plaud/prepare-meeting'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { noteId?: string }
  const noteId = String(body.noteId || '').trim()
  if (!noteId) return NextResponse.json({ error: 'Ungültige PLAUD-Notiz.' }, { status: 400 })

  try {
    const { data: note, error } = await supabase.from('plaud_notes')
      .select('id,source_language,transcript_original,transcript_de')
      .eq('id', noteId).eq('user_id', user.id).maybeSingle()
    if (error) throw error
    if (!note) return NextResponse.json({ error: 'PLAUD-Notiz wurde nicht gefunden.' }, { status: 404 })

    if (getPlaudTranslationStatus(note.transcript_de).done) {
      return NextResponse.json({ ok: true, ...getPlaudTranslationStatus(note.transcript_de) })
    }
    if (!note.transcript_original) {
      return NextResponse.json({ error: 'Das Originaltranskript ist nicht verfügbar.' }, { status: 409 })
    }

    if (isGermanPlaudLanguage(note.source_language)) {
      const { error: updateError } = await supabase.from('plaud_notes')
        .update({ transcript_de: note.transcript_original, updated_at: new Date().toISOString() })
        .eq('id', note.id).eq('user_id', user.id)
      if (updateError) throw updateError
      return NextResponse.json({ ok: true, done: true, completed: 1, total: 1 })
    }

    const result = await advancePlaudTranslation({
      userId: user.id,
      transcript: note.transcript_original,
      storedTranslation: note.transcript_de,
    })
    const { error: updateError } = await supabase.from('plaud_notes')
      .update({ transcript_de: result.value, updated_at: new Date().toISOString() })
      .eq('id', note.id).eq('user_id', user.id)
    if (updateError) throw updateError

    return NextResponse.json({ ok: true, ...result.status })
  } catch (error) {
    console.error('PLAUD translation step failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Die deutsche Übersetzung konnte nicht fortgesetzt werden.',
    }, { status: 502 })
  }
}
