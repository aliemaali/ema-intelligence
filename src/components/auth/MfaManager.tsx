'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { KeyRound, Loader2, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type VerifiedFactor = {
  id: string
  friendly_name?: string
  created_at: string
}

type Enrollment = {
  factorId: string
  qrCode: string
  secret: string
}

function qrCodeSource(value: string) {
  if (value.startsWith('data:')) return value
  return `data:image/svg+xml;utf-8,${encodeURIComponent(value)}`
}

export function MfaManager() {
  const [factors, setFactors] = useState<VerifiedFactor[]>([])
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  const loadFactors = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) toast.error('Zwei-Faktor-Schutz konnte nicht geladen werden.')
    setFactors((data?.totp ?? []) as VerifiedFactor[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadFactors()
  }, [loadFactors])

  async function startEnrollment() {
    setWorking(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'EMA Authenticator',
      issuer: 'EMA Enterprise',
    })

    if (error || !data?.totp) {
      toast.error(error?.message || 'Authenticator konnte nicht eingerichtet werden.')
      setWorking(false)
      return
    }

    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    setCode('')
    setWorking(false)
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enrollment || !/^\d{6}$/.test(code)) return

    setWorking(true)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code,
    })

    if (error) {
      toast.error('Der Code ist ungültig oder abgelaufen.')
      setWorking(false)
      return
    }

    toast.success('Zwei-Faktor-Schutz ist aktiv.')
    setEnrollment(null)
    setCode('')
    await loadFactors()
    window.location.reload()
  }

  async function removeFactor(factorId: string) {
    if (!window.confirm('Zwei-Faktor-Schutz für dieses Gerät wirklich entfernen?')) return
    setWorking(true)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) toast.error('Der Authenticator konnte nicht entfernt werden.')
    else toast.success('Authenticator wurde entfernt.')
    await loadFactors()
    setWorking(false)
  }

  return (
    <section className="premium-surface rounded-[1.6rem] border p-5 sm:p-6" style={{ '--premium-rgb': '117, 238, 53' } as React.CSSProperties}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#5CB800]">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold text-white">Zwei-Faktor-Schutz</h2>
          <p className="premium-muted mt-1 text-sm leading-relaxed">
            Kostenlos mit einer Authenticator-App. Nach der Aktivierung reicht ein Passwort allein nicht mehr aus.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="premium-muted mt-5 flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Sicherheitsstatus wird geladen …
        </div>
      ) : factors.length > 0 ? (
        <div className="mt-5 space-y-3">
          {factors.map((factor) => (
            <div key={factor.id} className="premium-success flex items-center gap-3 rounded-2xl border px-4 py-3">
              <Smartphone className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{factor.friendly_name || 'Authenticator-App'}</p>
                <p className="text-xs text-[#b9f99a]">Aktiv und bei jeder Passwort-Anmeldung erforderlich</p>
              </div>
              <button
                type="button"
                onClick={() => void removeFactor(factor.id)}
                disabled={working}
                className="rounded-xl p-2 text-[#b9f99a] hover:bg-white/10 disabled:opacity-50"
                aria-label="Authenticator entfernen"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      ) : enrollment ? (
        <form onSubmit={verifyEnrollment} className="mt-5 space-y-4 rounded-2xl border border-[#75ee35]/25 bg-white/[.045] p-4 sm:p-5">
          <p className="font-semibold text-white">QR-Code mit deiner Authenticator-App scannen</p>
          <Image
            src={qrCodeSource(enrollment.qrCode)}
            alt="QR-Code für den EMA Zwei-Faktor-Schutz"
            width={192}
            height={192}
            unoptimized
            className="mx-auto h-48 w-48 rounded-xl bg-white p-2"
          />
          <details className="premium-muted text-sm">
            <summary className="cursor-pointer font-medium">Schlüssel manuell eingeben</summary>
            <code className="mt-2 block break-all rounded-lg border border-white/10 bg-[#020e20]/70 p-3 text-xs text-slate-100">{enrollment.secret}</code>
          </details>
          <label className="block">
            <span className="text-sm font-semibold text-white">Sechsstelliger Bestätigungscode</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              className="form-input mt-2 text-center text-xl tracking-[0.35em]"
            />
          </label>
          <button type="submit" disabled={working || code.length !== 6} className="btn-primary w-full">
            {working ? 'Code wird geprüft …' : 'Aktivieren'}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => void startEnrollment()}
          disabled={working}
          className="btn-primary mt-5 inline-flex items-center gap-2"
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Kostenlos aktivieren
        </button>
      )}
    </section>
  )
}
