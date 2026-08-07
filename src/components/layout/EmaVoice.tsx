'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Mic, MicOff, Volume2, X } from 'lucide-react'

type VoiceState = 'idle' | 'listening' | 'speaking' | 'unsupported' | 'error'

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

const WAKE_SESSION_KEY = 'ema-intelligence:voice:wake-active:v1'

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
    if (active) window.sessionStorage.setItem(WAKE_SESSION_KEY, '1')
    else window.sessionStorage.removeItem(WAKE_SESSION_KEY)
  } catch {
    // Sprachsteuerung funktioniert auch, wenn Session Storage nicht verfügbar ist.
  }
}

function hasRememberedWakeMode() {
  try {
    return window.sessionStorage.getItem(WAKE_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function currentArea(pathname: string) {
  return PATH_LABELS.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'EMA Intelligence'
}

function ownerGreeting(email: string) {
  const normalized = email.trim().toLocaleLowerCase('de-DE')
  return normalized === 'unluer@ema-enterprise.de' || normalized === 'a.unluer@t-online.de'
}

function chooseGermanVoice() {
  if (!('speechSynthesis' in window)) return undefined
  const voices = window.speechSynthesis.getVoices()
  const germanVoices = voices.filter((voice) => voice.lang.toLocaleLowerCase().startsWith('de'))
  return germanVoices.find((voice) => /anna|petra|helena|marlene|vicki|samantha|siri/i.test(voice.name)) ?? germanVoices[0]
}

export function EmaVoice({ userName, userEmail }: { userName: string; userEmail: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const wakeModeRef = useRef(false)
  const speakingRef = useRef(false)
  const followUpRef = useRef(false)
  const restartTimerRef = useRef<number | null>(null)
  const followUpTimerRef = useRef<number | null>(null)
  const speechFallbackTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [panelOpen, setPanelOpen] = useState(false)
  const [heard, setHeard] = useState('')
  const [answer, setAnswer] = useState('Tippe einmal auf das Mikrofon. Danach wartet EMA auf „EMA“.')
  const [status, setStatus] = useState('EMA-Modus aus')

  const isChief = useMemo(() => ownerGreeting(userEmail), [userEmail])
  const firstName = userName.trim().split(/\s+/)[0] || 'da'
  const address = isChief ? 'Chef' : firstName

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
    if (!wakeModeRef.current || speakingRef.current) return
    restartTimerRef.current = window.setTimeout(() => startRecognitionRef.current(), delay)
  }, [clearTimer])

  const speak = useCallback((message: string, followUp = false) => {
    setAnswer(message)
    setPanelOpen(true)
    speakingRef.current = true
    setVoiceState('speaking')
    setStatus('EMA spricht …')

    let finished = false
    const finish = () => {
      if (finished || !mountedRef.current) return
      finished = true
      clearTimer(speechFallbackTimerRef)
      speakingRef.current = false
      setVoiceState('listening')
      if (followUp) setFollowUp(true)
      if (!recognitionRef.current) scheduleListen(320)
      else updateListeningStatus()
    }

    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      finish()
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = 'de-DE'
    utterance.rate = 0.92
    utterance.pitch = 0.92
    utterance.volume = 1
    const voice = chooseGermanVoice()
    if (voice) utterance.voice = voice
    utterance.onend = finish
    utterance.onerror = finish

    // iOS Safari liefert onend gelegentlich nicht. Der Fallback hält den Wake-Modus am Leben.
    speechFallbackTimerRef.current = window.setTimeout(
      finish,
      Math.max(1800, Math.min(8000, message.length * 85 + 900)),
    )
    window.speechSynthesis.speak(utterance)
  }, [clearTimer, scheduleListen, setFollowUp, updateListeningStatus])

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
      speak(`Ja, ${address}?`, true)
      return
    }

    if (/\b(guten morgen|morgen|hallo|hi|hey)\b/.test(command)) {
      speak(`Hallo ${address}. EMA ist bereit. Was kann ich für dich tun?`, true)
      return
    }

    if (/wer bin ich|kennst du mich/.test(command)) {
      speak(isChief ? 'Du bist der Chef. Natürlich kenne ich dich.' : `Du bist ${firstName}.`)
      return
    }

    if (/wer bist du|wie heisst du|wie heißt du/.test(command)) {
      speak('Ich bin EMA. Ich kenne die Bereiche und Abläufe von EMA Intelligence und helfe dir direkt in der App.')
      return
    }

    if (/wo bin ich|welcher bereich|was sehe ich/.test(command)) {
      speak(`Du bist gerade im Bereich ${currentArea(pathname)}.`)
      return
    }

    if (/was kannst du|was kannst du alles|hilfe|befehle/.test(command)) {
      speak('Ich kann dich durch EMA führen und Projekte, Investoren, Partner, Dokumente, Kalender, CAPEX, Deals, Akquise und Einstellungen öffnen.')
      return
    }

    if (/was ist (ein )?bess|erklar.*bess/.test(command)) {
      speak('BESS steht für Battery Energy Storage System, also einen Batteriespeicher. EMA führt BESS als eigenen Projekttyp und auch in Hybridprojekten.')
      return
    }

    if (/projektstatus|statusstufen|welche status/.test(command)) {
      speak('Die EMA Projektstufen sind Lead, Vorprüfung, Investorensuche, Due Diligence, LOI, SPA, Closing, verkauft oder abgelehnt.')
      return
    }

    if (/zuruck|vorherige seite/.test(command)) {
      speak(`Natürlich, ${address}. Ich gehe zurück.`)
      window.setTimeout(() => router.back(), 350)
      return
    }

    if (/losch|entfern|versend|schick.*mail|sende.*mail/.test(command)) {
      speak(`Diese Aktion führe ich aus Sicherheitsgründen nicht direkt per Sprache aus, ${address}. Kritische Aktionen brauchen eine Bestätigung.`)
      return
    }

    const destination = DESTINATIONS.find((item) => item.patterns.some((pattern) => pattern.test(command)))
    if (destination) {
      speak(`Natürlich, ${address}. Ich öffne ${destination.label}.`)
      window.setTimeout(() => router.push(destination.href), 350)
      return
    }

    speak(`Das habe ich noch nicht sicher verstanden, ${address}. Sag zum Beispiel: EMA, öffne Projekte.`)
  }, [address, firstName, isChief, pathname, router, setFollowUp, speak])

  const startRecognition = useCallback(() => {
    if (!wakeModeRef.current || speakingRef.current || recognitionRef.current) return

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
      if (speakingRef.current) return
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
      if (!wakeModeRef.current) return
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
    window.speechSynthesis?.cancel()
    clearTimer(speechFallbackTimerRef)
    speakingRef.current = false

    if (wakeModeRef.current) {
      wakeModeRef.current = false
      rememberWakeMode(false)
      setFollowUp(false)
      clearTimer(restartTimerRef)
      try {
        recognitionRef.current?.abort()
      } catch {
        // Safari darf beim Beenden bereits geschlossen haben.
      }
      recognitionRef.current = null
      setVoiceState('idle')
      setAnswer('EMA-Modus pausiert. Tippe auf das Mikrofon, um mich wieder zu aktivieren.')
      setStatus('EMA-Modus aus')
      return
    }

    wakeModeRef.current = true
    rememberWakeMode(true)
    setVoiceState('idle')
    setAnswer('EMA-Modus aktiv. Du kannst jetzt einfach „EMA“ sagen.')
    setHeard('Ich warte auf mein Aktivierungswort …')
    updateListeningStatus()
    startRecognitionRef.current()
  }, [clearTimer, setFollowUp, updateListeningStatus])

  const closePanel = useCallback(() => {
    wakeModeRef.current = false
    rememberWakeMode(false)
    followUpRef.current = false
    speakingRef.current = false
    clearTimer(restartTimerRef)
    clearTimer(followUpTimerRef)
    clearTimer(speechFallbackTimerRef)
    recognitionRef.current?.abort()
    recognitionRef.current = null
    window.speechSynthesis?.cancel()
    setVoiceState('idle')
    setPanelOpen(false)
    setStatus('EMA-Modus aus')
  }, [clearTimer])

  useEffect(() => {
    mountedRef.current = true

    // AppShell wird zwischen einigen EMA-Hauptbereichen neu gemountet.
    // Den einmal vom Nutzer aktivierten Wake-Modus innerhalb dieses Tabs fortsetzen.
    if (hasRememberedWakeMode()) {
      wakeModeRef.current = true
      setPanelOpen(true)
      setAnswer('EMA-Modus aktiv. Du kannst weiter einfach „EMA“ sagen.')
      setHeard('')
      updateListeningStatus()
      scheduleListen(320)
    }

    return () => {
      mountedRef.current = false
      wakeModeRef.current = false
      recognitionRef.current?.abort()
      window.speechSynthesis?.cancel()
      clearTimer(restartTimerRef)
      clearTimer(followUpTimerRef)
      clearTimer(speechFallbackTimerRef)
    }
  }, [clearTimer, scheduleListen, updateListeningStatus])

  const listening = wakeModeRef.current && voiceState === 'listening'
  const active = wakeModeRef.current

  return (
    <div className="fixed bottom-[calc(5.8rem+env(safe-area-inset-bottom))] right-4 z-[900] flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {panelOpen && (
        <section
          role="status"
          aria-live="polite"
          className="w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/95 shadow-[0_22px_70px_rgba(7,20,47,0.24)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between bg-[#07142F] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${active ? 'animate-pulse bg-[#8FDA45]' : 'bg-slate-400'}`} />
              <span className="text-sm font-extrabold tracking-[0.12em]">EMA</span>
            </div>
            <button type="button" onClick={closePanel} aria-label="EMA schließen" className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 px-4 py-4">
            {heard && <p className="text-xs font-semibold text-slate-400">Du: „{heard}“</p>}
            <div className="flex items-start gap-2.5">
              <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5CB800]" />
              <p className="text-sm font-semibold leading-5 text-[#07142F]">{answer}</p>
            </div>
            <p className="text-xs font-semibold text-slate-400">{status}</p>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={toggleWakeMode}
        aria-label={active ? 'EMA-Modus ausschalten' : 'EMA-Modus einschalten'}
        title={active ? 'EMA hört auf das Aktivierungswort' : 'Mit EMA sprechen'}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-white text-white shadow-[0_14px_38px_rgba(7,20,47,0.32)] transition active:scale-95 ${
          active ? 'bg-red-500' : 'bg-[#5CB800] hover:bg-[#4DA300]'
        }`}
      >
        {listening && <span className="absolute inset-0 animate-ping rounded-full bg-red-400/40" />}
        {active ? <MicOff className="relative h-7 w-7" /> : <Mic className="relative h-7 w-7" />}
      </button>
    </div>
  )
}
