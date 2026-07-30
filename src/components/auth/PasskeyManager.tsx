'use client'

import { useCallback, useEffect, useState } from 'react'
import { Fingerprint, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type Passkey = {
  id: string
  friendly_name?: string | null
  created_at: string
  last_used_at?: string | null
}

function formatDate(value?: string | null) {
  if (!value) return 'Noch nicht verwendet'

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadPasskeys = useCallback(async () => {
    setLoading(true)

    try {
      const supabase = createClient()
      const auth = supabase.auth as any
      const { data, error } = await auth.passkey.list()

      if (error) throw error
      setPasskeys(Array.isArray(data) ? data : [])
    } catch (error: any) {
      toast.error(error?.message || 'Passkeys konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPasskeys()
  }, [loadPasskeys])

  async function registerPasskey() {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      toast.error('Dieser Browser unterstützt keine Passkeys.')
      return
    }

    setRegistering(true)

    try {
      const supabase = createClient()
      const auth = supabase.auth as any
      const { error } = await auth.registerPasskey()

      if (error) throw error

      toast.success('Passkey wurde erfolgreich eingerichtet.')
      await loadPasskeys()
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') {
        toast.error('Face ID / Passkey wurde abgebrochen.')
      } else {
        toast.error(error?.message || 'Passkey konnte nicht eingerichtet werden.')
      }
    } finally {
      setRegistering(false)
    }
  }

  async function deletePasskey(passkeyId: string) {
    const confirmed = window.confirm(
      'Diesen Passkey wirklich entfernen? Der Passwort-Login bleibt weiterhin möglich.'
    )

    if (!confirmed) return

    setDeletingId(passkeyId)

    try {
      const supabase = createClient()
      const auth = supabase.auth as any
      const { error } = await auth.passkey.delete({ passkeyId })

      if (error) throw error

      toast.success('Passkey wurde entfernt.')
      setPasskeys((current) => current.filter((passkey) => passkey.id !== passkeyId))
    } catch (error: any) {
      toast.error(error?.message || 'Passkey konnte nicht entfernt werden.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-[#5CB800]/10 p-3 text-[#5CB800]">
            <Fingerprint className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[#1F2A44]">Face ID & Passkeys</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Melde dich auf unterstützten Geräten ohne Passwort an. Auf dem iPhone wird dafür Face ID verwendet.
              Biometrische Daten verlassen dein Gerät nicht.
            </p>

            <button
              type="button"
              onClick={registerPasskey}
              disabled={registering}
              className="btn-primary mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {registering ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Fingerprint className="h-4 w-4" aria-hidden="true" />
              )}
              {registering ? 'Face ID wird geöffnet…' : 'Passkey einrichten'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1F2A44]">Registrierte Geräte</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Verwalte die Geräte und Passwortmanager, auf denen ein EMA-Passkey gespeichert ist.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadPasskeys()}
            disabled={loading}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white text-[#1F2A44] hover:bg-muted disabled:opacity-50"
            aria-label="Passkeys aktualisieren"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="flex min-h-28 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
              Passkeys werden geladen…
            </div>
          ) : passkeys.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium text-[#1F2A44]">Noch kein Passkey eingerichtet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Richte oben deinen ersten Passkey ein. Der bisherige Passwort-Login bleibt verfügbar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="flex items-center gap-3 rounded-xl border px-4 py-4"
                >
                  <div className="rounded-lg bg-[#1F2A44]/5 p-2.5 text-[#1F2A44]">
                    <Fingerprint className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#1F2A44]">
                      {passkey.friendly_name || 'Passkey'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Erstellt: {formatDate(passkey.created_at)} · Zuletzt verwendet: {formatDate(passkey.last_used_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void deletePasskey(passkey.id)}
                    disabled={deletingId === passkey.id}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    aria-label="Passkey entfernen"
                  >
                    {deletingId === passkey.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Entferne deinen letzten Passkey nur, wenn du dein EMA-Passwort noch kennst. Der Passwort-Login bleibt während der Testphase bewusst aktiv.
      </div>
    </div>
  )
}
