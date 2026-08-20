'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, CheckSquare, Mic2, Sparkles, ShieldCheck } from 'lucide-react'

export default function PlaudPage() {
  const router = useRouter()
  const connected = false

  const goBack = () => {
    if (window.history.length > 1) router.back()
    else router.push('/dashboard')
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] space-y-4 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:space-y-6 md:px-6 md:py-8">
      <header className="flex min-h-14 items-center gap-3">
        <button type="button" onClick={goBack} aria-label="Zurück" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#1F2A44] shadow-sm active:scale-95"><ArrowLeft className="h-6 w-6" /></button>
        <div className="min-w-0"><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5CB800]">EMA Intelligence</p><div className="flex items-center gap-2"><h1 className="text-3xl font-extrabold tracking-tight text-[#07142F]">PLAUD</h1><span className={`h-3 w-3 rounded-full ${connected ? 'bg-[#5CB800] shadow-[0_0_0_4px_rgba(92,184,0,.14)]' : 'bg-slate-300'}`} /></div></div>
      </header>

      <section className="overflow-hidden rounded-[1.75rem] border border-[#1F2A44]/10 bg-gradient-to-br from-[#1F2A44] via-[#243451] to-[#1F2A44] p-5 text-white shadow-[0_16px_45px_rgba(31,42,68,0.16)] md:p-8">
        <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Mic2 className="h-6 w-6 text-[#76d22a]" /></span><div><h2 className="text-xl font-extrabold leading-tight md:text-2xl">Gespräche intelligent weiterverarbeiten</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">Aufnahmen, Transkripte und Notizen an einem Ort. EMA erkennt daraus Termine und Aufgaben, bevor du sie übernimmst.</p></div></div>
      </section>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-5"><Mic2 className="h-5 w-5 text-[#1F2A44]" /><p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 md:text-xs">Aufnahmen</p><p className="mt-1 text-xl font-extrabold text-[#07142F]">–</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-5"><CalendarDays className="h-5 w-5 text-[#5CB800]" /><p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 md:text-xs">Termine</p><p className="mt-1 text-xl font-extrabold text-[#07142F]">–</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-5"><CheckSquare className="h-5 w-5 text-violet-600" /><p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 md:text-xs">Aufgaben</p><p className="mt-1 text-xl font-extrabold text-[#07142F]">–</p></div>
      </div>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]"><ShieldCheck className="h-5 w-5" /></span><div><div className="flex items-center gap-2"><h2 className="text-lg font-extrabold text-[#07142F]">PLAUD</h2><span className="h-3 w-3 rounded-full bg-slate-300" /></div><p className="mt-1 text-sm font-medium text-slate-600">Verbindung wird eingerichtet</p></div></div>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">EMA zeigt den Status erst dann grün an, wenn eine echte, serverseitig geprüfte PLAUD-Verbindung besteht. Deine Zugangsdaten werden nicht im Browser oder im Quellcode gespeichert.</p>
        <div className="mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500"><Sparkles className="h-4 w-4" /> PLAUD-Integration vorbereitet</div>
      </section>
    </main>
  )
}
