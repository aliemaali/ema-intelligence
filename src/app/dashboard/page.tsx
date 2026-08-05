import Link from 'next/link'
import {
  ArrowRight,
  BatteryCharging,
  FilePlus2,
  FolderOpen,
  Inbox,
  Layers,
  ListPlus,
  Plus,
  Sparkles,
  UserPlus,
  Zap,
} from 'lucide-react'
import { CountryProjectsAccordion } from '@/components/dashboard/CountryProjectsAccordion'
import { ProjectMap } from '@/components/dashboard/ProjectMap'
import { TimeGreeting } from '@/components/dashboard/TimeGreeting'
import { getProjects } from '@/lib/actions/project.actions'
import { formatEnergyFromMwh, formatPowerFromKwp } from '@/lib/format/power'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Dashboard' }

function KpiCard({ title, value, subtitle, icon }: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
}) {
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-[1.4rem] border border-white/8 bg-[#1c222a]/92 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-[#5CB800]/35 hover:shadow-[0_24px_70px_rgba(0,0,0,0.34)] md:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#5CB800]/8 blur-2xl transition group-hover:bg-[#5CB800]/15" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400 md:text-xs">{title}</p>
          <p className="mt-3 truncate text-[clamp(1.35rem,5vw,2.25rem)] font-extrabold leading-none tracking-[-0.05em] text-white">{value}</p>
          <p className="mt-2 text-[11px] leading-snug text-slate-400 md:text-sm">{subtitle}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#5CB800]/20 bg-[#5CB800]/10 text-[#76d22a] shadow-[0_0_28px_rgba(92,184,0,0.08)]">
          {icon}
        </span>
      </div>
    </div>
  )
}

const quickActions = [
  { href: '/projects/new', label: 'Neues Projekt', icon: Plus },
  { href: '/projects/lists/new', label: 'Projektliste', icon: ListPlus },
  { href: '/investors/new', label: 'Investor', icon: UserPlus },
  { href: '/documents', label: 'Dokument', icon: FilePlus2 },
  { href: '/project-analysis', label: 'Projektanalyse', icon: Sparkles },
  { href: '/ai', label: 'EMA AI', icon: Zap },
]

