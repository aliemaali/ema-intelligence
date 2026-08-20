'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, Check, CheckSquare, Clock3, Mic2, ShieldCheck, Sparkles, X } from 'lucide-react'

const suggestions = [
  { type: 'Termin', title: 'Folgegespräch nach Due Diligence', detail: '26.–29. August 2026', source: 'Aus Gespräch abgeleitet', icon: CalendarDays },
  { type: 'Aufgabe', title: 'NDA abstimmen und unterzeichnen', detail: 'Vor Datenraumfreigabe', source: 'Im Gespräch besprochen', icon: CheckSquare },
  { type: 'Aufgabe', title: 'Teaser und Präsentation prüfen', detail: 'Projektpaket · 4 Projekte', source: 'Im Gespräch besprochen', icon: CheckSquare },
]

export default function PlaudPage() {
  const router = useRouter()
  const connected = false
  const goBack = () => window.history.length > 1 ? router.back() : router.push('/dashboard')

  return <main className="mx-auto w-full max-w-[1180px] space-y-4 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:space-y-6 md:px-6 md:py-8">
    <header className="flex min-h-14 items-center gap-3"><button type="button" onClick={goBack} aria-label="Zurück" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#1F2A44] shadow-sm active:scale-95"><ArrowLeft className="h-6 w-6" /></button><div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#5CB800]">EMA Intelligence</p><div className="flex items-center gap-2"><h1 className="text-3xl font-extrabold tracking-tight text-[#07142F]">PLAUD</h1><span className={`h-3 w-3 rounded-full ${connected?'bg-[#5CB800]':'bg-slate-300'}`} /></div></div></header>

    <section className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#1F2A44] via-[#243451] to-[#1F2A44] p-5 text-white shadow-lg md:p-8"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Mic2 className="h-6 w-6 text-[#76d22a]" /></span><div><h2 className="text-xl font-extrabold">Gespräche intelligent weiterverarbeiten</h2><p className="mt-2 text-sm leading-relaxed text-white/75">EMA bereitet erkannte Termine und Aufgaben zur Prüfung vor. Nichts wird ohne deine Freigabe übernommen.</p></div></div></section>

    <div className="grid grid-cols-3 gap-2"><Stat icon={Mic2} label="Aufnahmen" value="–"/><Stat icon={CalendarDays} label="Termine" value="1"/><Stat icon={CheckSquare} label="Aufgaben" value="2"/></div>

    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-8"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[#5CB800]">EMA Vorschläge</p><h2 className="mt-1 text-xl font-extrabold text-[#07142F]">3 Elemente prüfen</h2></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">Freigabe nötig</span></div><div className="mt-5 space-y-3">{suggestions.map(({type,title,detail,source,icon:Icon})=><article key={title} className="rounded-2xl border border-slate-200 p-4"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[#1F2A44]"><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{type}</span></div><h3 className="mt-1 font-extrabold text-[#07142F]">{title}</h3><p className="mt-1 text-sm text-slate-600">{detail}</p><p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><Clock3 className="h-3.5 w-3.5"/>{source}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600"><X className="h-4 w-4"/>Verwerfen</button><button type="button" className="flex items-center justify-center gap-2 rounded-xl bg-[#5CB800] py-2.5 text-sm font-extrabold text-white"><Check className="h-4 w-4"/>Übernehmen</button></div></article>)}</div></section>

    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]"><ShieldCheck className="h-5 w-5"/></span><div><div className="flex items-center gap-2"><h2 className="text-lg font-extrabold text-[#07142F]">PLAUD</h2><span className="h-3 w-3 rounded-full bg-slate-300"/></div><p className="mt-1 text-sm font-medium text-slate-600">Verbindung wird eingerichtet</p></div></div><div className="mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500"><Sparkles className="h-4 w-4"/> PLAUD-Integration vorbereitet</div></section>
  </main>
}

function Stat({icon:Icon,label,value}:{icon:any,label:string,value:string}){return <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><Icon className="h-5 w-5 text-[#1F2A44]"/><p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold text-[#07142F]">{value}</p></div>}
