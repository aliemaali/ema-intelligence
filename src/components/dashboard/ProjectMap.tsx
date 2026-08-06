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
  location_country?: string | null
  location_lat?: number | string | null
  location_lng?: number | string | null
  pv_kwp?: number | null
  pv_mwp?: number | null
  bess_mwh?: number | null
  status?: string | null
}

type LocatedProject = ProjectMapItem & {
  latitude: number
  longitude: number
  country: string
}

type Point = { x: number; y: number }

const COUNTRY_FLAGS: Record<string, string> = {
  Deutschland: '🇩🇪',
  Frankreich: '🇫🇷',
  Italien: '🇮🇹',
  Spanien: '🇪🇸',
  Portugal: '🇵🇹',
  Niederlande: '🇳🇱',
  Belgien: '🇧🇪',
  Österreich: '🇦🇹',
  Schweiz: '🇨🇭',
  Polen: '🇵🇱',
  Dänemark: '🇩🇰',
  Türkei: '🇹🇷',
}

const COUNTRY_BOUNDS: Record<string, { south: number; west: number; north: number; east: number }> = {
  Deutschland: { south: 47.1, west: 5.5, north: 55.2, east: 15.5 },
  Frankreich: { south: 41.0, west: -5.5, north: 51.5, east: 10.0 },
  Italien: { south: 35.0, west: 6.0, north: 47.5, east: 19.0 },
}

function validCoordinate(value: unknown, min: number, max: number) {
  const coordinate = Number(value)
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? coordinate : null
}

function countryLabel(project: ProjectMapItem) {
  return String(project.location_country || '').trim() || 'Ohne Länderzuordnung'
}

function projectKind(project: ProjectMapItem) {
  if (project.project_type === 'bess') return 'bess'
  if (project.project_type === 'hybrid') return 'hybrid'
  if (project.project_type === 'wind') return 'wind'
  if (project.project_type === 'rechenzentrum') return 'rechenzentrum'
  if (project.project_type === 'sonstiges') return 'sonstiges'
  return 'pv'
}

function markerColor(project: ProjectMapItem) {
  const kind = projectKind(project)
  if (kind === 'bess') return '#2563EB'
  if (kind === 'hybrid') return '#7C3AED'
  if (kind === 'wind') return '#0891B2'
  if (kind === 'rechenzentrum') return '#EA580C'
  if (kind === 'sonstiges') return '#64748B'
  return '#5CB800'
}

function formatPower(project: ProjectMapItem) {
  const value = Number(project.pv_kwp ?? project.pv_mwp ?? 0)
  return value > 0 ? `${value.toLocaleString('de-DE')} kWp` : 'Leistung offen'
}

function mapBounds(projects: LocatedProject[], country: string) {
  if (country !== 'all' && COUNTRY_BOUNDS[country]) return COUNTRY_BOUNDS[country]
  if (projects.length === 0) return { south: 35, west: -12, north: 60, east: 30 }

  const latitudes = projects.map((project) => project.latitude)
  const longitudes = projects.map((project) => project.longitude)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  const latPadding = Math.max(1.5, (north - south) * 0.16)
  const lngPadding = Math.max(1.5, (east - west) * 0.16)

  return {
    south: south - latPadding,
    west: west - lngPadding,
    north: north + latPadding,
    east: east + lngPadding,
  }
}

function projectPoint(project: LocatedProject, bounds: ReturnType<typeof mapBounds>): Point {
  const width = Math.max(0.01, bounds.east - bounds.west)
  const height = Math.max(0.01, bounds.north - bounds.south)
  return {
    x: 8 + ((project.longitude - bounds.west) / width) * 84,
    y: 8 + ((bounds.north - project.latitude) / height) * 84,
  }
}

