import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMicrosoftAccessToken } from '@/lib/microsoft/session'
import { graphFetch } from '@/lib/microsoft/graph'

export const dynamic = 'force-dynamic'
export const maxDuration = 30
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401, headers })
  // Empty legacy fields keep already-open clients compatible during deployment.
  // Intelligence no longer requests, ranks or returns inbox messages.
  const empty = { mailboxes: [], messages: [], events: [], calendarAvailable: false }
  let token: string | null
  try { token = await getMicrosoftAccessToken(user.id) }
  catch { return NextResponse.json({ ...empty, connected: false, reconnect: true }, { headers }) }
  if (!token) return NextResponse.json({ ...empty, connected: false, reconnect: true }, { headers })
  const params = new URLSearchParams({ startDateTime: new Date().toISOString(), endDateTime: new Date(Date.now()+7*86400000).toISOString(), '$top':'12', '$orderby':'start/dateTime', '$select':'id,subject,start,end,isCancelled' })
  let events: { id: string; title: string; start: string; end: string }[] = [], calendarAvailable = true
  try {
    const result = await graphFetch<{ value?: { id: string; subject?: string; isCancelled?: boolean; start?: { dateTime?: string }; end?: { dateTime?: string } }[] }>(token, `/me/calendarView?${params}`, { headers: { Prefer: 'outlook.timezone="UTC"' }, signal: AbortSignal.timeout(8000) })
    events = (result.value || []).filter(event => !event.isCancelled && event.start?.dateTime).map(event => ({ id: event.id, title: event.subject || 'Termin', start: event.start!.dateTime!.replace(/Z?$/, 'Z'), end: (event.end?.dateTime || '').replace(/Z?$/, 'Z') }))
  } catch { calendarAvailable = false }
  return NextResponse.json({ ...empty, connected: true, reconnect: false, events, calendarAvailable, updatedAt: new Date().toISOString() }, { headers })
}
