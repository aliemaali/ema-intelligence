import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { graphFetch } from '@/lib/microsoft/graph'
import { getMicrosoftAccessToken } from '@/lib/microsoft/session'

async function authenticatedToken() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getMicrosoftAccessToken(user.id)
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = await authenticatedToken()
    if (!accessToken) return NextResponse.json({ error: 'Microsoft nicht verbunden' }, { status: 401 })

    const start = request.nextUrl.searchParams.get('start') || new Date().toISOString()
    const defaultEnd = new Date()
    defaultEnd.setDate(defaultEnd.getDate() + 60)
    const end = request.nextUrl.searchParams.get('end') || defaultEnd.toISOString()

    const query = new URL('https://graph.microsoft.com/v1.0/me/calendarView')
    query.searchParams.set('startDateTime', start)
    query.searchParams.set('endDateTime', end)
    query.searchParams.set('$top', '75')
    query.searchParams.set('$orderby', 'start/dateTime')
    query.searchParams.set('$select', 'id,subject,start,end,location,attendees,isOnlineMeeting,onlineMeeting,webLink,bodyPreview')

    const result = await graphFetch<{ value: any[] }>(accessToken, query.toString(), {
      headers: { Prefer: 'outlook.timezone="Europe/Berlin"' },
    })

    const events = (result.value || []).map((event) => ({
      id: event.id,
      title: event.subject || 'Termin',
      start: event.start?.dateTime || '',
      end: event.end?.dateTime || '',
      location: event.location?.displayName || '',
      attendees: (event.attendees || []).map((attendee: any) => ({
        name: attendee.emailAddress?.name || '',
        email: attendee.emailAddress?.address || '',
        status: attendee.status?.response || 'none',
      })),
      isOnlineMeeting: Boolean(event.isOnlineMeeting),
      joinUrl: event.onlineMeeting?.joinUrl || '',
      webLink: event.webLink || '',
      bodyPreview: event.bodyPreview || '',
    }))

    return NextResponse.json({ events })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Termine konnten nicht geladen werden.' }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await authenticatedToken()
    if (!accessToken) return NextResponse.json({ error: 'Microsoft nicht verbunden' }, { status: 401 })

    const body = await request.json()
    const title = String(body.title || '').trim()
    const start = String(body.start || '').trim()
    const end = String(body.end || '').trim()
    const attendees = Array.isArray(body.attendees) ? body.attendees.map(String).map((email: string) => email.trim()).filter(Boolean) : []

    if (!title || !start || !end) {
      return NextResponse.json({ error: 'Titel, Beginn und Ende sind erforderlich.' }, { status: 400 })
    }
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      return NextResponse.json({ error: 'Das Terminende muss nach dem Beginn liegen.' }, { status: 400 })
    }

    const project = String(body.project || '').trim()
    const notes = String(body.notes || '').trim()
    const description = [project ? `EMA-Projekt: ${project}` : '', notes].filter(Boolean).join('\n\n')
    const isOnlineMeeting = body.isOnlineMeeting !== false

    const eventPayload = {
      subject: title,
      body: { contentType: 'Text', content: description || 'Erstellt über EMA Intelligence.' },
      start: { dateTime: start, timeZone: 'Europe/Berlin' },
      end: { dateTime: end, timeZone: 'Europe/Berlin' },
      location: { displayName: String(body.location || '').trim() },
      attendees: attendees.map((email: string) => ({
        emailAddress: { address: email },
        type: 'required',
      })),
      allowNewTimeProposals: true,
      isOnlineMeeting,
      ...(isOnlineMeeting ? { onlineMeetingProvider: 'teamsForBusiness' } : {}),
    }

    const event = await graphFetch<any>(accessToken, '/me/events', {
      method: 'POST',
      headers: { Prefer: 'outlook.timezone="Europe/Berlin"' },
      body: JSON.stringify(eventPayload),
    })

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.subject,
        start: event.start?.dateTime,
        end: event.end?.dateTime,
        joinUrl: event.onlineMeeting?.joinUrl || '',
        webLink: event.webLink || '',
      },
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Termin konnte nicht erstellt werden.' }, { status: 502 })
  }
}
