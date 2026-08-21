import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { fileId?: string; decision?: string }
  const fileId = String(body.fileId || '').trim()
  if (!fileId || body.decision !== 'rejected') return NextResponse.json({ error: 'Ungültige Entscheidung.' }, { status: 400 })
  const { error } = await supabase.from('plaud_import_decisions').upsert({
    user_id: user.id,
    external_id: fileId,
    decision: 'rejected',
    decided_at: new Date().toISOString(),
  }, { onConflict: 'user_id,external_id' })
  if (error) return NextResponse.json({ error: 'Die Entscheidung konnte nicht gespeichert werden.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
