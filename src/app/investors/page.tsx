import Link from 'next/link'
import { ArrowRight, Building2, Search, Sparkles, UserPlus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getInvestors, getInvestorDashboardKpis } from '@/lib/actions/investorActions'
import { InvestorBoard } from '@/components/investors-crm/InvestorBoard'
import { InvestorProfileImportButton } from '@/components/investors-crm/InvestorProfileImportButton'

export const dynamic = 'force-dynamic'

export default async function InvestorsPage() {
  const supabase = await createClient()
  const [investorsResult, kpisResult, projectsResult] = await Promise.all([
    getInvestors({ sortBy: 'last_contact_at', sortDirection: 'desc' }),
    getInvestorDashboardKpis(),
    supabase.from('projects').select('id, project_name').order('project_name'),
  ])

  const initialInvestors = investorsResult.success ? investorsResult.data : []
  const initialKpis = kpisResult.success
    ? kpisResult.data
    : {
        totalInvestors: 0,
        activeInvestors: 0,
        totalTicketVolumeEur: 0,
        contactedLast30Days: 0,
        mostRecentContactAt: null,
      }
  const projects = (projectsResult.data ?? []).map((project) => ({
    id: project.id,
    name: project.project_name,
  }))

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#0b1118] pb-28 text-white">
      <section className="relative isolate overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(92,184,0,0.16),transparent_28rem),radial-gradient(circle_at_18%_0%,rgba(31,42,68,0.72),transparent_34rem),linear-gradient(180deg,#101821_0%,#0b1118_100%)]" />
        <div className="absolute -right-28 top-8 h-72 w-72 rounded-full border border-[#5CB800]/12 bg-[#5CB800]/5 blur-3xl" />
        <div className="relative mx-auto max-w-[1480px] px-4 pb-10 pt-7 md:px-8 md:pb-14 md:pt-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#8dde38] backdrop-blur-xl">
                <Sparkles className="h-4 w-4" /> Investoren-CRM
              </span>
              <h1 className="mt-5 text-4xl font-extrabold tracking-[-0.055em] text-white sm:text-5xl md:text-6xl">
                Kapital, Kontakte und
                <span className="block text-[#76d500]">Deals im Blick.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Verwalte Investoren, Suchprofile und Projektzuordnungen in einer ruhigen, klaren Arbeitsoberfläche.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/investors/new" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-[#07110a] shadow-[0_16px_36px_rgba(92,184,0,0.24)] transition hover:-translate-y-0.5 hover:bg-[#6bcf15]">
                <UserPlus className="h-4 w-4" /> Neuer Investor
              </Link>
              <Link href="/investors?view=all" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.055] px-5 py-3 text-sm font-extrabold text-white backdrop-blur-xl transition hover:bg-white/[0.09]">
                Alle Kontakte <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.045] p-4 backdrop-blur-xl">
              <Users className="h-5 w-5 text-[#76d500]" />
              <p className="mt-4 text-2xl font-extrabold tracking-[-0.04em]">{initialKpis.totalInvestors}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">Investoren gesamt</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.045] p-4 backdrop-blur-xl">
              <Building2 className="h-5 w-5 text-[#76d500]" />
              <p className="mt-4 text-2xl font-extrabold tracking-[-0.04em]">{initialKpis.activeInvestors}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">Aktive Kontakte</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.045] p-4 backdrop-blur-xl">
              <Search className="h-5 w-5 text-[#76d500]" />
              <p className="mt-4 text-2xl font-extrabold tracking-[-0.04em]">{initialKpis.contactedLast30Days}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">Kontakte in 30 Tagen</p>
            </div>
            <div className="rounded-[1.35rem] border border-[#5CB800]/18 bg-[#5CB800]/8 p-4 backdrop-blur-xl">
              <Sparkles className="h-5 w-5 text-[#8dde38]" />
              <p className="mt-4 text-2xl font-extrabold tracking-[-0.04em]">{projects.length}</p>
              <p className="mt-1 text-xs font-bold text-slate-300">Projekte zuordenbar</p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1480px] px-4 pt-6 md:px-8 md:pt-8">
        {!investorsResult.success && (
          <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
            Investoren konnten nicht geladen werden: {investorsResult.error}
          </div>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#76d500]">CRM-Arbeitsbereich</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-white md:text-3xl">Investoren und Suchprofile</h2>
          </div>
          <InvestorProfileImportButton />
        </div>

        <section className="overflow-hidden rounded-[1.65rem] border border-white/8 bg-[#151d26]/95 p-1 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl md:p-2">
          <InvestorBoard initialInvestors={initialInvestors} initialKpis={initialKpis} projects={projects} />
        </section>
      </main>
    </div>
  )
}
