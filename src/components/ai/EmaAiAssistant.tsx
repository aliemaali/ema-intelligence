'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bot,
  FileSearch,
  FileText,
  Mail,
  Paperclip,
  Plus,
  SearchCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'

type Message = {
  id: number
  role: 'assistant' | 'user'
  text: string
}

const QUICK_ACTIONS = [
  {
    label: 'Projekt analysieren',
    prompt: 'Analysiere ein Projekt und zeige mir Chancen, Risiken und fehlende Angaben.',
    icon: BarChart3,
  },
  {
    label: 'Fehlende Daten prüfen',
    prompt: 'Welche Angaben und Dokumente fehlen für ein vollständiges Projekt?',
    icon: SearchCheck,
  },
  {
    label: 'Dokument prüfen',
    prompt: 'Hilf mir dabei, ein Projektdokument strukturiert zu prüfen.',
    icon: FileSearch,
  },
  {
    label: 'Exposé vorbereiten',
    prompt: 'Erstelle die Struktur für ein professionelles Investoren-Exposé.',
    icon: FileText,
  },
  {
    label: 'Investor anschreiben',
    prompt: 'Formuliere eine kurze und professionelle Investoren-E-Mail.',
    icon: Mail,
  },
] as const

function createLocalAnswer(input: string) {
  const text = input.toLowerCase()

  if (text.includes('exposé') || text.includes('expose')) {
    return 'Für ein Investoren-Exposé brauche ich mindestens Projektname, Standort, Projekttyp, Leistung, Projektstatus, Kaufpreis sowie vorhandene Angaben zu Einspeisung, Vergütung und Ertrag. In der nächsten Ausbaustufe übernehme ich diese Daten direkt aus dem ausgewählten EMA-Projekt.'
  }

  if (text.includes('fehl') || text.includes('vollständig') || text.includes('vollstaendig')) {
    return 'Ich würde zuerst diese Bereiche prüfen: Standort und Flächensicherung, Netzanfrage oder Netzzusage, Genehmigungsstand, technische Leistung, Einspeiseart, Vergütung, Ertrag, Kaufpreis sowie die zugehörigen Nachweise. Aktuell arbeite ich noch ohne direkten Datenbankzugriff.'
  }

  if (text.includes('investor') || text.includes('e-mail') || text.includes('email')) {
    return 'Gern. Für eine belastbare Investorenansprache brauche ich den Projektnamen, den Standort, die Leistung, den Entwicklungsstatus und das gewünschte Ziel der Nachricht. Danach kann EMA-AI daraus einen kurzen Teaser oder eine ausführliche E-Mail vorbereiten.'
  }

  if (text.includes('analys') || text.includes('risik') || text.includes('chance')) {
    return 'Eine saubere Projektanalyse sollte Datenqualität, Netzstatus, Genehmigungsreife, Wirtschaftlichkeit, Vermarktungsmodell und offene Risiken getrennt bewerten. Sobald der Projektkontext angebunden ist, kann EMA-AI diese Prüfung direkt mit den vorhandenen EMA-Daten durchführen.'
  }

  if (text.includes('dokument') || text.includes('pdf')) {
    return 'Die Dokumentenanalyse ist als nächster Funktionsblock vorgesehen. Dann soll EMA-AI Angaben aus PDF- und Bilddateien erkennen, gefundene Werte anzeigen und erst nach deiner Bestätigung in das Projekt übernehmen.'
  }

  return 'Ich bin als kostenlose EMA-AI-Basisversion eingerichtet. Die Oberfläche und lokale Assistenz funktionieren bereits ohne API-Kosten. Der direkte Zugriff auf Projekte, Dokumente und echte KI-Antworten wird im nächsten Schritt angebunden.'
}

