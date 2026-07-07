import Link from 'next/link'
import { BatteryCharging, FolderOpen, MapPin, SunMedium, Zap } from 'lucide-react'
import { getProjects } from '@/lib/actions/project.actions'

export const metadata = { title: 'Dashboard' }

const STATE_POSITIONS: Record<string, { left: number; top: number }> = {
  'Schleswig-Holstein': { left: 49, top: 12 },
  Hamburg: { left: 50, top: 18 },
  Bremen: { left: 39, top: 25 },
  Niedersachsen: { left: 43, top: 34 },
  'Mecklenburg-Vorpommern': { left: 66, top: 24 },
  Brandenburg: { left: 70, top: 40 },
  Berlin: { left: 68, top: 38 },
  Sachsen: { left: 66, top: 61 },
  'Sachsen-Anhalt': { left: 58, top: 50 },
  Thüringen: { left: 53, top: 61 },
  Hessen: { left: 43, top: 63 },
  'Nordrhein-Westfalen': { left: 29, top: 51 },
  'Rheinland-Pfalz': { left: 34, top: 70 },
  Saarland: { left: 29, top: 79 },
  'Baden-Württemberg': { left: 42, top: 84 },
  Bayern: { left: 58, top: 82 },
}

const CITY_POSITIONS: Record<string, { left: number; top: number }> = {
  Worms: { left: 37, top: 71 },
  Berlin: { left: 68, top: 38 },
  Hamburg: { left: 50, top: 18 },
  München: { left: 57, top: 88 },
  Stuttgart: { left: 42, top: 83 },
  Frankfurt: { left: 41, top: 66 },
  Leipzig: { left: 61, top: 56 },
  Dresden: { left: 69, top: 61 },
  Köln: { left: 29, top: 57 },
  Hannover: { left: 45, top: 36 },
  'Poßßen': { left: 70, top: 40 },
  'Poßen': { left: 70, top: 40 },
  Possen: { left: 70, top: 40 },
  Polßen: { left: 70, top: 40 },
}

const MAP_TILES = [
  'https://tile.openstreetmap.org/6/32/20.png',
  'https://tile.openstreetmap.org/6/33/20.png',
  'https://tile.openstreetmap.org/6/34/20.png',
  'https://tile.openstreetmap.org/6/32/21.png',
  'https://tile.openstreetmap.org/6/33/21.png',
  'https://tile.openstreetmap.org/6/34/21.png',
]

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

function getMapPosition(project: any, index: number) {
  const city = project.location_city ? String(project.location_city) : ''
  const state = project.location_state ? String(project.location_state) : ''
  const base = CITY_POSITIONS[city] ?? STATE_POSITIONS[state] ?? { left: 50, top: 50 }
  const offset = (index % 4) * 1.4
  return {
    left: Math.min(92, Math.max(8, base.left + offset)),
    top: Math.min(90, Math.max(8, base.top + offset)),
  }
}

function getMarkerStyle(project: any) {
  const kind = getProjectKind(project)
  if (kind === 'bess') return 'bg-blue-600 border-blue-100'
  if (kind === 'hybrid') return 'bg-violet-600 border-violet-100'
  return 'bg-[#5CB800] border-green-100'
}

export default async function DashboardPage() {
  const projects = await getProjects({})

  const totalProjects = projects.length
  const totalKwp = projects.reduce((sum: number, p: any) => sum + Number(p.pv_mwp ?? 0), 0)
  const totalBess = projects.reduce((sum: number, p: any) => sum + Number(p.bess_mwh ?? 0), 0)

  const latestProjects = projects.slice(0, 5)
  const mapProjects = projects.filter((project: any) => project.location_city || project.location_state).slice(0, 12)

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

          <div className="relative min-h-[430px] rounded-2xl border border-border overflow-hidden bg-[#dfe9d9]">
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 scale-110 opacity-95">
              {MAP_TILES.map((tile) => (
                <img key={tile} src={tile} alt="" className="h-full w-full object-cover" />
              ))}
            </div>
            <div className="absolute inset-0 bg-white/5" />

            {mapProjects.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Noch keine Projektstandorte erfasst.
              </div>
            )}

            {mapProjects.map((project: any, index: number) => {
              const position = getMapPosition(project, index)
              const kind = getProjectKind(project)
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/overview`}
                  className="absolute group -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  title={`${project.project_name} · ${getLocation(project)}`}
                >
                  <span className={`flex items-center justify-center w-10 h-10 rounded-full border-4 text-white shadow-lg ${getMarkerStyle(project)}`}>
                    {kind === 'bess' ? <BatteryCharging className="w-4 h-4" /> : <SunMedium className="w-4 h-4" />}
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-60 -translate-x-1/2 rounded-xl border border-border bg-white p-3 text-left shadow-xl group-hover:block">
                    <span className="block text-sm font-bold text-foreground">{project.project_name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{getLocation(project)}</span>
                    <span className="mt-2 block text-xs font-semibold text-[#132060]">{getProjectPower(project)}</span>
                    <span className="mt-2 block text-xs font-semibold text-[#5CB800]">Details anzeigen</span>
                  </span>
                </Link>
              )
            })}

            <div className="absolute left-4 top-4 rounded-lg bg-white/95 border border-border shadow-sm overflow-hidden">
              <div className="px-3 py-1.5 text-lg font-bold border-b border-border">+</div>
              <div className="px-3 py-1.5 text-lg font-bold">−</div>
            </div>

            <div className="absolute bottom-2 right-3 rounded bg-white/80 px-2 py-1 text-[10px] text-muted-foreground">
              © OpenStreetMap contributors
            </div>
          </div>

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
