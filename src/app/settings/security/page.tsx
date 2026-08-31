import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { PasskeyManager } from '@/components/auth/PasskeyManager'
import { MfaManager } from '@/components/auth/MfaManager'

export default function SecuritySettingsPage() {
  return (
    <main className="premium-page min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/settings"
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[.055] px-4 py-2.5 text-sm font-extrabold text-slate-100 shadow-sm transition hover:border-[#75ee35]/30 hover:bg-white/[.085]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück zu Einstellungen
        </Link>

        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#75ee35]/20 bg-[#75ee35]/10 p-3 text-[#91f15e] shadow-[0_0_28px_rgba(117,238,53,.10)]">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-[-.04em] text-white">
                Sicherheit
              </h1>
              <p className="premium-muted mt-1 text-sm">
                Face ID, Passkeys und sichere Anmeldung verwalten
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-5">
          <MfaManager />
          <PasskeyManager />
        </div>
      </div>
    </main>
  )
}
