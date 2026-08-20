'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArrowLeft, CalendarDays, Check, CheckSquare, Clock3, Eye, FileText, Mic2, Pencil, Printer, Save, ShieldCheck, Sparkles, X } from 'lucide-react'
import { archivePlaudNote, savePlaudItem, savePlaudNoteTitle } from './actions'
import { CURRENT_PLAUD_NOTE } from '@/lib/plaud/current-note'

type Suggestion = { id:string; type:'Termin'|'Aufgabe'; title:string; detail:string; source:string; dueAt:string; icon:typeof CalendarDays }
type Stored = { id:string; external_id:string; kind:'task'|'appointment'; title:string; detail:string|null; source:string|null; status:string; due_at:string|null }

const initialSuggestions:Suggestion[] = [
  { id:'followup', type:'Termin', title:'Folgegespräch nach Due Diligence', detail:'26.–29. August 2026', source:'Aus Gespräch abgeleitet', dueAt:'2026-08-26T09:00:00+02:00', icon:CalendarDays },
  { id:'nda', type:'Aufgabe', title:'NDA abstimmen und unterzeichnen', detail:'Vor Datenraumfreigabe', source:'Im Gespräch besprochen', dueAt:'2026-08-23T12:00:00+02:00', icon:CheckSquare },
  { id:'teaser', type:'Aufgabe', title:'Teaser und Präsentation prüfen', detail:'Projektpaket · 4 Projekte', source:'Im Gespräch besprochen', dueAt:'2026-08-27T12:00:00+02:00', icon:CheckSquare },
]

