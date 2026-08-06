'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { divIcon } from 'leaflet'

export type ProjectMapItem = {
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

export type ProjectListSummary = {
  country: string
  project_count: number
  created_at: string
}

type LocatedProject = ProjectMapItem & {
  latitude: number
  longitude: number
  country: string
}

type Cluster = {
  key: string
  latitude: number
  longitude: number
  projects: LocatedProject[]
}

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

function validCoordinate(value: unknown, min: number, max: number) {
  const coordinate = Number(value)
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? coordinate : null
}

function countryLabel(project: ProjectMapItem) {
  return String(project.location_country || '').trim() || 'Ohne Länderzuordnung'
}

function MapViewport({ projects }: { projects: LocatedProject[] }) {
  const map = useMap()

  useEffect(() => {
    if (projects.length === 0) {
      map.flyTo([50.5, 10.5], 4, { animate: true, duration: 0.65 })
      return
    }

    if (projects.length === 1) {
      map.flyTo([projects[0].latitude, projects[0].longitude], 8, { animate: true, duration: 0.65 })
      return
    }

    const bounds: [number, number][] = projects.map((project) => [project.latitude, project.longitude])
    map.flyToBounds(bounds, {
      animate: true,
      duration: 0.65,
      padding: [38, 38],
      maxZoom: 9,
    })
  }, [map, projects])

  return null
}

function ClusterLayer({ projects }: { projects: LocatedProject[] }) {
  const [zoom, setZoom] = useState(5)
  const map = useMap()
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  })

  const clusters = useMemo(() => {
    const gridSize = Math.max(0.08, 10 / Math.pow(2, Math.max(0, zoom - 3)))
    const buckets = new Map<string, LocatedProject[]>()

    for (const project of projects) {
      const latBucket = Math.round(project.latitude / gridSize)
      const lngBucket = Math.round(project.longitude / gridSize)
      const key = `${latBucket}:${lngBucket}`
      buckets.set(key, [...(buckets.get(key) ?? []), project])
    }

    return Array.from(buckets.entries()).map<Cluster>(([key, items]) => ({
      key,
      latitude: items.reduce((sum, item) => sum + item.latitude, 0) / items.length,
      longitude: items.reduce((sum, item) => sum + item.longitude, 0) / items.length,
      projects: items,
    }))
  }, [projects, zoom])

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.projects.length > 1) {
          const radius = Math.min(24, 13 + Math.log2(cluster.projects.length) * 3)
          const icon = divIcon({
            className: 'ema-project-cluster',
            html: `<span style="width:${radius * 2}px;height:${radius * 2}px">${cluster.projects.length.toLocaleString('de-DE')}</span>`,
            iconSize: [radius * 2, radius * 2],
            iconAnchor: [radius, radius],
          })
          return (
            <Marker
              key={cluster.key}
              position={[cluster.latitude, cluster.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => map.flyTo([cluster.latitude, cluster.longitude], Math.min(13, zoom + 2), { animate: true, duration: 0.55 }),
              }}
            >
              <Popup>
                <strong>{cluster.projects.length} Projekte</strong>
                <br />
                Zum Auflösen hineinzoomen.
              </Popup>
            </Marker>
          )
        }

        const project = cluster.projects[0]
        return (
          <CircleMarker
            key={project.id}
            center={[project.latitude, project.longitude]}
            radius={9}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: markerColor(project), fillOpacity: 1 }}
          >
            <Popup>
              <div className="min-w-44">
                <strong>{project.project_name || project.project_number || 'Projekt'}</strong>
                <div>{[project.location_city, project.location_state, project.country].filter(Boolean).join(', ')}</div>
                <Link className="mt-2 inline-flex font-bold text-[#367E00]" href={`/projects/${project.id}/overview`}>
                  Projekt öffnen
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

