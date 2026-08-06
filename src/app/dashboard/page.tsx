import Link from 'next/link'
import {
  ArrowRight,
  BatteryCharging,
  Clock3,
  FilePlus2,
  FolderOpen,
  Inbox,
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
    <div className="ema-kpi-card group relative min-w-0 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(31,42,68,0.09)] transition duration-200 hover:-translate-y-1 hover:border-[#5CB800]/35 hover:shadow-[0_18px_44px_rgba(31,42,68,0.13)] md:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#5CB800]/8 blur-2xl transition group-hover:bg-[#5CB800]/15" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#667085] md:text-xs">{title}</p>
          <p className="mt-3 break-words text-[clamp(1.3rem,5vw,2.25rem)] font-extrabold leading-tight tracking-[-0.04em] text-[#172033]">{value}</p>
          <p className="mt-2 text-[11px] leading-snug text-[#667085] md:text-sm">{subtitle}</p>
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

const aiActions = [
  { href: '/ai', label: 'Investor finden' },
  { href: '/project-analysis', label: 'Projekt analysieren' },
  { href: '/expose', label: 'Exposé erstellen' },
  { href: '/ai', label: 'Wirtschaftlichkeit prüfen' },
]

const submissionStatusLabels: Record<string, string> = {
  eingereicht: 'Neu eingereicht',
  in_pruefung: 'In Prüfung',
  rueckfrage: 'Rückfrage offen',
}

function formatActivityDate(value: string | null | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(value))
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
  const activities = [
    ...partnerSubmissions.map((submission: any) => ({
      id: `submission-${submission.id}`,
      label: submission.project_name,
      detail: `Einreichung · ${submissionStatusLabels[submission.status] ?? submission.status}`,
      date: submission.submitted_at,
      href: `/partner-submissions/${submission.id}`,
    })),
    ...(projectListsResult.data ?? []).slice(0, 5).map((list: any, index: number) => ({
      id: `list-${list.country}-${index}`,
      label: `${list.country || 'Projektübersicht'}`,
      detail: `${Number(list.project_count ?? 0)} Projekte · ${formatPowerFromKwp(Number(list.total_kwp ?? 0))}`,
      date: list.created_at,
      href: '/projects',
    })),
  ]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 5)

  return (
    <div className="min-h-full w-full max-w-full overflow-x-hidden bg-[#F4F6F8] pb-8 text-[#172033] md:mx-auto md:max-w-[1480px]">
      <section className="relative isolate min-h-[16rem] overflow-hidden bg-[#1F2A44] md:min-h-[25rem]">
        <div className="absolute inset-0">
          <img src="/hero-dashboard.png" alt="Erneuerbare Energieprojekte" className="h-full w-full object-cover object-center opacity-100" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1F2A44]/80 via-[#1F2A44]/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F4F6F8]/20 via-transparent to-[#1F2A44]/15" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#F4F6F8] via-[#F4F6F8]/35 to-transparent" />
        </div>
        <div className="relative z-10 flex min-h-[16rem] items-center px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)] md:min-h-[25rem] md:px-8 md:pb-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-[#1F2A44]/45 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#5CB800] shadow-[0_0_14px_rgba(92,184,0,0.9)]" />
              <TimeGreeting />
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] text-white sm:text-5xl md:text-6xl">
              Willkommen zurück,<br />
              <span className="text-[#76d22a]">Ali Ünlüer</span> 👋
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90 md:text-base">Dein Portfolio, deine Projekte und alle wichtigen Aktivitäten auf einen Blick.</p>
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

      <div className="space-y-6 px-4 pt-5 md:px-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-5">
          <KpiCard title="Projekte gesamt" value={totalProjects} subtitle={`${activeProjects} aktiv · ${projectsInLists} in Übersichten`} icon={<FolderOpen className="h-5 w-5" />} />
          <KpiCard title="PV-Leistung" value={formatPowerFromKwp(totalKwp)} subtitle={`${formatPowerFromKwp(activeKwp)} aktiv · ${formatPowerFromKwp(listKwp)} weitere`} icon={<Zap className="h-5 w-5" />} />
          <KpiCard title="BESS-Kapazität" value={formatEnergyFromMwh(totalBess)} subtitle="Aktive Speicherkapazität" icon={<BatteryCharging className="h-5 w-5" />} />
        </div>

        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_22px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl md:p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#76d22a]">Schnellzugriff</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-[#172033] md:text-2xl">Was möchtest du erledigen?</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {quickActions.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="group flex min-h-24 flex-col justify-between rounded-[1.2rem] border border-slate-200 bg-[#F8FAFB] p-3.5 transition hover:-translate-y-0.5 hover:border-[#5CB800]/30 hover:bg-[#5CB800]/7">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5CB800]/10 text-[#76d22a] transition group-hover:bg-[#5CB800]/18"><Icon className="h-5 w-5" /></span>
                <span className="mt-4 text-sm font-extrabold text-[#172033]">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="ema-ai-panel relative overflow-hidden rounded-[1.6rem] border border-[#5CB800]/20 bg-gradient-to-br from-[#17231b] via-[#172028] to-[#111820] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-6">
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#5CB800]/12 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/12 text-[#76d22a] shadow-[0_0_34px_rgba(92,184,0,0.12)]"><Sparkles className="h-6 w-6" /></span>
                <div><p className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#76d22a]">EMA AI</p><h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-white">Frag EMA …</h2></div>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90">Nutze die vorhandenen KI-Funktionen für Recherche, Analyse und nächste Schritte. Schreibende Aktionen bleiben bestätigungspflichtig.</p>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                {aiActions.map((action) => <Link key={`${action.href}-${action.label}`} href={action.href} className="rounded-xl border border-white/8 bg-white/[0.045] px-3 py-3 text-sm font-bold text-[#172033] transition hover:border-[#5CB800]/30 hover:bg-[#5CB800]/8">{action.label}</Link>)}
              </div>
              <Link href="/ai" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#5CB800] px-4 py-2.5 text-sm font-extrabold text-[#0f151a]">EMA AI öffnen <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#76d22a]">Live aus EMA</p><h2 className="mt-1 text-xl font-extrabold text-[#172033]">Aktivitäten</h2></div><Clock3 className="h-5 w-5 text-slate-500" /></div>
            <div className="mt-4 space-y-2.5">
              {activities.length > 0 ? activities.map((activity) => (
                <Link key={activity.id} href={activity.href} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#F8FAFB] p-3 transition hover:border-[#5CB800]/25 hover:bg-white/[0.05]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#5CB800] shadow-[0_0_12px_rgba(92,184,0,0.7)]" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[#172033]">{activity.label}</p><p className="mt-0.5 truncate text-xs text-[#667085]">{activity.detail}</p></div>
                  <span className="shrink-0 text-[10px] font-bold text-slate-500">{formatActivityDate(activity.date)}</span>
                </Link>
              )) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-[#667085]">Noch keine aktuellen Aktivitäten vorhanden.</p>}
            </div>
          </section>
        </div>

        {partnerSubmissions.length > 0 && (
          <section className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(0,0,0,0.2)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-[#5CB800]/10 to-transparent p-5">
              <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800] text-[#0f151a]"><Inbox className="h-5 w-5" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#76d22a]">Partnerportal</p><h2 className="mt-1 text-xl font-extrabold text-[#172033]">Neue Einreichungen</h2></div></div>
              <Link href="/partner-submissions" className="inline-flex items-center gap-1 text-sm font-extrabold text-[#76d22a]">Alle anzeigen <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {partnerSubmissions.map((submission: any) => (
                <Link key={submission.id} href={`/partner-submissions/${submission.id}`} className="flex items-center gap-3 rounded-[1.2rem] border border-slate-200 bg-[#F8FAFB] p-3.5 transition hover:border-[#5CB800]/25 hover:bg-white/[0.055]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5CB800]/10 text-[#76d22a]"><Inbox className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-extrabold text-[#172033]">{submission.project_name}</p><span className="rounded-full bg-[#5CB800]/10 px-2 py-1 text-[10px] font-extrabold text-[#76d22a]">{submissionStatusLabels[submission.status] ?? submission.status}</span></div><p className="mt-1 truncate text-xs text-[#667085]">{partnerNames.get(submission.partner_user_id) || 'Vertriebspartner'} · {[submission.location_city, submission.location_state].filter(Boolean).join(', ') || 'Standort offen'}</p></div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#76d22a]" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.92fr_1.45fr]">
          <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_22px_70px_rgba(0,0,0,0.2)] md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold text-[#172033] md:text-2xl">Aktuelle Projekte</h2><p className="mt-1 text-sm text-[#667085]">Land auswählen und Projekte aufklappen.</p></div><Link href="/projects" className="flex items-center gap-1 text-sm font-extrabold text-[#76d22a]">Alle <ArrowRight className="h-4 w-4" /></Link></div>
            <CountryProjectsAccordion projects={projects} projectLists={(projectListsResult.data ?? []) as any[]} />
          </section>

          <section className="ema-map-card overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_14px_40px_rgba(31,42,68,0.10)] md:p-5">
            <ProjectMap projects={projects as any[]} projectLists={(projectListsResult.data ?? []) as any[]} />
          </section>
        </div>
      </div>
    </div>
  )
}
