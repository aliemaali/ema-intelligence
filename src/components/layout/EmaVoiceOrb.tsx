'use client'

import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

type OrbPhase = 'idle' | 'connecting' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'error'

type EmaVoiceOrbProps = {
  phase: OrbPhase
  inputLevelRef: MutableRefObject<number>
  outputLevelRef: MutableRefObject<number>
}

const TAU = Math.PI * 2

export function EmaVoiceOrb({ phase, inputLevelRef, outputLevelRef }: EmaVoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const phaseRef = useRef(phase)

  phaseRef.current = phase

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    let frame = 0
    let smoothedLevel = 0
    let orbImageReady = false
    const orbImage = new window.Image()
    orbImage.onload = () => { orbImageReady = true }
    orbImage.src = '/brand/ema-realtime-orb.png'

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(bounds.width * ratio))
      canvas.height = Math.max(1, Math.round(bounds.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const draw = (now: number) => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const centerX = width / 2
      const centerY = height / 2
      const baseRadius = Math.min(width, height) * 0.34
      const currentPhase = phaseRef.current
      const active = currentPhase === 'listening' || currentPhase === 'speaking'
      const liveLevel = currentPhase === 'listening' ? inputLevelRef.current : outputLevelRef.current
      const targetLevel = active ? Math.min(1, liveLevel * 2.2 + 0.08) : 0.035
      smoothedLevel += (targetLevel - smoothedLevel) * (targetLevel > smoothedLevel ? 0.2 : 0.08)

      context.clearRect(0, 0, width, height)

      const breathe = 1 + Math.sin(now * 0.00155) * 0.035
      const activity = active ? smoothedLevel : currentPhase === 'thinking' ? 0.1 : 0
      const radius = baseRadius * (breathe + activity * 0.14)

      const aura = context.createRadialGradient(centerX, centerY, radius * 0.58, centerX, centerY, radius * 1.75)
      aura.addColorStop(0, `rgba(99, 200, 0, ${0.22 + activity * 0.28})`)
      aura.addColorStop(0.45, `rgba(59, 130, 246, ${0.12 + activity * 0.14})`)
      aura.addColorStop(1, 'rgba(7, 20, 47, 0)')
      context.fillStyle = aura
      context.beginPath()
      context.arc(centerX, centerY, radius * 1.75, 0, TAU)
      context.fill()

      context.save()
      context.beginPath()
      context.arc(centerX, centerY, radius, 0, TAU)
      context.clip()

      if (orbImageReady) {
        context.filter = `saturate(${1.02 + activity * 0.32}) brightness(${1 + activity * 0.12})`
        context.drawImage(orbImage, centerX - radius, centerY - radius, radius * 2, radius * 2)
        context.filter = 'none'
      } else {
        const fallback = context.createRadialGradient(
          centerX - radius * 0.35,
          centerY - radius * 0.38,
          radius * 0.06,
          centerX,
          centerY,
          radius * 1.12,
        )
        fallback.addColorStop(0, '#d7ffd0')
        fallback.addColorStop(0.3, '#4fc982')
        fallback.addColorStop(0.72, '#123f5a')
        fallback.addColorStop(1, '#07142f')
        context.fillStyle = fallback
        context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)
      }

      const movingLight = context.createRadialGradient(
        centerX - radius * (0.48 - Math.sin(now * 0.0008) * 0.08),
        centerY - radius * 0.34,
        0,
        centerX - radius * 0.2,
        centerY - radius * 0.14,
        radius * 0.9,
      )
      movingLight.addColorStop(0, `rgba(220,255,190,${0.08 + activity * 0.16})`)
      movingLight.addColorStop(0.45, 'rgba(126,255,174,0.025)')
      movingLight.addColorStop(1, 'rgba(7,20,47,0)')
      context.fillStyle = movingLight
      context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)
      context.restore()

      context.strokeStyle = currentPhase === 'error'
        ? 'rgba(248,113,113,0.88)'
        : `rgba(178,255,116,${0.5 + activity * 0.38})`
      context.lineWidth = 1.5 + activity * 2
      context.beginPath()
      context.arc(centerX, centerY, radius + 1, 0, TAU)
      context.stroke()

      if (currentPhase === 'thinking') {
        context.strokeStyle = 'rgba(99,200,0,0.9)'
        context.lineWidth = 4
        context.lineCap = 'round'
        context.beginPath()
        context.arc(centerX, centerY, radius * 1.22, now * 0.003, now * 0.003 + Math.PI * 0.62)
        context.stroke()
      }

      if (currentPhase !== 'error') {
        const pulse = (now * (active ? 0.00135 : 0.0009)) % 1
        context.strokeStyle = `rgba(99,200,0,${(1 - pulse) * (0.24 + activity * 0.4)})`
        context.lineWidth = 2.25 + activity * 1.75
        context.beginPath()
        context.arc(centerX, centerY, radius * (1.05 + pulse * (active ? 0.42 : 0.28)), 0, TAU)
        context.stroke()
      }

      frame = window.requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    frame = window.requestAnimationFrame(draw)

    return () => {
      orbImage.onload = null
      window.removeEventListener('resize', resize)
      window.cancelAnimationFrame(frame)
    }
  }, [inputLevelRef, outputLevelRef])

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
}
