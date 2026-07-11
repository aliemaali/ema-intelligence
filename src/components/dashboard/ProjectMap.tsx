'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import GermanyMap from '@svg-maps/germany'

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
  'Schleswig-Holstein': { x: 49, y: 10 }, Hamburg: { x: 48, y: 19 }, Bremen: { x: 36, y: 27 },
  Niedersachsen: { x: 42, y: 31 }, 'Mecklenburg-Vorpommern': { x: 66, y: 23 }, Brandenburg: { x: 67, y: 41 },
  Berlin: { x: 70, y: 40 }, Sachsen: { x: 68, y: 59 }, 'Sachsen-Anhalt': { x: 56, y: 45 },
  Thüringen: { x: 54, y: 57 }, Hessen: { x: 43, y: 58 }, 'Nordrhein-Westfalen': { x: 28, y: 49 },
  'Rheinland-Pfalz': { x: 31, y: 66 }, Saarland: { x: 24, y: 73 }, 'Baden-Württemberg': { x: 38, y: 82 },
  Bayern: { x: 59, y: 79 },
}

const CITY_POINTS: Record<string, Point> = {
  Worms: { x: 34, y: 69 }, Berlin: { x: 70, y: 40 }, Hamburg: { x: 48, y: 19 },
  München: { x: 59, y: 89 }, Stuttgart: { x: 39, y: 79 }, Frankfurt: { x: 41, y: 62 },
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
  return { x: base.x + ((index % 3) - 1) * 1.4, y: base.y + (Math.floor(index / 3) % 3) * 1.2 }
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
    <div className="relative h-[430px] overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-x-4 top-4 z-20 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-md backdrop-blur">
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

      <div className="absolute inset-x-8 bottom-5 top-20 flex items-center justify-center">
        <div className="relative h-full w-full max-w-[360px]">
          <svg
            viewBox={GermanyMap.viewBox}
            className="h-full w-full drop-shadow-[0_18px_30px_rgba(15,23,42,0.10)]"
            role="img"
            aria-label="Deutschlandkarte mit Bundesländern und Projektstandorten"
          >
            <defs>
              <linearGradient id="germanyFill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#EAF4E4" />
              </linearGradient>
            </defs>
            {GermanyMap.locations.map((location) => (
              <path
                key={location.id}
                d={location.path}
                fill="url(#germanyFill)"
                stroke="#CBD5E1"
                strokeWidth="0.9"
                vectorEffect="non-scaling-stroke"
              >
                <title>{location.name}</title>
              </path>
            ))}
          </svg>

          {visibleProjects.map((project, index) => {
            const point = getPoint(project, index)
            const kind = projectKind(project)
            const color = markerColor(kind)
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}/overview`}
                title={`${project.project_name} · ${project.location_city ?? project.location_state ?? ''} · ${formatKwp(project.pv_mwp)}`}
                aria-label={`${project.project_name} öffnen`}
                className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white shadow-[0_8px_18px_rgba(15,23,42,0.22)] transition hover:scale-110"
                style={{ left: `${point.x}%`, top: `${point.y}%`, backgroundColor: color }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-white/95" />
              </Link>
            )
          })}
        </div>
      </div>

      {visibleProjects.length === 0 && (
        <div className="pointer-events-none absolute inset-x-6 bottom-6 z-10 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-center text-sm font-bold text-slate-500 shadow-sm">
          Keine Projekte in dieser Kategorie.
        </div>
      )}
    </div>
  )
}
