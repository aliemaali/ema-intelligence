import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { redirect } from 'next/navigation'
import { PartnerProjectSubmissionForm } from '@/components/partner/PartnerProjectSubmissionForm'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Neues Projekt einreichen' }

export default async function NewPartnerProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="min-h-screen bg-[#F7F9FC] text-[#1F2A44]">
      <div className="mx-auto w-full max-w-3xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="flex items-center justify-between gap-4 py-3">
          <Link href="/partner" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold shadow-sm">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Link>
          <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-11 w-auto rounded-xl object-contain" />
        </header>

        <section className="py-7">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">
            <ShieldCheck className="h-4 w-4" /> Sichere Einreichung
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">Neues Projekt</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            Projektdaten erfassen und Exposé, Pläne oder weitere Unterlagen direkt an EMA Enterprise übermitteln.
          </p>
        </section>

        <PartnerProjectSubmissionForm userId={user.id} />
      </div>
    </main>
  )
}
