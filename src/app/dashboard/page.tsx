import Link from 'next/link'
import { BatteryCharging, FolderOpen, MapPin, SunMedium, Zap } from 'lucide-react'
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

export default async function DashboardPage() {
  const projects = await getProjects({})

  const totalProjects = projects.length
  const totalKwp = projects.reduce((sum: number, p: any) => sum + Number(p.pv_mwp ?? 0), 0)
  const totalBess = projects.reduce((sum: number, p: any) => sum + Number(p.bess_mwh ?? 0), 0)

  const latestProjects = projects.slice(0, 5)
  const locationCounts = projects.reduce((acc: Record<string, number>, project: any) => {
    const key = project.location_state || project.location_city || 'Ohne Standort'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const locations = Object.entries(locationCounts).slice(0, 6)

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Überblick über deine EMA Intelligence Projekte
          </p>
        </div>

        <Link href="/projects/new" className="btn-primary">
          + Neues Projekt
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-padded flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-700 flex items-center justify-center">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Projekte gesamt</p>
            <p className="text-2xl font-semibold mt-1">{totalProjects}</p>
          </div>
        </div>

        <div className="card-padded flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#5CB800]/10 text-[#2F8A00] flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">PV-Leistung (kWp)</p>
            <p className="text-2xl font-semibold mt-1 text-[#2F8A00]">
              {totalKwp.toLocaleString('de-DE')}
            </p>
          </div>
        </div>

        <div className="card-padded flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-700 flex items-center justify-center">
            <BatteryCharging className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">BESS-Kapazität (MWh)</p>
            <p className="text-2xl font-semibold mt-1 text-violet-700">{totalBess.toFixed(1)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="card-padded">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Aktuelle Projekte</h2>
            <Link href="/projects" className="text-xs font-medium text-[#0B1E63] hover:underline">
              Alle anzeigen
            </Link>
          </div>

          <div className="divide-y divide-border">
            {latestProjects.length === 0 && (
              <p className="text-sm text-muted-foreground py-6">Noch keine Projekte vorhanden.</p>
            )}

            {latestProjects.map((project: any) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/overview`}
                className="flex items-center gap-3 py-3 hover:bg-muted/40 rounded-xl transition-colors px-2 -mx-2"
              >
                <div className="w-10 h-10 rounded-xl bg-[#5CB800]/10 text-[#2F8A00] flex items-center justify-center shrink-0">
                  <SunMedium className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{project.project_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{getLocation(project)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-foreground">{getProjectPower(project)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{project.project_number}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card-padded">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Projekt Standorte</h2>
            <Link href="/projects" className="text-xs font-medium text-[#0B1E63] hover:underline">
              Alle anzeigen
            </Link>
          </div>

          <div className="relative min-h-[260px] rounded-2xl bg-gradient-to-br from-[#F5FAEF] via-white to-[#EEF5FF] border border-border overflow-hidden p-4">
            <div className="absolute left-[12%] top-[18%] w-20 h-20 rounded-full bg-[#5CB800]/20 blur-xl" />
            <div className="absolute right-[18%] top-[28%] w-24 h-24 rounded-full bg-blue-500/10 blur-xl" />
            <div className="absolute left-[35%] bottom-[16%] w-28 h-28 rounded-full bg-violet-500/10 blur-xl" />

            <div className="relative grid grid-cols-2 gap-3">
              {locations.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2">Noch keine Standorte erfasst.</p>
              )}

              {locations.map(([location, count], index) => (
                <div key={location} className="rounded-xl bg-white/80 border border-border p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-[#5CB800]/15 text-[#2F8A00] flex items-center justify-center text-xs font-bold">
                      {count}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{location}</p>
                      <p className="text-xs text-muted-foreground">
                        {count} Projekt{count !== 1 ? 'e' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#5CB800]" /> PV Projekte</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> BESS Projekte</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500" /> Hybrid Projekte</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
