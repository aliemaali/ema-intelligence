'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fingerprint, Info, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const CANONICAL_HOSTNAME = 'app.ema-enterprise.de'

function getPasskeyErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Face ID oder die Passkey-Anmeldung wurde abgebrochen.'
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes('passkey_disabled')) {
      return 'Passkeys sind für EMA noch nicht in Supabase aktiviert.'
    }

    if (message.includes('rp id') || message.includes('invalid for this domain')) {
      return 'Face ID ist nur auf app.ema-enterprise.de verfügbar. Nutze im Preview bitte E-Mail und Passwort.'
    }

    return 'Die Passkey-Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut oder nutze dein Passwort.'
  }

  return 'Die Passkey-Anmeldung konnte nicht gestartet werden.'
}

export function PasskeyLoginButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isCanonicalHost = typeof window !== 'undefined' && window.location.hostname === CANONICAL_HOSTNAME

  const handlePasskeyLogin = async () => {
    if (!isCanonicalHost) {
      setErrorMessage('Preview-Modus: Bitte melde dich unten mit E-Mail und Passwort an. Face ID bleibt nur auf der Produktionsdomain aktiv.')
      return
    }

    if (!window.PublicKeyCredential) {
      setErrorMessage('Dieses Gerät oder dieser Browser unterstützt keine Passkeys.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPasskey()

      if (error) throw error

      router.replace('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Passkey login failed', error)
      setErrorMessage(getPasskeyErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handlePasskeyLogin}
        disabled={isLoading}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#1F2A44]/20 bg-white px-4 text-base font-semibold text-[#1F2A44] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : isCanonicalHost ? (
          <Fingerprint className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Info className="h-5 w-5" aria-hidden="true" />
        )}
        {isLoading
          ? 'Passkey wird geprüft …'
          : isCanonicalHost
            ? 'Mit Face ID / Passkey anmelden'
            : 'Preview: Anmeldung mit Passwort'}
      </button>

      {errorMessage && (
        <p role="alert" className="break-words px-2 text-center text-sm leading-5 text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
