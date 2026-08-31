'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function MfaChallenge({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.mfa.listFactors().then(({ data, error: factorError }) => {
      const factor = data?.totp?.[0]
      if (factorError || !factor) setError('Kein bestätigter Authenticator gefunden.')
      else setFactorId(factor.id)
      setLoading(false)
    })
  }, [])

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!factorId || !/^\d{6}$/.test(code)) return
    setVerifying(true)
    setError(null)

    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (verifyError) {
      setError('Der Code ist ungültig oder abgelaufen.')
      setVerifying(false)
      return
    }

    router.replace(redirectTo)
    router.refresh()
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_28px_90px_rgba(7,20,47,.13)] sm:p-9">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#5CB800]">
          <ShieldCheck className="h-8 w-8" />
        </span>
        <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[.22em] text-[#5CB800]">EMA Sicherheit</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#07142F]">Anmeldung bestätigen</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Gib den aktuellen Code aus deiner Authenticator-App ein.</p>
      </div>

      {loading ? (
        <div className="mt-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#5CB800]" /></div>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-4">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            required
            autoFocus
            aria-label="Authenticator-Code"
            className="form-input text-center text-2xl tracking-[0.4em]"
          />
          {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={verifying || !factorId || code.length !== 6} className="btn-primary w-full">
            {verifying ? 'Code wird geprüft …' : 'Sicher anmelden'}
          </button>
        </form>
      )}
    </div>
  )
}
