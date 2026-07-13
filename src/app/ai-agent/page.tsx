import Link from 'next/link'
import {
  Bot,
  Search,
  Building2,
  FolderSearch,
  MailCheck,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Clock3,
} from 'lucide-react'

const workflows = [
  {
    title: 'Dachflächen finden',
    description: 'Große Gewerbe- und Industriedächer recherchieren und als Leads vorbereiten.',
    icon: Building2,
    status: 'Vorbereitet',
  },
  {
    title: 'Projekte finden',
    description: 'PV-, BESS- und Hybridprojekte für Investoren identifizieren und bewerten.',
    icon: FolderSearch,
    status: 'Vorbereitet',
  },
  {
    title: 'E-Mails vorbereiten',
    description: 'Individuelle Erstansprachen erstellen und zur Freigabe vorlegen.',
    icon: MailCheck,
    status: 'Sprint 2',
  },
]

const exampleCommands = [
  'Finde Logistikunternehmen in Rheinland-Pfalz mit großen Dachflächen.',
  'Suche neue PV-Projekte ab 5 MWp für unsere Investoren.',
  'Erstelle für alle geprüften Dachflächen-Leads eine persönliche E-Mail.',
]

export default function AiAgentPage() {
  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <section className="overflow-hidden rounded-3xl bg-[#132060] text-white shadow-sm">
          <div className="relative px-6 py-8 md:px-10 md:py-11">
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#5CB800]/20 blur-3xl" />
            <div className="relative max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                <Sparkles className="h-4 w-4 text-[#8FDA45]" />
                EMA Acquisition Intelligence
              </div>
              <div className="flex items-start gap-4">
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 md:flex">
                  <Bot className="h-7 w-7 text-[#8FDA45]" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">KI-Agent</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
                    Dein digitaler Akquise-Mitarbeiter für neue Projekte und große Dachflächen.
                    Recherche, Bewertung und E-Mail-Vorbereitung werden hier zentral gesteuert.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF8E8]">
                <Search className="h-5 w-5 text-[#5CB800]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#132060]">Auftrag an den Agenten</h2>
                <p className="text-sm text-slate-500">Beschreibe, welche Chancen gesucht werden sollen.</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <textarea
                aria-label="Auftrag an den KI-Agenten"
                placeholder="Zum Beispiel: Finde 20 Logistikunternehmen zwischen Frankfurt und Stuttgart mit großen Dachflächen und ohne erkennbare PV-Anlage."
                className="min-h-36 w-full resize-none bg-transparent text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                disabled
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Clock3 className="h-4 w-4" />
                  Aktivierung folgt mit der Recherche-Engine
                </span>
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-[#132060] px-4 py-2.5 text-sm font-semibold text-white opacity-50"
                >
                  Agent starten
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Beispielaufträge</p>
              <div className="space-y-2">
                {exampleCommands.map((command) => (
                  <div key={command} className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                    {command}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[#5CB800]" />
                <h2 className="font-semibold text-[#132060]">Freigabe bleibt bei dir</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Der Agent darf Leads recherchieren und Nachrichten vorbereiten. Eine erste E-Mail wird erst nach deiner ausdrücklichen Freigabe versendet.
              </p>
              <Link
                href="/acquisition"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#132060] hover:text-[#5CB800]"
              >
                Zum Akquise-Center
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Agentenstatus</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Grundsystem</span>
                  <span className="rounded-full bg-[#EFF8E8] px-2.5 py-1 text-xs font-semibold text-[#468C00]">Aktiv</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Recherche</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">In Aufbau</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Outlook-Versand</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Geplant</span>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-[#132060]">Fähigkeiten des Agenten</h2>
            <p className="mt-1 text-sm text-slate-500">Die Module werden Schritt für Schritt aktiviert.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {workflows.map(({ title, description, icon: Icon, status }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2F7]">
                    <Icon className="h-5 w-5 text-[#132060]" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{status}</span>
                </div>
                <h3 className="mt-4 font-semibold text-[#132060]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
