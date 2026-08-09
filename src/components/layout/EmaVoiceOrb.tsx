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
      const baseRadius = Math.min(width, height) * 0.29
      const currentPhase = phaseRef.current
      const active = currentPhase === 'listening' || currentPhase === 'speaking'
      const liveLevel = currentPhase === 'listening' ? inputLevelRef.current : outputLevelRef.current
      const targetLevel = active ? Math.min(1, liveLevel * 2.2 + 0.08) : 0.035
      smoothedLevel += (targetLevel - smoothedLevel) * (targetLevel > smoothedLevel ? 0.2 : 0.08)

      context.clearRect(0, 0, width, height)

      const breathe = 1 + Math.sin(now * 0.0014) * 0.018
      const activity = active ? smoothedLevel : currentPhase === 'thinking' ? 0.1 : 0
      const radius = baseRadius * (breathe + activity * 0.1)

      const aura = context.createRadialGradient(centerX, centerY, radius * 0.58, centerX, centerY, radius * 1.75)
      aura.addColorStop(0, `rgba(99, 200, 0, ${0.17 + activity * 0.2})`)
      aura.addColorStop(0.45, `rgba(59, 130, 246, ${0.09 + activity * 0.1})`)
      aura.addColorStop(1, 'rgba(7, 20, 47, 0)')
      context.fillStyle = aura
      context.beginPath()
      context.arc(centerX, centerY, radius * 1.75, 0, TAU)
      context.fill()

      context.save()
      context.beginPath()
      context.arc(centerX, centerY, radius, 0, TAU)
      context.clip()

      const sphere = context.createRadialGradient(
        centerX - radius * 0.38,
        centerY - radius * 0.42,
        radius * 0.05,
        centerX + radius * 0.16,
        centerY + radius * 0.2,
        radius * 1.25,
      )
      sphere.addColorStop(0, '#d7ffd0')
      sphere.addColorStop(0.16, '#8bea59')
      sphere.addColorStop(0.42, '#2b9b70')
      sphere.addColorStop(0.72, '#123f5a')
      sphere.addColorStop(1, '#07142f')
      context.fillStyle = sphere
      context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)

      const bandCount = 11
      for (let index = 0; index < bandCount; index += 1) {
        const offset = index / bandCount
        const y = centerY - radius + offset * radius * 2
        const wave = Math.sin(now * 0.0013 + index * 0.9) * radius * (0.04 + activity * 0.09)
        context.strokeStyle = index % 3 === 0
          ? `rgba(179, 255, 117, ${0.2 + activity * 0.18})`
          : `rgba(126, 211, 255, ${0.08 + activity * 0.12})`
        context.lineWidth = 1 + activity * 1.5
        context.beginPath()
        context.ellipse(centerX + wave, y, radius * 1.08, radius * 0.18, 0, 0, TAU)
        context.stroke()
      }

      for (let index = 0; index < 34; index += 1) {
        const angle = index * 2.399 + now * 0.00012 * (index % 2 === 0 ? 1 : -1)
        const orbit = radius * (0.2 + ((index * 37) % 80) / 100)
        const x = centerX + Math.cos(angle) * orbit
        const y = centerY + Math.sin(angle * 1.17) * orbit * 0.72
        const particleRadius = 0.7 + (index % 4) * 0.35 + activity * 1.3
        context.fillStyle = index % 4 === 0
          ? `rgba(207, 255, 167, ${0.36 + activity * 0.35})`
          : `rgba(190, 231, 255, ${0.18 + activity * 0.24})`
        context.beginPath()
        context.arc(x, y, particleRadius, 0, TAU)
        context.fill()
      }

      const shade = context.createRadialGradient(
        centerX - radius * 0.35,
        centerY - radius * 0.45,
        radius * 0.1,
        centerX,
        centerY,
        radius * 1.15,
      )
      shade.addColorStop(0, 'rgba(255,255,255,0.34)')
      shade.addColorStop(0.42, 'rgba(255,255,255,0)')
      shade.addColorStop(0.78, 'rgba(7,20,47,0.14)')
      shade.addColorStop(1, 'rgba(1,7,19,0.72)')
      context.fillStyle = shade
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

      frame = window.requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    frame = window.requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      window.cancelAnimationFrame(frame)
    }
  }, [inputLevelRef, outputLevelRef])

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
}
