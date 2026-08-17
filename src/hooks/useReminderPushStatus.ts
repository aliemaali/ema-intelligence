'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  EMPTY_PUSH_DIAGNOSTICS,
  isPushFullyActive,
  needsSilentRepair,
  reasonForInactivePush,
  type ReminderPushDiagnostics,
} from '@/lib/reminders/pushStatus'

export type { ReminderPushDiagnostics } from '@/lib/reminders/pushStatus'
export type ReminderPushStatus = 'checking' | 'active' | 'inactive'

const SCHEDULER_STALE_AFTER_MS = 5 * 60 * 1000

function decodeVapidKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), ms)),
  ])
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
  return window.matchMedia('(display-mode: standalone)').matches || Boolean(iosStandalone)
}

function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration('/')
}

export function useReminderPushStatus() {
  const [status, setStatus] = useState<ReminderPushStatus>('checking')
  const [diagnostics, setDiagnostics] = useState<ReminderPushDiagnostics>(EMPTY_PUSH_DIAGNOSTICS)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const repairAttempted = useRef(false)

  const runDiagnostics = useCallback(async (): Promise<ReminderPushDiagnostics> => {
    const standalone = isStandalone()
    const notificationsSupported = pushSupported()

    if (!notificationsSupported) {
      const result = { ...EMPTY_PUSH_DIAGNOSTICS, standalone, notificationsSupported: false, permission: 'unsupported' as const }
      setDiagnostics(result)
      return result
    }

    const permission = Notification.permission
    let registration: ServiceWorkerRegistration | undefined
    try {
      registration = await withTimeout(getRegistration(), 5000, 'timeout')
    } catch {
      registration = undefined
    }

    const serviceWorkerRegistered = Boolean(registration)
    const serviceWorkerActive = Boolean(registration?.active)

    let subscriptionExists = false
    let endpoint: string | null = null
    if (registration) {
      try {
        const subscription = await withTimeout(registration.pushManager.getSubscription(), 5000, 'timeout')
        subscriptionExists = Boolean(subscription)
        endpoint = subscription?.endpoint ?? null
      } catch {
        subscriptionExists = false
      }
    }

    let subscriptionSavedServerSide = false
    let schedulerHealthy: boolean | null = null
    try {
      const supabase = createClient()
      const [subResult, heartbeatResult] = await Promise.all([
        endpoint
          ? withTimeout(
              supabase.from('ema_push_subscriptions').select('id').eq('endpoint', endpoint).maybeSingle(),
              6000,
              'timeout'
            )
          : Promise.resolve({ data: null, error: null }),
        withTimeout(
          supabase.from('ema_cron_heartbeat').select('last_run_at').eq('id', true).maybeSingle(),
          6000,
          'timeout'
        ),
      ])
      subscriptionSavedServerSide = Boolean((subResult as { data: { id: string } | null }).data)
      const lastRunAt = (heartbeatResult as { data: { last_run_at: string } | null }).data?.last_run_at
      schedulerHealthy = lastRunAt ? Date.now() - new Date(lastRunAt).getTime() < SCHEDULER_STALE_AFTER_MS : false
    } catch {
      subscriptionSavedServerSide = false
      schedulerHealthy = null
    }

    const result: ReminderPushDiagnostics = {
      standalone,
      notificationsSupported,
      permission,
      serviceWorkerRegistered,
      serviceWorkerActive,
      subscriptionExists,
      subscriptionSavedServerSide,
      schedulerHealthy,
    }
    setDiagnostics(result)
    return result
  }, [])

  const getActiveRegistration = useCallback(async (): Promise<ServiceWorkerRegistration> => {
    const existing = await withTimeout(
      navigator.serviceWorker.getRegistration('/'),
      5000,
      'Der EMA Service Worker konnte nicht gelesen werden.'
    )
    const registration =
      existing ??
      (await withTimeout(
        navigator.serviceWorker.register('/sw.js', { scope: '/' }),
        10000,
        'Der EMA Service Worker konnte nicht registriert werden.'
      ))

    const ready = await withTimeout(
      navigator.serviceWorker.ready,
      15000,
      'Der EMA Service Worker wird noch aktiviert. Bitte EMA kurz schließen, erneut öffnen und noch einmal versuchen.'
    )
    void registration

    if (!ready.active) {
      throw new Error('Der EMA Service Worker ist noch nicht aktiv. Bitte EMA kurz schließen und erneut öffnen.')
    }
    return ready
  }, [])

  const ensureSubscriptionSaved = useCallback(async (registration: ServiceWorkerRegistration) => {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!key) throw new Error('Push ist serverseitig noch nicht konfiguriert.')

    let subscription = await withTimeout(
      registration.pushManager.getSubscription(),
      5000,
      'Die vorhandene Push-Registrierung konnte nicht gelesen werden.'
    )
    if (!subscription) {
      subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(key),
        }),
        15000,
        'Das iPhone konnte die Push-Registrierung nicht abschließen. Bitte EMA schließen, erneut öffnen und noch einmal versuchen.'
      )
    }

    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      throw new Error('Push-Registrierung konnte nicht gespeichert werden.')
    }

    const supabase = createClient()
    const authResult = await withTimeout(
      supabase.auth.getUser(),
      8000,
      'Die EMA-Anmeldung antwortet nicht. Bitte EMA neu öffnen und erneut anmelden.'
    )
    const user = authResult.data.user
    if (!user) throw new Error('Push-Registrierung konnte nicht gespeichert werden.')

    const saveResult = await withTimeout(
      supabase.from('ema_push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth_key: json.keys.auth,
          device_label: navigator.userAgent.slice(0, 180),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' }
      ),
      10000,
      'Die Push-Registrierung konnte nicht in EMA gespeichert werden.'
    )
    if (saveResult.error) throw saveResult.error
  }, [])

  const enable = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      if (!pushSupported()) {
        throw new Error(
          'Push wird auf diesem Gerät nicht unterstützt. Öffne EMA auf dem iPhone über das Symbol auf dem Home-Bildschirm.'
        )
      }

      const registration = await getActiveRegistration()

      let permission = Notification.permission
      if (permission === 'default') {
        permission = await withTimeout(
          Notification.requestPermission(),
          12000,
          'iOS hat die Mitteilungsabfrage nicht geöffnet. Bitte EMA als App vom Home-Bildschirm starten und erneut versuchen.'
        )
      }
      if (permission !== 'granted') {
        throw new Error(
          permission === 'denied'
            ? 'Mitteilungen sind für EMA blockiert. Bitte in den iPhone-Einstellungen unter Mitteilungen → EMA erlauben.'
            : 'Mitteilungen wurden nicht erlaubt.'
        )
      }

      await ensureSubscriptionSaved(registration)
      await runDiagnostics()
      setStatus('active')
    } catch (error) {
      console.error('EMA push activation failed', error)
      setMessage(error instanceof Error ? error.message : 'Erinnerungen konnten nicht aktiviert werden.')
      await runDiagnostics()
      setStatus('inactive')
    } finally {
      setBusy(false)
    }
  }, [busy, ensureSubscriptionSaved, getActiveRegistration, runDiagnostics])

  const disable = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const registration = await getActiveRegistration()
      const subscription = await withTimeout(
        registration.pushManager.getSubscription(),
        5000,
        'Die Push-Registrierung konnte nicht gelesen werden.'
      )
      if (subscription) {
        const endpoint = subscription.endpoint
        await withTimeout(subscription.unsubscribe(), 8000, 'Die Push-Registrierung konnte nicht entfernt werden.')
        await withTimeout(
          createClient().from('ema_push_subscriptions').delete().eq('endpoint', endpoint),
          10000,
          'Die Push-Registrierung konnte serverseitig nicht entfernt werden.'
        )
      }
      await runDiagnostics()
      setStatus('inactive')
      setMessage('Erinnerungen wurden auf diesem Gerät deaktiviert.')
    } catch (error) {
      console.error('EMA push deactivation failed', error)
      setMessage(error instanceof Error ? error.message : 'Erinnerungen konnten nicht deaktiviert werden.')
    } finally {
      setBusy(false)
    }
  }, [busy, getActiveRegistration, runDiagnostics])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const result = await runDiagnostics()
      if (cancelled) return

      // Silent repair: permission is already granted (no user gesture needed
      // for PushManager.subscribe() in that case), the worker is active, but
      // either the subscription or its server-side record is missing. Fix it
      // without bothering the user or re-asking for permission.
      if (needsSilentRepair(result) && !repairAttempted.current) {
        repairAttempted.current = true
        try {
          const registration = await getActiveRegistration()
          if (cancelled) return
          await ensureSubscriptionSaved(registration)
          const repaired = await runDiagnostics()
          if (cancelled) return
          setStatus(isPushFullyActive(repaired) ? 'active' : 'inactive')
          return
        } catch (error) {
          console.error('EMA push silent repair failed', error)
        }
      }

      if (cancelled) return
      setStatus(isPushFullyActive(result) ? 'active' : 'inactive')
    }

    bootstrap()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    status,
    diagnostics,
    message,
    busy,
    reason: reasonForInactivePush(diagnostics),
    enable,
    disable,
  }
}
