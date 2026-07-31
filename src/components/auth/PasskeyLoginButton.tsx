'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fingerprint, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function getPasskeyErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Face ID oder die Passkey-Anmeldung wurde abgebrochen.'
  }

  if (error instanceof Error) {
    if (error.message.includes('passkey_disabled')) {
      return 'Passkeys sind für EMA noch nicht in Supabase aktiviert.'
    }

    return error.message
  }

  return 'Die Passkey-Anmeldung konnte nicht gestartet werden.'
}

export function PasskeyLoginButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handlePasskeyLogin = async () => {
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
        ) : (
          <Fingerprint className="h-5 w-5" aria-hidden="true" />
        )}
        {isLoading ? 'Passkey wird geprüft …' : 'Mit Face ID / Passkey anmelden'}
      </button>

      {errorMessage && (
        <p role="alert" className="text-center text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