const submissionStatusLabels: Record<string, string> = {
  eingereicht: 'Neu eingereicht',
  in_pruefung: 'In Prüfung',
  rueckfrage: 'Rückfrage offen',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const [projects, submissionsResult, projectListsResult] = await Promise.all([
    getProjects({}),
    supabase
      .from('project_submissions')
      .select('id, partner_user_id, project_name, project_type, location_city, location_state, status, submitted_at, pv_kwp, bess_mwh')
      .in('status', ['eingereicht', 'in_pruefung', 'rueckfrage'])
      .order('submitted_at', { ascending: false })
      .limit(5),
    supabase
      .from('country_project_lists')
      .select('country, project_count, total_kwp, created_at')
      .order('created_at', { ascending: false }),
  ])

  const partnerSubmissions = submissionsResult.data ?? []
  const partnerIds = Array.from(new Set(partnerSubmissions.map((item: any) => item.partner_user_id).filter(Boolean)))
  const partnerNames = new Map<string, string>()
  if (partnerIds.length > 0) {
    const { data: partners } = await supabase.from('profiles').select('id, full_name, company, email').in('id', partnerIds)
    for (const partner of partners ?? []) partnerNames.set(partner.id, partner.company || partner.full_name || partner.email || 'Vertriebspartner')
  }

  const latestListByCountry = new Map<string, { count: number; totalKwp: number }>()
  for (const list of projectListsResult.data ?? []) {
    const country = String((list as any).country || '').trim()
    if (country && !latestListByCountry.has(country)) {
      latestListByCountry.set(country, {
        count: Number((list as any).project_count ?? 0),
        totalKwp: Number((list as any).total_kwp ?? 0),
      })
    }
  }

  const projectsInLists = Array.from(latestListByCountry.values()).reduce((sum, item) => sum + item.count, 0)
  const listKwp = Array.from(latestListByCountry.values()).reduce((sum, item) => sum + item.totalKwp, 0)
  const activeProjects = projects.length
  const totalProjects = activeProjects + projectsInLists
  const activeKwp = projects.reduce((sum: number, project: any) => sum + Number(project.pv_kwp ?? project.pv_mwp ?? 0), 0)
  const totalKwp = activeKwp + listKwp
  const totalBess = projects.reduce((sum: number, project: any) => sum + Number(project.bess_mwh ?? 0), 0)
  const mapProjects = projects.filter((project: any) => project.location_city || project.location_state).slice(0, 50)

  return (
    <div className="min-h-full w-full max-w-full overflow-x-hidden bg-[#11161c] pb-8 text-white md:mx-auto md:max-w-[1480px]">
      <section className="relative isolate overflow-hidden border-b border-white/5 bg-[#11161c]">
        <div className="absolute inset-0">
          <img src="/hero-dashboard.png" alt="Erneuerbare Energieprojekte" className="h-full w-full object-cover object-center opacity-75" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#11161c] via-[#11161c]/80 to-[#11161c]/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#11161c] via-transparent to-black/20" />
        </div>
        <div className="relative z-10 px-5 pb-8 pt-8 md:px-8 md:pb-10 md:pt-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-bold text-slate-300 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#5CB800] shadow-[0_0_14px_rgba(92,184,0,0.9)]" />
              <TimeGreeting />
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] text-white sm:text-5xl md:text-6xl">
              Willkommen zurück,<br />
              <span className="text-[#76d22a]">Ali Ünlüer</span> 👋
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">Dein Portfolio, deine Projekte und alle wichtigen Aktivitäten auf einen Blick.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/projects/new" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-[#0f151a] shadow-[0_16px_35px_rgba(92,184,0,0.24)] transition hover:-translate-y-0.5 hover:bg-[#6bcf15]">
                <Plus className="h-4 w-4" /> Neues Projekt
              </Link>
              <Link href="/projects" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-5 py-3 text-sm font-extrabold text-white backdrop-blur-md transition hover:bg-white/12">
                Alle Projekte <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6 px-4 pt-5 md:px-8 md:pt-7">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-5">
          <KpiCard title="Projekte gesamt" value={totalProjects} subtitle={`${activeProjects} aktiv · ${projectsInLists} in Übersichten`} icon={<FolderOpen className="h-5 w-5" />} />
          <KpiCard title="PV-Leistung" value={formatPowerFromKwp(totalKwp)} subtitle={`${formatPowerFromKwp(activeKwp)} aktiv · ${formatPowerFromKwp(listKwp)} weitere`} icon={<Zap className="h-5 w-5" />} />
          <KpiCard title="BESS-Kapazität" value={formatEnergyFromMwh(totalBess)} subtitle="Aktive Speicherkapazität" icon={<BatteryCharging className="h-5 w-5" />} />
        </div>

        <section className="rounded-[1.6rem] border border-white/8 bg-[#1a2028]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl md:p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#76d22a]">Schnellzugriff</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-white md:text-2xl">Was möchtest du erledigen?</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {quickActions.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="group flex min-h-24 flex-col justify-between rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-3.5 transition hover:-translate-y-0.5 hover:border-[#5CB800]/30 hover:bg-[#5CB800]/7">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5CB800]/10 text-[#76d22a] transition group-hover:bg-[#5CB800]/18"><Icon className="h-5 w-5" /></span>
                <span className="mt-4 text-sm font-extrabold text-slate-100">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {partnerSubmissions.length > 0 && (
          <section className="overflow-hidden rounded-[1.6rem] border border-[#5CB800]/18 bg-[#1a2028]/95 shadow-[0_22px_70px_rgba(0,0,0,0.2)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/7 bg-gradient-to-r from-[#5CB800]/10 to-transparent p-5">
              <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800] text-[#0f151a]"><Inbox className="h-5 w-5" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#76d22a]">Partnerportal</p><h2 className="mt-1 text-xl font-extrabold text-white">Neue Einreichungen</h2></div></div>
              <Link href="/partner-submissions" className="inline-flex items-center gap-1 text-sm font-extrabold text-[#76d22a]">Alle anzeigen <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {partnerSubmissions.map((submission: any) => (
                <Link key={submission.id} href={`/partner-submissions/${submission.id}`} className="flex items-center gap-3 rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-3.5 transition hover:border-[#5CB800]/25 hover:bg-white/[0.055]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5CB800]/10 text-[#76d22a]"><Inbox className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-extrabold text-white">{submission.project_name}</p><span className="rounded-full bg-[#5CB800]/10 px-2 py-1 text-[10px] font-extrabold text-[#76d22a]">{submissionStatusLabels[submission.status] ?? submission.status}</span></div><p className="mt-1 truncate text-xs text-slate-400">{partnerNames.get(submission.partner_user_id) || 'Vertriebspartner'} · {[submission.location_city, submission.location_state].filter(Boolean).join(', ') || 'Standort offen'}</p></div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#76d22a]" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.92fr_1.45fr]">
          <section className="rounded-[1.6rem] border border-white/8 bg-[#1a2028]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.2)] md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold text-white md:text-2xl">Aktuelle Projekte</h2><p className="mt-1 text-sm text-slate-400">Land auswählen und Projekte aufklappen.</p></div><Link href="/projects" className="flex items-center gap-1 text-sm font-extrabold text-[#76d22a]">Alle <ArrowRight className="h-4 w-4" /></Link></div>
            <CountryProjectsAccordion projects={projects} projectLists={(projectListsResult.data ?? []) as any[]} />
          </section>

          <section className="overflow-hidden rounded-[1.6rem] border border-white/8 bg-[#1a2028]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.2)] md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold text-white md:text-2xl">Projektstandorte</h2><p className="mt-1 text-sm text-slate-400">Standorte und Projektverteilung.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold text-[#76d22a]"><Layers className="h-4 w-4" /> {mapProjects.length}</span></div>
            <div className="overflow-hidden rounded-[1.3rem]"><ProjectMap projects={mapProjects} /></div>
          </section>
        </div>
      </div>
    </div>
  )
}