export function EmaAiAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'Hallo Ali 👋 Ich bin EMA-AI. Wobei soll ich dich heute unterstützen?',
    },
  ])
  const [input, setInput] = useState('')
  const [selectedProject, setSelectedProject] = useState('Kein Projekt ausgewählt')

  const nextId = useMemo(
    () => (messages.length ? Math.max(...messages.map((message) => message.id)) + 1 : 1),
    [messages]
  )

  function sendMessage(text: string) {
    const cleanText = text.trim()
    if (!cleanText) return

    setMessages((current) => [
      ...current,
      { id: nextId, role: 'user', text: cleanText },
      { id: nextId + 1, role: 'assistant', text: createLocalAnswer(cleanText) },
    ])
    setInput('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    sendMessage(input)
  }

  function startNewChat() {
    setMessages([
      {
        id: Date.now(),
        role: 'assistant',
        text: 'Neues Gespräch gestartet. Was möchtest du mit EMA-AI erledigen?',
      },
    ])
    setInput('')
  }

  return (
    <div className="-mx-5 min-h-[calc(100vh-8rem)] bg-gradient-to-b from-[#f7f9fc] via-white to-[#f4f8f1] px-4 pb-8 pt-5 md:mx-auto md:max-w-[1480px] md:rounded-[2rem] md:px-8 md:pt-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#07142F] shadow-sm transition hover:border-[#5CB800]/40"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>

          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex items-center gap-2 rounded-full bg-[#07142F] px-4 py-2 text-sm font-bold text-white shadow-sm transition active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Neues Gespräch
          </button>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.09)]">
          <div className="relative overflow-hidden bg-[#07142F] px-5 py-7 text-white md:px-8 md:py-9">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#5CB800]/20 blur-2xl" />
            <div className="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-blue-500/15 blur-2xl" />

            <div className="relative flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800] shadow-lg shadow-[#5CB800]/20">
                <Bot className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#87d33b]">EMA Intelligence</p>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">EMA-AI</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Dein intelligenter Assistent für Energieprojekte, Dokumente und Investorenkommunikation.
                </p>
              </div>
            </div>

            <div className="relative mt-6 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/10">
                <Sparkles className="h-4 w-4 text-[#87d33b]" /> Kostenlose Basisversion aktiv
              </span>
              <select
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
                className="max-w-full rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white outline-none"
                aria-label="Projekt auswählen"
              >
                <option className="text-slate-900">Kein Projekt ausgewählt</option>
                <option className="text-slate-900">Projektanbindung folgt</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 p-4 md:grid-cols-[0.72fr_1.28fr] md:p-7">
            <aside>
              <div className="rounded-[1.6rem] border border-slate-200/80 bg-slate-50/70 p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#5CB800]">Schnellaktionen</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => sendMessage(action.prompt)}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#5CB800]/40 hover:shadow-md active:translate-y-0"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5CB800]/10 text-[#378c00]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-sm font-extrabold text-[#07142F]">{action.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-[1.6rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <strong>Aktueller Stand:</strong> Die Seite funktioniert ohne kostenpflichtige API. Direkter Projektzugriff, Datei-Upload und ein echtes Sprachmodell sind noch nicht verbunden.
              </div>
            </aside>

            <div className="flex min-h-[520px] flex-col overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="font-extrabold text-[#07142F]">EMA-AI Chat</p>
                  <p className="text-xs text-slate-500">{selectedProject}</p>
                </div>
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Bereit
                </span>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 md:p-5">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#07142F] text-white">
                        <Bot className="h-5 w-5" />
                      </span>
                    )}
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                        message.role === 'user'
                          ? 'rounded-br-md bg-[#5CB800] font-medium text-white'
                          : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {message.text}
                    </div>
                    {message.role === 'user' && (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-[#07142F]">
                        <UserRound className="h-5 w-5" />
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-white p-3 md:p-4">
                <div className="flex items-end gap-2 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-2 focus-within:border-[#5CB800]/60 focus-within:ring-4 focus-within:ring-[#5CB800]/10">
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-[#07142F]"
                    aria-label="Datei hinzufügen – folgt in der nächsten Ausbaustufe"
                    title="Datei-Upload folgt"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        sendMessage(input)
                      }
                    }}
                    rows={1}
                    placeholder="Frag EMA-AI etwas …"
                    className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-[#07142F] outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5CB800] text-white shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Nachricht senden"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
