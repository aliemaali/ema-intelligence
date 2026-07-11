'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type ProjectMapItem = {
  id: string
  project_name: string
  project_number?: string | null
  project_type?: string | null
  location_city?: string | null
  location_state?: string | null
  pv_mwp?: number | null
  bess_mwh?: number | null
  status?: string | null
}

type Point = { x: number; y: number }
type MapFilter = 'all' | 'pv' | 'bess' | 'hybrid'

const STATE_POINTS: Record<string, Point> = {
  'Schleswig-Holstein': { x: 49, y: 11 }, Hamburg: { x: 47, y: 20 }, Bremen: { x: 37, y: 27 },
  Niedersachsen: { x: 42, y: 31 }, 'Mecklenburg-Vorpommern': { x: 65, y: 23 }, Brandenburg: { x: 67, y: 40 },
  Berlin: { x: 70, y: 39 }, Sachsen: { x: 68, y: 59 }, 'Sachsen-Anhalt': { x: 56, y: 45 },
  Thüringen: { x: 54, y: 57 }, Hessen: { x: 43, y: 57 }, 'Nordrhein-Westfalen': { x: 28, y: 48 },
  'Rheinland-Pfalz': { x: 31, y: 65 }, Saarland: { x: 24, y: 72 }, 'Baden-Württemberg': { x: 37, y: 82 },
  Bayern: { x: 58, y: 79 },
}

const CITY_POINTS: Record<string, Point> = {
  Worms: { x: 34, y: 69 }, Berlin: { x: 70, y: 39 }, Hamburg: { x: 47, y: 20 },
  München: { x: 59, y: 88 }, Stuttgart: { x: 39, y: 79 }, Frankfurt: { x: 41, y: 62 },
  Leipzig: { x: 61, y: 53 }, Dresden: { x: 70, y: 57 }, Köln: { x: 28, y: 52 }, Hannover: { x: 43, y: 35 },
}

function formatKwp(value?: number | null) {
  if (!value) return '–'
  return `${Number(value).toLocaleString('de-DE')} kWp`
}

function projectKind(project: ProjectMapItem): Exclude<MapFilter, 'all'> {
  if (project.project_type === 'bess') return 'bess'
  if (project.project_type === 'hybrid') return 'hybrid'
  return 'pv'
}

function getPoint(project: ProjectMapItem, index: number): Point {
  const base = CITY_POINTS[project.location_city ?? ''] ?? STATE_POINTS[project.location_state ?? ''] ?? { x: 50, y: 50 }
  return { x: base.x + ((index % 3) - 1) * 1.6, y: base.y + (Math.floor(index / 3) % 3) * 1.35 }
}

function markerColor(kind: Exclude<MapFilter, 'all'>) {
  if (kind === 'bess') return '#2563EB'
  if (kind === 'hybrid') return '#7C3AED'
  return '#5CB800'
}

const FILTERS: { value: MapFilter; label: string; active: string; idle: string }[] = [
  { value: 'all', label: 'Alle', active: 'bg-[#07142F] text-white', idle: 'bg-white text-[#07142F]' },
  { value: 'pv', label: 'PV', active: 'bg-[#5CB800] text-white', idle: 'bg-[#5CB800]/10 text-[#2F8A00]' },
  { value: 'bess', label: 'BESS', active: 'bg-blue-600 text-white', idle: 'bg-blue-50 text-blue-700' },
  { value: 'hybrid', label: 'Hybrid', active: 'bg-violet-600 text-white', idle: 'bg-violet-50 text-violet-700' },
]

export function ProjectMap({ projects }: { projects: ProjectMapItem[] }) {
  const [filter, setFilter] = useState<MapFilter>('all')
  const locatedProjects = projects.filter((project) => project.location_city || project.location_state)

  const counts = locatedProjects.reduce((acc, project) => {
    acc[projectKind(project)] += 1
    return acc
  }, { pv: 0, bess: 0, hybrid: 0 })

  const visibleProjects = useMemo(
    () => filter === 'all' ? locatedProjects : locatedProjects.filter((project) => projectKind(project) === filter),
    [filter, locatedProjects],
  )

  return (
    <div className="relative h-[430px] overflow-hidden rounded-[1.8rem] border border-slate-200 bg-gradient-to-br from-white via-[#F8FAFC] to-[#EEF7E8] shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-x-4 top-4 z-20 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-lg backdrop-blur">
        {FILTERS.map((item) => {
          const count = item.value === 'all' ? locatedProjects.length : counts[item.value]
          const active = filter === item.value
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              aria-pressed={active}
              className={`rounded-xl px-3 py-2 text-xs font-extrabold transition active:scale-95 ${active ? item.active : item.idle}`}
            >
              {item.label} {count}
            </button>
          )
        })}
      </div>

      <svg viewBox="0 0 100 100" className="h-full w-full px-10 pb-7 pt-20" role="img" aria-label="Feste Deutschlandkarte mit Projektstandorten">
        <defs>
          <linearGradient id="germanyFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#EAF4E4" />
          </linearGradient>
          <filter id="mapShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2.2" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.13" />
          </filter>
        </defs>

        <path d="M45 4 L51 6 L54 10 L58 12 L62 18 L68 20 L72 26 L71 32 L76 37 L74 43 L80 49 L76 56 L74 63 L69 68 L66 76 L64 83 L57 92 L50 90 L44 95 L38 91 L34 86 L31 80 L26 76 L24 69 L19 63 L21 56 L18 49 L21 42 L24 36 L28 31 L33 27 L35 20 L40 15 L41 9 Z" fill="url(#germanyFill)" stroke="#C7D2E0" strokeWidth="1.1" filter="url(#mapShadow)" />

        <g stroke="#DCE5EF" strokeWidth="0.55" fill="none" opacity="0.9">
          <path d="M39 17 L55 19 L67 27" />
          <path d="M29 31 L45 34 L62 32 L72 40" />
          <path d="M22 47 L39 47 L55 45 L72 49" />
          <path d="M21 60 L36 61 L51 59 L69 63" />
          <path d="M26 73 L41 72 L57 75 L64 82" />
          <path d="M40 14 L42 30 L39 47 L36 61 L39 82" />
          <path d="M56 18 L54 34 L55 45 L51 59 L55 78" />
        </g>

        {visibleProjects.map((project, index) => {
          const point = getPoint(project, index)
          const kind = projectKind(project)
          const color = markerColor(kind)
          return (
            <g key={project.id}>
              <circle cx={point.x} cy={point.y} r="5" fill={color} opacity="0.16" />
              <circle cx={point.x} cy={point.y} r="2.7" fill={color} stroke="white" strokeWidth="1.2" />
              <foreignObject x={point.x - 5} y={point.y - 5} width="10" height="10">
                <Link
                  href={`/projects/${project.id}/overview`}
                  className="block h-full w-full rounded-full"
                  title={`${project.project_name} · ${project.location_city ?? project.location_state ?? ''} · ${formatKwp(project.pv_mwp)}`}
                  aria-label={`${project.project_name} öffnen`}
                />
              </foreignObject>
            </g>
          )
        })}
      </svg>

      {visibleProjects.length === 0 && (
        <div className="pointer-events-none absolute inset-x-6 bottom-7 z-10 rounded-2xl bg-white/90 px-4 py-3 text-center text-sm font-bold text-slate-500 shadow-sm">
          Keine Projekte in dieser Kategorie.
        </div>
      )}
    </div>
  )
}
