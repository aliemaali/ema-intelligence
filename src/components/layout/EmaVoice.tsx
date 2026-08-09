'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mic, Sparkles, X } from 'lucide-react'
import { EmaVoiceOrb } from './EmaVoiceOrb'

type RealtimePhase = 'idle' | 'connecting' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'error'

type RealtimeServerEvent = {
  type?: string
  transcript?: string
  error?: { message?: string }
  response?: {
    output?: Array<{
      type?: string
      name?: string
      call_id?: string
      arguments?: string
    }>
  }
}

type Destination = {
  label: string
  href: string
}

type ProjectVisualRow = {
  id: string
  project_number?: string | null
  project_name?: string | null
  project_type?: string | null
  status?: string | null
  project_stage?: string | null
  location?: {
    country?: string | null
    state?: string | null
    city?: string | null
  } | null
  pv_kwp?: number | null
  bess_mw?: number | null
  bess_mwh?: number | null
}

type ProjectVisualResult = {
  kind: 'project_table'
  title: string
  subtitle: string
  rows: ProjectVisualRow[]
}

type AudioMeter = {
  context: AudioContext
  frame: number
}

type PendingEmaAction =
  | {
      kind: 'create_project'
      data: Record<string, unknown>
      preparedTurn: number
      label: string
    }
  | {
      kind: 'open_expose'
      projectId: string
      preparedTurn: number
      label: string
    }

const PROJECT_TYPE_LABELS: Record<string, string> = {
  pv_freiflaeche: 'PV-Freifläche',
  pv_dach: 'PV-Dach',
  bess: 'BESS',
  hybrid: 'Hybrid',
  wind: 'Wind',
  rechenzentrum: 'Rechenzentrum',
  sonstiges: 'Sonstiges',
}

const REALTIME_IDLE_MS = 5 * 60 * 1000
const MIC_RELEASE_GRACE_MS = 100
const RESPONSE_DELAY_MS = 1000

const REALTIME_STATUS: Record<RealtimePhase, string> = {
  idle: 'Bereit, wenn du es bist',
  connecting: 'EMA verbindet sich …',
  ready: 'Zum Sprechen gedrückt halten',
  listening: 'Ich höre zu …',
  thinking: 'EMA denkt nach …',
  speaking: 'EMA antwortet …',
  error: 'Verbindung nicht möglich',
}

function projectTypeLabel(type: string | null | undefined) {
  return type ? PROJECT_TYPE_LABELS[type] ?? type : '–'
}

function formatCapacity(project: ProjectVisualRow) {
  if (Number(project.pv_kwp) > 0) {
    return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(Number(project.pv_kwp))} kWp`
  }
  if (Number(project.bess_mw) > 0) {
    return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(Number(project.bess_mw))} MW`
  }
  return '–'
}

function visualResultFromTool(tool: string | undefined, result: unknown, args: Record<string, unknown>): ProjectVisualResult | null {
  if (tool !== 'search_ema_projects' || !result || typeof result !== 'object') return null
  const payload = result as { matches?: unknown; match_count?: unknown }
  if (!Array.isArray(payload.matches)) return null

  const rows = payload.matches.filter((item): item is ProjectVisualRow => (
    Boolean(item && typeof item === 'object' && typeof (item as ProjectVisualRow).id === 'string')
  ))
  const total = Number(payload.match_count)
  const country = typeof args.country === 'string' && args.country.trim() ? args.country.trim() : null

  return {
    kind: 'project_table',
    title: country ? `Projekte in ${country}` : 'Gefundene Projekte',
    subtitle: `${Number.isFinite(total) ? total : rows.length} Treffer · Live aus EMA Intelligence`,
    rows,
  }
}

function triggerHaptic(duration = 8) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(duration)
  }
}

