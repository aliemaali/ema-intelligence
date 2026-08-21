import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listPlaudRecordings } from '@/lib/plaud/api'
import { getPlaudAccessToken } from '@/lib/plaud/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  try {
    const token = await getPlaudAccessToken(user.id)
    if (!token) return NextResponse.json({ connected: false, recordings: [] })
    const [recordings, decisions] = await Promise.all([
      listPlaudRecordings(token),
      supabase.from('plaud_import_decisions').select('external_id').eq('user_id', user.id),
    ])
    if (decisions.error) throw decisions.error
    const handled = new Set((decisions.data ?? []).map((row: any) => String(row.external_id)))
    const pending = recordings
      .filter((recording) => recording.id && !handled.has(recording.id))
      .map((recording) => ({
        id: recording.id,
        name: recording.name || 'PLAUD-Aufnahme',
        createdAt: recording.start_at || recording.created_at,
        durationMs: Number(recording.duration || 0),
      }))
    return NextResponse.json({ connected: true, recordings: pending })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PLAUD-Aufnahmen konnten nicht geladen werden.' }, { status: 502 })
  }
}
