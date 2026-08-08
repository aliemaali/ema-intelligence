'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const INTRO_SESSION_KEY = 'ema-intelligence:intro:played:v1'
const EXIT_DURATION_MS = 350
const SAFETY_TIMEOUT_MS = 8500
const INTRO_VIDEO_URL = 'https://ema-intro-assets.vercel.app/api/intro'

type IntroPhase = 'checking' | 'playing' | 'leaving' | 'done'

export function AppIntro() {
  const [phase, setPhase] = useState<IntroPhase>('checking')
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const finishIntro = useCallback(() => {
    setPhase((currentPhase) => {
      if (currentPhase === 'leaving' || currentPhase === 'done') return currentPhase
      return 'leaving'
    })

    if (exitTimerRef.current === null) {
      exitTimerRef.current = setTimeout(() => setPhase('done'), EXIT_DURATION_MS)
    }
  }, [])

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(INTRO_SESSION_KEY) === '1') {
        setPhase('done')
        return
      }
      window.sessionStorage.setItem(INTRO_SESSION_KEY, '1')
    } catch {
      // Storage can be unavailable in hardened/private browser modes.
      // In that case, the intro simply plays for this mount.
    }

    setPhase('playing')
    const safetyTimer = window.setTimeout(finishIntro, SAFETY_TIMEOUT_MS)

    return () => {
      window.clearTimeout(safetyTimer)
      if (exitTimerRef.current !== null) clearTimeout(exitTimerRef.current)
    }
  }, [finishIntro])

  if (phase === 'done') return null

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center bg-[#1F2A44] transition-opacity duration-300 ${
        phase === 'leaving' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {phase !== 'checking' ? (
        <>
          <video
            className="h-full w-full object-cover"
            src={INTRO_VIDEO_URL}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={finishIntro}
            onError={finishIntro}
          />
          <button
            type="button"
            onClick={finishIntro}
            className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-10 min-h-11 rounded-full border border-white/35 bg-[#1F2A44]/55 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-[#1F2A44]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5CB800] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F2A44]"
            aria-label="Intro überspringen"
          >
            Überspringen
          </button>
        </>
      ) : null}
    </div>
  )
}
