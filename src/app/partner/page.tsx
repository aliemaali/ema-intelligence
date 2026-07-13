import { ShieldCheck } from 'lucide-react'
import { redirect } from 'next/navigation'
import { PartnerSignOutButton } from '@/components/partner/PartnerSignOutButton'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Partner Portal' }

export default async function PartnerDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company')
    .eq('id', user.id)
    .maybeSingle()

  const firstName = profile?.full_name?.trim().split(' ')[0] || 'Partner'
  const company = profile?.company?.trim()

  return (
    <main className="min-h-screen bg-[#F7F9FC] text-[#1F2A44]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="flex items-center justify-between gap-4 py-3">
          <img
            src="/ema-logo.jpeg"
            alt="EMA Enterprise"
            className="h-12 w-auto rounded-xl object-contain sm:h-14"
          />
          <PartnerSignOutButton />
        </header>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_20px_60px_rgba(31,42,68,0.08)] sm:p-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">
              <ShieldCheck className="h-4 w-4" /> EMA Partner Portal
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.04em] text-[#1F2A44] sm:text-5xl">
              Willkommen, {firstName}.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              Dein Partnerzugang ist aktiv. Du befindest dich in der getrennten, geschützten Partner-Oberfläche von EMA Intelligence.
            </p>
            {company && (
              <p className="mt-3 text-sm font-semibold text-slate-500">Unternehmen: {company}</p>
            )}
          </div>
        </section>

        <footer className="mt-auto pt-10 text-center text-xs text-slate-400">
          EMA Enterprise GmbH · Connecting Capital with Energy Infrastructure.
        </footer>
      </div>
    </main>
  )
}
