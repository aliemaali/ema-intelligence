'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bot,
  FileSearch,
  FileText,
  FolderOpen,
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

export type EmaAiProject = {
  id: string
  projectNumber: string | null
  projectName: string
  projectType: string | null
  status: string | null
  locationCity: string | null
  locationState: string | null
  pvKwp: number | null
  bessMw: number | null
  bessMwh: number | null
  purchasePrice: number | null
  feedInType: string | null
}

const QUICK_ACTIONS = [
  {
    label: 'Projekt analysieren',
    description: 'Erhalte eine strukturierte Analyse deines Projekts',
    prompt: 'Analysiere das ausgewählte Projekt und zeige mir Chancen, Risiken und fehlende Angaben.',
    icon: BarChart3,
  },
  {
    label: 'Fehlende Daten prüfen',
    description: 'Prüfe, welche Informationen noch fehlen',
    prompt: 'Welche Angaben und Dokumente fehlen beim ausgewählten Projekt?',
    icon: SearchCheck,
  },
  {
    label: 'Dokument prüfen',
    description: 'Lade ein Dokument hoch und analysiere es',
    prompt: 'Hilf mir dabei, ein Projektdokument strukturiert zu prüfen.',
    icon: FileSearch,
  },
  {
    label: 'Exposé vorbereiten',
    description: 'Erstelle ein professionelles Investoren-Exposé',
    prompt: 'Erstelle die Struktur für ein professionelles Investoren-Exposé zum ausgewählten Projekt.',
    icon: FileText,
  },
  {
    label: 'Investor anschreiben',
    description: 'Erstelle eine individuelle Investoren-E-Mail',
    prompt: 'Formuliere eine kurze und professionelle Investoren-E-Mail zum ausgewählten Projekt.',
    icon: Mail,
  },
] as const

function formatProject(project: EmaAiProject) {
  const location = [project.locationCity, project.locationState].filter(Boolean).join(', ') || 'Standort offen'
  const power = [
    project.pvKwp ? `${Number(project.pvKwp).toLocaleString('de-DE')} kWp` : null,
    project.bessMw ? `${Number(project.bessMw).toLocaleString('de-DE')} MW` : null,
    project.bessMwh ? `${Number(project.bessMwh).toLocaleString('de-DE')} MWh` : null,
  ].filter(Boolean).join(' / ') || 'Leistung offen'

  return {
    title: project.projectNumber ? `${project.projectNumber} – ${project.projectName}` : project.projectName,
    location,
    power,
    price: project.purchasePrice ? `${Number(project.purchasePrice).toLocaleString('de-DE')} €` : 'Kaufpreis offen',
  }
}

