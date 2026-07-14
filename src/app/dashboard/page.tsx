import Link from 'next/link'
import {
  ArrowRight,
  BatteryCharging,
  Bell,
  FolderOpen,
  Inbox,
  Layers,
  MapPin,
  Search,
  Zap,
} from 'lucide-react'
import { ProjectMap } from '@/components/dashboard/ProjectMap'
import { TimeGreeting } from '@/components/dashboard/TimeGreeting'
import { getProjects } from '@/lib/actions/project.actions'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Dashboard' }

function formatKwp(value: number | null | undefined) {
  if (!value) return '–'
  return `${Number(value).toLocaleString('de-DE')} kWp`
}

function formatMwh(value: number | null | undefined) {
  if (!value) return '–'
  return `${Number(value).toLocaleString('de-DE')} MWh`
}

function formatMoney(value: number | null | undefined) {
  if (!value) return '–'
  return `${Number(value).toLocaleString('de-DE')} €`
}

function getProjectPower(project: any) {
  const parts = []
  if (project.pv_mwp) parts.push(formatKwp(project.pv_mwp))
  if (project.bess_mwh) parts.push(formatMwh(project.bess_mwh))
  return parts.join(' / ') || '–'
}

function getPurchasePrice(project: any) {
  return project.purchase_price ?? project.deal_purchase_price ?? project.active_deal_purchase_price ?? null
}

function getFeedInType(project: any) {
  const raw = project.feed_in_type ?? project.einspeiseart ?? project.feed_in_model ?? project.offtake_type ?? null
  if (!raw) return 'Voll'
  const value = String(raw).toLowerCase()
  if (value.includes('ppa')) return 'PPA'
  if (value.includes('voll')) return 'Voll'
  return String(raw)
}

function getLocation(project: any) {
  return [project.location_city, project.location_state].filter(Boolean).join(', ') || 'Standort offen'
}

function getProjectKind(project: any) {
  if (project.project_type === 'bess') return 'bess'
  if (project.project_type === 'hybrid') return 'hybrid'
  return 'pv'
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
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
    <div className={`premium-lift relative overflow-hidden rounded-[1.15rem] border bg-gradient-to-br ${toneClass} p-2.5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] md:rounded-[1.45rem] md:p-6 md:shadow-[0_18px_50px_rgba(15,23,42,0.08)]`}>
      <div className="absolute right-0 top-0 h-16 w-16 translate-x-5 -translate-y-5 rounded-full bg-current opacity-[0.07] md:h-28 md:w-28 md:translate-x-8 md:-translate-y-8" />
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 shadow-sm ring-1 ring-black/5 md:h-14 md:w-14">
        {icon}
      </div>
      <p className="mt-4 min-h-[28px] text-[9px] font-extrabold uppercase leading-tight tracking-[0.14em] text-slate-500 md:mt-6 md:text-xs md:tracking-[0.18em]">{title}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#07142F] md:mt-3 md:text-4xl">{value}</p>
      <p className="mt-1 text-[10px] leading-tight text-muted-foreground md:text-sm">{subtitle}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200/70 md:mt-5">
        <div className="h-full w-2/3 rounded-full bg-current opacity-70" />
      </div>
    </div>
  )
}

function SolarHeroArt() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-0 hidden w-[54%] overflow-hidden rounded-r-[2.2rem] md:block">
      <img
        src="/hero-dashboard.png"
        alt=""
        className="h-full w-full object-cover object-center saturate-[1.18] contrast-[1.05] brightness-[1.02]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
    </div>
  )
}

function MobileHeroImage() {
  return (
    <div className="relative -mx-1 mt-7 block h-60 overflow-hidden rounded-[1.8rem] md:hidden">
      <img
        src="/hero-dashboard.png"
        alt="Solarfeld mit Windkraft und Batteriespeicher"
        className="h-full w-full object-cover object-center saturate-[1.18] contrast-[1.05] brightness-[1.02]"
      />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
    </div>
  )
}

