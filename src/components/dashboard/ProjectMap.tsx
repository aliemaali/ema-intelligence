'use client'

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

const STATE_POINTS: Record<string, Point> = {
  'Schleswig-Holstein': { x: 48, y: 12 }, Hamburg: { x: 47, y: 20 }, Bremen: { x: 37, y: 27 },
  Niedersachsen: { x: 42, y: 31 }, 'Mecklenburg-Vorpommern': { x: 64, y: 23 }, Brandenburg: { x: 66, y: 40 },
  Berlin: { x: 69, y: 39 }, Sachsen: { x: 67, y: 58 }, 'Sachsen-Anhalt': { x: 56, y: 45 },
  Thüringen: { x: 54, y: 57 }, Hessen: { x: 43, y: 57 }, 'Nordrhein-Westfalen': { x: 28, y: 48 },
  'Rheinland-Pfalz': { x: 31, y: 65 }, Saarland: { x: 24, y: 72 }, 'Baden-Württemberg': { x: 37, y: 82 },
  Bayern: { x: 57, y: 78 },
}

const CITY_POINTS: Record<string, Point> = {
  Worms: { x: 34, y: 69 }, Berlin: { x: 69, y: 39 }, Hamburg: { x: 47, y: 20 },
  München: { x: 58, y: 88 }, Stuttgart: { x: 39, y: 79 }, Frankfurt: { x: 41, y: 62 },
  Leipzig: { x: 61, y: 53 }, Dresden: { x: 70, y: 57 }, Köln: { x: 28, y: 52 }, Hannover: { x: 43, y: 35 },
}

function formatKwp(value?: number | null) {
  if (!value) return '–'
  return `${Number(value).toLocaleString('de-DE')} kWp`
}

function getPoint(project: ProjectMapItem, index: number): Point {
  const base = CITY_POINTS[project.location_city ?? ''] ?? STATE_POINTS[project.location_state ?? ''] ?? { x: 50, y: 50 }
  return { x: base.x + ((index % 3) - 1) * 1.8, y: base.y + (Math.floor(index / 3) % 3) * 1.5 }
}

function markerColor(project: ProjectMapItem) {
  if (project.project_type === 'bess') return '#2563EB'
  if (project.project_type === 'hybrid') return '#7C3AED'
  return '#5CB800'
}

export function ProjectMap({ projects }: { projects: ProjectMapItem[] }) {
  const visibleProjects = projects.filter((project) => project.location_city || project.location_state)
  const counts = visibleProjects.reduce((acc, project) => {
    const type = project.project_type === 'bess' ? 'bess' : project.project_type === 'hybrid' ? 'hybrid' : 'pv'
    acc[type] += 1
    return acc
  }, { pv: 0, bess: 0, hybrid: 0 })

  return (
    <div className="relative h-[430px] overflow-hidden rounded-[1.8rem] border border-slate-200 bg-gradient-to-br from-white via-[#F8FAFC] to-[#EEF7E8] shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
      <div className="absolute left-5 top-5 z-10 rounded-2xl border border-white/80 bg-white/92 px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#5CB800]">Deutschland</p>
        <p className="mt-1 text-sm font-bold text-[#07142F]">Projektstandorte</p>
      </div>

      <div className="absolute right-5 top-5 z-10 flex gap-2 rounded-2xl border border-white/80 bg-white/92 p-2 shadow-lg backdrop-blur">
        <span className="rounded-xl bg-[#5CB800]/10 px-3 py-2 text-xs font-extrabold text-[#2F8A00]">{counts.pv} PV</span>
        <span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-700">{counts.bess} BESS</span>
        <span className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-extrabold text-violet-700">{counts.hybrid} Hybrid</span>
      </div>

      <svg viewBox="0 0 100 100" className="h-full w-full p-8" role="img" aria-label="Statische Deutschlandkarte mit Projektstandorten">
        <defs>
          <linearGradient id="germanyFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F7FAFC" />
            <stop offset="100%" stopColor="#EAF4E4" />
          </linearGradient>
          <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="#0F172A" floodOpacity="0.14" />
          </filter>
        </defs>

        <path d="M45 5 L53 8 L57 14 L66 17 L72 23 L70 31 L76 36 L74 43 L80 49 L75 57 L73 66 L66 72 L64 82 L55 94 L46 91 L39 95 L33 89 L30 82 L24 77 L22 68 L17 61 L20 53 L18 45 L23 38 L27 31 L32 27 L35 18 L40 14 Z" fill="url(#germanyFill)" stroke="#C9D4E1" strokeWidth="1.1" filter="url(#mapShadow)" />

        <g stroke="#D9E2EC" strokeWidth="0.6" fill="none" opacity="0.95">
          <path d="M38 18 L56 20 L66 29" /><path d="M28 31 L45 34 L63 32 L73 40" />
          <path d="M22 47 L39 47 L55 45 L72 49" /><path d="M20 60 L36 61 L51 59 L69 63" />
          <path d="M25 74 L41 72 L58 75 L64 83" /><path d="M39 14 L42 30 L39 47 L36 61 L39 82" />
          <path d="M56 18 L54 34 L55 45 L51 59 L55 78" />
        </g>

        {visibleProjects.map((project, index) => {
          const point = getPoint(project, index)
          const color = markerColor(project)
          return (
            <g key={project.id}>
              <circle cx={point.x} cy={point.y} r="4.6" fill={color} opacity="0.16" />
              <circle cx={point.x} cy={point.y} r="2.5" fill={color} stroke="white" strokeWidth="1.1" />
              <foreignObject x={point.x - 5} y={point.y - 5} width="10" height="10">
                <Link href={`/projects/${project.id}/overview`} className="block h-full w-full rounded-full" title={`${project.project_name} · ${project.location_city ?? project.location_state ?? ''} · ${formatKwp(project.pv_mwp)}`} aria-label={`${project.project_name} öffnen`} />
              </foreignObject>
            </g>
          )
        })}
      </svg>

      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/80 bg-white/92 px-4 py-2.5 text-[11px] font-bold text-slate-600 shadow-lg backdrop-blur">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#5CB800]" /> PV</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-blue-600" /> BESS</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-violet-600" /> Hybrid</span>
      </div>
    </div>
  )
}
