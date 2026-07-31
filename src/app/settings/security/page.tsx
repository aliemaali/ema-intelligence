import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { PasskeyManager } from '@/components/auth/PasskeyManager'

export default function SecuritySettingsPage() {
  return (
    <main className="min-h-screen bg-[#F7F9FC] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/settings"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#1F2A44] hover:opacity-75"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück zu Einstellungen
        </Link>

        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#1F2A44] p-3 text-white">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#1F2A44]">
                Sicherheit
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Face ID, Passkeys und sichere Anmeldung verwalten
              </p>
            </div>
          </div>
        </header>

        <PasskeyManager />
      </div>
    </main>
  )
}
