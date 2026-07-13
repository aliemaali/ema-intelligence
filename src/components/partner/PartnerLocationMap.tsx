'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

type Position = { lat: number; lng: number }

type Props = {
  value: Position | null
  onChange: (position: Position) => void
}

const markerIcon = L.divIcon({
  className: '',
  html: '<div style="width:24px;height:24px;border-radius:9999px;background:#5CB800;border:4px solid white;box-shadow:0 4px 14px rgba(31,42,68,.35)"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function MapClickHandler({ onChange }: Pick<Props, 'onChange'>) {
  useMapEvents({
    click(event) {
      onChange({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })
  return null
}

function MapCenter({ value }: { value: Position | null }) {
  const map = useMap()
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], 15)
  }, [map, value])
  return null
}

export function PartnerLocationMap({ value, onChange }: Props) {
  const center: [number, number] = value ? [value.lat, value.lng] : [51.1657, 10.4515]

  function useCurrentLocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((position) => {
      onChange({ lat: position.coords.latitude, lng: position.coords.longitude })
    })
  }

  return (
    <div className="space-y-3">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <MapContainer center={center} zoom={value ? 15 : 6} scrollWheelZoom className="h-72 w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onChange={onChange} />
          <MapCenter value={value} />
          {value && <Marker position={[value.lat, value.lng]} icon={markerIcon} />}
        </MapContainer>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Standort auf der Karte antippen oder den aktuellen Standort übernehmen.</p>
        <button type="button" onClick={useCurrentLocation} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#1F2A44]">
          Aktuellen Standort verwenden
        </button>
      </div>
      {value && <p className="text-xs font-semibold text-[#2F8A00]">Koordinaten: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>}
    </div>
  )
}