function createLocalAnswer(input: string, project?: EmaAiProject) {
  const text = input.toLowerCase()

  if (!project && (text.includes('projekt') || text.includes('exposé') || text.includes('analyse') || text.includes('fehl'))) {
    return 'Bitte wähle oben zuerst ein Projekt aus. Danach kann EMA-AI die bereits in EMA gespeicherten Projektdaten berücksichtigen.'
  }

  const projectInfo = project ? formatProject(project) : null
  const context = projectInfo
    ? `${projectInfo.title}, Standort: ${projectInfo.location}, Leistung: ${projectInfo.power}, Status: ${project?.status ?? 'offen'}, Kaufpreis: ${projectInfo.price}, Einspeiseart: ${project?.feedInType ?? 'offen'}.`
    : ''

  if (text.includes('exposé') || text.includes('expose')) {
    return `Exposé-Grundlage für ${context} Vorhandene Daten kann ich bereits übernehmen. Noch offene Angaben sollten vor Veröffentlichung ergänzt werden.`
  }

  if (text.includes('fehl') || text.includes('vollständig') || text.includes('vollstaendig')) {
    const missing = [
      !project?.locationCity && 'Standort',
      !project?.status && 'Projektstatus',
      !project?.pvKwp && !project?.bessMw && !project?.bessMwh && 'Leistung',
      !project?.purchasePrice && 'Kaufpreis',
      !project?.feedInType && 'Einspeiseart',
    ].filter(Boolean)

    return missing.length
      ? `Beim Projekt fehlen aktuell: ${missing.join(', ')}. Zusätzlich sollten Netzzusage, Genehmigungen, Vergütung, Ertrag und Nachweise geprüft werden.`
      : `Die wichtigsten Stammdaten zu ${context} sind vorhanden. Als Nächstes sollten Netzzusage, Genehmigungen, Vergütung, Ertrag und Dokumentennachweise geprüft werden.`
  }

  if (text.includes('investor') || text.includes('e-mail') || text.includes('email')) {
    return `Betreff: Investitionsmöglichkeit ${projectInfo?.title}\n\nGuten Tag,\n\nwir möchten Ihnen folgendes Energieprojekt vorstellen: ${context} Gern übersenden wir Ihnen bei Interesse die vollständigen Projektunterlagen.\n\nMit freundlichen Grüßen\nEMA Enterprise GmbH`
  }

  if (text.includes('analys') || text.includes('risik') || text.includes('chance')) {
    return `Kurzanalyse zu ${context} Chancen: vorhandener Projektkontext und strukturierte Datenbasis. Zu prüfen sind insbesondere Netzstatus, Genehmigungsreife, Wirtschaftlichkeit, Vermarktungsmodell und Vollständigkeit der Nachweise.`
  }

  if (text.includes('dokument') || text.includes('pdf')) {
    return 'Die Projektauswahl ist jetzt angebunden. Der Datei-Upload folgt als nächster Funktionsblock; dann kann EMA-AI Dokumente dem ausgewählten Projekt zuordnen.'
  }

  return projectInfo
    ? `Das Projekt ${projectInfo.title} ist ausgewählt. Ich kann die vorhandenen Stammdaten jetzt für Analysen, Datenprüfungen, Exposé-Entwürfe und Investorenanschreiben verwenden.`
    : 'Ich bin als kostenlose EMA-AI-Basisversion eingerichtet. Wähle oben ein Projekt aus, damit ich dessen vorhandene Daten berücksichtigen kann.'
}

