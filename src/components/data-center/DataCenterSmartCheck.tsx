'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bookmark, Check, ClipboardPaste, Copy, FileText, Loader2, MessageCircle, Mic, MicOff, Server, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { analyzeDataCenterNote } from '@/lib/actions/data-center-smart-check.actions'
import { createDataCenterAnalyzerProject } from '@/lib/actions/data-center-analyzer.actions'
import type { SmartCheckAssessment, SmartCheckFacts } from '@/lib/data-center/smart-check'

type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type SpeechRecognizer = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResult) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognizer
  webkitSpeechRecognition?: new () => SpeechRecognizer
}

function mw(value: number | null) {
  return value === null ? '—' : `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} MW`
}

function money(value: number | null) {
  return value === null ? '—' : `${value.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
}

export function DataCenterSmartCheck() {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [result, setResult] = useState<{ facts: SmartCheckFacts; assessment: SmartCheckAssessment; note: string } | null>(null)
  const [busy, startTransition] = useTransition()
  const [saving, startSaving] = useTransition()
  const [listening, setListening] = useState(false)
  const recognition = useRef<SpeechRecognizer | null>(null)

  const analyze = () => {
    if (note.trim().length < 8) { toast.error('Bitte gib zuerst die Informationen aus dem Gespräch ein.'); return }
    startTransition(async () => {
      const response = await analyzeDataCenterNote(note)
      if ('error' in response && response.error) { toast.error(response.error); return }
      if (!response.facts || !response.assessment) { toast.error('Die Auswertung ist nicht verfügbar.'); return }
      setResult({ facts: response.facts, assessment: response.assessment, note: note.trim() })
    })
  }

  const pasteMessage = async () => {
    try {
      const copied = await navigator.clipboard.readText()
      if (!copied.trim()) { toast.info('Die Zwischenablage ist leer.'); return }
      setNote(copied)
      setResult(null)
      toast.success('Nachricht eingefügt.')
    } catch {
      toast.info('Einfügen ist hier nicht erlaubt. Halte das Textfeld gedrückt und wähle „Einsetzen“.')
    }
  }

  const dictate = () => {
    if (recognition.current && listening) { recognition.current.stop(); return }
    const speechWindow = window as SpeechWindow
    const Speech = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Speech) { toast.info('Diktieren ist in diesem Browser nicht verfügbar. Die iPhone-Tastatur bietet ebenfalls ein Mikrofon.'); return }
    const session = new Speech()
    recognition.current = session
    session.lang = 'de-DE'
    session.continuous = false
    session.interimResults = false
    session.onresult = (event) => {
      const spoken = Array.from(event.results).map((item) => item[0]?.transcript ?? '').join(' ').trim()
      if (spoken) { setNote((current) => `${current.trim()} ${spoken}`.trim()); setResult(null) }
    }
    session.onerror = () => { setListening(false); toast.error('Diktieren wurde unterbrochen. Du kannst die Notiz weiter eintippen.') }
    session.onend = () => { setListening(false); recognition.current = null }
    try { session.start(); setListening(true) } catch { toast.error('Das Mikrofon konnte nicht gestartet werden.') }
  }

  const copyQuestions = async () => {
    if (!result) return
    const text = `Hallo, danke für die Infos zum Rechenzentrumsprojekt${result.facts.location ? ` in ${result.facts.location}` : ''}. Damit ich es weiter prüfen kann, brauche ich noch:\n${result.assessment.questions.map((question, index) => `${index + 1}. ${question}`).join('\n')}\nVielen Dank!`
    try { await navigator.clipboard.writeText(text); toast.success('Die Fragen sind kopiert und können in WhatsApp eingefügt werden.') }
    catch { toast.error('Kopieren war nicht möglich. Bitte die Fragen manuell übernehmen.') }
  }

  const save = () => {
    if (!result) return
    startSaving(async () => {
      const { facts } = result
      const form = new FormData()
      form.set('smartCheckSource', 'partner_note')
      form.set('projectName', facts.location ? `Rechenzentrum ${facts.location}` : 'Rechenzentrum – Standort offen')
      form.set('address', facts.location)
      form.set('city', facts.location)
      form.set('gridCapacityMw', facts.gridMw === null ? '' : String(facts.gridMw))
      form.set('gridStatus', facts.gridStatus)
      form.set('pue', '1.25')
      form.set('planningStatus', facts.planning === 'conflict' ? 'planning_conflict' : '')
      form.set('dataCenterUseStatus', facts.planning === 'permitted_claimed' ? 'indicated' : 'unknown')
      form.set('offtakerStatus', facts.offtaker)
      form.set('projectModel', facts.projectModel)
      form.set('purchasePriceMode', facts.pricePerMw !== null ? 'per_mw' : 'total')
      form.set('pricePerMw', facts.pricePerMw === null ? '' : String(facts.pricePerMw))
      form.set('totalPurchasePrice', facts.totalPrice === null ? '' : String(facts.totalPrice))
      form.set('referenceCapacity', facts.priceReference === 'unknown' ? '' : facts.priceReference)
      form.set('notes', `Smart Check – Partnerangabe (nicht verifiziert):\n${result.note}`)
      try {
        const saved = await createDataCenterAnalyzerProject(form)
        if (saved.error || !saved.projectId) { toast.error(saved.error ?? 'Projekt konnte nicht vorgemerkt werden.'); return }
        toast.success('Projekt in EMA Intelligence vorgemerkt.')
        router.push(`/projects/${saved.projectId}/overview`)
      } catch { toast.error('Projekt konnte nicht vorgemerkt werden.') }
    })
  }

  return (
    <div className="min-h-[100dvh] bg-[#031126] pb-[max(2rem,env(safe-area-inset-bottom))] text-white">
      <div className="relative overflow-hidden border-b border-[#184574]/40 bg-[#031126]">
        <div className="absolute inset-0 bg-[url('/hero-datacenter.webp')] bg-cover bg-[center_40%] opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#031126]/95 via-[#031126]/78 to-[#031126]/45" />
        <div className="relative mx-auto max-w-4xl px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-8">
          <div className="flex min-h-12 items-center justify-between">
            <Link href="/apps" aria-label="Zur Hauptseite" className="grid h-11 w-11 place-items-center rounded-xl border border-[#4976a5]/40 bg-[#061936]/80 text-[#b9cde7]"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="flex items-center gap-2"><Image src="/ema-logo-transparent.png" alt="EMA" width={55} height={30} className="h-8 w-auto object-contain" /><span className="text-xl font-black tracking-wide">EMA</span></div>
            <div className="w-11" />
          </div>
          <div className="mt-7 sm:mt-10">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#acc2df]">DATA CENTER</p>
            <h1 className="mt-2 text-[2.5rem] font-black leading-none tracking-[-0.05em] sm:text-6xl">SMART <span className="text-[#83e637]">CHECK</span></h1>
            <p className="mt-3 max-w-lg text-base leading-6 text-[#c6d4e8] sm:text-lg">Rechenzentrumsprojekt in Sekunden einschätzen</p>
          </div>
        </div>
      </div>

      <main className="mx-auto -mt-1 max-w-4xl space-y-4 px-4 pb-8 sm:px-8">
        <section className="rounded-[1.55rem] border border-[#3482c5] bg-gradient-to-br from-[#08244b] to-[#041832] p-5 shadow-[0_18px_50px_rgba(0,0,0,.28)] sm:p-7">
          <h2 className="flex items-center gap-3 text-xl font-extrabold sm:text-2xl"><MessageCircle className="h-6 w-6 shrink-0 text-[#7fc9ff]" />Was hat dein Partner gesagt?</h2>
          <label htmlFor="smart-note" className="sr-only">Gesprächsnotiz oder WhatsApp-Nachricht</label>
          <textarea id="smart-note" value={note} onChange={(event) => { setNote(event.target.value); setResult(null) }} rows={4} maxLength={8000} placeholder="z. B. Chemnitz, 10 MW angefragt, Grundstück vorhanden, 600.000 € pro MW" className="mt-5 min-h-36 w-full resize-y rounded-2xl border border-[#416b9c] bg-[#061b3a] p-4 text-base leading-6 text-white outline-none transition placeholder:text-[#93a9c5] focus:border-[#83e637] focus:ring-2 focus:ring-[#83e637]/20" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" onClick={pasteMessage} className="flex min-h-13 items-center justify-center gap-2 rounded-xl border border-[#38679b] bg-[#0b2b55] px-3 text-sm font-semibold text-[#c3dcff] transition hover:border-[#83e637]/60"><ClipboardPaste className="h-5 w-5" />Nachricht einfügen</button>
            <button type="button" onClick={dictate} aria-pressed={listening} className="flex min-h-13 items-center justify-center gap-2 rounded-xl border border-[#38679b] bg-[#0b2b55] px-3 text-sm font-semibold text-[#c3dcff] transition hover:border-[#83e637]/60">{listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}{listening ? 'Beenden' : 'Diktieren'}</button>
          </div>
          <button type="button" onClick={analyze} disabled={busy || !note.trim()} className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#83e637] to-[#72d82c] px-5 text-base font-black tracking-wide text-[#07172e] shadow-[0_10px_30px_rgba(112,217,44,.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{busy ? 'EMA PRÜFT DIE NOTIZ …' : 'JETZT EINSCHÄTZEN'}</button>
        </section>

        {result ? (
          <section aria-live="polite" className="rounded-[1.55rem] border border-[#3482c5] bg-gradient-to-br from-[#0a2348] to-[#04142f] p-5 shadow-[0_18px_50px_rgba(0,0,0,.25)] sm:p-7">
            <div className="flex items-start gap-3"><span className={`mt-1 h-5 w-5 shrink-0 rounded-full border-4 border-[#815a1a] bg-amber-300 shadow-[0_0_16px_rgba(251,191,36,.5)] ${result.assessment.verdict.startsWith('KRITISCH') ? 'border-rose-900 bg-rose-400' : ''}`} /><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a9c1de]">ERSTEINSCHÄTZUNG · ANGABEN AUS NACHRICHT</p><h2 className={`mt-2 text-xl font-black leading-tight ${result.assessment.verdict.startsWith('KRITISCH') ? 'text-rose-300' : 'text-amber-300'}`}>{result.assessment.verdict}</h2><p className="mt-2 text-sm leading-6 text-[#bdcfe6]">{result.assessment.explanation}</p></div></div>
            <div className="mt-5 grid grid-cols-3 gap-1 rounded-2xl border border-[#2d608d] bg-[#071e3f] p-3 sm:gap-3">
              <div className="min-w-0 px-1 sm:px-3"><Zap className="h-5 w-5 text-[#83e637]" /><strong className="mt-2 block text-base">{mw(result.facts.gridMw)}</strong><small className="block text-xs leading-4 text-[#adc0d9]">Netzleistung<br />{result.facts.gridStatus === 'requested' ? 'angefragt' : 'angegeben'}</small></div>
              <div className="min-w-0 border-x border-[#2d608d] px-2 sm:px-4"><Server className="h-5 w-5 text-[#83e637]" /><strong className="mt-2 block text-base">{mw(result.assessment.itMw)}</strong><small className="block text-xs leading-4 text-[#adc0d9]">IT · geschätzt<br />PUE 1,25</small></div>
              <div className="min-w-0 px-1 sm:px-3"><FileText className="h-5 w-5 text-[#83e637]" /><strong className="mt-2 block break-words text-sm sm:text-base">{result.facts.pricePerMw !== null && result.facts.priceReference === 'unknown' ? 'Bezug offen' : money(result.assessment.calculatedPrice)}</strong><small className="block text-xs leading-4 text-[#adc0d9]">{result.facts.pricePerMw !== null ? 'Projektpreis' : 'Kaufpreis'}<br />{result.assessment.calculatedPrice !== null && result.facts.priceReference === 'it' ? 'geschätzte Basis' : 'nicht verifiziert'}</small></div>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#9eb7d5]">Keine technische Auslegung. Ein behaupteter oder angefragter Netzanschluss ist kein geprüfter Netznachweis.</p>
            <div className="mt-6 border-t border-[#2e5d87] pt-5"><h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#b4cbe5]">DIE NÄCHSTEN 3 FRAGEN</h3><ol className="mt-3 divide-y divide-[#2e5d87]">{result.assessment.questions.map((question, index) => <li key={question} className="flex items-center gap-3 py-3 text-sm leading-5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#37699d] bg-[#15355f] font-bold">{index + 1}</span>{question}</li>)}</ol></div>
            <button type="button" onClick={copyQuestions} className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl border border-[#83e637] bg-[#83e637]/10 px-4 text-center text-sm font-extrabold text-[#9cf05b] transition hover:bg-[#83e637]/20"><Copy className="h-5 w-5 shrink-0" />FRAGEN ALS WHATSAPP-TEXT KOPIEREN</button>
            <button type="button" onClick={save} disabled={saving} className="mt-3 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl border border-[#356797] bg-[#0a2850] px-4 text-sm font-bold text-[#c4d9f5] transition hover:border-[#83e637]/60 disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bookmark className="h-5 w-5" />}{saving ? 'PROJEKT WIRD VORGEMERKT …' : 'Als Projekt vormerken'}</button>
            <p className="mt-3 text-center text-xs text-[#96abc7]">Gespeichert in EMA Intelligence → Projekte → Rechenzentren</p>
          </section>
        ) : <p className="px-2 text-center text-sm text-[#9aafcb]">EMA bewertet erst deine Angaben. Beispielwerte werden nicht als Ergebnis angezeigt.</p>}

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-sm"><Link href="/data-center/full" className="text-[#b6cce7] underline decoration-[#527ba5] underline-offset-4">Ausführliche Projekterfassung</Link><Link href="/projects?view=all&type=rechenzentrum" className="flex items-center gap-1 text-[#b6cce7] underline decoration-[#527ba5] underline-offset-4"><Check className="h-4 w-4" />Gespeicherte Projekte</Link></div>
      </main>
    </div>
  )
}