const DESTINATIONS: Destination[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Projekt-Import', href: '/project-import' },
  { label: 'Projektprüfung', href: '/projects/audit' },
  { label: 'Projektarchiv', href: '/projects/archive' },
  { label: 'Neues Projekt', href: '/projects/new' },
  { label: 'Projekte', href: '/projects' },
  { label: 'Investoren', href: '/investors' },
  { label: 'Partner', href: '/partners' },
  { label: 'Partner-Einreichungen', href: '/partner-submissions' },
  { label: 'Dokumente', href: '/dokumente' },
  { label: 'Kalender', href: '/calendar' },
  { label: 'CAPEX', href: '/capex' },
  { label: 'Deals', href: '/deals' },
  { label: 'Akquise', href: '/acquisition' },
  { label: 'EMA AI', href: '/ai' },
  { label: 'Microsoft 365', href: '/microsoft' },
  { label: 'Einstellungen', href: '/settings' },
]

export function EmaVoice({ userName }: { userName: string }) {
  const router = useRouter()
  const realtimeActiveRef = useRef(false)
  const realtimeConnectingRef = useRef(false)
  const realtimePeerRef = useRef<RTCPeerConnection | null>(null)
  const realtimeChannelRef = useRef<RTCDataChannel | null>(null)
  const realtimeSenderRef = useRef<RTCRtpSender | null>(null)
  const realtimeStreamRef = useRef<MediaStream | null>(null)
  const realtimeAudioRef = useRef<HTMLAudioElement | null>(null)
  const realtimeIdleTimerRef = useRef<number | null>(null)
  const responseDelayTimerRef = useRef<number | null>(null)
  const holdingRef = useRef(false)
  const captureActiveRef = useRef(false)
  const micStartingRef = useRef(false)
  const micRequestRef = useRef(0)
  const responseActiveRef = useRef(false)
  const phaseRef = useRef<RealtimePhase>('idle')
  const beginCaptureRef = useRef<() => void>(() => undefined)
  const voiceTurnRef = useRef(0)
  const pendingActionRef = useRef<PendingEmaAction | null>(null)
  const inputMeterRef = useRef<AudioMeter | null>(null)
  const outputMeterRef = useRef<AudioMeter | null>(null)
  const inputLevelRef = useRef(0)
  const outputLevelRef = useRef(0)

  const [realtimePhase, setRealtimePhaseState] = useState<RealtimePhase>('idle')
  const [pressed, setPressed] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [visualResult, setVisualResult] = useState<ProjectVisualResult | null>(null)

  const setRealtimePhase = useCallback((phase: RealtimePhase) => {
    phaseRef.current = phase
    setRealtimePhaseState(phase)
  }, [])

  const clearIdleTimer = useCallback(() => {
    if (realtimeIdleTimerRef.current !== null) {
      window.clearTimeout(realtimeIdleTimerRef.current)
      realtimeIdleTimerRef.current = null
    }
  }, [])

  const clearResponseDelayTimer = useCallback(() => {
    if (responseDelayTimerRef.current !== null) {
      window.clearTimeout(responseDelayTimerRef.current)
      responseDelayTimerRef.current = null
    }
  }, [])

  const stopAudioMeter = useCallback((meterRef: { current: AudioMeter | null }, reset: () => void) => {
    const meter = meterRef.current
    meterRef.current = null
    if (!meter) return
    window.cancelAnimationFrame(meter.frame)
    void meter.context.close().catch(() => undefined)
    reset()
  }, [])

  const startAudioMeter = useCallback((
    stream: MediaStream,
    meterRef: { current: AudioMeter | null },
    update: (level: number) => void,
  ) => {
    stopAudioMeter(meterRef, () => update(0))
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return

    try {
      const context = new AudioContextClass()
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.76
      const source = context.createMediaStreamSource(stream)
      source.connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      const meter: AudioMeter = { context, frame: 0 }
      meterRef.current = meter

      const read = () => {
        if (meterRef.current !== meter) return
        analyser.getByteTimeDomainData(samples)
        let energy = 0
        for (const sample of samples) {
          const normalized = (sample - 128) / 128
          energy += normalized * normalized
        }
        update(Math.min(1, Math.sqrt(energy / samples.length) * 4.6))
        meter.frame = window.requestAnimationFrame(read)
      }
      meter.frame = window.requestAnimationFrame(read)
      void context.resume().catch(() => undefined)
    } catch {
      update(0)
    }
  }, [stopAudioMeter])

  const stopMicrophone = useCallback((stream = realtimeStreamRef.current) => {
    if (!stream) return
    stream.getAudioTracks().forEach((track) => {
      track.enabled = false
      track.stop()
    })
    if (realtimeStreamRef.current === stream) realtimeStreamRef.current = null
    stopAudioMeter(inputMeterRef, () => { inputLevelRef.current = 0 })
  }, [stopAudioMeter])

  const stopRealtime = useCallback(() => {
    realtimeActiveRef.current = false
    realtimeConnectingRef.current = false
    responseActiveRef.current = false
    captureActiveRef.current = false
    holdingRef.current = false
    micStartingRef.current = false
    micRequestRef.current += 1
    pendingActionRef.current = null
    setPressed(false)
    setRealtimePhase('idle')
    clearIdleTimer()
    clearResponseDelayTimer()

    stopMicrophone()
    stopAudioMeter(outputMeterRef, () => { outputLevelRef.current = 0 })

    const channel = realtimeChannelRef.current
    realtimeChannelRef.current = null
    try {
      channel?.close()
    } catch {
      // Bereits geschlossene Data Channels brauchen keine weitere Behandlung.
    }

    realtimeSenderRef.current = null

    const peer = realtimePeerRef.current
    realtimePeerRef.current = null
    try {
      peer?.close()
    } catch {
      // Bereits geschlossene Peer Connections brauchen keine weitere Behandlung.
    }

    if (realtimeAudioRef.current) {
      realtimeAudioRef.current.pause()
      realtimeAudioRef.current.srcObject = null
      realtimeAudioRef.current = null
    }
  }, [clearIdleTimer, clearResponseDelayTimer, setRealtimePhase, stopAudioMeter, stopMicrophone])

  const resetRealtimeIdleTimer = useCallback(() => {
    clearIdleTimer()
    realtimeIdleTimerRef.current = window.setTimeout(() => {
      if (!holdingRef.current && !responseActiveRef.current) stopRealtime()
    }, REALTIME_IDLE_MS)
  }, [clearIdleTimer, stopRealtime])

  const beginCapture = useCallback(async () => {
    const channel = realtimeChannelRef.current
    const sender = realtimeSenderRef.current
    if (
      !holdingRef.current
      || captureActiveRef.current
      || micStartingRef.current
      || !channel
      || channel.readyState !== 'open'
      || !sender
    ) return

    clearResponseDelayTimer()
    micStartingRef.current = true
    const requestId = ++micRequestRef.current

    try {
      if (responseActiveRef.current) {
        channel.send(JSON.stringify({ type: 'response.cancel' }))
      }
      if (phaseRef.current === 'speaking') {
        channel.send(JSON.stringify({ type: 'output_audio_buffer.clear' }))
      }
      channel.send(JSON.stringify({ type: 'input_audio_buffer.clear' }))

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      if (requestId !== micRequestRef.current || !holdingRef.current) {
        stopMicrophone(stream)
        return
      }

      const track = stream.getAudioTracks()[0]
      if (!track) {
        stopMicrophone(stream)
        setRealtimePhase('error')
        return
      }

      await sender.replaceTrack(track)

      if (requestId !== micRequestRef.current || !holdingRef.current) {
        await sender.replaceTrack(null).catch(() => undefined)
        stopMicrophone(stream)
        return
      }

      realtimeStreamRef.current = stream
      startAudioMeter(stream, inputMeterRef, (level) => { inputLevelRef.current = level })
      captureActiveRef.current = true
      responseActiveRef.current = false
      setRealtimePhase('listening')
      resetRealtimeIdleTimer()
    } catch (error) {
      console.error('EMA Push-to-Talk microphone failed:', error instanceof Error ? error.message : 'unknown error')
      captureActiveRef.current = false
      setRealtimePhase('error')
    } finally {
      if (requestId === micRequestRef.current) micStartingRef.current = false
    }
  }, [clearResponseDelayTimer, resetRealtimeIdleTimer, setRealtimePhase, startAudioMeter, stopMicrophone])

  beginCaptureRef.current = () => {
    void beginCapture()
  }

  const finishCapture = useCallback(() => {
    holdingRef.current = false
    setPressed(false)
    micRequestRef.current += 1
    micStartingRef.current = false

    const stream = realtimeStreamRef.current
    const hadCapture = captureActiveRef.current && Boolean(stream)
    captureActiveRef.current = false

    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false
      })
    }

    const channel = realtimeChannelRef.current
    if (hadCapture && channel?.readyState === 'open') {
      voiceTurnRef.current += 1
      channel.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
      clearResponseDelayTimer()
      setRealtimePhase('thinking')
      resetRealtimeIdleTimer()

      responseDelayTimerRef.current = window.setTimeout(() => {
        responseDelayTimerRef.current = null
        if (
          holdingRef.current
          || realtimeChannelRef.current !== channel
          || channel.readyState !== 'open'
        ) return

        channel.send(JSON.stringify({
          type: 'response.create',
          response: { output_modalities: ['audio'] },
        }))
        responseActiveRef.current = true
        resetRealtimeIdleTimer()
      }, RESPONSE_DELAY_MS)
    } else if (realtimeActiveRef.current) {
      setRealtimePhase('ready')
    }

    if (stream) {
      window.setTimeout(() => {
        if (realtimeStreamRef.current === stream) {
          void realtimeSenderRef.current?.replaceTrack(null).catch(() => undefined)
          realtimeStreamRef.current = null
        }
        stopMicrophone(stream)
      }, MIC_RELEASE_GRACE_MS)
    }
  }, [clearResponseDelayTimer, resetRealtimeIdleTimer, setRealtimePhase, stopMicrophone])

  const handleRealtimeEvent = useCallback(async (channel: RTCDataChannel, event: RealtimeServerEvent) => {
    resetRealtimeIdleTimer()

    if (event.type === 'response.created') {
      responseActiveRef.current = true
      setRealtimePhase('thinking')
      return
    }

    if (event.type === 'response.output_audio.delta') {
      setRealtimePhase('speaking')
      return
    }

    if (event.type === 'response.output_audio.done') {
      if (!holdingRef.current) setRealtimePhase('ready')
      return
    }

    if (event.type === 'response.done') {
      const functionCalls = event.response?.output?.filter((item) => item.type === 'function_call' && item.call_id) ?? []

      if (functionCalls.length > 0) {
        setRealtimePhase('thinking')
        let navigationTarget: Destination | null = null

        for (const functionCall of functionCalls) {
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(functionCall.arguments ?? '{}') as Record<string, unknown>
          } catch {
            args = {}
          }

          let output: Record<string, unknown>

          if (functionCall.name === 'open_ema_area') {
            const requestedPath = typeof args.path === 'string' ? args.path : ''
            const destination = DESTINATIONS.find((item) => item.href === requestedPath)
            navigationTarget = destination ?? null
            output = destination
              ? { success: true, opened: destination.label }
              : { success: false, error: 'Dieser Bereich ist nicht für Sprachnavigation freigegeben.' }
          } else if (functionCall.name === 'prepare_create_project') {
            const projectName = typeof args.project_name === 'string' ? args.project_name.trim() : ''
            const projectType = typeof args.project_type === 'string' ? args.project_type : ''
            if (!projectName || !PROJECT_TYPE_LABELS[projectType]) {
              output = { success: false, error: 'Projektname und ein gültiger Projekttyp werden benötigt.' }
            } else {
              const typeLabel = PROJECT_TYPE_LABELS[projectType]
              pendingActionRef.current = {
                kind: 'create_project',
                data: args,
                preparedTurn: voiceTurnRef.current,
                label: `${projectName} als ${typeLabel}`,
              }
              output = {
                success: true,
                requires_confirmation: true,
                confirmation_prompt: `Soll ich das Projekt „${projectName}“ als ${typeLabel} jetzt anlegen?`,
              }
            }
          } else if (functionCall.name === 'prepare_project_expose') {
            const projectQuery = typeof args.project_query === 'string' ? args.project_query.trim() : ''
            if (!projectQuery) {
              output = { success: false, error: 'Projektname oder Projektnummer fehlt.' }
            } else {
              try {
                const knowledgeResponse = await fetch('/api/ema/knowledge', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tool: 'get_project_details', args: { query: projectQuery } }),
                })
                const payload = await knowledgeResponse.json().catch(() => null) as {
                  ok?: boolean
                  result?: {
                    found?: boolean
                    project?: { id?: string; project_name?: string; project_number?: string }
                  }
                  error?: string
                } | null
                const project = payload?.result?.project
                if (!knowledgeResponse.ok || !payload?.ok || !payload.result?.found || !project?.id) {
                  output = { success: false, error: payload?.error ?? 'Das Projekt wurde nicht eindeutig gefunden.' }
                } else {
                  const label = [project.project_number, project.project_name].filter(Boolean).join(' – ')
                  pendingActionRef.current = {
                    kind: 'open_expose',
                    projectId: project.id,
                    preparedTurn: voiceTurnRef.current,
                    label,
                  }
                  output = {
                    success: true,
                    requires_confirmation: true,
                    project: label,
                    confirmation_prompt: `Soll ich das Exposé für ${label} jetzt öffnen?`,
                  }
                }
              } catch {
                output = { success: false, error: 'EMA konnte das Projekt gerade nicht prüfen.' }
              }
            }
          } else if (functionCall.name === 'confirm_ema_action') {
            const pending = pendingActionRef.current
            if (!pending) {
              output = { success: false, error: 'Es ist keine EMA-Aktion zur Bestätigung vorbereitet.' }
            } else if (voiceTurnRef.current <= pending.preparedTurn) {
              output = {
                success: false,
                error: 'Die Bestätigung muss in einer neuen Sprechrunde vom Nutzer kommen.',
              }
            } else if (pending.kind === 'open_expose') {
              navigationTarget = { label: 'Exposé', href: `/expose/${pending.projectId}` }
              pendingActionRef.current = null
              output = { success: true, opened: pending.label }
            } else {
              try {
                const actionResponse = await fetch('/api/ema/actions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'create_project', data: pending.data }),
                })
                const payload = await actionResponse.json().catch(() => null) as {
                  ok?: boolean
                  result?: {
                    id?: string
                    project_number?: string
                    project_name?: string
                    href?: string
                  }
                  error?: string
                } | null
                if (!actionResponse.ok || !payload?.ok || !payload.result?.id || !payload.result.href) {
                  output = { success: false, error: payload?.error ?? 'Das Projekt konnte nicht erstellt werden.' }
                } else {
                  pendingActionRef.current = null
                  navigationTarget = { label: 'Projekt', href: payload.result.href }
                  output = {
                    success: true,
                    created: [payload.result.project_number, payload.result.project_name].filter(Boolean).join(' – '),
                  }
                }
              } catch {
                output = { success: false, error: 'Das Projekt konnte gerade nicht erstellt werden.' }
              }
            }
          } else if (functionCall.name === 'cancel_ema_action') {
            const pending = pendingActionRef.current
            pendingActionRef.current = null
            output = {
              success: true,
              cancelled: pending?.label ?? 'vorbereitete EMA-Aktion',
            }
          } else if (
            functionCall.name === 'get_portfolio_summary'
            || functionCall.name === 'search_ema_projects'
            || functionCall.name === 'get_project_details'
            || functionCall.name === 'search_ema_country_list_projects'
            || functionCall.name === 'search_ema_investors'
            || functionCall.name === 'get_investor_details'
            || functionCall.name === 'search_ema_partners'
            || functionCall.name === 'get_partner_details'
            || functionCall.name === 'search_ema_documents'
            || functionCall.name === 'get_document_details'
          ) {
            try {
              const knowledgeResponse = await fetch('/api/ema/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool: functionCall.name, args }),
              })
              const payload = await knowledgeResponse.json().catch(() => null) as {
                ok?: boolean
                result?: unknown
                error?: string
              } | null
              const nextVisualResult = knowledgeResponse.ok && payload?.ok
                ? visualResultFromTool(functionCall.name, payload.result, args)
                : null
              if (nextVisualResult) {
                setVisualResult(nextVisualResult)
                setWorkspaceOpen(true)
              }
              output = knowledgeResponse.ok && payload?.ok
                ? { success: true, data: payload.result }
                : { success: false, error: payload?.error ?? 'EMA konnte die aktuellen EMA-Daten nicht lesen.' }
            } catch {
              output = { success: false, error: 'EMA konnte die aktuellen EMA-Daten nicht lesen.' }
            }
          } else {
            output = { success: false, error: 'Unbekanntes EMA-Werkzeug.' }
          }

          if (channel.readyState !== 'open') return
          channel.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: functionCall.call_id,
              output: JSON.stringify(output),
            },
          }))
        }

        if (channel.readyState === 'open') {
          channel.send(JSON.stringify({
            type: 'response.create',
            response: { output_modalities: ['audio'] },
          }))
          responseActiveRef.current = true
        }

        if (navigationTarget) router.push(navigationTarget.href)
        return
      }

      responseActiveRef.current = false
      if (!holdingRef.current) setRealtimePhase('ready')
      return
    }

    if (event.type === 'error') {
      console.error('EMA Realtime event error:', event.error?.message ?? 'Unbekannter Fehler')
      responseActiveRef.current = false
      if (!holdingRef.current) setRealtimePhase('ready')
    }
  }, [resetRealtimeIdleTimer, router, setRealtimePhase])

  const startRealtime = useCallback(async () => {
    if (realtimeActiveRef.current || realtimeConnectingRef.current) return
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      setRealtimePhase('error')
      return
    }

    realtimeConnectingRef.current = true
    setRealtimePhase('connecting')

    try {
      const peer = new RTCPeerConnection()
      realtimePeerRef.current = peer

      const transceiver = peer.addTransceiver('audio', { direction: 'sendrecv' })
      realtimeSenderRef.current = transceiver.sender

      const audio = document.createElement('audio')
      audio.autoplay = true
      audio.setAttribute('playsinline', 'true')
      realtimeAudioRef.current = audio

      peer.ontrack = (event) => {
        const stream = event.streams[0] ?? null
        audio.srcObject = stream
        if (stream) startAudioMeter(stream, outputMeterRef, (level) => { outputLevelRef.current = level })
        if (holdingRef.current) void audio.play().catch(() => undefined)
      }

      const channel = peer.createDataChannel('oai-events')
      realtimeChannelRef.current = channel

      channel.addEventListener('open', () => {
        realtimeConnectingRef.current = false
        realtimeActiveRef.current = true
        setRealtimePhase('ready')
        resetRealtimeIdleTimer()
        if (holdingRef.current) beginCaptureRef.current()
      })

      channel.addEventListener('message', (message) => {
        try {
          const event = JSON.parse(String(message.data)) as RealtimeServerEvent
          void handleRealtimeEvent(channel, event)
        } catch {
          // Unbekannte Realtime-Events werden ignoriert.
        }
      })

      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      if (!offer.sdp) throw new Error('WebRTC-Angebot enthält keine SDP-Daten.')

      const response = await fetch('/api/ema/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp,
      })

      if (!response.ok) {
        const details = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(details?.error ?? 'EMA AI konnte die Sitzung nicht starten.')
      }

      const answerSdp = await response.text()
      await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      peer.addEventListener('connectionstatechange', () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
          stopRealtime()
        }
      })
    } catch (error) {
      console.error('EMA Realtime connection failed:', error instanceof Error ? error.message : 'unknown error')
      stopRealtime()
      setRealtimePhase('error')
    }
  }, [handleRealtimeEvent, resetRealtimeIdleTimer, setRealtimePhase, startAudioMeter, stopRealtime])

  const handlePressStart = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer Capture ist auf älteren Safari-Versionen nicht immer verfügbar.
    }

    holdingRef.current = true
    setPressed(true)
    clearResponseDelayTimer()
    triggerHaptic()
    void realtimeAudioRef.current?.play().catch(() => undefined)

    if (realtimeActiveRef.current && realtimeChannelRef.current?.readyState === 'open') {
      beginCaptureRef.current()
    } else {
      void startRealtime()
    }
  }, [clearResponseDelayTimer, startRealtime])

  const handlePressEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Pointer Capture ist auf älteren Safari-Versionen nicht immer verfügbar.
    }
    finishCapture()
    triggerHaptic(6)
  }, [finishCapture])

  useEffect(() => {
    const warmupTimer = window.setTimeout(() => {
      void startRealtime()
    }, 300)

    return () => {
      window.clearTimeout(warmupTimer)
      stopRealtime()
    }
  }, [startRealtime, stopRealtime])

  useEffect(() => {
    if (!workspaceOpen) return
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWorkspaceOpen(false)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [workspaceOpen])

  const speaking = realtimePhase === 'speaking'
  const listening = realtimePhase === 'listening' || pressed
  const ready = realtimePhase === 'ready'

  return (
    <>
      <div className="fixed bottom-[calc(5.8rem+env(safe-area-inset-bottom))] right-4 z-30 md:bottom-6 md:right-6">
        <button
          type="button"
          onClick={() => setWorkspaceOpen(true)}
          aria-label={`EMA AI öffnen, ${userName}`}
          title="EMA AI öffnen"
          className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-[#07142F]/15 bg-white shadow-[0_14px_38px_rgba(7,20,47,0.28)] transition hover:scale-105 hover:border-[#63C800]/70"
        >
          <span className={`pointer-events-none absolute inset-[2px] rounded-full ${speaking ? 'animate-pulse shadow-[inset_0_0_30px_11px_rgba(99,200,0,0.58)]' : ready ? 'shadow-[inset_0_0_15px_4px_rgba(99,200,0,0.18)]' : ''}`} />
          <Image
            src="/brand/ema-mark.png"
            alt=""
            width={506}
            height={247}
            className="pointer-events-none relative z-10 h-auto w-[38px] drop-shadow-[0_1px_2px_rgba(7,20,47,0.12)]"
            priority
            draggable={false}
          />
          {ready ? <span className="pointer-events-none absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#63C800]" /> : null}
        </button>
      </div>

      {workspaceOpen ? (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="EMA AI Arbeitsbereich"
          className="fixed inset-0 z-[100] overflow-y-auto bg-[#f6f8fb] text-[#07142F]"
        >
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(99,200,0,0.13),transparent_31%),radial-gradient(circle_at_84%_38%,rgba(29,78,216,0.10),transparent_34%)]" />

          <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between border-b border-[#07142F]/10 bg-white/[0.85] px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl md:px-10">
            <div className="flex items-center gap-3">
              <Image src="/brand/ema-mark.png" alt="EMA Enterprise" width={506} height={247} className="h-auto w-16" priority />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#63C800]">EMA Intelligence</p>
                <h1 className="text-lg font-extrabold tracking-tight md:text-xl">EMA AI</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWorkspaceOpen(false)}
              aria-label="EMA AI schließen"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#07142F]/10 bg-white text-[#07142F] shadow-sm transition hover:border-[#63C800]/60 hover:bg-[#f4f8ef]"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <main className="relative mx-auto grid min-h-[calc(100dvh-5rem)] w-full max-w-[1500px] grid-cols-1 gap-7 px-5 py-7 md:px-10 lg:grid-cols-[minmax(360px,0.82fr)_minmax(520px,1.18fr)] lg:items-center lg:gap-12 lg:py-10">
            <div className="flex min-h-[520px] flex-col items-center justify-center text-center lg:min-h-[680px]">
              <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#63C800]/25 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#305f12] shadow-sm backdrop-blur">
                <Sparkles className="h-4 w-4 text-[#63C800]" />
                OpenAI Realtime verbunden
              </div>

              <div className="relative h-[300px] w-[300px] sm:h-[410px] sm:w-[410px]">
                <EmaVoiceOrb
                  phase={realtimePhase}
                  inputLevelRef={inputLevelRef}
                  outputLevelRef={outputLevelRef}
                />
              </div>

              <div className="-mt-3 min-h-[76px]">
                <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">{REALTIME_STATUS[realtimePhase]}</p>
                <p className="mt-2 text-sm text-[#647089]">
                  {listening ? 'Sprich jetzt – beim Loslassen wird deine Frage gesendet.' : 'Frage EMA nach Projekten, Zahlen, Dokumenten oder nächsten Schritten.'}
                </p>
              </div>

              <button
                type="button"
                onPointerDown={handlePressStart}
                onPointerUp={handlePressEnd}
                onPointerCancel={handlePressEnd}
                onContextMenu={(event) => event.preventDefault()}
                aria-label={listening ? 'EMA hört zu. Loslassen zum Senden.' : 'Gedrückt halten, um mit EMA zu sprechen.'}
                aria-pressed={listening}
                className={`mt-5 flex min-h-16 touch-none select-none items-center gap-3 rounded-full px-8 text-base font-extrabold text-white shadow-[0_16px_34px_rgba(7,20,47,0.24)] transition [-webkit-touch-callout:none] [-webkit-user-select:none] ${listening ? 'scale-[0.97] bg-[#397c00]' : 'bg-[#07142F] hover:bg-[#10264f]'}`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${listening ? 'bg-[#63C800]' : 'bg-white/[0.12]'}`}>
                  <Mic className="h-5 w-5" />
                </span>
                {listening ? 'Loslassen zum Senden' : 'Gedrückt halten zum Sprechen'}
              </button>
            </div>

            <div className="self-stretch pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:flex lg:items-center">
              {visualResult ? (
                <div className="w-full overflow-hidden rounded-[28px] border border-[#07142F]/10 bg-white shadow-[0_24px_70px_rgba(7,20,47,0.12)]">
                  <div className="flex flex-col gap-2 border-b border-[#07142F]/10 px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#63C800]">Live-Ansicht</p>
                      <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{visualResult.title}</h2>
                    </div>
                    <p className="text-sm text-[#657188]">{visualResult.subtitle}</p>
                  </div>

                  {visualResult.rows.length > 0 ? (
                    <div className="max-h-[58dvh] overflow-auto">
                      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-[#f1f4f8] text-[11px] uppercase tracking-[0.16em] text-[#667187]">
                          <tr>
                            <th className="px-6 py-4 font-bold">Projekt</th>
                            <th className="px-5 py-4 font-bold">Typ</th>
                            <th className="px-5 py-4 font-bold">Standort</th>
                            <th className="px-5 py-4 font-bold">Status</th>
                            <th className="px-6 py-4 text-right font-bold">Leistung</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visualResult.rows.map((project) => (
                            <tr
                              key={project.id}
                              className="border-t border-[#07142F]/[0.08] transition hover:bg-[#63C800]/[0.06]"
                            >
                              <td className="px-6 py-4">
                                <Link
                                  href={`/projects/${project.id}`}
                                  className="font-extrabold text-[#07142F] underline-offset-4 hover:text-[#397c00] hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#63C800]"
                                >
                                  {project.project_name || 'Ohne Projektnamen'}
                                </Link>
                                <p className="mt-0.5 text-xs text-[#778197]">{project.project_number || 'Keine Projektnummer'}</p>
                              </td>
                              <td className="px-5 py-4 font-semibold">{projectTypeLabel(project.project_type)}</td>
                              <td className="px-5 py-4 text-[#4f5b70]">
                                {[project.location?.city, project.location?.state, project.location?.country].filter(Boolean).join(', ') || '–'}
                              </td>
                              <td className="px-5 py-4">
                                <span className="inline-flex rounded-full bg-[#edf6e6] px-3 py-1 text-xs font-bold text-[#356b14]">
                                  {project.project_stage || project.status || 'Offen'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-extrabold">{formatCapacity(project)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-8 py-16 text-center text-[#657188]">Keine passenden Projekte gefunden.</div>
                  )}
                </div>
              ) : (
                <div className="w-full rounded-[28px] border border-[#07142F]/10 bg-white/[0.86] p-7 shadow-[0_24px_70px_rgba(7,20,47,0.10)] backdrop-blur sm:p-9">
                  <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#63C800]">Was EMA zeigen kann</p>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Fragen werden hier sichtbar.</h2>
                  <p className="mt-3 max-w-xl text-base leading-7 text-[#647089]">
                    Ergebnisse erscheinen automatisch als Tabelle oder übersichtliche Kennzahlen – während EMA dir die kurze Antwort vorliest.
                  </p>
                  <div className="mt-8 grid gap-3">
                    {[
                      'Zeig mir alle Projekte in Deutschland.',
                      'Wie groß ist unser aktuelles PV-Portfolio?',
                      'Finde alle RTB-Projekte.',
                    ].map((prompt) => (
                      <div key={prompt} className="rounded-2xl border border-[#07142F]/[0.08] bg-[#f6f8fb] px-5 py-4 text-sm font-bold text-[#25324c]">
                        „{prompt}“
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>
        </section>
      ) : null}
    </>
  )
}
