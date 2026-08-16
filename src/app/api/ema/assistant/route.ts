import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const sensitive = /(passwort|password|\bpin\b|token\b|api[-_ ]?key|iban\b|kreditkarten?|credit card|bankdaten)/i

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 })

  const body = await request.json().catch(() => null) as { tool?: string; args?: Record<string, unknown> } | null
  const tool = body?.tool ?? ''
  const args = body?.args ?? {}

  if (tool === 'remember') {
    const content = typeof args.content === 'string' ? args.content.trim() : ''
    if (!content) return NextResponse.json({ ok: false, error: 'Es fehlt, was EMA sich merken soll.' }, { status: 400 })
    if (sensitive.test(content)) return NextResponse.json({ ok: false, error: 'EMA speichert keine Passwörter, PINs, Tokens oder Bankdaten.' }, { status: 400 })
    const { data, error } = await supabase.from('ema_memories').insert({ user_id: user.id, content }).select('id,content').single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, result: data })
  }

  if (tool === 'recall') {
    const query = typeof args.query === 'string' ? args.query.trim() : ''
    let request = supabase.from('ema_memories').select('id,title,content,updated_at').order('updated_at', { ascending: false }).limit(10)
    if (query) request = request.ilike('content', `%${query.replace(/[%_]/g, '')}%`)
    const { data, error } = await request
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, result: { memories: data ?? [] } })
  }

  if (tool === 'forget') {
    const query = typeof args.query === 'string' ? args.query.trim() : ''
    if (!query) return NextResponse.json({ ok: false, error: 'Es fehlt, was EMA vergessen soll.' }, { status: 400 })
    const safe = query.replace(/[%_]/g, '')
    const { data: matches, error: findError } = await supabase.from('ema_memories').select('id,content').ilike('content', `%${safe}%`).limit(10)
    if (findError) return NextResponse.json({ ok: false, error: findError.message }, { status: 500 })
    if (!matches?.length) return NextResponse.json({ ok: true, result: { deleted: 0 } })
    const ids = matches.map(item => item.id)
    const { error } = await supabase.from('ema_memories').delete().in('id', ids)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, result: { deleted: ids.length } })
  }

  if (tool === 'create_reminder') {
    const title = typeof args.title === 'string' ? args.title.trim() : ''
    const dueAt = typeof args.due_at === 'string' ? args.due_at : ''
    const parsed = new Date(dueAt)
    if (!title || !dueAt || Number.isNaN(parsed.getTime())) return NextResponse.json({ ok: false, error: 'Titel sowie gültiges Datum und Uhrzeit werden benötigt.' }, { status: 400 })
    const { data, error } = await supabase.from('ema_reminders').insert({ user_id: user.id, title, due_at: parsed.toISOString() }).select('id,title,due_at').single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, result: data })
  }

  if (tool === 'list_reminders') {
    const now = new Date()
    const end = new Date(now); end.setHours(23, 59, 59, 999)
    const { data, error } = await supabase.from('ema_reminders').select('id,title,notes,due_at,completed_at').is('completed_at', null).lte('due_at', end.toISOString()).order('due_at', { ascending: true }).limit(20)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, result: { reminders: data ?? [] } })
  }

  return NextResponse.json({ ok: false, error: 'Unbekanntes Assistenten-Werkzeug.' }, { status: 400 })
}
