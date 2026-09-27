'use client'

import GermanyMap from '@svg-maps/germany'
import { MapPin } from 'lucide-react'

type Props = {
  latitude: number | null
  longitude: number | null
  label: string
}

function positionFromCoordinates(latitude: number, longitude: number) {
  const longitudeRatio = Math.min(1, Math.max(0, (longitude - 5.866) / (15.042 - 5.866)))
  const latitudeRatio = Math.min(1, Math.max(0, (55.1 - latitude) / (55.1 - 47.27)))
  return {
    x: 20 + longitudeRatio * 60,
    y: 7 + latitudeRatio * 85,
  }
}

export function DataCenterLocationMap({ latitude, longitude, label }: Props) {
  const hasPosition = latitude !== null && longitude !== null && latitude !== 0 && longitude !== 0
  const point = hasPosition ? positionFromCoordinates(latitude, longitude) : null

  return (
    <div className="relative h-[390px] w-full max-w-full overflow-hidden rounded-[1.8rem] border border-blue-300/25 bg-[#03142c] shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_25px_80px_rgba(0,0,0,.38),0_0_44px_rgba(45,99,230,.12)]">
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#0c2d59] via-[#051b39] to-[#020c1e]" />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage: 'linear-gradient(rgba(83,136,220,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(83,136,220,.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, transparent, black 18%, black 84%, transparent)',
        }}
      />
      <div aria-hidden="true" className="absolute -left-20 top-20 h-56 w-56 rounded-full bg-[#5CB800]/12 blur-[80px]" />
      <div aria-hidden="true" className="absolute -right-24 bottom-4 h-64 w-64 rounded-full bg-blue-600/16 blur-[90px]" />

      <div className="absolute inset-x-4 top-4 z-20 flex min-w-0 items-center gap-3 rounded-2xl border border-blue-200/18 bg-[#04152e]/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_12px_30px_rgba(0,0,0,.25)] backdrop-blur-xl">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#5CB800]/15 text-[#83e637]"><MapPin className="h-4 w-4" /></span>
        <span className="min-w-0">
          <strong className="block text-xs font-extrabold uppercase tracking-[0.14em] text-white">Projektstandort</strong>
          <small className="block truncate text-[10px] text-slate-400">{label || 'Adresse auswählen'}</small>
        </span>
      </div>

      <div className="absolute inset-x-7 bottom-5 top-[76px] flex items-center justify-center">
        <div className="relative h-full w-full max-w-[330px]">
          <svg viewBox={GermanyMap.viewBox} className="relative z-[2] h-full w-full drop-shadow-[0_0_16px_rgba(54,133,255,.30)]" role="img" aria-label="EMA Deutschlandkarte mit ausgewähltem Projektstandort">
            <defs>
              <linearGradient id="dcGermanyNightFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#123563" /><stop offset="48%" stopColor="#082647" /><stop offset="100%" stopColor="#041a35" /></linearGradient>
              <pattern id="dcCityLights" width="21" height="21" patternUnits="userSpaceOnUse"><circle cx="3" cy="7" r=".55" fill="#8ed7ff" opacity=".55" /><circle cx="13" cy="3" r=".34" fill="#ffffff" opacity=".5" /><circle cx="17" cy="15" r=".5" fill="#64b7ff" opacity=".42" /><circle cx="7" cy="18" r=".25" fill="#b9e7ff" opacity=".45" /></pattern>
              <clipPath id="dcGermanyClip">{GermanyMap.locations.map((location) => <path key={`dc-clip-${location.id}`} d={location.path} />)}</clipPath>
              <filter id="dcMapGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g filter="url(#dcMapGlow)">
              {GermanyMap.locations.map((location) => <path key={location.id} d={location.path} fill="url(#dcGermanyNightFill)" stroke="#4F7DBA" strokeWidth="0.9" vectorEffect="non-scaling-stroke"><title>{location.name}</title></path>)}
              <rect x="-20" y="-20" width="1000" height="1000" fill="url(#dcCityLights)" clipPath="url(#dcGermanyClip)" opacity=".72" />
            </g>
          </svg>

          {point && (
            <span className="pointer-events-none absolute z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-label="Ausgewählter Projektstandort">
              <span className="absolute h-10 w-10 animate-ping rounded-full bg-[#70E52D]/20" />
              <span className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full border-[3px] border-white bg-[#70E52D] shadow-[0_0_0_4px_rgba(112,229,45,.2),0_0_12px_#70E52D,0_0_22px_rgba(112,229,45,.7),0_5px_12px_rgba(0,0,0,.35)]"><span className="h-1.5 w-1.5 rounded-full bg-[#07142F]" /></span>
            </span>
          )}
        </div>
      </div>

      {!point && <div className="pointer-events-none absolute inset-x-5 bottom-5 z-10 rounded-2xl border border-blue-200/15 bg-[#04152e]/95 px-4 py-3 text-center text-xs font-bold text-slate-300">Nach der Adressauswahl erscheint hier der Projektmarker.</div>}
    </div>
  )
}
