'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getOutlookConfig() {
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const senderEmail = process.env.OUTLOOK_SENDER_EMAIL

  if (!tenantId || !clientId || !clientSecret || !senderEmail) return null
  return { tenantId, clientId, clientSecret, senderEmail }
}

async function getMicrosoftAccessToken(config: NonNullable<ReturnType<typeof getOutlookConfig>>) {
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      cache: 'no-store',
    }
  )

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text()
    throw new Error(`Microsoft-Anmeldung fehlgeschlagen (${tokenResponse.status}): ${details.slice(0, 300)}`)
  }

  const token = await tokenResponse.json() as { access_token?: string }
  if (!token.access_token) throw new Error('Microsoft hat kein Zugriffstoken zurückgegeben.')
  return token.access_token
}

export async function sendApprovedAcquisitionEmail(formData: FormData) {
  const emailId = text(formData, 'email_id')
  if (!emailId) redirect('/acquisition/approvals?error=email')

  const config = getOutlookConfig()
  if (!config) redirect('/acquisition/approvals?error=outlook_config')

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: email, error: claimError } = await db
    .from('acquisition_emails')
    .update({ status: 'sending', error_message: null })
    .eq('id', emailId)
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .select('id,lead_id,recipient_email,subject,body')
    .single()

  if (claimError || !email) redirect('/acquisition/approvals?error=status')

  try {
    const accessToken = await getMicrosoftAccessToken(config)
    const sendResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.senderEmail)}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: email.subject,
            body: { contentType: 'Text', content: email.body },
            toRecipients: [
              { emailAddress: { address: email.recipient_email } },
            ],
          },
          saveToSentItems: true,
        }),
        cache: 'no-store',
      }
    )

    if (!sendResponse.ok) {
      const details = await sendResponse.text()
      throw new Error(`Outlook-Versand fehlgeschlagen (${sendResponse.status}): ${details.slice(0, 500)}`)
    }

    const sentAt = new Date().toISOString()
    await db.from('acquisition_emails').update({
      status: 'sent',
      sent_at: sentAt,
      error_message: null,
    }).eq('id', email.id).eq('user_id', user.id)

    await db.from('acquisition_leads').update({
      status: 'contacted',
      next_action: 'Antwort abwarten und Follow-up prüfen',
    }).eq('id', email.lead_id).eq('user_id', user.id)

    await db.from('acquisition_activities').insert({
      user_id: user.id,
      lead_id: email.lead_id,
      activity_type: 'email_sent',
      title: 'E-Mail über Outlook versendet',
      description: `Erstkontakt wurde an ${email.recipient_email} gesendet.`,
      metadata: { email_id: email.id, sender_email: config.senderEmail, sent_at: sentAt },
    })

    revalidatePath('/acquisition')
    revalidatePath('/acquisition/approvals')
    redirect('/acquisition/approvals?sent=1')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Outlook-Fehler.'
    await db.from('acquisition_emails').update({
      status: 'failed',
      error_message: message,
    }).eq('id', email.id).eq('user_id', user.id)

    await db.from('acquisition_activities').insert({
      user_id: user.id,
      lead_id: email.lead_id,
      activity_type: 'note',
      title: 'Outlook-Versand fehlgeschlagen',
      description: message,
      metadata: { email_id: email.id },
    })

    revalidatePath('/acquisition/approvals')
    redirect('/acquisition/approvals?error=send')
  }
}
