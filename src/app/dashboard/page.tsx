import Link from 'next/link'
import { ArrowRight, BatteryCharging, FolderOpen, Inbox, Layers, MapPin, Zap } from 'lucide-react'
import { ProjectMap } from '@/components/dashboard/ProjectMap'
import { TimeGreeting } from '@/components/dashboard/TimeGreeting'
import { getProjects } from '@/lib/actions/project.actions'
import { formatProjectLocationLabel } from '@/lib/projects/location'
import { formatEnergyFromMwh, formatPowerFromKwp, formatPowerFromMw } from '@/lib/format/power'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Dashboard' }

function formatKwp(value: number | null | undefined) {
  if (!value) return '–'
  return formatPowerFromKwp(value)
}

function formatMw(value: number | null | undefined) {
  if (!value) return '–'
  return formatPowerFromMw(value)
}

function formatMwh(value: number | null | undefined) {
  if (!value) return '–'
  return formatEnergyFromMwh(value)
}

function getProjectPower(project: any) {
  if (project.project_type === 'rechenzentrum') {
    const parts = []
    if (project.data_center_grid_mw) parts.push(`${formatMw(project.data_center_grid_mw)} Netz`)
    if (project.data_center_it_mw) parts.push(`${formatMw(project.data_center_it_mw)} IT`)
    return parts.join(' / ') || 'Leistung offen'
  }
  if (project.project_type === 'sonstiges') return 'Individuell'
  const parts = []
  if (project.pv_mwp) parts.push(formatKwp(project.pv_mwp))
  if (project.bess_mwh) parts.push(formatMwh(project.bess_mwh))
  return parts.join(' / ') || 'Leistung offen'
}

function getLocation(project: any) {
  return formatProjectLocationLabel(project.location_country, project.location_city, project.location_state)
}

type ProjectKind = 'dach' | 'freiflaeche' | 'bess' | 'hybrid' | 'wind' | 'rechenzentrum' | 'sonstiges'

function getProjectKind(project: any): ProjectKind {
  if (project.project_type === 'bess') return 'bess'
  if (project.project_type === 'hybrid') return 'hybrid'
  if (project.project_type === 'pv_dach') return 'dach'
  if (project.project_type === 'wind') return 'wind'
  if (project.project_type === 'rechenzentrum') return 'rechenzentrum'
  if (project.project_type === 'sonstiges') return 'sonstiges'
  return 'freiflaeche'
}

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

