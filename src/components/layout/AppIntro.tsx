'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const INTRO_VERSION = 'v5'
const EXIT_DURATION_MS = 350
const SAFETY_TIMEOUT_MS = 6500
const INTRO_VIDEO_URL = '/intro/ema-intro.mp4?v=5'
const INTRO_POSTER_URL = '/intro/ema-intro-poster.webp'

type IntroPhase = 'checking' | 'playing' | 'leaving' | 'done'
type StandaloneNavigator = Navigator & { standalone?: boolean }

function getIntroStorageKey() {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as StandaloneNavigator).standalone === true

  return `ema-intelligence:intro:played:${INTRO_VERSION}:${isStandalone ? 'app' : 'browser'}`
}

export function AppIntro() {
  const [phase, setPhase] = useState<IntroPhase>('checking')
  const exitTimerRef = useRef<number | null>(null)
  const safetyTimerRef = useRef<number | null>(null)
  const storageKeyRef = useRef<string | null>(null)

  const finishIntro = useCallback((remember: boolean) => {
    if (remember && document.visibilityState === 'visible' && storageKeyRef.current) {
      try {
        window.localStorage.setItem(storageKeyRef.current, '1')
      } catch {
        // Storage can be unavailable in hardened/private browser modes.
      }
    }

    setPhase((currentPhase) => {
      if (currentPhase === 'leaving' || currentPhase === 'done') return currentPhase
      return 'leaving'
    })

    if (exitTimerRef.current === null) {
      exitTimerRef.current = window.setTimeout(() => setPhase('done'), EXIT_DURATION_MS)
    }
  }, [])

  useEffect(() => {
    const storageKey = getIntroStorageKey()
    storageKeyRef.current = storageKey

    try {
      if (window.localStorage.getItem(storageKey) === '1') {
        setPhase('done')
        return
      }
    } catch {
      // Storage can be unavailable in hardened/private browser modes.
      // In that case, the intro simply plays for this mount.
    }

    const syncIntroVisibility = () => {
      setPhase((currentPhase) => {
        if (currentPhase === 'leaving' || currentPhase === 'done') return currentPhase
        return document.visibilityState === 'visible' ? 'playing' : 'checking'
      })
    }

    syncIntroVisibility()
    document.addEventListener('visibilitychange', syncIntroVisibility)
    window.addEventListener('pageshow', syncIntroVisibility)

    return () => {
      document.removeEventListener('visibilitychange', syncIntroVisibility)
      window.removeEventListener('pageshow', syncIntroVisibility)
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return

    safetyTimerRef.current = window.setTimeout(() => finishIntro(false), SAFETY_TIMEOUT_MS)

    return () => {
      if (safetyTimerRef.current !== null) window.clearTimeout(safetyTimerRef.current)
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
            onEnded={() => finishIntro(true)}
          />
          <button
            type="button"
            onClick={() => finishIntro(true)}
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
