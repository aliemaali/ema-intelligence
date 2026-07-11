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
  'Schleswig-Holstein': { x: 51, y: 13 }, Hamburg: { x: 49, y: 24 }, Bremen: { x: 36, y: 31 },
  Niedersachsen: { x: 43, y: 34 }, 'Mecklenburg-Vorpommern': { x: 67, y: 26 }, Brandenburg: { x: 69, y: 44 },
  Berlin: { x: 72, y: 43 }, Sachsen: { x: 69, y: 63 }, 'Sachsen-Anhalt': { x: 58, y: 49 },
  Thüringen: { x: 56, y: 61 }, Hessen: { x: 43, y: 60 }, 'Nordrhein-Westfalen': { x: 27, y: 52 },
  'Rheinland-Pfalz': { x: 31, y: 69 }, Saarland: { x: 24, y: 76 }, 'Baden-Württemberg': { x: 38, y: 85 },
  Bayern: { x: 61, y: 82 },
}

const CITY_POINTS: Record<string, Point> = {
  Worms: { x: 34, y: 72 }, Berlin: { x: 72, y: 43 }, Hamburg: { x: 49, y: 24 },
  München: { x: 61, y: 90 }, Stuttgart: { x: 39, y: 82 }, Frankfurt: { x: 42, y: 64 },
  Leipzig: { x: 63, y: 57 }, Dresden: { x: 72, y: 61 }, Köln: { x: 27, y: 56 }, Hannover: { x: 43, y: 39 },
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
  return { x: base.x + ((index % 3) - 1) * 1.5, y: base.y + (Math.floor(index / 3) % 3) * 1.25 }
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
    <div className="relative h-[430px] overflow-hidden rounded-[1.8rem] border border-slate-200 bg-gradient-to-br from-white via-[#F8FAFC] to-[#F2F7EE] shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-x-4 top-4 z-20 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-lg backdrop-blur">
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

      <svg viewBox="0 0 100 108" className="h-full w-full px-8 pb-5 pt-20" role="img" aria-label="Feste Deutschlandkarte mit Projektstandorten">
        <defs>
          <linearGradient id="germanyPremiumFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="58%" stopColor="#F4F8F1" />
            <stop offset="100%" stopColor="#E5F1DE" />
          </linearGradient>
          <filter id="germanyPremiumShadow" x="-35%" y="-35%" width="170%" height="170%">
            <feDropShadow dx="0" dy="2.8" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.16" />
          </filter>
        </defs>

        <path
          d="M49 4 L53 6 L54 10 L58 12 L60 17 L66 19 L70 23 L73 28 L72 33 L77 37 L75 43 L80 48 L77 53 L80 58 L75 63 L73 70 L68 74 L67 82 L62 88 L57 96 L52 101 L47 99 L42 103 L38 99 L34 94 L31 87 L26 83 L25 76 L21 71 L22 65 L18 59 L20 53 L17 47 L21 41 L23 35 L28 31 L31 25 L36 22 L38 16 L43 13 L44 8 Z"
          fill="url(#germanyPremiumFill)"
          stroke="#BFCBDC"
          strokeWidth="1.15"
          strokeLinejoin="round"
          filter="url(#germanyPremiumShadow)"
        />

        <path d="M43 14 C48 18 55 17 61 20" stroke="#D7E0EA" strokeWidth="0.5" fill="none" />
        <path d="M29 31 C39 35 52 34 69 29" stroke="#D7E0EA" strokeWidth="0.5" fill="none" />
        <path d="M21 45 C35 46 51 45 75 42" stroke="#D7E0EA" strokeWidth="0.5" fill="none" />
        <path d="M20 58 C37 59 55 56 77 55" stroke="#D7E0EA" strokeWidth="0.5" fill="none" />
        <path d="M23 70 C39 72 57 69 72 68" stroke="#D7E0EA" strokeWidth="0.5" fill="none" />
        <path d="M27 82 C40 82 53 80 66 83" stroke="#D7E0EA" strokeWidth="0.5" fill="none" />
        <path d="M40 16 C42 32 39 48 37 64 C35 77 39 91 42 99" stroke="#D7E0EA" strokeWidth="0.5" fill="none" />
        <path d="M58 19 C55 35 55 51 57 66 C58 78 57 88 53 99" stroke="#D7E0EA" strokeWidth="0.5" fill="none" />

        {visibleProjects.map((project, index) => {
          const point = getPoint(project, index)
          const kind = projectKind(project)
          const color = markerColor(kind)
          return (
            <g key={project.id}>
              <circle cx={point.x} cy={point.y} r="5.2" fill={color} opacity="0.16" />
              <circle cx={point.x} cy={point.y} r="2.75" fill={color} stroke="white" strokeWidth="1.2" />
              <foreignObject x={point.x - 5.5} y={point.y - 5.5} width="11" height="11">
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
        <div className="pointer-events-none absolute inset-x-6 bottom-6 z-10 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-center text-sm font-bold text-slate-500 shadow-sm">
          Keine Projekte in dieser Kategorie.
        </div>
      )}
    </div>
  )
}
