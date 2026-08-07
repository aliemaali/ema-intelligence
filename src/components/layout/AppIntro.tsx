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
      aria-hidden="true"
    >
      {phase !== 'checking' ? (
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
      ) : null}
    </div>
  )
}
