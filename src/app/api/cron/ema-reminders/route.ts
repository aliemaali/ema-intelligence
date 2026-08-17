import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ClaimedReminder = {
  id: string
  user_id: string
  title: string
  due_at: string
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth_key: string
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || process.env.EMA_CRON_SECRET
  if (!expected) return false

  const authHeader = request.headers.get('authorization') ?? ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '')
  const customHeader = request.headers.get('x-ema-cron-secret') ?? ''

  return bearer === expected || customHeader === expected
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Web Push status codes that mean the subscription is permanently gone
// (unsubscribed on the device, endpoint expired, or the app was removed).
const INVALID_SUBSCRIPTION_STATUS = new Set([400, 401, 403, 404, 410])

export async function POST(request: NextRequest) {
  return handle(request)
}

export async function GET(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Supabase ist serverseitig nicht konfiguriert.' }, { status: 503 })
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@ema-enterprise.de'

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ ok: false, error: 'VAPID ist serverseitig nicht konfiguriert.' }, { status: 503 })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  // Atomically claims every due, not-yet-sent reminder whose user has at
  // least one push subscription. The claim itself (push_sent_at = now())
  // happens inside the SQL function under FOR UPDATE SKIP LOCKED, so two
  // overlapping cron invocations can never claim - and therefore never
  // send - the same reminder twice.
  const { data: claimed, error: claimError } = await supabase.rpc('claim_due_reminders', { p_limit: 100 })

  if (claimError) {
    return NextResponse.json({ ok: false, error: claimError.message }, { status: 500 })
  }

  const reminders = (claimed ?? []) as ClaimedReminder[]
  let sent = 0
  let removedSubscriptions = 0

  for (const reminder of reminders) {
    const { data: subscriptions } = await supabase
      .from('ema_push_subscriptions')
      .select('id,endpoint,p256dh,auth_key')
      .eq('user_id', reminder.user_id)

    const payload = JSON.stringify({
      title: 'EMA',
      body: `Erinnerung: ${reminder.title}`,
      tag: `ema-reminder-${reminder.id}`,
      reminderId: reminder.id,
      url: `/assistant?reminder=${reminder.id}`,
    })

    for (const sub of (subscriptions ?? []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        )
        sent++
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode)
        if (INVALID_SUBSCRIPTION_STATUS.has(statusCode)) {
          await supabase.from('ema_push_subscriptions').delete().eq('id', sub.id)
          removedSubscriptions++
        }
      }
    }
  }

  await supabase
    .from('ema_cron_heartbeat')
    .update({
      last_run_at: new Date().toISOString(),
      last_checked_count: reminders.length,
      last_sent_count: sent,
    })
    .eq('id', true)

  return NextResponse.json({ ok: true, claimed: reminders.length, sent, removedSubscriptions })
}