export function EmaAiAssistant({ projects }: { projects: EmaAiProject[] }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: 'Hallo Ali 👋 Ich bin EMA-AI. Wähle ein Projekt aus oder stelle mir direkt eine Frage.' },
  ])
  const [input, setInput] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const selectedLabel = selectedProject ? formatProject(selectedProject).title : 'Kein Projekt ausgewählt'

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
      { id: nextId + 1, role: 'assistant', text: createLocalAnswer(cleanText, selectedProject) },
    ])
    setInput('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    sendMessage(input)
  }

  function startNewChat() {
    setMessages([{ id: Date.now(), role: 'assistant', text: 'Neues Gespräch gestartet. Was möchtest du mit EMA-AI erledigen?' }])
    setInput('')
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-[#f7f9fc] via-white to-[#f4f8f1] pb-8 pt-[max(5.5rem,calc(env(safe-area-inset-top)+3rem))] md:rounded-[2rem] md:px-8 md:pt-10">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-0">
        <div className="mb-5 flex w-full items-center justify-between gap-3">
          <Link href="/dashboard" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-[#07142F] shadow-sm transition hover:border-[#5CB800]/40">
            <ArrowLeft className="h-5 w-5" /> Dashboard
          </Link>
          <button type="button" onClick={startNewChat} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#07142F] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition active:scale-[0.98]">
            <Plus className="h-5 w-5" /> Neues Gespräch
          </button>
        </div>

        <section className="overflow-hidden rounded-[1.9rem] bg-white shadow-[0_22px_70px_rgba(15,23,42,0.09)] md:rounded-[2.2rem]">
          <div className="relative overflow-hidden rounded-[1.9rem] bg-gradient-to-br from-[#07142F] via-[#091a3b] to-[#16472f] px-5 py-7 text-white md:rounded-[2.2rem] md:px-9 md:py-10">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#5CB800]/20 blur-2xl" />
            <div className="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-blue-500/15 blur-2xl" />
            <div className="relative flex items-start gap-4 md:gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-[#5CB800] shadow-lg shadow-[#5CB800]/20 md:h-20 md:w-20">
                <Bot className="h-8 w-8 text-white md:h-10 md:w-10" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#87d33b] md:text-sm">EMA Intelligence</p>
                <h1 className="mt-1 text-4xl font-extrabold tracking-tight md:text-5xl">EMA-AI</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-lg md:leading-8">Dein intelligenter Assistent für Energieprojekte, Dokumente und Investorenkommunikation.</p>
              </div>
            </div>

            <div className="relative mt-7 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-extrabold text-white ring-1 ring-white/10">
                <Sparkles className="h-5 w-5 text-[#87d33b]" /> Kostenlose Basisversion aktiv
              </span>
              <div className="relative w-full sm:w-auto">
                <FolderOpen className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white" />
                <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="w-full appearance-none rounded-full border border-white/15 bg-white/10 py-3 pl-12 pr-11 text-sm font-extrabold text-white outline-none sm:min-w-[340px]" aria-label="Projekt auswählen">
                  <option value="" className="text-slate-900">Kein Projekt ausgewählt</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id} className="text-slate-900">
                      {project.projectNumber ? `${project.projectNumber} – ${project.projectName}` : project.projectName}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white">⌄</span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-4 md:grid-cols-[0.72fr_1.28fr] md:p-7">
            <aside>
              <div className="rounded-[1.7rem] border border-slate-200/80 bg-slate-50/70 p-4 md:p-5">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#5CB800]">Schnellaktionen</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon
                    return (
                      <button key={action.label} type="button" onClick={() => sendMessage(action.prompt)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#5CB800]/40 hover:shadow-md active:translate-y-0">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#378c00]"><Icon className="h-6 w-6" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold text-[#07142F]">{action.label}</span>
                          <span className="mt-0.5 hidden text-xs leading-5 text-slate-500 sm:block">{action.description}</span>
                        </span>
                        <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="mt-4 rounded-[1.6rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                <strong>Projektanbindung aktiv:</strong> {projects.length} Projekt{projects.length === 1 ? '' : 'e'} aus EMA sind verfügbar. Datei-Upload und externes Sprachmodell folgen später.
              </div>
            </aside>

            <div className="flex min-h-[520px] flex-col overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="font-extrabold text-[#07142F]">EMA-AI Chat</p>
                  <p className="text-xs text-slate-500">{selectedLabel}</p>
                </div>
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-700"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Bereit</span>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 md:p-5">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'assistant' && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#07142F] text-white"><Bot className="h-5 w-5" /></span>}
                    <div className={`max-w-[82%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === 'user' ? 'rounded-br-md bg-[#5CB800] font-medium text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'}`}>{message.text}</div>
                    {message.role === 'user' && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-[#07142F]"><UserRound className="h-5 w-5" /></span>}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-white p-3 md:p-4">
                <div className="flex items-end gap-2 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-2 focus-within:border-[#5CB800]/60 focus-within:ring-4 focus-within:ring-[#5CB800]/10">
                  <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-[#07142F]" aria-label="Datei hinzufügen – folgt in der nächsten Ausbaustufe" title="Datei-Upload folgt"><Paperclip className="h-5 w-5" /></button>
                  <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(input) } }} rows={1} placeholder="Frag EMA-AI etwas …" className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-[#07142F] outline-none placeholder:text-slate-400" />
                  <button type="submit" disabled={!input.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5CB800] text-white shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Nachricht senden"><ArrowUp className="h-5 w-5" /></button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
