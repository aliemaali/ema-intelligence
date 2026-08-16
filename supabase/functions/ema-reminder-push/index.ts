import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async req => {
  const cronSecret = Deno.env.get('EMA_CRON_SECRET')
  if (!cronSecret || req.headers.get('x-ema-cron-secret') !== cronSecret) return new Response('Unauthorized', { status: 401 })
  const url = Deno.env.get('SUPABASE_URL')!, serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!, vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!, subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@ema-enterprise.de'
  if (!vapidPublic || !vapidPrivate) return new Response('VAPID not configured', { status: 503 })
  webpush.setVapidDetails(subject, vapidPublic, vapidPrivate)
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })
  const now = new Date().toISOString()
  const { data: reminders, error } = await db.from('ema_reminders').select('id,user_id,title,due_at').is('completed_at', null).is('push_sent_at', null).lte('due_at', now).limit(100)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  let sent = 0
  for (const reminder of reminders ?? []) {
    const { data: subscriptions } = await db.from('ema_push_subscriptions').select('id,endpoint,p256dh,auth_key').eq('user_id', reminder.user_id)
    let delivered = false
    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, JSON.stringify({ title: 'EMA Erinnerung', body: reminder.title, tag: `ema-${reminder.id}`, reminderId: reminder.id, url: `/assistant?reminder=${reminder.id}` }))
        delivered = true; sent++
      } catch (e) {
        const status = Number((e as { statusCode?: number }).statusCode)
        if (status === 404 || status === 410) await db.from('ema_push_subscriptions').delete().eq('id', sub.id)
      }
    }
    if (delivered) await db.from('ema_reminders').update({ push_sent_at: now }).eq('id', reminder.id).is('push_sent_at', null)
  }
  return Response.json({ checked: reminders?.length ?? 0, sent })
})
