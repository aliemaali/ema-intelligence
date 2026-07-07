import Link from 'next/link'
import {
  ArrowRight,
  BatteryCharging,
  Bell,
  FolderOpen,
  Layers,
  MapPin,
  Search,
  SunMedium,
  Zap,
} from 'lucide-react'
import { ProjectMap } from '@/components/dashboard/ProjectMap'
import { TimeGreeting } from '@/components/dashboard/TimeGreeting'
import { getProjects } from '@/lib/actions/project.actions'

export const metadata = { title: 'Dashboard' }

function formatKwp(value: number | null | undefined) {
  if (!value) return '–'
  return `${Number(value).toLocaleString('de-DE')} kWp`
}

function formatMwh(value: number | null | undefined) {
  if (!value) return '–'
  return `${Number(value).toLocaleString('de-DE')} MWh`
}

function getProjectPower(project: any) {
  const parts = []
  if (project.pv_mwp) parts.push(formatKwp(project.pv_mwp))
  if (project.bess_mwh) parts.push(formatMwh(project.bess_mwh))
  return parts.join(' / ') || '–'
}

function getLocation(project: any) {
  return [project.location_city, project.location_state].filter(Boolean).join(', ') || 'Standort offen'
}

function getProjectKind(project: any) {
  if (project.project_type === 'bess') return 'bess'
  if (project.project_type === 'hybrid') return 'hybrid'
  return 'pv'
}

function getStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    lead: 'Lead',
    qualifizierung: 'Qualifizierung',
    investorsuche: 'Investorensuche',
    verhandlung: 'Verhandlung',
    verkauft: 'Verkauft',
    pausiert: 'Pausiert',
    verloren: 'Verloren',
  }
  return labels[status ?? ''] ?? status ?? 'Offen'
}

function getStatusClass(status?: string | null) {
  if (status === 'verkauft') return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
  if (status === 'investorsuche' || status === 'verhandlung') return 'bg-[#5CB800]/10 text-[#2F8A00] border-[#5CB800]/20'
  if (status === 'pausiert') return 'bg-amber-500/10 text-amber-700 border-amber-500/20'
  if (status === 'verloren') return 'bg-red-500/10 text-red-700 border-red-500/20'
  return 'bg-blue-500/10 text-blue-700 border-blue-500/20'
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
    <div className={`premium-lift relative overflow-hidden rounded-[1.25rem] border bg-gradient-to-br ${toneClass} p-3 shadow-[0_14px_36px_rgba(15,23,42,0.07)] md:rounded-[1.45rem] md:p-6 md:shadow-[0_18px_50px_rgba(15,23,42,0.08)]`}>
      <div className="absolute right-0 top-0 h-16 w-16 translate-x-5 -translate-y-5 rounded-full bg-current opacity-[0.07] md:h-28 md:w-28 md:translate-x-8 md:-translate-y-8" />
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 shadow-sm ring-1 ring-black/5 md:h-14 md:w-14">
        {icon}
      </div>
      <p className="mt-4 min-h-[28px] text-[10px] font-extrabold uppercase leading-tight tracking-[0.16em] text-slate-500 md:mt-6 md:text-xs md:tracking-[0.18em]">{title}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#07142F] md:mt-3 md:text-4xl">{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-muted-foreground md:text-sm">{subtitle}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200/70 md:mt-5">
        <div className="h-full w-2/3 rounded-full bg-current opacity-70" />
      </div>
    </div>
  )
}

function SolarHeroArt() {
  return (
    <div className="pointer-events-none absolute inset-y-5 right-5 z-0 hidden w-[46%] overflow-hidden rounded-[1.9rem] border border-white/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] md:block">
      <img
        src="/hero-dashboard.png"
        alt=""
        className="h-full w-full object-cover object-center saturate-[1.18] contrast-[1.05] brightness-[1.02]"
      />
    </div>
  )
}

