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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), ms)),
  ])
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  return withTimeout(
    navigator.serviceWorker.register('/sw.js', { scope: '/' }),
    8000,
    'Der EMA Service Worker antwortet nicht. Bitte EMA vollständig schließen und erneut öffnen.',
  )
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

    getRegistration()
      .then(async registration => setActive(Boolean(await registration.pushManager.getSubscription())))
      .catch(error => {
        console.error('EMA service worker registration failed', error)
        setMessage('EMA konnte die iPhone-Erinnerungen noch nicht vorbereiten. Bitte die App einmal schließen und erneut öffnen.')
      })
  }, [])

  async function enable() {
    setMessage('')
    if (!supported) {
      setMessage('Push wird auf diesem Gerät nicht unterstützt. Öffne EMA auf dem iPhone über das Symbol auf dem Home-Bildschirm.')
      return
    }

    setBusy(true)
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!key) throw new Error('Push ist serverseitig noch nicht konfiguriert.')

      const registration = await getRegistration()

      const permission = await withTimeout(
        Notification.requestPermission(),
        12000,
        'iOS hat die Mitteilungsabfrage nicht geöffnet. Bitte EMA als App vom Home-Bildschirm starten und erneut versuchen.',
      )
      if (permission !== 'granted') {
        setMessage(permission === 'denied'
          ? 'Mitteilungen sind für EMA blockiert. Bitte in den iPhone-Einstellungen unter Mitteilungen → EMA erlauben.'
          : 'Mitteilungen wurden nicht erlaubt.')
        return
      }

      let subscription = await withTimeout(
        registration.pushManager.getSubscription(),
        8000,
        'Die vorhandene Push-Registrierung konnte nicht gelesen werden.',
      )
      subscription ??= await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(key),
        }),
        15000,
        'Das iPhone konnte die Push-Registrierung nicht abschließen. Bitte EMA schließen, erneut öffnen und noch einmal versuchen.',
      )

      const json = subscription.toJSON()
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Push-Registrierung konnte nicht gespeichert werden.')
      }

      const { error } = await supabase.from('ema_push_subscriptions').upsert({
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
        device_label: navigator.userAgent.slice(0, 180),
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,endpoint' })

      if (error) throw error
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
    setMessage('')
    setBusy(true)
    try {
      const registration = await getRegistration()
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        setActive(false)
        return
      }
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      await createClient().from('ema_push_subscriptions').delete().eq('endpoint', endpoint)
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
