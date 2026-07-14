import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type NotificationEvent = 'created' | 'updated' | 'documents_added'

const EVENT_LABELS: Record<NotificationEvent, string> = {
  created: 'Neues Projekt eingereicht',
  updated: 'Projekt wurde geändert',
  documents_added: 'Neue Unterlagen wurden nachgereicht',
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  pv_freiflaeche: 'PV-Freifläche',
  pv_dach: 'PV-Dach',
  bess: 'BESS',
  hybrid: 'Hybrid',
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function getMicrosoftAccessToken() {
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) return null

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      cache: 'no-store',
    }
  )

  if (!tokenResponse.ok) {
    console.error('Microsoft token request failed:', tokenResponse.status, await tokenResponse.text())
    return null
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string }
  return tokenData.access_token ?? null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    const user = authData.user

    if (authError || !user) {
      return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
    }

    const body = (await request.json()) as {
      submissionId?: string
      event?: NotificationEvent
      addedDocumentCount?: number
    }

    if (!body.submissionId || !body.event || !EVENT_LABELS[body.event]) {
      return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
    }

    const { data: submission, error: submissionError } = await supabase
      .from('project_submissions')
      .select('id, partner_user_id, project_name, project_type, location_city, location_state, pv_kwp, bess_mw, bess_mwh, status')
      .eq('id', body.submissionId)
      .eq('partner_user_id', user.id)
      .single()

    if (submissionError || !submission) {
      return NextResponse.json({ error: 'Projekt nicht gefunden.' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company')
      .eq('id', user.id)
      .single()

    const sender = process.env.OUTLOOK_SENDER_EMAIL ?? 'unluer@ema-enterprise.de'
    const recipient = process.env.PARTNER_NOTIFICATION_EMAIL ?? 'unluer@ema-enterprise.de'
    const accessToken = await getMicrosoftAccessToken()

    if (!accessToken) {
      console.warn('Partner notification skipped: Microsoft Graph configuration is missing or invalid.')
      return NextResponse.json({ sent: false, reason: 'mail_not_configured' })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ema-enterprise.de'
    const reviewUrl = `${appUrl.replace(/\/$/, '')}/partner-submissions/${submission.id}`
    const eventLabel = EVENT_LABELS[body.event]
    const projectType = PROJECT_TYPE_LABELS[submission.project_type] ?? submission.project_type
    const partnerName = profile?.full_name || user.email || 'Partner'
    const company = profile?.company || '—'
    const documentInfo = body.event === 'documents_added' || Number(body.addedDocumentCount) > 0
      ? `<tr><td style="padding:8px 0;color:#64748b">Neue Unterlagen</td><td style="padding:8px 0;font-weight:700">${Math.max(0, Number(body.addedDocumentCount) || 0)}</td></tr>`
      : ''

    const html = `
      <div style="background:#f6f8fb;padding:32px 16px;font-family:Arial,sans-serif;color:#1F2A44">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0">
          <div style="background:#1F2A44;padding:24px 28px;color:#ffffff">
            <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.75">EMA Intelligence</div>
            <h1 style="margin:8px 0 0;font-size:24px">${escapeHtml(eventLabel)}</h1>
          </div>
          <div style="padding:28px">
            <p style="margin:0 0 20px;font-size:16px;line-height:1.6">Ein Partnerprojekt benötigt deine Aufmerksamkeit.</p>
            <table style="width:100%;border-collapse:collapse;font-size:15px">
              <tr><td style="padding:8px 0;color:#64748b">Projekt</td><td style="padding:8px 0;font-weight:700">${escapeHtml(submission.project_name)}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Projektart</td><td style="padding:8px 0;font-weight:700">${escapeHtml(projectType)}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Standort</td><td style="padding:8px 0;font-weight:700">${escapeHtml(submission.location_city)}, ${escapeHtml(submission.location_state)}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Partner</td><td style="padding:8px 0;font-weight:700">${escapeHtml(partnerName)}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Firma</td><td style="padding:8px 0;font-weight:700">${escapeHtml(company)}</td></tr>
              ${documentInfo}
            </table>
            <a href="${escapeHtml(reviewUrl)}" style="display:inline-block;margin-top:24px;background:#5CB800;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">Projekt prüfen</a>
          </div>
        </div>
      </div>
    `

    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: `${eventLabel}: ${submission.project_name}`,
            body: { contentType: 'HTML', content: html },
            toRecipients: [
              { emailAddress: { address: recipient } },
            ],
          },
          saveToSentItems: true,
        }),
      }
    )

    if (!graphResponse.ok) {
      console.error('Outlook partner notification failed:', graphResponse.status, await graphResponse.text())
      return NextResponse.json({ sent: false, reason: 'mail_provider_error' }, { status: 502 })
    }

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('Partner notification failed:', error)
    return NextResponse.json({ sent: false, reason: 'unexpected_error' }, { status: 500 })
  }
}
