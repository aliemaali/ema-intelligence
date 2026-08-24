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
type PositionedProject = { project: ProjectMapItem; point: Point; kind: Exclude<MapFilter, 'all'> }
type MapFilter = 'all' | 'pv' | 'bess' | 'hybrid' | 'wind' | 'rechenzentrum' | 'sonstiges'

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
  if (project.project_type === 'wind') return 'wind'
  if (project.project_type === 'rechenzentrum') return 'rechenzentrum'
  if (project.project_type === 'sonstiges') return 'sonstiges'
  return 'pv'
}

function getPoint(project: ProjectMapItem, index: number): Point {
  const base = CITY_POINTS[project.location_city ?? ''] ?? STATE_POINTS[project.location_state ?? ''] ?? { x: 50, y: 50 }
  return { x: base.x + ((index % 3) - 1) * 1.4, y: base.y + (Math.floor(index / 3) % 3) * 1.2 }
}

function markerColor(kind: Exclude<MapFilter, 'all'>) {
  if (kind === 'bess') return '#4F8CFF'
  if (kind === 'hybrid') return '#9A6CFF'
  if (kind === 'wind') return '#32D7F0'
  if (kind === 'rechenzentrum') return '#FF8B3D'
  if (kind === 'sonstiges') return '#94A3B8'
  return '#70E52D'
}

const FILTERS: { value: MapFilter; label: string; active: string; idle: string }[] = [
  { value: 'all', label: 'Alle', active: 'bg-[#020b1d] text-white', idle: 'bg-white/[.06] text-white' },
  { value: 'pv', label: 'PV', active: 'bg-[#5CB800] text-white', idle: 'bg-[#5CB800]/10 text-[#89ee4c]' },
  { value: 'bess', label: 'BESS', active: 'bg-blue-600 text-white', idle: 'bg-blue-400/10 text-blue-300' },
  { value: 'hybrid', label: 'Hybrid', active: 'bg-violet-600 text-white', idle: 'bg-violet-400/10 text-violet-300' },
  { value: 'wind', label: 'Wind', active: 'bg-cyan-600 text-white', idle: 'bg-cyan-400/10 text-cyan-300' },
  { value: 'rechenzentrum', label: 'Rechenzentrum', active: 'bg-orange-600 text-white', idle: 'bg-orange-400/10 text-orange-300' },
  { value: 'sonstiges', label: 'Sonstiges', active: 'bg-slate-500 text-white', idle: 'bg-slate-400/10 text-slate-300' },
]

