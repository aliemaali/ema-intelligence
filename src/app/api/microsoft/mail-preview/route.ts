import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { graphFetch } from '@/lib/microsoft/graph'
import { getMicrosoftAccessToken } from '@/lib/microsoft/session'

type GraphMail = { id: string; subject?: string; bodyPreview?: string; receivedDateTime?: string; isRead?: boolean; from?: { emailAddress?: { name?: string; address?: string } } }
type GraphMailPage = { value?: GraphMail[] }

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
    const accessToken = await getMicrosoftAccessToken(user.id)
    if (!accessToken) return NextResponse.json({ error: 'Microsoft 365 ist nicht verbunden.' }, { status: 401 })

    const limit = Math.min(10, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 5)))
    const unreadOnly = request.nextUrl.searchParams.get('unread') === '1'
    const filter = unreadOnly ? '&$filter=isRead eq false' : ''
    const path = `/me/messages?$select=id,subject,bodyPreview,receivedDateTime,isRead,from&$orderby=receivedDateTime desc&$top=${limit}${filter}`
    const result = await graphFetch<GraphMailPage>(accessToken, path)
    const messages = (result.value ?? []).map(mail => ({
      id: mail.id,
      subject: mail.subject || '(Ohne Betreff)',
      preview: mail.bodyPreview || '',
      received_at: mail.receivedDateTime || null,
      unread: mail.isRead === false,
      from: mail.from?.emailAddress?.name || mail.from?.emailAddress?.address || 'Unbekannt',
    }))
    return NextResponse.json({ success: true, messages })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'E-Mail-Vorschauen konnten nicht geladen werden.' }, { status: 502 })
  }
}
