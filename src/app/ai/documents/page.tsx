import Link from 'next/link'
import { ArrowLeft, FileSearch, ShieldCheck, Sparkles } from 'lucide-react'
import { ProjectImportClient } from '@/components/project-import/ProjectImportClient'

export const metadata = {
  title: 'EMA-AI Dokumentenanalyse',
  description: 'Dokumente mit EMA-AI hochladen, auslesen und prüfen',
}

export default function EmaAiDocumentsPage() {
  return (
    <div className="page-container space-y-5 pt-[max(5.5rem,calc(env(safe-area-inset-top)+3rem))] md:space-y-8 md:pt-10">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#07142F] via-[#091a3b] to-[#16472f] p-5 text-white shadow-[0_22px_70px_rgba(15,23,42,0.12)] md:rounded-[2.2rem] md:p-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#5CB800]/20 blur-2xl" />
        <div className="relative">
          <Link href="/ai" className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold text-white ring-1 ring-white/15">
            <ArrowLeft className="h-4 w-4" /> Zurück zu EMA-AI
          </Link>
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800] shadow-lg shadow-[#5CB800]/20">
              <FileSearch className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#87d33b]">EMA-AI</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">Dokumentenanalyse</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-lg">
                Lade PDF-Dateien, Fotos oder Screenshots hoch. EMA-AI liest vorhandene Projektdaten aus und zeigt sie dir vor der Übernahme zur Prüfung an.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 ring-1 ring-white/10"><Sparkles className="h-4 w-4 text-[#87d33b]" /> Kostenlose Analyse</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 ring-1 ring-white/10"><ShieldCheck className="h-4 w-4 text-[#87d33b]" /> Übernahme erst nach Prüfung</span>
          </div>
        </div>
      </section>

      <ProjectImportClient />
    </div>
  )
}
