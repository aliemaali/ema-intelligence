import Link from 'next/link'
import { ArrowRight, BatteryCharging, FolderOpen, Inbox, Layers, Zap } from 'lucide-react'
import { CountryProjectsAccordion } from '@/components/dashboard/CountryProjectsAccordion'
import { ProjectMap } from '@/components/dashboard/ProjectMap'
import { TimeGreeting } from '@/components/dashboard/TimeGreeting'
import { getProjects } from '@/lib/actions/project.actions'
import { formatEnergyFromMwh, formatPowerFromKwp } from '@/lib/format/power'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Dashboard' }

function KpiCard({ title, value, subtitle, icon, tone }: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
  tone: 'blue' | 'green' | 'violet'
}) {
  const toneClass = {
    blue: 'from-blue-600/12 via-white to-blue-50/70 text-blue-700 border-blue-600/10',
    green: 'from-[#5CB800]/18 via-white to-green-50 text-[#2F8A00] border-[#5CB800]/10',
    violet: 'from-violet-600/12 via-white to-violet-50 text-violet-700 border-violet-600/10',
  }[tone]

  return (
    <div className={`premium-lift relative min-w-0 overflow-hidden rounded-[1.15rem] border bg-gradient-to-br ${toneClass} p-2.5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] md:rounded-[1.45rem] md:p-5`}>
      <div className="absolute right-0 top-0 h-16 w-16 translate-x-5 -translate-y-5 rounded-full bg-current opacity-[0.07] md:h-24 md:w-24" />
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 shadow-sm ring-1 ring-black/5 md:h-12 md:w-12">{icon}</div>
      <p className="mt-3 min-h-[26px] text-[9px] font-extrabold uppercase leading-tight tracking-[0.12em] text-slate-500 md:mt-4 md:text-xs">{title}</p>
      <p className="mt-1 min-w-0 overflow-hidden whitespace-nowrap text-[clamp(1.05rem,5.3vw,1.65rem)] font-extrabold leading-none tracking-[-0.05em] text-[#07142F] md:mt-2 md:text-3xl">{value}</p>
      <p className="mt-1 text-[10px] leading-tight text-muted-foreground md:text-sm">{subtitle}</p>
    </div>
  )
}

const submissionStatusLabels: Record<string, string> = {
  eingereicht: 'Neu eingereicht',
  in_pruefung: 'In Prüfung',
  rueckfrage: 'Rückfrage offen',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: currentProfile } = user
    ? await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null }
  const displayName =
    currentProfile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    currentProfile?.email ||
    user?.email ||
    'Nutzer'

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
    <div className="w-full max-w-full space-y-6 overflow-x-hidden md:mx-auto md:max-w-[1480px] md:space-y-7">
      <section className="relative isolate min-h-[31rem] overflow-hidden bg-[#1F2A44] md:min-h-[25rem]">
        <div className="absolute inset-0">
          <img src="/hero-dashboard.png" alt="Erneuerbare Energieprojekte" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1F2A44]/82 via-[#1F2A44]/38 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1F2A44]/20 via-transparent to-[#1F2A44]/20" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/85 via-white/20 to-transparent" />
        </div>
        <div className="relative z-10 flex min-h-[31rem] items-center px-5 pb-10 pt-6 md:min-h-[25rem] md:px-8 md:pb-10 md:pt-10">
          <div className="max-w-3xl -translate-y-4 md:translate-y-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-[#1F2A44]/48 px-3 py-1.5 text-white backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#5CB800] shadow-[0_0_14px_rgba(92,184,0,0.9)]" />
              <TimeGreeting />
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] text-white sm:text-5xl md:text-6xl">
              Willkommen zurück,<br />
              <span className="text-[#76d22a]">{displayName}</span> 👋
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90 md:text-base">Dein Portfolio, deine Projekte und alle wichtigen Aktivitäten auf einen Blick.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/projects/new" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-[#0f151a] shadow-[0_16px_35px_rgba(92,184,0,0.24)] transition hover:-translate-y-0.5 hover:bg-[#6bcf15]">+ Neues Projekt</Link>
              <Link href="/projects" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/45 bg-white px-5 py-3 text-sm font-extrabold text-[#07142F] shadow-[0_12px_28px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-white/95">Alle Projekte <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 px-3 sm:gap-4 md:gap-5 md:px-0">
        <KpiCard title="Projekte gesamt" value={totalProjects} subtitle={`${activeProjects} aktiv · ${projectsInLists} in Übersichten`} tone="blue" icon={<FolderOpen className="h-5 w-5 md:h-6 md:w-6" />} />
        <KpiCard title="PV-Leistung" value={formatPowerFromKwp(totalKwp)} subtitle={`${formatPowerFromKwp(activeKwp)} aktiv · ${formatPowerFromKwp(listKwp)} weitere`} tone="green" icon={<Zap className="h-5 w-5 md:h-6 md:w-6" />} />
        <KpiCard title="BESS-Kapazität" value={formatEnergyFromMwh(totalBess)} subtitle="Aktive Speicherkapazität" tone="violet" icon={<BatteryCharging className="h-5 w-5 md:h-6 md:w-6" />} />
      </div>

      {partnerSubmissions.length > 0 && (
        <section className="mx-3 overflow-hidden rounded-[2rem] border border-[#5CB800]/20 bg-white shadow-[0_16px_40px_rgba(31,42,68,0.07)] md:mx-0">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-[#5CB800]/12 via-white to-white p-5 md:p-6">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800] text-white"><Inbox className="h-5 w-5" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">Partnerportal</p><h2 className="mt-1 text-xl font-extrabold text-[#07142F] md:text-2xl">Neue Einreichungen</h2></div></div>
            <Link href="/partner-submissions" className="inline-flex items-center gap-1 text-sm font-extrabold text-[#2F8A00]">Alle anzeigen <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-2 md:p-5">
            {partnerSubmissions.map((submission: any) => (
              <Link key={submission.id} href={`/partner-submissions/${submission.id}`} className="premium-lift flex items-center gap-3 rounded-[1.3rem] border border-slate-200 bg-white p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1F2A44]/8 text-[#1F2A44]"><Inbox className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-extrabold text-[#07142F]">{submission.project_name}</p><span className="rounded-full bg-[#5CB800]/10 px-2 py-1 text-[10px] font-extrabold text-[#2F8A00]">{submissionStatusLabels[submission.status] ?? submission.status}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{partnerNames.get(submission.partner_user_id) || 'Vertriebspartner'} · {[submission.location_city, submission.location_state].filter(Boolean).join(', ') || 'Standort offen'}</p></div>
                <ArrowRight className="h-5 w-5 shrink-0 text-[#2F8A00]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 px-3 md:px-0 xl:grid-cols-[0.92fr_1.45fr]">
        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-extrabold text-[#07142F]">Aktuelle Projekte</h2><p className="mt-1 text-sm text-muted-foreground">Land auswählen und Projekte aufklappen.</p></div><Link href="/projects" className="flex items-center gap-1 text-sm font-extrabold text-[#2F8A00]">Alle <ArrowRight className="h-4 w-4" /></Link></div>
          <CountryProjectsAccordion projects={projects} projectLists={(projectListsResult.data ?? []) as any[]} />
        </div>

        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-extrabold text-[#07142F]">Projektstandorte</h2><p className="mt-1 text-sm text-muted-foreground">Standorte und Projektverteilung.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold text-[#2F8A00]"><Layers className="h-4 w-4" /> {mapProjects.length}</span></div>
          <ProjectMap projects={mapProjects} />
        </div>
      </div>
    </div>
  )
}