export function ProjectMap({ projects }: { projects: ProjectMapItem[]; projectLists?: unknown[] }) {
  const [activeCountry, setActiveCountry] = useState('all')
  const [openCluster, setOpenCluster] = useState<string | null>(null)

  const locatedProjects = useMemo<LocatedProject[]>(() => projects.flatMap((project) => {
    const latitude = validCoordinate(project.location_lat, -90, 90)
    const longitude = validCoordinate(project.location_lng, -180, 180)
    if (latitude === null || longitude === null) return []
    return [{ ...project, latitude, longitude, country: countryLabel(project) }]
  }), [projects])

  const countries = useMemo(() => Array.from(new Set(
    projects.map(countryLabel).filter((country) => country !== 'Ohne Länderzuordnung'),
  )).sort((a, b) => a.localeCompare(b, 'de')), [projects])

  const visibleProjects = useMemo(
    () => activeCountry === 'all'
      ? locatedProjects
      : locatedProjects.filter((project) => project.country === activeCountry),
    [activeCountry, locatedProjects],
  )

  const bounds = useMemo(() => mapBounds(visibleProjects, activeCountry), [activeCountry, visibleProjects])
  const markers = useMemo(() => {
    const groups = new Map<string, { point: Point; projects: LocatedProject[] }>()
    for (const project of visibleProjects) {
      const point = projectPoint(project, bounds)
      const key = `${Math.round(point.x / 4)}:${Math.round(point.y / 4)}`
      const current = groups.get(key)
      if (current) {
        current.projects.push(project)
        current.point = {
          x: (current.point.x * (current.projects.length - 1) + point.x) / current.projects.length,
          y: (current.point.y * (current.projects.length - 1) + point.y) / current.projects.length,
        }
      } else {
        groups.set(key, { point, projects: [project] })
      }
    }
    return Array.from(groups.entries())
  }, [bounds, visibleProjects])

  const missingCoordinates = projects.filter((project) => (
    activeCountry === 'all' || countryLabel(project) === activeCountry
  )).length - visibleProjects.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#172033] md:text-2xl">
            {activeCountry === 'all' ? 'Projektstandorte' : activeCountry}
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            {visibleProjects.length.toLocaleString('de-DE')} kartierte {visibleProjects.length === 1 ? 'Projektposition' : 'Projektpositionen'}
            {activeCountry === 'all' && ` in ${countries.length.toLocaleString('de-DE')} ${countries.length === 1 ? 'Land' : 'Ländern'}`}
          </p>
        </div>
        {missingCoordinates > 0 && (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
            {missingCoordinates.toLocaleString('de-DE')} ohne Koordinaten
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setActiveCountry('all'); setOpenCluster(null) }} aria-pressed={activeCountry === 'all'} className={`ema-map-chip ${activeCountry === 'all' ? 'ema-map-chip-active' : ''}`}>
          Alle Länder
        </button>
        {countries.map((country) => (
          <button key={country} type="button" onClick={() => { setActiveCountry(country); setOpenCluster(null) }} aria-pressed={activeCountry === country} className={`ema-map-chip ${activeCountry === country ? 'ema-map-chip-active' : ''}`}>
            <span aria-hidden="true">{COUNTRY_FLAGS[country] ?? '🌍'}</span> {country}
          </button>
        ))}
      </div>

      <div className="relative h-[380px] overflow-hidden rounded-[1.8rem] border border-slate-200 bg-gradient-to-br from-white via-[#F4F8FB] to-[#EAF4E4] shadow-[0_22px_70px_rgba(15,23,42,0.08)] md:h-[520px]">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(rgba(31,42,68,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(31,42,68,.07) 1px, transparent 1px)', backgroundSize: '12.5% 12.5%' }} />

        {activeCountry === 'Deutschland' && (
          <div className="pointer-events-none absolute inset-8 flex items-center justify-center opacity-55">
            <svg viewBox={GermanyMap.viewBox} className="h-full w-full max-w-[360px] drop-shadow-[0_18px_30px_rgba(15,23,42,0.10)]" role="img" aria-label="Deutschlandkarte mit Bundesländern">
              <defs>
                <linearGradient id="germanyFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#DDEFD3" />
                </linearGradient>
              </defs>
              {GermanyMap.locations.map((location) => (
                <path key={location.id} d={location.path} fill="url(#germanyFill)" stroke="#94A3B8" strokeWidth="0.9" vectorEffect="non-scaling-stroke">
                  <title>{location.name}</title>
                </path>
              ))}
            </svg>
          </div>
        )}

        <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#667085] shadow-sm">
          {activeCountry === 'all' ? 'Automatische Gesamtansicht' : `Automatischer Zoom · ${activeCountry}`}
        </div>

        {markers.map(([key, marker]) => {
          const singleProject = marker.projects.length === 1 ? marker.projects[0] : null
          if (singleProject) {
            return (
              <Link
                key={key}
                href={`/projects/${singleProject.id}/overview`}
                title={`${singleProject.project_name} · ${[singleProject.location_city, singleProject.country].filter(Boolean).join(', ')} · ${formatPower(singleProject)}`}
                aria-label={`${singleProject.project_name} öffnen`}
                className="absolute z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white shadow-[0_8px_18px_rgba(15,23,42,0.24)] transition hover:scale-110"
                style={{ left: `${marker.point.x}%`, top: `${marker.point.y}%`, backgroundColor: markerColor(singleProject) }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-white/95" />
              </Link>
            )
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpenCluster(openCluster === key ? null : key)}
              className="absolute z-20 flex h-11 min-h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-[#1F2A44] text-xs font-black text-white shadow-[0_9px_22px_rgba(31,42,68,0.28)] transition hover:scale-105"
              style={{ left: `${marker.point.x}%`, top: `${marker.point.y}%` }}
              aria-expanded={openCluster === key}
              aria-label={`${marker.projects.length} Projekte anzeigen`}
            >
              {marker.projects.length}
            </button>
          )
        })}

        {openCluster && markers.find(([key]) => key === openCluster) && (
          <div className="absolute inset-x-4 bottom-4 z-30 max-h-44 overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#667085]">Projekte am Standort</p>
            <div className="space-y-1.5">
              {markers.find(([key]) => key === openCluster)?.[1].projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}/overview`} className="flex min-h-11 items-center justify-between rounded-xl bg-[#F4F6F8] px-3 py-2 text-sm font-bold text-[#172033]">
                  <span className="truncate">{project.project_name || project.project_number}</span>
                  <span className="ml-3 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: markerColor(project) }} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {visibleProjects.length === 0 && (
          <div className="absolute inset-x-6 bottom-6 z-10 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-center text-sm font-bold text-[#667085] shadow-sm">
            Für diese Auswahl sind keine echten Standortkoordinaten vorhanden.
          </div>
        )}
      </div>
    </div>
  )
}