function MobileHeroImage() {
  return (
    <div className="mt-7 block h-56 overflow-hidden rounded-[1.8rem] border border-white/70 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.14)] md:hidden">
      <img
        src="/hero-dashboard.png"
        alt="Solarfeld mit Windkraft und Batteriespeicher"
        className="h-full w-full object-cover object-center saturate-[1.18] contrast-[1.05] brightness-[1.02]"
      />
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
    <div className={`relative h-28 w-32 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} sm:h-32 sm:w-40`}>
      <div className="absolute inset-x-0 bottom-0 h-10 bg-green-500/20" />
      <div className="absolute left-4 top-8 h-12 w-20 rotate-[-10deg] rounded bg-blue-700/70 shadow-md" />
      <div className="absolute left-7 top-11 h-1 w-16 rotate-[-10deg] bg-white/50" />
      <div className="absolute left-8 top-15 h-1 w-14 rotate-[-10deg] bg-white/40" />
      <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-[#2F8A00] shadow-sm">
        {kind === 'bess' ? 'BESS' : kind === 'hybrid' ? 'HYB' : 'PV'}
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const projects = await getProjects({})

  const totalProjects = projects.length
  const totalKwp = projects.reduce((sum: number, p: any) => sum + Number(p.pv_mwp ?? 0), 0)
  const totalBess = projects.reduce((sum: number, p: any) => sum + Number(p.bess_mwh ?? 0), 0)

  const latestProjects = projects.slice(0, 5)
  const mapProjects = projects.filter((project: any) => project.location_city || project.location_state).slice(0, 50)

  return (
    <div className="page-container space-y-7 md:space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-white/0 pt-8 md:min-h-[330px] md:rounded-[2.2rem] md:bg-white/80 md:p-8 md:shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
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

      <div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-3 md:gap-5">
        <KpiCard
          title="Projekte gesamt"
          value={totalProjects}
          subtitle="aktive Projekte"
          tone="blue"
          icon={<FolderOpen className="h-5 w-5 md:h-7 md:w-7" />}
        />
        <KpiCard
          title="PV-Leistung"
          value={totalKwp.toLocaleString('de-DE')}
          subtitle="kWp Gesamtleistung"
          tone="green"
          icon={<Zap className="h-5 w-5 md:h-7 md:w-7" />}
        />
        <KpiCard
          title="BESS-Kapazität"
          value={totalBess.toLocaleString('de-DE')}
          subtitle="MWh Gesamtkapazität"
          tone="violet"
          icon={<BatteryCharging className="h-5 w-5 md:h-7 md:w-7" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.92fr_1.45fr]">
        <div className="card-padded rounded-[2rem]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#07142F] md:text-xl">Aktuelle Projekte</h2>
              <p className="mt-1 text-sm text-muted-foreground md:text-xs">Die zuletzt aktiven Projekte auf einen Blick.</p>
            </div>
            <Link href="/projects" className="flex items-center gap-1 text-sm font-extrabold text-[#2F8A00] hover:underline">
              Alle anzeigen <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-4">
            {latestProjects.length === 0 && (
              <p className="rounded-2xl bg-muted/50 px-4 py-6 text-sm text-muted-foreground">Noch keine Projekte vorhanden.</p>
            )}

            {latestProjects.map((project: any) => {
              const kind = getProjectKind(project)

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/overview`}
                  className="premium-lift block rounded-[1.6rem] border border-border/80 bg-white p-3 shadow-sm hover:border-[#5CB800]/25 md:p-4"
                >
                  <div className="flex gap-4">
                    <ProjectImage kind={kind} />
                    <div className="min-w-0 flex-1 py-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-extrabold text-[#07142F] md:text-base">{project.project_number ?? project.project_name}</p>
                          <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" /> {getLocation(project)}
                          </p>
                        </div>
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00] shadow-sm">
                          <ArrowRight className="h-5 w-5" />
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Leistung</p>
                          <p className="mt-1 font-extrabold text-[#132060]">{getProjectPower(project)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className={`mt-1 w-fit rounded-lg border px-2 py-1 font-extrabold ${getStatusClass(project.status)}`}>
                            {getStatusLabel(project.status)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Bundesland</p>
                          <p className="mt-1 truncate font-extrabold text-[#132060]">{project.location_state ?? '–'}</p>
                        </div>
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
              <p className="mt-1 text-sm text-muted-foreground md:text-xs">Zoomen, verschieben und Projekte direkt öffnen.</p>
            </div>
            <Link href="/projects" className="flex items-center gap-1 text-sm font-extrabold text-[#2F8A00] hover:underline">
              Karte <Layers className="h-4 w-4" />
            </Link>
          </div>

          <ProjectMap projects={mapProjects as any} />

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#5CB800]" /> PV Projekte</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> BESS Projekte</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> Hybrid Projekte</span>
          </div>
        </div>
      </div>
    </div>
  )
}
