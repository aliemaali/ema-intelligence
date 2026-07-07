import Link from 'next/link'
import {
  BatteryCharging,
  Bell,
  FolderOpen,
  MapPin,
  Search,
  SunMedium,
  Zap,
} from 'lucide-react'
import { ProjectMap } from '@/components/dashboard/ProjectMap'
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
    blue: 'from-blue-600/12 via-white to-white text-blue-700 border-blue-600/10',
    green: 'from-[#5CB800]/16 via-white to-white text-[#2F8A00] border-[#5CB800]/10',
    violet: 'from-violet-600/12 via-white to-white text-violet-700 border-violet-600/10',
  }[tone]

  return (
    <div className={`premium-lift relative overflow-hidden rounded-[1.35rem] border bg-gradient-to-br ${toneClass} p-5 md:p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)]`}>
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-current opacity-[0.06]" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{title}</p>
          <p className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-[#07142F]">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex h-13 w-13 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-black/5">
          {icon}
        </div>
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
    <div className="page-container space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#5CB800]">EMA Intelligence</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Überblick über deine Projekte, Standorte und aktuelle Pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary hidden sm:inline-flex" type="button">
            <Search className="h-4 w-4" /> Suche
          </button>
          <button className="btn-secondary hidden sm:inline-flex" type="button">
            <Bell className="h-4 w-4" /> Hinweise
          </button>
          <Link href="/projects/new" className="btn-primary">
            + Neues Projekt
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 md:gap-5">
        <KpiCard
          title="Projekte gesamt"
          value={totalProjects}
          subtitle="aktive Projekte"
          tone="blue"
          icon={<FolderOpen className="h-7 w-7" />}
        />
        <KpiCard
          title="PV-Leistung"
          value={totalKwp.toLocaleString('de-DE')}
          subtitle="kWp Gesamtleistung"
          tone="green"
          icon={<Zap className="h-7 w-7" />}
        />
        <KpiCard
          title="BESS-Kapazität"
          value={totalBess.toLocaleString('de-DE')}
          subtitle="MWh Gesamtkapazität"
          tone="violet"
          icon={<BatteryCharging className="h-7 w-7" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.88fr_1.55fr]">
        <div className="card-padded">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#07142F]">Aktuelle Projekte</h2>
              <p className="mt-1 text-xs text-muted-foreground">Die zuletzt aktiven Projekte auf einen Blick.</p>
            </div>
            <Link href="/projects" className="text-xs font-extrabold text-[#132060] hover:underline">
              Alle anzeigen
            </Link>
          </div>

          <div className="space-y-3">
            {latestProjects.length === 0 && (
              <p className="rounded-2xl bg-muted/50 px-4 py-6 text-sm text-muted-foreground">Noch keine Projekte vorhanden.</p>
            )}

            {latestProjects.map((project: any) => {
              const kind = getProjectKind(project)
              const iconClass = kind === 'bess'
                ? 'bg-blue-600/10 text-blue-700'
                : kind === 'hybrid'
                ? 'bg-violet-600/10 text-violet-700'
                : 'bg-[#5CB800]/12 text-[#2F8A00]'

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/overview`}
                  className="premium-lift block rounded-2xl border border-border/80 bg-white/80 p-4 shadow-sm hover:border-[#5CB800]/25"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
                      {kind === 'bess' ? <BatteryCharging className="h-5 w-5" /> : <SunMedium className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-foreground">{project.project_name}</p>
                          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {getLocation(project)}
                          </p>
                        </div>
                        <span className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${getStatusClass(project.status)}`}>
                          {getStatusLabel(project.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-muted-foreground">Leistung</p>
                          <p className="mt-0.5 font-extrabold text-[#132060]">{getProjectPower(project)}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-muted-foreground">Nummer</p>
                          <p className="mt-0.5 font-extrabold text-[#132060]">{project.project_number}</p>
                        </div>
                        <div className="col-span-2 rounded-xl bg-slate-50 px-3 py-2 sm:col-span-1">
                          <p className="text-muted-foreground">Bundesland</p>
                          <p className="mt-0.5 truncate font-extrabold text-[#132060]">{project.location_state ?? '–'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="card-padded">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#07142F]">Projektstandorte</h2>
              <p className="mt-1 text-xs text-muted-foreground">Zoomen, verschieben und Projekte direkt öffnen.</p>
            </div>
            <Link href="/projects" className="text-xs font-extrabold text-[#132060] hover:underline">
              Alle anzeigen
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
