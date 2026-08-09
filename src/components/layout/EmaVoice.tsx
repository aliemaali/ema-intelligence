'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

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

  const [realtimePhase, setRealtimePhaseState] = useState<RealtimePhase>('idle')
  const [pressed, setPressed] = useState(false)

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

  const stopMicrophone = useCallback((stream = realtimeStreamRef.current) => {
    if (!stream) return
    stream.getAudioTracks().forEach((track) => {
      track.enabled = false
      track.stop()
    })
    if (realtimeStreamRef.current === stream) realtimeStreamRef.current = null
  }, [])

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
  }, [clearIdleTimer, clearResponseDelayTimer, setRealtimePhase, stopMicrophone])

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
  }, [clearResponseDelayTimer, resetRealtimeIdleTimer, setRealtimePhase, stopMicrophone])

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
        audio.srcObject = event.streams[0] ?? null
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
  }, [handleRealtimeEvent, resetRealtimeIdleTimer, setRealtimePhase, stopRealtime])

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

  const speaking = realtimePhase === 'speaking'
  const listening = realtimePhase === 'listening' || pressed
  const ready = realtimePhase === 'ready'

  return (
    <div className="fixed bottom-[calc(5.8rem+env(safe-area-inset-bottom))] right-4 z-40 md:bottom-6 md:right-6">
      <button
        type="button"
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={listening ? 'EMA hört zu. Loslassen zum Senden.' : `Gedrückt halten, um mit EMA zu sprechen, ${userName}`}
        aria-pressed={listening}
        title={listening ? 'Loslassen zum Senden' : 'Gedrückt halten zum Sprechen'}
        className={`relative flex h-16 w-16 touch-none select-none [-webkit-touch-callout:none] [-webkit-user-select:none] items-center justify-center overflow-hidden rounded-full border-2 bg-white shadow-[0_14px_38px_rgba(7,20,47,0.28)] transition duration-150 ${listening ? 'scale-95 border-[#63C800]' : 'border-[#07142F]/15 hover:border-[#63C800]/70'}`}
      >
        <span
          className={`pointer-events-none absolute inset-[2px] rounded-full transition-opacity duration-200 ${
            listening
              ? 'opacity-100 shadow-[inset_0_0_30px_11px_rgba(99,200,0,0.62)]'
              : speaking
                ? 'animate-[pulse_650ms_cubic-bezier(0.4,0,0.6,1)_infinite] opacity-100 shadow-[inset_0_0_30px_11px_rgba(99,200,0,0.58)]'
                : ready
                  ? 'opacity-55 shadow-[inset_0_0_15px_4px_rgba(99,200,0,0.18)]'
                  : 'opacity-35 shadow-[inset_0_0_12px_3px_rgba(7,20,47,0.10)]'
          }`}
          aria-hidden="true"
        />

        {(listening || speaking) ? (
          <span
            className={`pointer-events-none absolute inset-[8px] rounded-full bg-[radial-gradient(circle,rgba(99,200,0,0.32)_0%,rgba(99,200,0,0.11)_55%,rgba(255,255,255,0)_76%)] ${speaking ? 'animate-[pulse_500ms_ease-in-out_infinite]' : ''}`}
            aria-hidden="true"
          />
        ) : null}

        <span className="pointer-events-none absolute left-[5px] flex items-center gap-[2px]" aria-hidden="true">
          <span className={`h-2 w-[2px] rounded-full bg-[#07142F] ${speaking ? 'animate-[pulse_500ms_ease-in-out_infinite]' : 'opacity-35'}`} />
          <span className={`h-4 w-[2px] rounded-full bg-[#63C800] ${listening || speaking ? 'opacity-100' : 'opacity-40'}`} />
        </span>

        <Image
          src="/brand/ema-mark.png"
          alt=""
          width={506}
          height={247}
          className="pointer-events-none relative z-10 h-auto w-[38px] select-none [-webkit-touch-callout:none] [-webkit-user-select:none] drop-shadow-[0_1px_2px_rgba(7,20,47,0.12)]"
          priority
          draggable={false}
        />

        <span className="pointer-events-none absolute right-[5px] flex items-center gap-[2px]" aria-hidden="true">
          <span className={`h-4 w-[2px] rounded-full bg-[#63C800] ${listening || speaking ? 'opacity-100' : 'opacity-40'}`} />
          <span className={`h-2 w-[2px] rounded-full bg-[#07142F] ${speaking ? 'animate-[pulse_500ms_ease-in-out_infinite]' : 'opacity-35'}`} />
        </span>

        {ready ? (
          <span className="pointer-events-none absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#63C800]" />
        ) : null}
      </button>
    </div>
  )
}
