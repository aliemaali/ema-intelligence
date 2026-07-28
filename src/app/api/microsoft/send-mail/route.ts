import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { graphFetch } from '@/lib/microsoft/graph'
import { getMicrosoftAccessToken } from '@/lib/microsoft/session'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

    const accessToken = await getMicrosoftAccessToken(user.id)
    if (!accessToken) return NextResponse.json({ error: 'Microsoft 365 ist nicht verbunden.' }, { status: 401 })

    const payload = await request.json()
    const to = String(payload.to || '').trim()
    const subject = String(payload.subject || '').trim()
    const body = String(payload.body || '').trim()
    const fileName = String(payload.fileName || 'EMA_CAPEX.pdf').trim()
    const contentBytes = String(payload.contentBytes || '').trim()

    if (!to || !subject || !contentBytes) {
      return NextResponse.json({ error: 'Empfänger, Betreff und PDF sind erforderlich.' }, { status: 400 })
    }

    await graphFetch<void>(accessToken, '/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: body || 'Anbei erhalten Sie die CAPEX-Kalkulation.' },
          toRecipients: [{ emailAddress: { address: to } }],
          attachments: [{
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: fileName,
            contentType: 'application/pdf',
            contentBytes,
          }],
        },
        saveToSentItems: true,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'E-Mail konnte nicht versendet werden.' }, { status: 502 })
  }
}