export function ProjectMap({ projects }: { projects: ProjectMapItem[] }) {
  const [filter, setFilter] = useState<MapFilter>('all')
  const locatedProjects = projects.filter((project) => project.location_city || project.location_state)

  const counts = locatedProjects.reduce<Record<Exclude<MapFilter, 'all'>, number>>((acc, project) => {
    acc[projectKind(project)] += 1
    return acc
  }, { pv: 0, bess: 0, hybrid: 0, wind: 0, rechenzentrum: 0, sonstiges: 0 })

  const visibleProjects = useMemo(
    () => filter === 'all' ? locatedProjects : locatedProjects.filter((project) => projectKind(project) === filter),
    [filter, locatedProjects],
  )

  const positionedProjects = useMemo<PositionedProject[]>(
    () => visibleProjects.map((project, index) => ({ project, point: getPoint(project, index), kind: projectKind(project) })),
    [visibleProjects],
  )

  const networkSegments = useMemo(() => {
    if (positionedProjects.length < 2) return []
    const segments = positionedProjects.slice(1).map((entry, index) => ({
      from: positionedProjects[index].point,
      to: entry.point,
      key: `${positionedProjects[index].project.id}-${entry.project.id}`,
    }))
    if (positionedProjects.length > 2) {
      segments.push({
        from: positionedProjects[0].point,
        to: positionedProjects[positionedProjects.length - 1].point,
        key: `${positionedProjects[0].project.id}-${positionedProjects[positionedProjects.length - 1].project.id}-loop`,
      })
    }
    return segments
  }, [positionedProjects])

  return (
    <div className="relative h-[430px] overflow-hidden rounded-[1.8rem] border border-blue-300/25 bg-[#03142c] shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_25px_80px_rgba(0,0,0,.38),0_0_44px_rgba(45,99,230,.12)]">
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#0c2d59] via-[#051b39] to-[#020c1e]" />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage: 'linear-gradient(rgba(83,136,220,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(83,136,220,.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, transparent, black 24%, black 80%, transparent)',
        }}
      />
      <div aria-hidden="true" className="absolute -left-20 top-20 h-56 w-56 rounded-full bg-[#5CB800]/12 blur-[80px]" />
      <div aria-hidden="true" className="absolute -right-24 bottom-4 h-64 w-64 rounded-full bg-blue-600/16 blur-[90px]" />

      <div className="absolute inset-x-4 top-4 z-20 overflow-x-auto rounded-2xl border border-blue-200/18 bg-[#04152e]/90 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_12px_30px_rgba(0,0,0,.25)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center gap-2">
          {FILTERS.map((item) => {
            const count = item.value === 'all' ? locatedProjects.length : counts[item.value]
            const active = filter === item.value
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                aria-pressed={active}
                className={`shrink-0 rounded-xl border border-white/[.06] px-3 py-2 text-xs font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition active:scale-95 ${active ? item.active : item.idle}`}
              >
                {item.label} {count}
              </button>
            )
          })}
        </div>
      </div>

      <div className="absolute inset-x-8 bottom-5 top-20 flex items-center justify-center">
        <div className="relative h-full w-full max-w-[360px]">
          <svg
            viewBox={GermanyMap.viewBox}
            className="relative z-[2] h-full w-full drop-shadow-[0_0_16px_rgba(54,133,255,.30)]"
            role="img"
            aria-label="Deutschlandkarte mit Bundesländern und Projektstandorten"
          >
            <defs>
              <linearGradient id="germanyNightFill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#123563" />
                <stop offset="48%" stopColor="#082647" />
                <stop offset="100%" stopColor="#041a35" />
              </linearGradient>
              <pattern id="cityLights" width="21" height="21" patternUnits="userSpaceOnUse">
                <circle cx="3" cy="7" r=".55" fill="#8ed7ff" opacity=".55" />
                <circle cx="13" cy="3" r=".34" fill="#ffffff" opacity=".5" />
                <circle cx="17" cy="15" r=".5" fill="#64b7ff" opacity=".42" />
                <circle cx="7" cy="18" r=".25" fill="#b9e7ff" opacity=".45" />
              </pattern>
              <clipPath id="germanyClip">
                {GermanyMap.locations.map((location) => <path key={`clip-${location.id}`} d={location.path} />)}
              </clipPath>
              <filter id="mapGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g filter="url(#mapGlow)">
              {GermanyMap.locations.map((location) => (
                <path
                  key={location.id}
                  d={location.path}
                  fill="url(#germanyNightFill)"
                  stroke="#4F7DBA"
                  strokeWidth="0.9"
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{location.name}</title>
                </path>
              ))}
              <rect x="-20" y="-20" width="1000" height="1000" fill="url(#cityLights)" clipPath="url(#germanyClip)" opacity=".72" />
            </g>
          </svg>

          <svg className="pointer-events-none absolute inset-0 z-[4] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="networkGlow" x="-35%" y="-35%" width="170%" height="170%">
                <feGaussianBlur stdDeviation="1.25" result="lineBlur" />
                <feMerge><feMergeNode in="lineBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {networkSegments.map((segment) => (
              <line
                key={segment.key}
                x1={segment.from.x}
                y1={segment.from.y}
                x2={segment.to.x}
                y2={segment.to.y}
                stroke="#58B9FF"
                strokeWidth="0.75"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity=".88"
                filter="url(#networkGlow)"
              />
            ))}
          </svg>

          {positionedProjects.map(({ project, point, kind }) => {
            const color = markerColor(kind)
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}/overview`}
                title={`${project.project_name} · ${project.location_city ?? project.location_state ?? ''} · ${formatKwp(project.pv_mwp)}`}
                aria-label={`${project.project_name} öffnen`}
                className="absolute z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 0 6px ${color}33, 0 0 18px ${color}, 0 0 34px ${color}99, 0 10px 20px rgba(0,0,0,.34)`,
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_10px_white]" />
              </Link>
            )
          })}
        </div>
      </div>

      {positionedProjects.length === 0 && (
        <div className="pointer-events-none absolute inset-x-6 bottom-6 z-10 rounded-2xl border border-blue-200/15 bg-[#04152e]/95 px-4 py-3 text-center text-sm font-bold text-slate-300 shadow-sm">
          Keine Projekte in dieser Kategorie.
        </div>
      )}
    </div>
  )
}