function ProjectImage({ kind, imageUrl, projectName }: { kind: ProjectKind; imageUrl?: string | null; projectName: string }) {
  const fallbackImage = kind === 'dach'
    ? '/project-dach.svg'
    : kind === 'bess'
      ? '/project-bess.svg'
      : kind === 'rechenzentrum'
        ? '/hero-datacenter.svg'
        : kind === 'sonstiges'
          ? '/hero-generic-project.svg'
          : kind === 'wind'
            ? '/hero-wind.svg'
            : '/project-freiflaeche.svg'
  const badge = kind === 'bess' ? 'BESS' : kind === 'hybrid' ? 'HYB' : kind === 'rechenzentrum' ? 'RZ' : kind === 'sonstiges' ? 'SON' : kind === 'wind' ? 'WIND' : 'PV'

  return (
    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-24 sm:w-32">
      <img src={imageUrl || fallbackImage} alt={`Projektbild ${projectName}`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-extrabold text-[#1F2A44] shadow-sm">{badge}</div>
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
      .select('country, project_count, created_at')
      .order('created_at', { ascending: false }),
  ])

  const partnerSubmissions = submissionsResult.data ?? []
  const partnerIds = Array.from(new Set(partnerSubmissions.map((item: any) => item.partner_user_id).filter(Boolean)))
  const partnerNames = new Map<string, string>()
  if (partnerIds.length > 0) {
    const { data: partners } = await supabase.from('profiles').select('id, full_name, company, email').in('id', partnerIds)
    for (const partner of partners ?? []) partnerNames.set(partner.id, partner.company || partner.full_name || partner.email || 'Vertriebspartner')
  }

  const latestListByCountry = new Map<string, number>()
  for (const list of projectListsResult.data ?? []) {
    const country = String((list as any).country || '').trim()
    if (country && !latestListByCountry.has(country)) latestListByCountry.set(country, Number((list as any).project_count ?? 0))
  }
  const projectsInLists = Array.from(latestListByCountry.values()).reduce((sum, count) => sum + count, 0)
  const activeProjects = projects.length
  const totalProjects = activeProjects + projectsInLists
  const totalKwp = projects.reduce((sum: number, project: any) => sum + Number(project.pv_mwp ?? 0), 0)
  const totalBess = projects.reduce((sum: number, project: any) => sum + Number(project.bess_mwh ?? 0), 0)
  const latestProjects = projects.slice(0, 5)
  const mapProjects = projects.filter((project: any) => project.location_city || project.location_state).slice(0, 50)

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden md:mx-auto md:max-w-[1480px] md:space-y-7">
      <section className="relative mx-3 overflow-hidden rounded-[2rem] bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)] md:mx-0">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] overflow-hidden md:block"><img src="/hero-dashboard.png" alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-white via-white/35 to-transparent" /></div>
        <div className="relative z-10 max-w-2xl px-6 py-7 md:max-w-[56%] md:px-8 md:py-10">
          <TimeGreeting />
          <h1 className="mt-1 text-4xl font-extrabold leading-[1] tracking-[-0.05em] text-[#07142F] sm:text-5xl md:text-5xl">Willkommen zurück,<br /><span className="text-[#2F8A00]">Ali Ünlüer</span> 👋</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">Dein aktueller Überblick über Projekte, Einreichungen und Standorte.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3"><Link href="/projects/new" className="btn-primary px-5 py-3">+ Neues Projekt</Link><Link href="/projects" className="btn-secondary px-5 py-3">Alle Projekte</Link></div>
        </div>
        <div className="relative h-44 md:hidden"><img src="/hero-dashboard.png" alt="Energieprojekte" className="h-full w-full object-cover" /><div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent" /></div>
      </section>

      <div className="grid grid-cols-3 gap-2 px-3 sm:gap-4 md:gap-5 md:px-0">
        <KpiCard title="Projekte gesamt" value={totalProjects} subtitle={`${activeProjects} aktiv · ${projectsInLists} in Listen`} tone="blue" icon={<FolderOpen className="h-5 w-5 md:h-6 md:w-6" />} />
        <KpiCard title="PV-Leistung" value={formatPowerFromKwp(totalKwp)} subtitle="Aktive PV-Leistung" tone="green" icon={<Zap className="h-5 w-5 md:h-6 md:w-6" />} />
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
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-extrabold text-[#07142F]">Aktuelle Projekte</h2><p className="mt-1 text-sm text-muted-foreground">Zuletzt aktive Projekte.</p></div><Link href="/projects" className="flex items-center gap-1 text-sm font-extrabold text-[#2F8A00]">Alle <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="space-y-3">
            {latestProjects.length === 0 && <p className="rounded-2xl bg-muted/50 px-4 py-6 text-sm text-muted-foreground">Noch keine Projekte vorhanden.</p>}
            {latestProjects.map((project: any) => (
              <Link key={project.id} href={`/projects/${project.id}/overview`} className="premium-lift block rounded-[1.4rem] border border-border/80 bg-white p-3 shadow-sm">
                <div className="flex gap-3"><ProjectImage kind={getProjectKind(project)} imageUrl={project.project_image_url} projectName={project.project_name || project.project_number || 'Projekt'} /><div className="min-w-0 flex-1 py-0.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-extrabold text-[#07142F]">{project.project_name || project.project_number}</p><p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{project.project_number}</p></div><ArrowRight className="h-5 w-5 shrink-0 text-[#2F8A00]" /></div><p className="mt-2 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {getLocation(project)}</p><p className="mt-1 truncate text-xs font-extrabold text-[#132060]">{getProjectPower(project)}</p></div></div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-extrabold text-[#07142F]">Projektstandorte</h2><p className="mt-1 text-sm text-muted-foreground">Standorte und Projektverteilung.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold text-[#2F8A00]"><Layers className="h-4 w-4" /> {mapProjects.length}</span></div>
          <ProjectMap projects={mapProjects} />
        </div>
      </div>
    </div>
  )
}