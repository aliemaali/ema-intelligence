'use client'

import { useRef } from 'react'
import { Search } from 'lucide-react'

type Props = {
  className?: string
}

export function ResearchProgressButton({ className = '' }: Props) {
  const fillRef = useRef<HTMLSpanElement | null>(null)
  const labelRef = useRef<HTMLSpanElement | null>(null)
  const startedRef = useRef(false)

  function startVisualProgress() {
    if (startedRef.current) return
    startedRef.current = true

    let progress = 6
    if (fillRef.current) fillRef.current.style.width = `${progress}%`
    if (labelRef.current) labelRef.current.textContent = `${progress}% · Standort wird gesucht`

    const timer = window.setInterval(() => {
      progress = Math.min(progress + (progress < 35 ? 5 : progress < 70 ? 3 : 1), 92)

      if (fillRef.current) fillRef.current.style.width = `${progress}%`
      if (labelRef.current) {
        const step = progress < 30
          ? 'Standort wird gesucht'
          : progress < 58
            ? 'Gewerbestandorte werden geprüft'
            : progress < 82
              ? 'Treffer werden ausgewertet'
              : 'Vorschläge werden gespeichert'
        labelRef.current.textContent = `${progress}% · ${step}`
      }

      if (progress >= 92) window.clearInterval(timer)
    }, 700)
  }

  return (
    <button
      type="submit"
      onClick={startVisualProgress}
      className={`relative h-12 w-full touch-manipulation overflow-hidden rounded-xl bg-[#5CB800] px-5 text-sm font-semibold text-white shadow-sm md:min-w-[220px] ${className}`}
    >
      <span ref={fillRef} className="absolute inset-y-0 left-0 w-0 bg-[#489700] transition-[width] duration-500 ease-out" />
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        <Search className="h-4 w-4" />
        <span ref={labelRef}>Suche starten</span>
      </span>
    </button>
  )
}
