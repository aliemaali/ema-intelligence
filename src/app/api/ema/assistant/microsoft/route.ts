import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { graphFetch } from '@/lib/microsoft/graph'
import { getMicrosoftAccessToken } from '@/lib/microsoft/session'

export const dynamic = 'force-dynamic'

async function tokenForCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getMicrosoftAccessToken(user.id)
}

export async function POST(request: NextRequest) {
  const accessToken = await tokenForCurrentUser()
  if (!accessToken) return NextResponse.json({ ok: false, error: 'Microsoft 365 ist nicht verbunden.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { tool?: string; args?: Record<string, unknown> }
  const args = body.args ?? {}

  try {
    if (body.tool === 'calendar') {
      const start = typeof args.start === 'string' && args.start ? args.start : new Date().toISOString()
      const endDate = new Date(start); endDate.setDate(endDate.getDate() + 7)
      const end = typeof args.end === 'string' && args.end ? args.end : endDate.toISOString()
      const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView')
      url.searchParams.set('startDateTime', start); url.searchParams.set('endDateTime', end)
      url.searchParams.set('$top', '20'); url.searchParams.set('$orderby', 'start/dateTime')
      url.searchParams.set('$select', 'subject,start,end,location,isOnlineMeeting,onlineMeeting')
      const result = await graphFetch<{ value: any[] }>(accessToken, url.toString(), { headers: { Prefer: 'outlook.timezone="Europe/Berlin"' } })
      return NextResponse.json({ ok: true, result: { events: (result.value ?? []).map(e => ({ title: e.subject || 'Termin', start: e.start?.dateTime || '', end: e.end?.dateTime || '', location: e.location?.displayName || '', teams: Boolean(e.isOnlineMeeting), joinUrl: e.onlineMeeting?.joinUrl || '' })) } })
    }

    if (body.tool === 'contacts') {
      const query = String(args.query || '').trim().replace(/["']/g, '')
      if (!query) return NextResponse.json({ ok: false, error: 'Suchbegriff fehlt.' }, { status: 400 })
      const url = new URL('https://graph.microsoft.com/v1.0/me/contacts')
      url.searchParams.set('$top', '10'); url.searchParams.set('$select', 'displayName,emailAddresses,businessPhones,mobilePhone,companyName')
      url.searchParams.set('$filter', `startswith(displayName,'${query.replace(/'/g, "''")}')`)
      const result = await graphFetch<{ value: any[] }>(accessToken, url.toString())
      return NextResponse.json({ ok: true, result: { contacts: (result.value ?? []).map(c => ({ name: c.displayName || '', company: c.companyName || '', emails: (c.emailAddresses ?? []).map((e: any) => e.address).filter(Boolean), phones: [...(c.businessPhones ?? []), c.mobilePhone].filter(Boolean) })) } })
    }

    return NextResponse.json({ ok: false, error: 'Unbekanntes Microsoft-Werkzeug.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Microsoft-Abfrage fehlgeschlagen.' }, { status: 502 })
  }
}