export default function PlaudPage() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [stored, setStored] = useState<Stored[]>([])
  const [title, setTitle] = useState<string>(CURRENT_PLAUD_NOTE.defaultTitle)
  const [editTitle, setEditTitle] = useState(false)
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState(false)
  const [noteArchived, setNoteArchived] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/plaud/state', { cache:'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('PLAUD-Daten konnten nicht geladen werden.')))
      .then((data) => {
        if (!active) return
        setStored(data.items ?? [])
        if (data.note?.title) setTitle(data.note.title)
        setNoteArchived(Boolean(data.note?.archived_at))
        const handled = new Set((data.items ?? []).map((item:Stored) => item.external_id))
        setSuggestions(initialSuggestions.filter((item) => !handled.has(item.id)))
      })
      .catch((error) => active && setMessage(error instanceof Error ? error.message : 'PLAUD-Daten konnten nicht geladen werden.'))
    return () => { active = false }
  }, [])

  const open = stored.filter((item) => item.status === 'open')
  const counts = useMemo(() => ({
    termine: open.filter((item) => item.kind === 'appointment').length,
    aufgaben: open.filter((item) => item.kind === 'task').length,
  }), [open])

  function act(id:string, accept:boolean) {
    const item = suggestions.find((suggestion) => suggestion.id === id)
    if (!item) return
    startTransition(async () => {
      try {
        const saved = await savePlaudItem({ externalId:id, kind:item.type === 'Termin' ? 'appointment' : 'task', title:item.title, detail:item.detail, source:item.source, dueAt:item.dueAt, status:accept ? 'open' : 'rejected' })
        setSuggestions((current) => current.filter((suggestion) => suggestion.id !== id))
        setStored((current) => [...current.filter((entry) => entry.external_id !== id), saved as Stored])
        setMessage(accept ? `„${item.title}“ wurde gespeichert und ist jetzt unter Aufgaben${item.type === 'Termin' ? ' sowie im Kalender' : ''} verfügbar.` : `„${item.title}“ wurde dauerhaft verworfen.`)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Die Auswahl konnte nicht gespeichert werden.')
      }
    })
  }

  function saveTitle() {
    startTransition(async () => {
      try {
        await savePlaudNoteTitle(title)
        setEditTitle(false)
        setMessage('Überschrift gespeichert.')
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Die Überschrift konnte nicht gespeichert werden.')
      }
    })
  }

  function archiveNote() {
    startTransition(async () => {
      try {
        await archivePlaudNote()
        setNoteArchived(true)
        setPreview(false)
        setMessage('PLAUD-Notiz wurde ins Archiv verschoben.')
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Die Notiz konnte nicht archiviert werden.')
      }
    })
  }

  return <main className="mx-auto w-full max-w-[1180px] space-y-4 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:space-y-6 md:px-6 md:py-8">
    <header className="flex min-h-14 items-center gap-3 print:hidden"><button onClick={() => window.history.length > 1 ? router.back() : router.push('/dashboard')} className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-white shadow-sm" aria-label="Zurück"><ArrowLeft /></button><div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#5CB800]">EMA Intelligence</p><h1 className="text-3xl font-extrabold text-[#07142F]">PLAUD</h1></div></header>
    <section className="rounded-[1.75rem] bg-[#1F2A44] p-5 text-white shadow-lg print:hidden"><div className="flex gap-4"><Mic2 className="text-[#76d22a]" /><div><h2 className="text-xl font-extrabold">Gespräche intelligent weiterverarbeiten</h2><p className="mt-2 text-sm text-white/75">Termine, Aufgaben und vollständige PLAUD-Notizen an einem Ort.</p></div></div></section>
    {message && <div role="status" className="rounded-2xl bg-[#5CB800]/10 px-4 py-3 text-sm font-bold text-[#2F7D00] print:hidden">{message}</div>}

    <div className="grid grid-cols-3 gap-2 print:hidden"><Stat href={noteArchived ? '/archive/plaud' : '#plaud-note'} icon={Mic2} label="Aufnahmen" value={noteArchived ? '0' : '1'} /><Stat href="/tasks?view=appointments" icon={CalendarDays} label="Offene Termine" value={String(counts.termine)} /><Stat href="/tasks?view=tasks" icon={CheckSquare} label="Offene Aufgaben" value={String(counts.aufgaben)} /></div>

    <section className="rounded-[1.75rem] border bg-white p-5 shadow-sm print:hidden"><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[#5CB800]">EMA Vorschläge</p><h2 className="mt-1 text-xl font-extrabold text-[#07142F]">{suggestions.length ? `${suggestions.length} Elemente prüfen` : 'Alles geprüft'}</h2><div className="mt-5 space-y-3">{suggestions.map((item) => <Item key={item.id} item={item} disabled={pending} onAct={act} />)}</div>{!suggestions.length && <Link href="/tasks" className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 font-extrabold text-[#1F2A44]">Gespeicherte Aufgaben und Termine öffnen</Link>}</section>

    {!noteArchived ? <section id="plaud-note" className="scroll-mt-6 rounded-[1.75rem] border bg-white p-5 shadow-sm print:hidden">
      <div className="flex gap-3"><FileText className="h-7 w-7 shrink-0 text-[#2F8A00]" /><div className="min-w-0 flex-1"><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[#5CB800]">PLAUD Notiz</p>{editTitle ? <div className="mt-2 flex gap-2"><input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2 font-bold" aria-label="PLAUD-Überschrift" /><button disabled={pending || !title.trim()} onClick={saveTitle} className="rounded-xl bg-[#5CB800] px-3 text-white" aria-label="Überschrift speichern"><Save /></button></div> : <div className="flex items-start gap-2"><h2 className="mt-1 flex-1 text-lg font-extrabold text-[#07142F]">{title}</h2><button onClick={() => setEditTitle(true)} className="mt-1 rounded-lg p-2" aria-label="Überschrift bearbeiten"><Pencil className="h-4 w-4" /></button><button disabled={pending} onClick={archiveNote} className="mt-1 rounded-lg p-2 text-slate-500" aria-label="PLAUD-Notiz archivieren"><Archive className="h-4 w-4" /></button></div>}<p className="mt-1 text-xs text-slate-400">20.08.2026 · 13:32</p></div></div>
      <button onClick={() => setPreview(true)} className="mt-4 block w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition active:scale-[.99]" aria-label="PLAUD-Notiz öffnen"><p className="line-clamp-4 text-sm leading-relaxed text-slate-600">{CURRENT_PLAUD_NOTE.sections[0][1]}</p><span className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#1F2A44] py-3 font-extrabold text-white"><Eye />Notiz und PDF-Vorschau öffnen</span></button>
    </section> : <Link href="/archive/plaud" className="flex items-center justify-between rounded-[1.75rem] border bg-white p-5 shadow-sm print:hidden"><div><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[#5CB800]">PLAUD Notiz</p><h2 className="mt-1 font-extrabold text-[#07142F]">Im Archiv</h2></div><Archive className="text-slate-400" /></Link>}

    <section className="rounded-[1.75rem] border bg-white p-5 shadow-sm print:hidden"><div className="flex gap-3"><ShieldCheck className="text-[#2F8A00]" /><div><h2 className="font-extrabold">PLAUD <span className="inline-block h-3 w-3 rounded-full bg-slate-300" /></h2><p className="text-sm text-slate-600">Verbindung wird eingerichtet</p></div></div><div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500"><Sparkles className="mr-2 inline h-4 w-4" />PLAUD-Integration vorbereitet</div></section>
    {preview && <PlaudPreview title={title} onClose={() => setPreview(false)} />}
  </main>
}

function PlaudPreview({ title, onClose }:{ title:string; onClose:()=>void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-3 print:static print:bg-white print:p-0"><div className="mx-auto max-w-[850px]"><div className="sticky top-2 z-10 mb-3 flex gap-2 rounded-2xl bg-white p-2 shadow-xl print:hidden"><button onClick={onClose} className="flex-1 rounded-xl border py-3 font-bold"><X className="mr-2 inline h-4 w-4" />Schließen</button><button onClick={() => window.print()} className="flex-1 rounded-xl bg-[#5CB800] py-3 font-extrabold text-white"><Printer className="mr-2 inline h-4 w-4" />PDF sichern</button></div><article className="plaud-pdf min-h-[1120px] bg-white p-8 text-[#1F2A44] shadow-2xl md:p-14"><div className="border-b-4 border-[#5CB800] pb-6"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">EMA Enterprise GmbH · PLAUD Gesprächsnotiz</p><h1 className="mt-4 text-3xl font-extrabold text-[#07142F]">{title}</h1><p className="mt-3 text-sm text-slate-500">20. August 2026 · 13:32 Uhr</p></div>{CURRENT_PLAUD_NOTE.sections.map(([heading,text]) => <section key={heading} className="mt-7 break-inside-avoid"><h2 className="text-xl font-extrabold text-[#07142F]">{heading}</h2><p className="mt-2 text-sm leading-7 text-slate-700">{text}</p></section>)}<section className="mt-7"><h2 className="text-xl font-extrabold">To-do-Liste</h2><ul className="mt-3 space-y-2">{CURRENT_PLAUD_NOTE.todos.map((item) => <li key={item} className="text-sm">☐ {item}</li>)}</ul></section><section className="mt-7 rounded-2xl bg-slate-50 p-5"><h2 className="text-xl font-extrabold">Vorschläge der PLAUD KI</h2><ol className="mt-3 list-decimal space-y-2 pl-5">{CURRENT_PLAUD_NOTE.aiSuggestions.map((item) => <li key={item} className="text-sm">{item}</li>)}</ol></section></article></div><style jsx global>{`@media print{body *{visibility:hidden!important}.plaud-pdf,.plaud-pdf *{visibility:visible!important}.plaud-pdf{position:absolute!important;left:0;top:0;width:100%!important;box-shadow:none!important;padding:14mm!important}@page{size:A4;margin:0}}`}</style></div>
}

function Item({ item,disabled,onAct }:{ item:Suggestion; disabled:boolean; onAct:(id:string,accept:boolean)=>void }) {
  const Icon = item.icon
  return <article className="rounded-2xl border p-4"><div className="flex gap-3"><Icon /><div><span className="text-[10px] font-extrabold uppercase text-slate-400">{item.type}</span><h3 className="font-extrabold">{item.title}</h3><p className="text-sm text-slate-600">{item.detail}</p><p className="mt-2 text-xs text-slate-400"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{item.source}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={disabled} onClick={() => onAct(item.id,false)} className="rounded-xl border py-2.5 font-bold"><X className="mr-1 inline h-4 w-4" />Verwerfen</button><button disabled={disabled} onClick={() => onAct(item.id,true)} className="rounded-xl bg-[#5CB800] py-2.5 font-extrabold text-white"><Check className="mr-1 inline h-4 w-4" />Übernehmen</button></div></article>
}

function Stat({ href,icon:Icon,label,value }:{ href:string; icon:typeof Mic2; label:string; value:string }) {
  return <Link href={href} aria-label={`${label} öffnen`} className="cursor-pointer rounded-2xl border bg-white p-3 shadow-sm transition active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5CB800]"><Icon className="h-5 w-5" /><p className="mt-3 text-[10px] font-extrabold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold">{value}</p></Link>
}
