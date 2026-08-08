'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'

type VoiceState = 'idle' | 'listening' | 'unsupported' | 'error'

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

type SpeechRecognitionResultLike = {
  0?: { transcript?: string }
}

type SpeechRecognitionEventLike = Event & {
  resultIndex?: number
  results?: {
    length?: number
    [index: number]: SpeechRecognitionResultLike | undefined
  }
}

type SpeechRecognitionErrorEventLike = Event & {
  error?: string
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type VoiceWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

type Destination = {
  label: string
  href: string
  patterns: RegExp[]
}

const WAKE_PERSIST_KEY = 'ema-intelligence:voice:wake-active:v2'
const REALTIME_IDLE_MS = 5 * 60 * 1000

const DESTINATIONS: Destination[] = [
  { label: 'Dashboard', href: '/dashboard', patterns: [/\bdashboard\b/, /\bstartseite\b/, /\bubersicht\b/] },
  { label: 'Projekt-Import', href: '/project-import', patterns: [/projekt.?import/, /projekte? importieren/] },
  { label: 'Projektprüfung', href: '/projects/audit', patterns: [/projekt.?pruf/, /portfolio.?pruf/, /\baudit\b/] },
  { label: 'Projektarchiv', href: '/projects/archive', patterns: [/projekt.?archiv/, /archivierte projekte/] },
  { label: 'Neues Projekt', href: '/projects/new', patterns: [/neues projekt/, /projekt anlegen/, /projekt erstellen/] },
  { label: 'Projekte', href: '/projects', patterns: [/\bprojekte?\b/, /projektliste/] },
  { label: 'Investoren', href: '/investors', patterns: [/\binvestor/, /\binvestoren\b/] },
  { label: 'Partner', href: '/partners', patterns: [/\bpartner\b/] },
  { label: 'Partner-Einreichungen', href: '/partner-submissions', patterns: [/partner.?einreich/, /einreichungen/] },
  { label: 'Dokumente', href: '/dokumente', patterns: [/\bdokument/, /unterlagen/] },
  { label: 'Kalender', href: '/calendar', patterns: [/\bkalender\b/, /\btermine?\b/] },
  { label: 'CAPEX', href: '/capex', patterns: [/\bcapex\b/, /kostenrechner/] },
  { label: 'Deals', href: '/deals', patterns: [/\bdeals?\b/, /transaktionen/] },
  { label: 'Akquise', href: '/acquisition', patterns: [/\bakquise\b/, /acquisition/, /leads?/] },
  { label: 'EMA AI', href: '/ai', patterns: [/\bema ai\b/, /\bki bereich\b/, /\bai bereich\b/] },
  { label: 'Microsoft 365', href: '/microsoft', patterns: [/microsoft/, /outlook/, /teams/] },
  { label: 'Einstellungen', href: '/settings', patterns: [/einstellungen/, /settings/] },
]

const PATH_LABELS: Array<[RegExp, string]> = [
  [/^\/projects\/[^/]+\/analysis/, 'Projektanalyse'],
  [/^\/projects\/[^/]+\/documents/, 'Projektdokumente'],
  [/^\/projects\/[^/]+\/investors/, 'Projektinvestoren'],
  [/^\/projects\/[^/]+/, 'Projekt'],
  ...DESTINATIONS.map((item) => [new RegExp(`^${item.href.replaceAll('/', '\\/')}(?:\\/|$)`), item.label] as [RegExp, string]),
]

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[!?.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wakeMatch(value: string) {
  return normalizeText(value).match(/\b(?:ema|emma)\b|(?:^|\s)e\s*m\s*a(?=\s|$)/)
}

function rememberWakeMode(active: boolean) {
  try {
    if (active) window.localStorage.setItem(WAKE_PERSIST_KEY, '1')
    else window.localStorage.removeItem(WAKE_PERSIST_KEY)
  } catch {
    // Sprachsteuerung funktioniert auch, wenn dauerhafter Browser-Speicher nicht verfügbar ist.
  }
}

function hasRememberedWakeMode() {
  try {
    return window.localStorage.getItem(WAKE_PERSIST_KEY) === '1'
  } catch {
    return false
  }
}

function currentArea(pathname: string) {
  return PATH_LABELS.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'EMA Intelligence'
}

export function EmaVoice({ userName }: { userName: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const wakeModeRef = useRef(false)
  const followUpRef = useRef(false)
  const realtimeActiveRef = useRef(false)
  const realtimePeerRef = useRef<RTCPeerConnection | null>(null)
  const realtimeChannelRef = useRef<RTCDataChannel | null>(null)
  const realtimeStreamRef = useRef<MediaStream | null>(null)
  const realtimeAudioRef = useRef<HTMLAudioElement | null>(null)
  const restartTimerRef = useRef<number | null>(null)
  const followUpTimerRef = useRef<number | null>(null)
  const realtimeIdleTimerRef = useRef<number | null>(null)

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [, setAiActive] = useState(false)
  const [, setPanelOpen] = useState(false)
  const [, setHeard] = useState('')
  const [, setAnswer] = useState('Tippe einmal auf EMA. Danach wartet EMA auf „EMA“.')
  const [, setStatus] = useState('EMA-Modus aus')

  const firstName = userName.trim().split(/\s+/)[0] || 'da'
  const address = firstName

  const clearTimer = useCallback((timerRef: React.MutableRefObject<number | null>) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const updateListeningStatus = useCallback(() => {
    if (!wakeModeRef.current) {
      setStatus('EMA-Modus aus')
      return
    }
    setStatus(followUpRef.current ? 'Ich warte auf deinen Befehl …' : 'EMA-Modus aktiv · sag „EMA“')
  }, [])

  const setFollowUp = useCallback((enabled: boolean) => {
    followUpRef.current = enabled
    clearTimer(followUpTimerRef)
    if (enabled) {
      followUpTimerRef.current = window.setTimeout(() => {
        followUpRef.current = false
        updateListeningStatus()
      }, 7500)
    }
    updateListeningStatus()
  }, [clearTimer, updateListeningStatus])

  const startRecognitionRef = useRef<() => void>(() => undefined)

  const scheduleListen = useCallback((delay = 280) => {
    clearTimer(restartTimerRef)
    if (!wakeModeRef.current || realtimeActiveRef.current) return
    restartTimerRef.current = window.setTimeout(() => startRecognitionRef.current(), delay)
  }, [clearTimer])

  const respond = useCallback((message: string, followUp = false, onFinished?: () => void) => {
    setAnswer(message)
    setPanelOpen(true)
    setVoiceState('listening')
    if (followUp) setFollowUp(true)
    else updateListeningStatus()
    if (!recognitionRef.current) scheduleListen(160)
    onFinished?.()
  }, [scheduleListen, setFollowUp, updateListeningStatus])

  const stopRealtime = useCallback((resumeWake = true) => {
    const wasActive = realtimeActiveRef.current
    realtimeActiveRef.current = false
    setAiActive(false)
    clearTimer(realtimeIdleTimerRef)

    const channel = realtimeChannelRef.current
    realtimeChannelRef.current = null
    try {
      channel?.close()
    } catch {
      // Bereits geschlossene Data Channels brauchen keine weitere Behandlung.
    }

    const peer = realtimePeerRef.current
    realtimePeerRef.current = null
    try {
      peer?.close()
    } catch {
      // Bereits geschlossene Peer Connections brauchen keine weitere Behandlung.
    }

    realtimeStreamRef.current?.getTracks().forEach((track) => track.stop())
    realtimeStreamRef.current = null

    if (realtimeAudioRef.current) {
      realtimeAudioRef.current.pause()
      realtimeAudioRef.current.srcObject = null
      realtimeAudioRef.current = null
    }

    if (wasActive && resumeWake && wakeModeRef.current) {
      setVoiceState('idle')
      setAnswer('EMA AI beendet. Ich warte wieder auf „EMA“.')
      updateListeningStatus()
      scheduleListen(320)
    }
  }, [clearTimer, scheduleListen, updateListeningStatus])

  const resetRealtimeIdleTimer = useCallback(() => {
    clearTimer(realtimeIdleTimerRef)
    realtimeIdleTimerRef.current = window.setTimeout(() => stopRealtime(true), REALTIME_IDLE_MS)
  }, [clearTimer, stopRealtime])

  const sendRealtimeText = useCallback((text: string) => {
    const channel = realtimeChannelRef.current
    if (!channel || channel.readyState !== 'open') return false

    channel.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    }))
    channel.send(JSON.stringify({
      type: 'response.create',
      response: { output_modalities: ['audio'] },
    }))
    resetRealtimeIdleTimer()
    return true
  }, [resetRealtimeIdleTimer])

  const startRealtime = useCallback(async (initialText?: string) => {
    if (realtimeActiveRef.current) {
      if (initialText) sendRealtimeText(initialText)
      return
    }

    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      respond('EMA AI kann auf diesem Gerät keine direkte Sprachverbindung starten.')
      return
    }

    realtimeActiveRef.current = true
    setAiActive(true)
    setFollowUp(false)
    clearTimer(restartTimerRef)
    clearTimer(followUpTimerRef)
    setPanelOpen(true)
    setVoiceState('listening')
    setStatus('EMA AI verbindet …')
    setAnswer('Einen Moment – ich verbinde die sichere Sprachsitzung.')

    try {
      recognitionRef.current?.abort()
    } catch {
      // Safari kann die lokale Erkennung bereits beendet haben.
    }
    recognitionRef.current = null

    try {
      const peer = new RTCPeerConnection()
      realtimePeerRef.current = peer

      const audio = document.createElement('audio')
      audio.autoplay = true
      audio.setAttribute('playsinline', 'true')
      realtimeAudioRef.current = audio

      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? null
        void audio.play().catch(() => {
          setStatus('EMA AI verbunden · tippe kurz auf EMA, falls du nichts hörst')
        })
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      realtimeStreamRef.current = stream
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream))

      const channel = peer.createDataChannel('oai-events')
      realtimeChannelRef.current = channel

      channel.addEventListener('open', () => {
        setStatus('EMA AI aktiv · sprich einfach weiter')
        setAnswer('EMA AI ist verbunden. Die Stimme ist KI-generiert.')
        resetRealtimeIdleTimer()
        if (initialText) sendRealtimeText(initialText)
      })

      channel.addEventListener('message', (message) => {
        resetRealtimeIdleTimer()
        try {
          const event = JSON.parse(String(message.data)) as RealtimeServerEvent
          if (event.type === 'response.output_audio_transcript.done' && event.transcript?.trim()) {
            setAnswer(event.transcript.trim())
          } else if (event.type === 'input_audio_buffer.speech_started') {
            setStatus('EMA AI hört zu …')
          } else if (event.type === 'response.created') {
            setStatus('EMA AI antwortet …')
          } else if (event.type === 'response.done') {
            const functionCall = event.response?.output?.find((item) => item.type === 'function_call' && item.name === 'open_ema_area')
            if (functionCall?.call_id) {
              let requestedPath = ''
              try {
                const args = JSON.parse(functionCall.arguments ?? '{}') as { path?: unknown }
                if (typeof args.path === 'string') requestedPath = args.path
              } catch {
                // Ungültige Tool-Argumente werden wie ein nicht freigegebener Pfad behandelt.
              }

              const destination = DESTINATIONS.find((item) => item.href === requestedPath)
              channel.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: functionCall.call_id,
                  output: JSON.stringify(destination
                    ? { success: true, opened: destination.label }
                    : { success: false, error: 'Dieser Bereich ist nicht für Sprachnavigation freigegeben.' }),
                },
              }))
              channel.send(JSON.stringify({ type: 'response.create' }))

              if (destination) {
                setAnswer(`Natürlich, ${address}. Ich öffne ${destination.label}.`)
                setStatus('EMA AI navigiert …')
                router.push(destination.href)
                return
              }
            }
            setStatus('EMA AI aktiv · sprich einfach weiter')
          } else if (event.type === 'error') {
            console.error('EMA Realtime event error:', event.error?.message ?? 'Unbekannter Fehler')
            setStatus('EMA AI meldet einen Verbindungsfehler')
          }
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
          stopRealtime(true)
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'EMA AI konnte nicht gestartet werden.'
      stopRealtime(false)
      setVoiceState('error')
      setAnswer(message)
      setStatus('EMA AI nicht verbunden')
      if (wakeModeRef.current) scheduleListen(650)
    }
  }, [address, clearTimer, resetRealtimeIdleTimer, respond, router, scheduleListen, sendRealtimeText, setFollowUp, stopRealtime])

  const runCommand = useCallback((transcript: string, followUpCommand = false) => {
    let command = normalizeText(transcript)
    setHeard(transcript)

    if (!followUpCommand) {
      const wake = wakeMatch(command)
      if (!wake) return
      command = command.slice((wake.index ?? 0) + wake[0].length).trim()
    } else {
      setFollowUp(false)
    }

    if (!command) {
      respond(`Ja, ${address}?`, true)
      return
    }

    if (/\b(guten morgen|morgen|hallo|hi|hey)\b/.test(command)) {
      respond(`Hallo ${address}. EMA ist bereit. Was kann ich für dich tun?`, true)
      return
    }

    if (/wer bin ich|kennst du mich/.test(command)) {
      respond(`Du bist ${firstName}. Natürlich kenne ich dich.`)
      return
    }

    if (/wer bist du|wie heisst du|wie heißt du/.test(command)) {
      respond('Ich bin EMA. Ich kenne die Bereiche und Abläufe von EMA Intelligence und helfe dir direkt in der App.')
      return
    }

    if (/wo bin ich|welcher bereich|was sehe ich/.test(command)) {
      respond(`Du bist gerade im Bereich ${currentArea(pathname)}.`)
      return
    }

    if (/was kannst du|was kannst du alles|hilfe|befehle/.test(command)) {
      respond('Ich kann dich durch EMA führen und Projekte, Investoren, Partner, Dokumente, Kalender, CAPEX, Deals, Akquise und Einstellungen öffnen.')
      return
    }

    if (/was ist (ein )?bess|erklar.*bess/.test(command)) {
      respond('BESS steht für Battery Energy Storage System, also einen Batteriespeicher. EMA führt BESS als eigenen Projekttyp und auch in Hybridprojekten.')
      return
    }

    if (/projektstatus|statusstufen|welche status/.test(command)) {
      respond('Die EMA Projektstufen sind Lead, Vorprüfung, Investorensuche, Due Diligence, LOI, SPA, Closing, verkauft oder abgelehnt.')
      return
    }

    if (/zuruck|vorherige seite/.test(command)) {
      respond(`Natürlich, ${address}. Ich gehe zurück.`, false, () => router.back())
      return
    }

    if (/losch|entfern|versend|schick.*mail|sende.*mail/.test(command)) {
      respond(`Diese Aktion führe ich aus Sicherheitsgründen nicht direkt per Sprache aus, ${address}. Kritische Aktionen brauchen eine Bestätigung.`)
      return
    }

    const destination = DESTINATIONS.find((item) => item.patterns.some((pattern) => pattern.test(command)))
    if (destination) {
      respond(`Natürlich, ${address}. Ich öffne ${destination.label}.`, false, () => router.push(destination.href))
      return
    }

    setAnswer('Das ist eine Frage für EMA AI – ich verbinde die Sprachsitzung.')
    setPanelOpen(true)
    void startRealtime(command)
  }, [address, firstName, pathname, respond, router, setFollowUp, startRealtime])

  const startRecognition = useCallback(() => {
    if (!wakeModeRef.current || recognitionRef.current) return

    const voiceWindow = window as VoiceWindow
    const Recognition = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition
    if (!Recognition) {
      wakeModeRef.current = false
      rememberWakeMode(false)
      setVoiceState('unsupported')
      setAnswer('Die Spracherkennung ist in diesem Browser nicht verfügbar. Bitte teste EMA auf deinem iPhone in Safari oder der installierten App.')
      setStatus('Nicht unterstützt')
      return
    }

    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'de-DE'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const fallbackIndex = Math.max(0, (event.results?.length ?? 1) - 1)
      const index = typeof event.resultIndex === 'number' ? event.resultIndex : fallbackIndex
      const transcript = event.results?.[index]?.[0]?.transcript?.trim()
      if (!transcript) return

      setHeard(transcript)
      if (followUpRef.current) runCommand(transcript, true)
      else if (wakeMatch(transcript)) runCommand(transcript, false)
    }

    recognition.onerror = (event) => {
      const code = event.error ?? 'unbekannt'
      if (code === 'aborted' || code === 'no-speech') return

      if (code === 'not-allowed' || code === 'service-not-allowed') {
        wakeModeRef.current = false
        rememberWakeMode(false)
        setVoiceState('error')
        setAnswer('Bitte erlaube EMA Mikrofon und Spracherkennung in den iPhone-Einstellungen und aktiviere den EMA-Modus danach erneut.')
        setStatus(`Fehler: ${code}`)
        return
      }

      setVoiceState('error')
      setAnswer(`Safari meldet den Spracherkennungsfehler: ${code}.`)
      setStatus(`Fehler: ${code}`)
    }

    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null
      if (!wakeModeRef.current || realtimeActiveRef.current) return
      setVoiceState('idle')
      updateListeningStatus()
      scheduleListen()
    }

    try {
      recognition.start()
      setVoiceState('listening')
      updateListeningStatus()
    } catch {
      recognitionRef.current = null
      setVoiceState('error')
      setAnswer('Safari konnte die Spracherkennung nicht neu starten.')
      setStatus('Fehler beim Neustart')
    }
  }, [runCommand, scheduleListen, updateListeningStatus])

  startRecognitionRef.current = startRecognition

  const toggleWakeMode = useCallback(() => {
    setPanelOpen(true)

    if (wakeModeRef.current) {
      wakeModeRef.current = false
      rememberWakeMode(false)
      setFollowUp(false)
      stopRealtime(false)
      clearTimer(restartTimerRef)
      try {
        recognitionRef.current?.abort()
      } catch {
        // Safari darf beim Beenden bereits geschlossen haben.
      }
      recognitionRef.current = null
      setVoiceState('idle')
      setAnswer('EMA-Modus pausiert. Tippe auf EMA, um mich wieder zu aktivieren.')
      setStatus('EMA-Modus aus')
      return
    }

    wakeModeRef.current = true
    rememberWakeMode(true)
    setVoiceState('idle')
    setHeard('Ich warte auf mein Aktivierungswort …')
    updateListeningStatus()
    respond(`EMA ist bereit, ${address}.`)
  }, [address, clearTimer, respond, setFollowUp, stopRealtime, updateListeningStatus])

  useEffect(() => {
    // AppShell wird zwischen einigen EMA-Hauptbereichen neu gemountet.
    // Den einmal vom Nutzer aktivierten Wake-Modus auf diesem Gerät dauerhaft fortsetzen.
    if (hasRememberedWakeMode()) {
      wakeModeRef.current = true
      setPanelOpen(true)
      setAnswer('EMA-Modus aktiv. Du kannst weiter einfach „EMA“ sagen.')
      setHeard('')
      updateListeningStatus()
      scheduleListen(320)
    }

    return () => {
      wakeModeRef.current = false
      recognitionRef.current?.abort()
      clearTimer(restartTimerRef)
      clearTimer(followUpTimerRef)
      stopRealtime(false)
    }
  }, [clearTimer, scheduleListen, stopRealtime, updateListeningStatus])

  const listening = wakeModeRef.current && voiceState === 'listening'
  const active = wakeModeRef.current

  return (
    <div className="fixed bottom-[calc(5.8rem+env(safe-area-inset-bottom))] right-4 z-[900] md:bottom-6 md:right-6">
      <button
        type="button"
        onClick={toggleWakeMode}
        aria-label={active ? 'EMA-Modus ausschalten' : 'EMA-Modus einschalten'}
        title={active ? 'EMA hört auf das Aktivierungswort' : 'Mit EMA sprechen'}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-white shadow-[0_14px_38px_rgba(7,20,47,0.28)] transition duration-200 active:scale-95 ${
          active ? 'border-[#63C800]' : 'border-[#07142F]/15 hover:border-[#63C800]/70'
        }`}
      >
        {active && <span className="pointer-events-none absolute -inset-1 rounded-full border-2 border-[#63C800]/35" />}
        {listening && <span className="pointer-events-none absolute -inset-2 animate-ping rounded-full border-2 border-[#63C800]/50" />}

        <span className="pointer-events-none absolute left-[5px] flex items-center gap-[2px]" aria-hidden="true">
          <span className={`h-2 w-[2px] rounded-full bg-[#07142F] ${listening ? 'animate-pulse' : 'opacity-35'}`} />
          <span className={`h-4 w-[2px] rounded-full bg-[#63C800] ${listening ? 'animate-pulse' : 'opacity-45'}`} />
        </span>

        <Image
          src="/brand/ema-mark.png"
          alt=""
          width={506}
          height={247}
          className="relative h-auto w-[38px]"
          priority
        />

        <span className="pointer-events-none absolute right-[5px] flex items-center gap-[2px]" aria-hidden="true">
          <span className={`h-4 w-[2px] rounded-full bg-[#63C800] ${listening ? 'animate-pulse' : 'opacity-45'}`} />
          <span className={`h-2 w-[2px] rounded-full bg-[#07142F] ${listening ? 'animate-pulse' : 'opacity-35'}`} />
        </span>

        {active && <span className="pointer-events-none absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#63C800]" />}
      </button>
    </div>
  )
}
