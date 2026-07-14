'use client'

import { useEffect, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

type Position = { lat: number; lng: number }

type Props = {
  value: Position | null
  city: string
  state: string
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
    if (value) map.setView([value.lat, value.lng], 13)
  }, [map, value])
  return null
}

export function PartnerLocationMap({ value, city, state, onChange }: Props) {
  const center: [number, number] = value ? [value.lat, value.lng] : [51.1657, 10.4515]
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'found' | 'not-found'>('idle')

  useEffect(() => {
    const trimmedCity = city.trim()
    const trimmedState = state.trim()
    if (!trimmedCity || !trimmedState) {
      setLocationStatus('idle')
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLocationStatus('loading')
      try {
        const query = encodeURIComponent(`${trimmedCity}, ${trimmedState}, Deutschland`)
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${query}`, {
          signal: controller.signal,
          headers: { 'Accept-Language': 'de' },
        })
        if (!response.ok) throw new Error('Standortsuche fehlgeschlagen')
        const results = await response.json() as Array<{ lat: string; lon: string }>
        const first = results[0]
        if (!first) {
          setLocationStatus('not-found')
          return
        }
        onChange({ lat: Number(first.lat), lng: Number(first.lon) })
        setLocationStatus('found')
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setLocationStatus('not-found')
      }
    }, 700)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [city, state, onChange])

  return (
    <div className="space-y-3">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <MapContainer center={center} zoom={value ? 13 : 6} scrollWheelZoom className="h-72 w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onChange={onChange} />
          <MapCenter value={value} />
          {value && <Marker position={[value.lat, value.lng]} icon={markerIcon} />}
        </MapContainer>
      </div>
      <p className="text-xs text-slate-500">
        Die Karte wird automatisch anhand von Stadt und Bundesland positioniert. Der Punkt kann bei Bedarf auf der Karte korrigiert werden.
      </p>
      {locationStatus === 'loading' && <p className="text-xs font-semibold text-slate-500">Projektstandort wird gesucht …</p>}
      {locationStatus === 'not-found' && <p className="text-xs font-semibold text-amber-700">Standort nicht eindeutig gefunden. Bitte Stadt prüfen oder den Punkt auf der Karte setzen.</p>}
      {value && <p className="text-xs font-semibold text-[#2F8A00]">Projektstandort: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>}
    </div>
  )
}
