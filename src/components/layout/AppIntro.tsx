'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const INTRO_STORAGE_KEY = 'ema-intelligence:intro:played:v3'
const EXIT_DURATION_MS = 350
const SAFETY_TIMEOUT_MS = 3600
const INTRO_VIDEO_URL = '/intro/ema-intro.mp4'
const INTRO_POSTER_URL = '/intro/ema-intro-poster.webp'

type IntroPhase = 'checking' | 'playing' | 'leaving' | 'done'

export function AppIntro() {
  const [phase, setPhase] = useState<IntroPhase>('checking')
  const exitTimerRef = useRef<number | null>(null)
  const safetyTimerRef = useRef<number | null>(null)
  const paintFrameRef = useRef<number | null>(null)

  const finishIntro = useCallback(() => {
    setPhase((currentPhase) => {
      if (currentPhase === 'leaving' || currentPhase === 'done') return currentPhase
      return 'leaving'
    })

    if (exitTimerRef.current === null) {
      exitTimerRef.current = window.setTimeout(() => setPhase('done'), EXIT_DURATION_MS)
    }
  }, [])

  useEffect(() => {
    try {
      if (window.localStorage.getItem(INTRO_STORAGE_KEY) === '1') {
        setPhase('done')
        return
      }
    } catch {
      // Storage can be unavailable in hardened/private browser modes.
      // In that case, the intro simply plays for this mount.
    }

    const showIntroWhenVisible = () => {
      if (document.visibilityState === 'visible') setPhase('playing')
    }

    showIntroWhenVisible()
    document.addEventListener('visibilitychange', showIntroWhenVisible)

    return () => {
      document.removeEventListener('visibilitychange', showIntroWhenVisible)
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return

    safetyTimerRef.current = window.setTimeout(finishIntro, SAFETY_TIMEOUT_MS)
    paintFrameRef.current = window.requestAnimationFrame(() => {
      paintFrameRef.current = window.requestAnimationFrame(() => {
        try {
          window.localStorage.setItem(INTRO_STORAGE_KEY, '1')
        } catch {
          // Storage can be unavailable in hardened/private browser modes.
        }
      })
    })

    return () => {
      if (safetyTimerRef.current !== null) window.clearTimeout(safetyTimerRef.current)
      if (paintFrameRef.current !== null) window.cancelAnimationFrame(paintFrameRef.current)
    }
  }, [finishIntro, phase])

  if (phase === 'done') return null

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center bg-[#1F2A44] transition-opacity duration-300 ${
        phase === 'leaving' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundImage: `url(${INTRO_POSTER_URL})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      {phase !== 'checking' ? (
        <>
          <video
            className="h-full w-full object-cover"
            src={INTRO_VIDEO_URL}
            poster={INTRO_POSTER_URL}
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
