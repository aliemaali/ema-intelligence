'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Search } from 'lucide-react'
import { runOpenStreetMapResearch } from '@/lib/actions/osm-research.actions'

const STEPS = [
  { at: 5, label: 'Standort wird gesucht' },
  { at: 28, label: 'Gewerbestandorte werden geprüft' },
  { at: 58, label: 'Treffer werden ausgewertet' },
  { at: 82, label: 'Vorschläge werden gespeichert' },
]

export function ResearchProgressForm() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startProgress() {
    setRunning(true)
    setProgress(5)

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return 92
        const increment = current < 30 ? 4 : current < 65 ? 2 : 1
        return Math.min(current + increment, 92)
      })
    }, 700)
  }

  const activeStep = [...STEPS].reverse().find((step) => progress >= step.at) || STEPS[0]

  return (
    <form action={runOpenStreetMapResearch} onSubmit={startProgress} className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_220px_auto] md:items-end">
      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Ort oder PLZ</span>
        <input name="location" placeholder="z. B. Worms oder 67547" required disabled={running} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15 disabled:bg-slate-50" />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Radius</span>
        <select name="radius_km" defaultValue="10" disabled={running} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5CB800] disabled:bg-slate-50">
          <option value="5">5 km</option><option value="10">10 km</option><option value="20">20 km</option><option value="30">30 km</option><option value="50">50 km</option>
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Standorttyp</span>
        <select name="category" defaultValue="all" disabled={running} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5CB800] disabled:bg-slate-50">
          <option value="all">Alle Gewerbestandorte</option><option value="logistics">Logistik und Lager</option><option value="industry">Industrie</option>
        </select>
      </label>

      <button type="submit" disabled={running} className="relative h-12 w-full overflow-hidden rounded-xl bg-[#5CB800] px-5 text-sm font-semibold text-white shadow-sm md:min-w-[190px]">
        {running && <span className="absolute inset-y-0 left-0 bg-[#489700] transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />}
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {running ? <><Search className="h-4 w-4 animate-pulse" /> {progress}%</> : <><Search className="h-4 w-4" /> Suche starten</>}
        </span>
      </button>

      {running && (
        <div className="md:col-span-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-green-900">{activeStep.label}</p>
            <span className="text-sm font-bold text-[#5CB800]">{progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-green-100">
            <div className="h-full rounded-full bg-[#5CB800] transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.label} className={`flex items-center gap-1.5 ${progress >= step.at ? 'font-medium text-green-700' : ''}`}>
                <CheckCircle2 className={`h-3.5 w-3.5 ${progress >= step.at ? 'text-[#5CB800]' : 'text-slate-300'}`} />
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}
