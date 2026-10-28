import { NextResponse } from 'next/server'
import { mailFingerprint } from '@/lib/control/mail-dismissals'
import { createClient } from '@/lib/supabase/server'
import { getMicrosoftAccessToken } from '@/lib/microsoft/session'
import { graphFetch } from '@/lib/microsoft/graph'
import { EMA_MAILBOXES, prioritizeMail, rankMail } from '@/lib/control/mail'

export const dynamic = 'force-dynamic'
export const maxDuration = 30
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  const headers = { 'Cache-Control': 'private, no-store' }
  let token: string | null
  try { token = await getMicrosoftAccessToken(user.id) } catch { return NextResponse.json({ connected: false, reconnect: true, mailboxes: EMA_MAILBOXES.map(mailbox => ({ mailbox, state: 'permission_required' })), messages: [], events: [], calendarAvailable: false }, { headers }) }
  if (!token) return NextResponse.json({ connected: false, reconnect: true, mailboxes: EMA_MAILBOXES.map(mailbox => ({ mailbox, state: 'not_connected' })), messages: [], events: [], calendarAvailable: false }, { headers })
  const mailboxResults = await Promise.all(EMA_MAILBOXES.map(async mailbox => {
    const params = new URLSearchParams({ '$select': 'id,subject,bodyPreview,receivedDateTime,isRead,importance,hasAttachments,flag,webLink,from', '$orderby': 'receivedDateTime desc', '$top': '25' })
    try {
      const page = await graphFetch<{ value?: Parameters<typeof prioritizeMail>[0][] }>(token!, `/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages?${params}`, { signal: AbortSignal.timeout(10000) })
      return { mailbox, state: 'connected', messages: (page.value || []).map(mail => prioritizeMail(mail, mailbox)) }
    } catch { return { mailbox, state: 'permission_required', messages: [] } }
  }))
  const params = new URLSearchParams({ startDateTime: new Date().toISOString(), endDateTime: new Date(Date.now()+7*86400000).toISOString(), '$top':'12', '$orderby':'start/dateTime', '$select':'id,subject,start,end,isCancelled' })
  let events: { id: string; title: string; start: string; end: string }[] = [], calendarAvailable = true
  try {
    const result = await graphFetch<{ value?: { id: string; subject?: string; isCancelled?: boolean; start?: { dateTime?: string }; end?: { dateTime?: string } }[] }>(token, `/me/calendarView?${params}`, { headers: { Prefer: 'outlook.timezone="UTC"' }, signal: AbortSignal.timeout(8000) })
    events = (result.value || []).filter(event => !event.isCancelled && event.start?.dateTime).map(event => ({ id: event.id, title: event.subject || 'Termin', start: event.start!.dateTime!.replace(/Z?$/, 'Z'), end: (event.end?.dateTime || '').replace(/Z?$/, 'Z') }))
  } catch { calendarAvailable = false }
  const messages=rankMail(mailboxResults.flatMap(item=>item.messages))
  const hidden=messages.length?await supabase.from('control_mail_dismissals').select('message_key').eq('user_id',user.id).in('message_key',messages.map(mailFingerprint)):{data:[],error:null}
  if(hidden.error)return NextResponse.json({error:'Die Nachrichtenübersicht konnte nicht geladen werden.'},{status:503,headers})
  const hiddenKeys=new Set((hidden.data||[]).map(row=>row.message_key))
  return NextResponse.json({ connected: true, reconnect: mailboxResults.some(item => item.state !== 'connected'), mailboxes: mailboxResults.map(({ mailbox, state }) => ({ mailbox, state })), messages: messages.filter(mail=>!hiddenKeys.has(mailFingerprint(mail))), events, calendarAvailable, updatedAt: new Date().toISOString() }, { headers })
}

