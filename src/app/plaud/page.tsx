import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckSquare, Mic2, Sparkles } from 'lucide-react'

export const metadata = { title: 'PLAUD' }

export default function PlaudPage() {
  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-3 py-5 md:px-0 md:py-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" aria-label="Zurück zum Dashboard" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#1F2A44] shadow-sm">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">EMA Intelligence</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#07142F]">PLAUD</h1>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-[#1F2A44]/10 bg-gradient-to-br from-[#1F2A44] via-[#243451] to-[#1F2A44] p-6 text-white shadow-[0_20px_55px_rgba(31,42,68,0.18)] md:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Mic2 className="h-7 w-7 text-[#76d22a]" /></span>
          <div><h2 className="text-2xl font-extrabold">Gespräche intelligent weiterverarbeiten</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">PLAUD-Aufnahmen, Transkripte und Notizen werden hier mit EMA verbunden. Erkannte Termine und Aufgaben werden vor der Übernahme geprüft.</p></div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><Mic2 className="h-5 w-5 text-[#1F2A44]" /><p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">Neue Aufnahmen</p><p className="mt-1 text-2xl font-extrabold text-[#07142F]">–</p></div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><CalendarDays className="h-5 w-5 text-[#5CB800]" /><p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">Termine erkannt</p><p className="mt-1 text-2xl font-extrabold text-[#07142F]">–</p></div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><CheckSquare className="h-5 w-5 text-violet-600" /><p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">Offene Aufgaben</p><p className="mt-1 text-2xl font-extrabold text-[#07142F]">–</p></div>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]"><Sparkles className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold text-[#07142F]">PLAUD verbinden</h2><p className="text-sm text-slate-500">Die EMA-Serveranbindung wird als nächster Schritt aktiviert.</p></div></div>
        <p className="mt-5 text-sm leading-relaxed text-slate-600">Nach der Verbindung erscheinen hier deine Aufnahmen mit Zusammenfassung, Transkript und von EMA erkannten Aktionen. Termine und Aufgaben werden nicht ungeprüft erstellt.</p>
      </section>
    </div>
  )
}