function ProjectImage({ kind }: { kind: string }) {
  const gradient = kind === 'bess'
    ? 'from-blue-100 via-slate-100 to-slate-200'
    : kind === 'hybrid'
    ? 'from-violet-100 via-green-50 to-blue-100'
    : 'from-green-100 via-emerald-50 to-blue-100'

  return (
    <div className={`relative h-24 w-28 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} sm:h-32 sm:w-40`}>
      <div className="absolute inset-x-0 bottom-0 h-10 bg-green-500/20" />
      <div className="absolute left-4 top-8 h-12 w-20 rotate-[-10deg] rounded bg-blue-700/70 shadow-md" />
      <div className="absolute left-7 top-11 h-1 w-16 rotate-[-10deg] bg-white/50" />
      <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-[#2F8A00] shadow-sm">
        {kind === 'bess' ? 'BESS' : kind === 'hybrid' ? 'HYB' : 'PV'}
      </div>
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
  const [projects, submissionsResult] = await Promise.all([
    getProjects({}),
    supabase
      .from('project_submissions')
      .select('id, partner_user_id, project_name, project_type, location_city, location_state, status, submitted_at, pv_kwp, bess_mwh')
      .in('status', ['eingereicht', 'in_pruefung', 'rueckfrage'])
      .order('submitted_at', { ascending: false })
      .limit(5),
  ])

  const partnerSubmissions = submissionsResult.data ?? []
  const partnerIds = Array.from(new Set(partnerSubmissions.map((item: any) => item.partner_user_id).filter(Boolean)))
  const partnerNames = new Map<string, string>()

  if (partnerIds.length > 0) {
    const { data: partners } = await supabase
      .from('profiles')
      .select('id, full_name, company, email')
      .in('id', partnerIds)

    for (const partner of partners ?? []) {
      partnerNames.set(partner.id, partner.company || partner.full_name || partner.email || 'Vertriebspartner')
    }
  }

  const totalProjects = projects.length
  const totalKwp = projects.reduce((sum: number, p: any) => sum + Number(p.pv_mwp ?? 0), 0)
  const totalBess = projects.reduce((sum: number, p: any) => sum + Number(p.bess_mwh ?? 0), 0)

  const latestProjects = projects.slice(0, 5)
  const mapProjects = projects.filter((project: any) => project.location_city || project.location_state).slice(0, 50)

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-7 md:mx-auto md:max-w-[1480px] md:space-y-8">
      <section className="relative overflow-hidden px-3 pt-8 md:rounded-[2.2rem] md:bg-white/80 md:p-8 md:shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <SolarHeroArt />

        <div className="relative z-10 max-w-2xl md:max-w-[52%]">
          <div className="mb-6 hidden items-center justify-between md:flex">
            <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-20 w-auto object-contain" />
            <div className="flex items-center gap-2">
              <button className="mobile-header-action" type="button"><Search className="h-5 w-5" /></button>
              <button className="mobile-header-action relative" type="button"><Bell className="h-5 w-5" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#5CB800]" /></button>
            </div>
          </div>

          <TimeGreeting />
          <h1 className="text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] text-[#07142F] sm:text-5xl md:text-5xl xl:text-6xl">
            Willkommen zurück,<br />
            <span className="text-[#2F8A00]">Ali Ünlüer</span> 👋
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Hier ist der aktuelle Überblick über deine Projekte und Standorte.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/projects/new" className="btn-primary px-5 py-3 text-base">
              + Neues Projekt erstellen
            </Link>
            <Link href="/projects" className="btn-secondary hidden px-5 py-3 text-base sm:inline-flex">
              Projekte ansehen
            </Link>
          </div>
          <MobileHeroImage />
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 px-3 sm:gap-4 md:grid-cols-3 md:gap-5 md:px-0">
        <KpiCard title="Projekte gesamt" value={totalProjects} subtitle="aktive Projekte" tone="blue" icon={<FolderOpen className="h-5 w-5 md:h-7 md:w-7" />} />
        <KpiCard title="PV-Leistung" value={totalKwp.toLocaleString('de-DE')} subtitle="kWp Gesamtleistung" tone="green" icon={<Zap className="h-5 w-5 md:h-7 md:w-7" />} />
        <KpiCard title="BESS-Kapazität" value={totalBess.toLocaleString('de-DE')} subtitle="MWh Gesamtkapazität" tone="violet" icon={<BatteryCharging className="h-5 w-5 md:h-7 md:w-7" />} />
      </div>

      <section className="mx-3 overflow-hidden rounded-[2rem] border border-[#5CB800]/20 bg-white shadow-[0_18px_48px_rgba(31,42,68,0.08)] md:mx-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-[#5CB800]/12 via-white to-white p-5 md:p-7">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5CB800] text-white shadow-lg shadow-[#5CB800]/20">
              <Inbox className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">Partnerportal</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#07142F]">Neue Partner-Einreichungen</h2>
              <p className="mt-1 text-sm text-muted-foreground">Neue Projekte deiner Vertriebspartner direkt prüfen.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#5CB800] px-3 py-1.5 text-sm font-extrabold text-white">{partnerSubmissions.length}</span>
            <Link href="/partner-submissions" className="inline-flex items-center gap-1 text-sm font-extrabold text-[#2F8A00] hover:underline">Alle anzeigen <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {partnerSubmissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-center text-sm text-muted-foreground">Aktuell liegen keine neuen Partner-Einreichungen vor.</div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {partnerSubmissions.map((submission: any) => (
                <Link key={submission.id} href={`/partner-submissions/${submission.id}`} className="premium-lift flex items-center gap-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 hover:border-[#5CB800]/40">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1F2A44]/8 text-[#1F2A44]"><Inbox className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-extrabold text-[#07142F]">{submission.project_name}</p>
                      <span className="rounded-full bg-[#5CB800]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#2F8A00]">{submissionStatusLabels[submission.status] ?? submission.status}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-600">{partnerNames.get(submission.partner_user_id) || 'Vertriebspartner'}</p>
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {[submission.location_city, submission.location_state].filter(Boolean).join(', ') || 'Standort offen'}</p>
                  </div>
                  <span className="rounded-xl bg-[#1F2A44] px-3 py-2 text-xs font-extrabold text-white">Prüfen</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 px-3 md:px-0 xl:grid-cols-[0.92fr_1.45fr]">
        <div className="card-padded rounded-[2rem]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#07142F] md:text-xl">Aktuelle Projekte</h2>
              <p className="mt-1 text-sm text-muted-foreground md:text-xs">Die zuletzt aktiven Projekte auf einen Blick.</p>
            </div>
            <Link href="/projects" className="flex items-center gap-1 text-sm font-extrabold text-[#2F8A00] hover:underline">Alle anzeigen <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="space-y-4">
            {latestProjects.length === 0 && <p className="rounded-2xl bg-muted/50 px-4 py-6 text-sm text-muted-foreground">Noch keine Projekte vorhanden.</p>}
            {latestProjects.map((project: any) => {
              const kind = getProjectKind(project)
              const purchasePrice = getPurchasePrice(project)
              const feedInType = getFeedInType(project)

              return (
                <Link key={project.id} href={`/projects/${project.id}/overview`} className="premium-lift block rounded-[1.6rem] border border-border/80 bg-white p-3 shadow-sm hover:border-[#5CB800]/25 md:p-4">
                  <div className="flex gap-3 sm:gap-4">
                    <ProjectImage kind={kind} />
                    <div className="min-w-0 flex-1 py-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-extrabold text-[#07142F] md:text-base">{project.project_number ?? project.project_name}</p>
                          <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {getLocation(project)}</p>
                        </div>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00] shadow-sm"><ArrowRight className="h-5 w-5" /></span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                        <div className="min-w-0"><p className="text-muted-foreground">Leistung</p><p className="mt-1 truncate font-extrabold text-[#132060]">{getProjectPower(project)}</p></div>
                        <div className="min-w-0"><p className="text-muted-foreground">Kaufpreis</p><p className="mt-1 truncate font-extrabold text-[#132060]">{formatMoney(purchasePrice)}</p></div>
                        <div className="min-w-0"><p className="text-muted-foreground">Einspeisung</p><p className="mt-1 truncate font-extrabold text-[#132060]">{feedInType}</p></div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="card-padded rounded-[2rem]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#07142F] md:text-xl">Projektstandorte</h2>
              <p className="mt-1 text-sm text-muted-foreground md:text-xs">Standorte, Technologie und Projektverteilung.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold text-[#2F8A00]"><Layers className="h-4 w-4" /> {mapProjects.length}</span>
          </div>
          <ProjectMap projects={mapProjects} />
        </div>
      </div>
    </div>
  )
}