export function InternationalProjectMap({
  projects,
  projectLists,
}: {
  projects: ProjectMapItem[]
  projectLists: ProjectListSummary[]
}) {
  const [activeCountry, setActiveCountry] = useState('all')

  const locatedProjects = useMemo<LocatedProject[]>(() => projects.flatMap((project) => {
    const latitude = validCoordinate(project.location_lat, -90, 90)
    const longitude = validCoordinate(project.location_lng, -180, 180)
    if (latitude === null || longitude === null) return []
    return [{ ...project, latitude, longitude, country: countryLabel(project) }]
  }), [projects])

  const latestListByCountry = useMemo(() => {
    const map = new Map<string, number>()
    for (const list of projectLists) {
      const country = String(list.country || '').trim()
      if (country && !map.has(country)) map.set(country, Number(list.project_count ?? 0))
    }
    return map
  }, [projectLists])

  const countries = useMemo(() => {
    const values = new Set<string>()
    projects.forEach((project) => {
      const country = countryLabel(project)
      if (country !== 'Ohne Länderzuordnung') values.add(country)
    })
    latestListByCountry.forEach((_count, country) => values.add(country))
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'de'))
  }, [latestListByCountry, projects])

  const visibleProjects = useMemo(
    () => activeCountry === 'all' ? locatedProjects : locatedProjects.filter((project) => project.country === activeCountry),
    [activeCountry, locatedProjects],
  )

  const activeProjectCount = useMemo(() => {
    if (activeCountry === 'all') {
      return projects.length + Array.from(latestListByCountry.values()).reduce((sum, count) => sum + count, 0)
    }
    return projects.filter((project) => countryLabel(project) === activeCountry).length + (latestListByCountry.get(activeCountry) ?? 0)
  }, [activeCountry, latestListByCountry, projects])

  const missingCoordinates = activeCountry === 'all'
    ? projects.length - locatedProjects.length
    : projects.filter((project) => countryLabel(project) === activeCountry).length - visibleProjects.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#172033] md:text-2xl">
            {activeCountry === 'all' ? 'Projektstandorte' : activeCountry}
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            {activeProjectCount.toLocaleString('de-DE')} {activeProjectCount === 1 ? 'Projekt' : 'Projekte'}
            {activeCountry === 'all' && ` in ${countries.length.toLocaleString('de-DE')} ${countries.length === 1 ? 'Land' : 'Ländern'}`}
          </p>
        </div>
        {missingCoordinates > 0 && (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
            {missingCoordinates.toLocaleString('de-DE')} ohne Standortkoordinaten
          </span>
        )}
      </div>

      <div className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          <button
            type="button"
            onClick={() => setActiveCountry('all')}
            aria-pressed={activeCountry === 'all'}
            className={`ema-map-chip ${activeCountry === 'all' ? 'ema-map-chip-active' : ''}`}
          >
            Alle Länder
          </button>
          {countries.map((country) => (
            <button
              key={country}
              type="button"
              onClick={() => setActiveCountry(country)}
              aria-pressed={activeCountry === country}
              className={`ema-map-chip ${activeCountry === country ? 'ema-map-chip-active' : ''}`}
            >
              <span aria-hidden="true">{COUNTRY_FLAGS[country] ?? '🌍'}</span> {country}
            </button>
          ))}
        </div>
      </div>

      <div className="ema-international-map relative h-[380px] overflow-hidden rounded-[1.45rem] border border-slate-200 bg-[#EEF1F4] shadow-[0_16px_44px_rgba(31,42,68,0.10)] md:h-[520px]">
        <MapContainer
          center={[50.5, 10.5]}
          zoom={4}
          minZoom={3}
          maxZoom={17}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewport projects={visibleProjects} />
          <ClusterLayer projects={visibleProjects} />
        </MapContainer>

        {visibleProjects.length === 0 && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[500] rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-center text-sm font-bold text-[#667085] shadow-md">
            Für diese Auswahl sind keine echten Standortkoordinaten vorhanden.
          </div>
        )}
      </div>
    </div>
  )
}
