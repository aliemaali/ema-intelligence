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
    const recipients = String(payload.to || '')
      .split(/[;,]/)
      .map((value) => value.trim())
      .filter(Boolean)
    const subject = String(payload.subject || '').trim()
    const body = String(payload.body || '').trim()
    const legacyAttachment = payload.contentBytes ? [{
      fileName: String(payload.fileName || 'EMA_Dokument.pdf').trim(),
      contentBytes: String(payload.contentBytes || '').trim(),
      contentType: 'application/pdf',
    }] : []
    const attachments = (Array.isArray(payload.attachments) ? payload.attachments : legacyAttachment)
      .map((attachment: any) => ({
        fileName: String(attachment.fileName || 'EMA_Dokument.pdf').trim(),
        contentBytes: String(attachment.contentBytes || '').trim(),
        contentType: String(attachment.contentType || 'application/pdf').trim(),
      }))
      .filter((attachment: any) => attachment.contentBytes)
      .slice(0, 20)

    if (!recipients.length || !subject || !attachments.length) {
      return NextResponse.json({ error: 'Empfänger, Betreff und mindestens ein Dokument sind erforderlich.' }, { status: 400 })
    }

    await graphFetch<void>(accessToken, '/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: body || 'Anbei erhalten Sie die ausgewählten Dokumente.' },
          toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
          attachments: attachments.map((attachment: any) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.fileName,
            contentType: attachment.contentType,
            contentBytes: attachment.contentBytes,
          })),
        },
        saveToSentItems: true,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'E-Mail konnte nicht versendet werden.' }, { status: 502 })
  }
}
