import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  const { data, error } = await supabase.from('plaud_notes')
    .select('id,external_id,title,recorded_at,duration_ms,source_language,summary_original,summary_de,transcript_original,transcript_de,archived_at,imported_at')
    .eq('id', params.id).eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'PLAUD-Notiz konnte nicht geladen werden.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'PLAUD-Notiz wurde nicht gefunden.' }, { status: 404 })
  return NextResponse.json({ note: data })
}
