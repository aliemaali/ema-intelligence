'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

const INTRO_VERSION = 'v6'
const EXIT_DURATION_MS = 350
const INTRO_DURATION_MS = 5000
const PLAYBACK_PROBE_MS = 650
const INTRO_VIDEO_URL = '/intro/ema-intro.mp4?v=6'
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
  const [useFallbackAnimation, setUseFallbackAnimation] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const introTimerRef = useRef<number | null>(null)
  const playbackProbeRef = useRef<number | null>(null)
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

    const video = videoRef.current
    setUseFallbackAnimation(false)

    if (video) {
      video.muted = true
      video.currentTime = 0
      void video.play().catch(() => setUseFallbackAnimation(true))
    }

    playbackProbeRef.current = window.setTimeout(() => {
      const currentVideo = videoRef.current
      if (!currentVideo || currentVideo.currentTime < 0.1 || currentVideo.paused) {
        setUseFallbackAnimation(true)
      }
    }, PLAYBACK_PROBE_MS)

    introTimerRef.current = window.setTimeout(() => finishIntro(true), INTRO_DURATION_MS)

    return () => {
      if (introTimerRef.current !== null) window.clearTimeout(introTimerRef.current)
      if (playbackProbeRef.current !== null) window.clearTimeout(playbackProbeRef.current)
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
            ref={videoRef}
            className={`h-full w-full object-cover transition-opacity duration-150 ${
              useFallbackAnimation ? 'opacity-0' : 'opacity-100'
            }`}
            src={INTRO_VIDEO_URL}
            poster={INTRO_POSTER_URL}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={() => finishIntro(true)}
            onCanPlay={(event) => {
              event.currentTarget.muted = true
              void event.currentTarget.play().catch(() => setUseFallbackAnimation(true))
            }}
            onError={() => setUseFallbackAnimation(true)}
          />
          {useFallbackAnimation ? (
            <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center overflow-hidden">
              <div className="ema-intro-fallback-beam absolute -left-1/2 top-[-20%] h-[145%] w-24 rotate-[18deg] bg-gradient-to-r from-transparent via-[#72d400]/70 to-transparent blur-xl" />
              <div className="ema-intro-fallback-content flex -translate-y-6 flex-col items-center">
                <Image
                  src="/brand/ema-mark-white.png"
                  alt="EMA"
                  width={506}
                  height={249}
                  priority
                  className="w-44 max-w-[48vw] drop-shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
                />
                <p className="mt-5 text-xl font-semibold tracking-[0.02em] text-white drop-shadow-lg">
                  EMA Intelligence
                </p>
                <span className="mt-3 h-px w-10 bg-[#72d400]" />
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => finishIntro(true)}
            className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-10 min-h-11 rounded-full border border-white/35 bg-[#1F2A44]/55 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-[#1F2A44]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5CB800] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F2A44]"
            aria-label="Intro überspringen"
          >
            Überspringen
          </button>
          <style jsx>{`
            .ema-intro-fallback-content {
              animation: ema-intro-logo 1.05s cubic-bezier(0.22, 1, 0.36, 1) both;
            }

            .ema-intro-fallback-beam {
              animation: ema-intro-beam 1.6s cubic-bezier(0.45, 0, 0.55, 1) both;
            }

            @keyframes ema-intro-logo {
              0% {
                opacity: 0;
                transform: translateY(8px) scale(0.72);
                filter: blur(10px);
              }
              65% {
                opacity: 1;
                filter: blur(0);
              }
              100% {
                opacity: 1;
                transform: translateY(-24px) scale(1);
                filter: blur(0);
              }
            }

            @keyframes ema-intro-beam {
              0% {
                opacity: 0;
                transform: translateX(-40vw) rotate(18deg);
              }
              20% {
                opacity: 0.85;
              }
              100% {
                opacity: 0;
                transform: translateX(180vw) rotate(18deg);
              }
            }
          `}</style>
        </>
      ) : null}
    </div>
  )
}
