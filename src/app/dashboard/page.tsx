import Link from 'next/link'
import { BatteryCharging, FolderOpen, MapPin, SunMedium, Zap } from 'lucide-react'
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

export default async function DashboardPage() {
  const projects = await getProjects({})

  const totalProjects = projects.length
  const totalKwp = projects.reduce((sum: number, p: any) => sum + Number(p.pv_mwp ?? 0), 0)
  const totalBess = projects.reduce((sum: number, p: any) => sum + Number(p.bess_mwh ?? 0), 0)

  const latestProjects = projects.slice(0, 5)
  const mapProjects = projects.filter((project: any) => project.location_city || project.location_state).slice(0, 50)

  return (
    <div className="page-container space-y-7">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Überblick über deine EMA Intelligence Projekte
          </p>
        </div>

        <Link href="/projects/new" className="btn-primary">
          + Neues Projekt
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card-padded flex items-center gap-5 min-h-[128px]">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Projekte gesamt</p>
            <p className="text-4xl font-bold mt-2 text-[#132060]">{totalProjects}</p>
            <p className="text-sm text-muted-foreground mt-1">aktive Projekte</p>
          </div>
        </div>

        <div className="card-padded flex items-center gap-5 min-h-[128px]">
          <div className="w-16 h-16 rounded-full bg-[#5CB800]/12 text-[#2F8A00] flex items-center justify-center shrink-0">
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">PV-Leistung (kWp)</p>
            <p className="text-4xl font-bold mt-2 text-[#2F8A00]">{totalKwp.toLocaleString('de-DE')}</p>
            <p className="text-sm text-muted-foreground mt-1">Gesamtleistung</p>
          </div>
        </div>

        <div className="card-padded flex items-center gap-5 min-h-[128px]">
          <div className="w-16 h-16 rounded-full bg-violet-500/12 text-violet-700 flex items-center justify-center shrink-0">
            <BatteryCharging className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">BESS-Kapazität (MWh)</p>
            <p className="text-4xl font-bold mt-2 text-violet-700">{totalBess.toLocaleString('de-DE')}</p>
            <p className="text-sm text-muted-foreground mt-1">Gesamtkapazität</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.5fr] gap-5">
        <div className="card-padded">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold">Aktuelle Projekte</h2>
            <Link href="/projects" className="text-sm font-semibold text-[#132060] hover:underline">
              Alle anzeigen
            </Link>
          </div>

          <div className="divide-y divide-border">
            {latestProjects.length === 0 && (
              <p className="text-sm text-muted-foreground py-6">Noch keine Projekte vorhanden.</p>
            )}

            {latestProjects.map((project: any) => {
              const kind = getProjectKind(project)
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/overview`}
                  className="grid grid-cols-[44px_1fr_auto] items-center gap-3 py-4 hover:bg-muted/40 rounded-xl transition-colors px-2 -mx-2"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${kind === 'bess' ? 'bg-blue-600/10 text-blue-700' : kind === 'hybrid' ? 'bg-violet-600/10 text-violet-700' : 'bg-[#5CB800]/12 text-[#2F8A00]'}`}>
                    {kind === 'bess' ? <BatteryCharging className="w-5 h-5" /> : <SunMedium className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{project.project_name}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {getLocation(project)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-foreground">{getProjectPower(project)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{project.project_number}</p>
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="pt-4 mt-3 border-t border-border">
            <Link href="/projects" className="flex items-center justify-between text-sm font-semibold text-[#132060]">
              Zu allen Projekten <span>→</span>
            </Link>
          </div>
        </div>

        <div className="card-padded">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold">Projektstandorte</h2>
            <Link href="/projects" className="text-sm font-semibold text-[#132060] hover:underline">
              Alle anzeigen
            </Link>
          </div>

          <ProjectMap projects={mapProjects as any} />

          <div className="mt-4 flex flex-wrap gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#5CB800]" /> PV Projekte</span>
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> BESS Projekte</span>
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-violet-600" /> Hybrid Projekte</span>
          </div>
        </div>
      </div>
    </div>
  )
}
