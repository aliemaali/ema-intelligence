'use client'

import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function decodeKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - value.length % 4) % 4)
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

async function getActiveRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await withTimeout(
    navigator.serviceWorker.getRegistration('/'),
    5000,
    'Der EMA Service Worker konnte nicht gelesen werden.',
  )

  const registration = existing ?? await withTimeout(
    navigator.serviceWorker.register('/sw.js', { scope: '/' }),
    10000,
    'Der EMA Service Worker konnte nicht registriert werden.',
  )

  // A newly installed worker can be present but not yet active. PushManager.subscribe()
  // rejects in that state on iOS with "requires an active service worker".
  if (!registration.active) {
    await withTimeout(
      navigator.serviceWorker.ready,
      15000,
      'Der EMA Service Worker wird noch aktiviert. Bitte EMA kurz schließen, erneut öffnen und noch einmal versuchen.',
    )
  }

  const ready = await withTimeout(
    navigator.serviceWorker.ready,
    10000,
    'Der EMA Service Worker ist noch nicht bereit.',
  )

  if (!ready.active) {
    throw new Error('Der EMA Service Worker ist noch nicht aktiv. Bitte EMA kurz schließen und erneut öffnen.')
  }

  return ready
}

export function PushControls() {
  const [supported, setSupported] = useState(false)
  const [active, setActive] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const canPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(canPush)
    if (!canPush) return

    getActiveRegistration()
      .then(registration => withTimeout(
        registration.pushManager.getSubscription(),
        5000,
        'Die Push-Registrierung konnte nicht gelesen werden.',
      ))
      .then(subscription => setActive(Boolean(subscription)))
      .catch(error => {
        console.error('EMA service worker registration failed', error)
        setMessage('EMA bereitet die iPhone-Erinnerungen vor. Falls die Aktivierung nicht klappt, App einmal schließen und erneut öffnen.')
      })
  }, [])

  async function enable() {
    if (busy) return
    setMessage('Push wird vorbereitet …')
    if (!supported) {
      setMessage('Push wird auf diesem Gerät nicht unterstützt. Öffne EMA auf dem iPhone über das Symbol auf dem Home-Bildschirm.')
      return
    }

    setBusy(true)
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!key) throw new Error('Push ist serverseitig noch nicht konfiguriert.')

      setMessage('Service Worker wird aktiviert …')
      const registration = await getActiveRegistration()

      setMessage('Mitteilungsberechtigung wird geprüft …')
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await withTimeout(
          Notification.requestPermission(),
          12000,
          'iOS hat die Mitteilungsabfrage nicht geöffnet. Bitte EMA als App vom Home-Bildschirm starten und erneut versuchen.',
        )
      }
      if (permission !== 'granted') {
        setMessage(permission === 'denied'
          ? 'Mitteilungen sind für EMA blockiert. Bitte in den iPhone-Einstellungen unter Mitteilungen → EMA erlauben.'
          : 'Mitteilungen wurden nicht erlaubt.')
        return
      }

      setMessage('iPhone wird für Push registriert …')
      let subscription = await withTimeout(
        registration.pushManager.getSubscription(),
        5000,
        'Die vorhandene Push-Registrierung konnte nicht gelesen werden.',
      )
      if (!subscription) {
        subscription = await withTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodeKey(key),
          }),
          15000,
          'Das iPhone konnte die Push-Registrierung nicht abschließen. Bitte EMA schließen, erneut öffnen und noch einmal versuchen.',
        )
      }

      const json = subscription.toJSON()
      const supabase = createClient()

      setMessage('EMA-Anmeldung wird geprüft …')
      const authResult = await withTimeout(
        supabase.auth.getUser(),
        8000,
        'Die EMA-Anmeldung antwortet nicht. Bitte EMA neu öffnen und erneut anmelden.',
      )
      const user = authResult.data.user
      if (!user || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Push-Registrierung konnte nicht gespeichert werden.')
      }

      setMessage('Push-Registrierung wird gespeichert …')
      const saveResult = await withTimeout(
        supabase.from('ema_push_subscriptions').upsert({
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth_key: json.keys.auth,
          device_label: navigator.userAgent.slice(0, 180),
          last_seen_at: new Date().toISOString(),
        }, { onConflict: 'user_id,endpoint' }),
        10000,
        'Die Push-Registrierung konnte nicht in EMA gespeichert werden. Bitte erneut versuchen.',
      )

      if (saveResult.error) throw saveResult.error
      setActive(true)
      setMessage('Erinnerungen sind auf diesem Gerät aktiviert.')
    } catch (error) {
      console.error('EMA push activation failed', error)
      setMessage(error instanceof Error ? error.message : 'Erinnerungen konnten nicht aktiviert werden. Bitte versuche es erneut.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (busy) return
    setMessage('Erinnerungen werden deaktiviert …')
    setBusy(true)
    try {
      const registration = await getActiveRegistration()
      const subscription = await withTimeout(
        registration.pushManager.getSubscription(),
        5000,
        'Die Push-Registrierung konnte nicht gelesen werden.',
      )
      if (!subscription) {
        setActive(false)
        setMessage('Erinnerungen sind auf diesem Gerät bereits deaktiviert.')
        return
      }
      const endpoint = subscription.endpoint
      await withTimeout(subscription.unsubscribe(), 8000, 'Die Push-Registrierung konnte nicht entfernt werden.')
      await withTimeout(
        createClient().from('ema_push_subscriptions').delete().eq('endpoint', endpoint),
        10000,
        'Die Push-Registrierung konnte serverseitig nicht entfernt werden.',
      )
      setActive(false)
      setMessage('Erinnerungen wurden auf diesem Gerät deaktiviert.')
    } catch (error) {
      console.error('EMA push deactivation failed', error)
      setMessage(error instanceof Error ? error.message : 'Erinnerungen konnten nicht deaktiviert werden. Bitte versuche es erneut.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <BellRing className="h-5 w-5" />
        <h2 className="text-xl font-semibold">iPhone-Erinnerungen</h2>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Aktiviere Mitteilungen einmal pro Gerät. Auf dem iPhone funktioniert Web Push mit der zum Home-Bildschirm hinzugefügten EMA-App.
      </p>
      <button
        onClick={active ? disable : enable}
        disabled={busy}
        className="mt-4 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? 'Bitte warten …' : active ? 'Erinnerungen deaktivieren' : 'Erinnerungen aktivieren'}
      </button>
      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
    </section>
  )
}
