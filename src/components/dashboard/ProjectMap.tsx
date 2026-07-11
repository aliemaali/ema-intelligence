'use client'

import Link from 'next/link'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

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

const GERMANY_CENTER: [number, number] = [51.1657, 10.4515]
const GERMANY_BOUNDS: [[number, number], [number, number]] = [
  [47.15, 5.5],
  [55.15, 15.5],
]

const STATE_COORDS: Record<string, [number, number]> = {
  'Schleswig-Holstein': [54.2194, 9.6961],
  Hamburg: [53.5511, 9.9937],
  Bremen: [53.0793, 8.8017],
  Niedersachsen: [52.6367, 9.8451],
  'Mecklenburg-Vorpommern': [53.6127, 12.4296],
  Brandenburg: [52.4125, 12.5316],
  Berlin: [52.52, 13.405],
  Sachsen: [51.1045, 13.2017],
  'Sachsen-Anhalt': [51.9503, 11.6923],
  Thüringen: [50.9848, 11.0299],
  Hessen: [50.6521, 9.1624],
  'Nordrhein-Westfalen': [51.4332, 7.6616],
  'Rheinland-Pfalz': [49.9499, 7.3109],
  Saarland: [49.3964, 7.0229],
  'Baden-Württemberg': [48.6616, 9.3501],
  Bayern: [48.7904, 11.4979],
}

const CITY_COORDS: Record<string, [number, number]> = {
  Worms: [49.6341, 8.3507],
  Berlin: [52.52, 13.405],
  Hamburg: [53.5511, 9.9937],
  München: [48.1351, 11.582],
  Stuttgart: [48.7758, 9.1829],
  Frankfurt: [50.1109, 8.6821],
  Leipzig: [51.3397, 12.3731],
  Dresden: [51.0504, 13.7373],
  Köln: [50.9375, 6.9603],
  Hannover: [52.3759, 9.732],
  Polßen: [52.62, 13.9],
  Possen: [52.62, 13.9],
  Poßen: [52.62, 13.9],
  Poßßen: [52.62, 13.9],
}

function formatKwp(value?: number | null) {
  if (!value) return '–'
  return `${Number(value).toLocaleString('de-DE')} kWp`
}

function getLocation(project: ProjectMapItem) {
  return [project.location_city, project.location_state].filter(Boolean).join(', ') || 'Standort offen'
}

function getPosition(project: ProjectMapItem, index: number): [number, number] {
  const city = project.location_city ?? ''
  const state = project.location_state ?? ''
  const base = CITY_COORDS[city] ?? STATE_COORDS[state] ?? GERMANY_CENTER
  const offset = (index % 5) * 0.08
  return [base[0] + offset, base[1] + offset]
}

function getIcon(project: ProjectMapItem) {
  const color = project.project_type === 'bess'
    ? '#2563eb'
    : project.project_type === 'hybrid'
    ? '#6d28d9'
    : '#5CB800'

  return L.divIcon({
    className: 'ema-map-marker',
    html: `<div style="width:34px;height:34px;border-radius:999px;background:${color};border:4px solid white;box-shadow:0 10px 24px rgba(15,23,42,.25);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:13px;">•</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  })
}

export function ProjectMap({ projects }: { projects: ProjectMapItem[] }) {
  const visibleProjects = projects.filter((p) => p.location_city || p.location_state)

  return (
    <div className="relative h-[430px] overflow-hidden rounded-2xl border border-border bg-muted">
      <MapContainer
        center={GERMANY_CENTER}
        zoom={6}
        minZoom={6}
        maxZoom={6}
        maxBounds={GERMANY_BOUNDS}
        maxBoundsViscosity={1}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl
        className="h-full w-full cursor-default"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {visibleProjects.map((project, index) => {
          const position = getPosition(project, index)
          return (
            <Marker key={project.id} position={position} icon={getIcon(project)}>
              <Popup>
                <div className="min-w-[190px] space-y-1">
                  <p className="font-bold text-[#07142F]">{project.project_name}</p>
                  <p className="text-xs text-slate-600">{project.project_number}</p>
                  <p className="text-xs text-slate-600">{getLocation(project)}</p>
                  <p className="text-xs font-semibold text-[#132060]">{formatKwp(project.pv_mwp)}</p>
                  <Link href={`/projects/${project.id}/overview`} className="mt-2 inline-block text-xs font-bold text-[#5CB800]">
                    Projekt öffnen →
                  </Link>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
