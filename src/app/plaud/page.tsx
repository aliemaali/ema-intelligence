'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive, ArrowLeft, CalendarDays, Check, CheckSquare, Clock3, Eye, FileText,
  Languages, Link2, Loader2, Mic2, Pencil, Printer, RefreshCw, Save, ShieldCheck,
  Unlink, X,
} from 'lucide-react'
import { archivePlaudNoteById, decidePlaudItem, savePlaudNoteTitleById } from './actions'
import { CURRENT_PLAUD_NOTE } from '@/lib/plaud/current-note'

type StoredItem = {
  id:string
  external_id:string
  note_external_id:string|null
  kind:'task'|'appointment'
  title:string
  detail:string|null
  source:string|null
  status:'suggested'|'open'|'completed'|'rejected'
  due_at:string|null
}

type PlaudNote = {
  id:string
  external_id:string
  title:string
  recorded_at:string|null
  duration_ms:number|null
  source_language:string|null
  summary_original:string|null
  summary_de:string|null
  transcript_original:string|null
  transcript_de:string|null
  archived_at:string|null
  imported_at:string|null
}

type PendingRecording = { id:string; name:string; createdAt:string; durationMs:number }

export default function PlaudPage() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [items, setItems] = useState<StoredItem[]>([])
  const [notes, setNotes] = useState<PlaudNote[]>([])
  const [connected, setConnected] = useState(false)
  const [recordings, setRecordings] = useState<PendingRecording[]>([])
  const [stateLoading, setStateLoading] = useState(true)
  const [inboxLoading, setInboxLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string|null>(null)
  const [openingId, setOpeningId] = useState<string|null>(null)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [preview, setPreview] = useState<PlaudNote|null>(null)
  const [editingId, setEditingId] = useState<string|null>(null)
  const [titleDraft, setTitleDraft] = useState('')

  const loadInbox = useCallback(async () => {
    setInboxLoading(true)
    setErrorMessage('')
    try {
      const response = await fetch('/api/plaud/inbox', { cache:'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'PLAUD-Aufnahmen konnten nicht geladen werden.')
      setConnected(Boolean(data.connected))
      setRecordings(data.recordings ?? [])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'PLAUD-Aufnahmen konnten nicht geladen werden.')
    } finally {
      setInboxLoading(false)
    }
  }, [])

  const loadState = useCallback(async () => {
    setStateLoading(true)
    try {
      const response = await fetch('/api/plaud/state', { cache:'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'PLAUD-Daten konnten nicht geladen werden.')
      setItems(data.items ?? [])
      setNotes(data.notes ?? [])
      setConnected(Boolean(data.connected))
      if (data.connected) await loadInbox()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'PLAUD-Daten konnten nicht geladen werden.')
    } finally {
      setStateLoading(false)
    }
  }, [loadInbox])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === '1') setMessage('PLAUD ist jetzt sicher mit EMA verbunden.')
    if (params.get('disconnected') === '1') setMessage('PLAUD-Verbindung wurde getrennt.')
    if (params.get('error')) setErrorMessage(params.get('error') || 'PLAUD-Anmeldung fehlgeschlagen.')
    void loadState()
  }, [loadState])

  const activeNotes = useMemo(() => notes.filter((note) => !note.archived_at), [notes])
  const suggestedItems = useMemo(() => items.filter((item) => item.status === 'suggested'), [items])
  const counts = useMemo(() => {
    const open = items.filter((item) => item.status === 'open')
    return {
      termine: open.filter((item) => item.kind === 'appointment').length,
      aufgaben: open.filter((item) => item.kind === 'task').length,
    }
  }, [items])

  async function decideRecording(fileId:string, accept:boolean) {
    setProcessingId(fileId)
    setMessage('')
    setErrorMessage('')
    try {
      const response = await fetch(accept ? '/api/plaud/import' : '/api/plaud/decision', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(accept ? {fileId} : {fileId,decision:'rejected'}),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Die Auswahl konnte nicht gespeichert werden.')
      setRecordings((current) => current.filter((recording) => recording.id !== fileId))
      setMessage(accept
        ? `„${data.title || 'PLAUD-Meeting'}“ wurde übernommen${data.suggestionCount ? `; ${data.suggestionCount} Aufgaben oder Termine warten auf deine Freigabe` : ''}.`
        : 'Die PLAUD-Aufnahme wurde nicht in EMA übernommen.')
      if (accept) await loadState()
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Die Auswahl konnte nicht gespeichert werden.')
    } finally {
      setProcessingId(null)
    }
  }

  function decideSuggestion(item:StoredItem, accept:boolean) {
    startTransition(async () => {
      try {
        const saved = await decidePlaudItem(item.id, accept ? 'open' : 'rejected') as StoredItem
        setItems((current) => current.map((entry) => entry.id === item.id ? saved : entry))
        setMessage(accept
          ? `„${item.title}“ wurde gespeichert${item.kind === 'appointment' ? ' und in den Kalender übernommen' : ''}.`
          : `„${item.title}“ wurde verworfen.`)
        router.refresh()
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Die Auswahl konnte nicht gespeichert werden.')
      }
    })
  }

  function saveTitle(note:PlaudNote) {
    startTransition(async () => {
      try {
        await savePlaudNoteTitleById(note.id, titleDraft)
        setNotes((current) => current.map((entry) => entry.id === note.id ? {...entry,title:titleDraft.trim()} : entry))
        setEditingId(null)
        setMessage('Überschrift gespeichert.')
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Die Überschrift konnte nicht gespeichert werden.')
      }
    })
  }

  function archiveNote(note:PlaudNote) {
    startTransition(async () => {
      try {
        await archivePlaudNoteById(note.id)
        setNotes((current) => current.map((entry) => entry.id === note.id ? {...entry,archived_at:new Date().toISOString()} : entry))
        setPreview(null)
        setMessage('PLAUD-Notiz wurde ins Archiv verschoben.')
        router.refresh()
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Die Notiz konnte nicht archiviert werden.')
      }
    })
  }

  async function openNote(note:PlaudNote) {
    setOpeningId(note.id)
    setErrorMessage('')
    try {
      const response = await fetch(`/api/plaud/notes/${encodeURIComponent(note.id)}`, { cache:'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'PLAUD-Notiz konnte nicht geladen werden.')
      setPreview(data.note as PlaudNote)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'PLAUD-Notiz konnte nicht geladen werden.')
    } finally {
      setOpeningId(null)
    }
  }

  return <main className="mx-auto w-full max-w-[1180px] space-y-4 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:space-y-6 md:px-6 md:py-8">
    <header className="flex min-h-14 items-center gap-3 print:hidden"><button onClick={() => window.history.length > 1 ? router.back() : router.push('/dashboard')} className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-white shadow-sm" aria-label="Zurück"><ArrowLeft /></button><div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#5CB800]">EMA Intelligence</p><h1 className="text-3xl font-extrabold text-[#07142F]">PLAUD</h1></div></header>
    <section className="rounded-[1.75rem] bg-[#1F2A44] p-5 text-white shadow-lg print:hidden"><div className="flex gap-4"><Mic2 className="text-[#76d22a]" /><div><h2 className="text-xl font-extrabold">Du entscheidest, was in EMA landet</h2><p className="mt-2 text-sm text-white/75">Neue Aufnahmen erscheinen zuerst im Eingang. Transkript und Notiz werden erst nach deiner Freigabe übernommen.</p></div></div></section>
    {message && <div role="status" className="rounded-2xl bg-[#5CB800]/10 px-4 py-3 text-sm font-bold text-[#2F7D00] print:hidden">{message}</div>}
    {errorMessage && <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 print:hidden">{errorMessage}</div>}

    <div className="grid grid-cols-3 gap-2 print:hidden" aria-busy={stateLoading}><Stat href="#plaud-notes" icon={Mic2} label="Aufnahmen" value={stateLoading ? '–' : String(activeNotes.length)} /><Stat href="/tasks?view=appointments" icon={CalendarDays} label="Offene Termine" value={stateLoading ? '–' : String(counts.termine)} /><Stat href="/tasks?view=tasks" icon={CheckSquare} label="Offene Aufgaben" value={stateLoading ? '–' : String(counts.aufgaben)} /></div>

    <section className="rounded-[1.75rem] border bg-white p-5 shadow-sm print:hidden">
      <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><ShieldCheck className={connected?'text-[#2F8A00]':'text-slate-400'} /><div><h2 className="font-extrabold">PLAUD <span className={`inline-block h-3 w-3 rounded-full ${connected?'bg-[#5CB800]':'bg-slate-300'}`} /></h2><p className="text-sm text-slate-600">{connected?'Sicher verbunden':'Noch nicht verbunden'}</p></div></div>{connected&&<button disabled={inboxLoading} onClick={()=>void loadInbox()} className="flex h-11 w-11 items-center justify-center rounded-xl border" aria-label="PLAUD synchronisieren"><RefreshCw className={`h-5 w-5 ${inboxLoading?'animate-spin':''}`}/></button>}</div>
      {connected?<div className="mt-5 grid grid-cols-2 gap-2"><button disabled={inboxLoading} onClick={()=>void loadInbox()} className="rounded-xl bg-[#1F2A44] px-4 py-3 font-extrabold text-white"><RefreshCw className={`mr-2 inline h-4 w-4 ${inboxLoading?'animate-spin':''}`}/>Jetzt prüfen</button><form action="/api/plaud/disconnect" method="post"><button className="w-full rounded-xl border px-4 py-3 text-center font-bold text-slate-600"><Unlink className="mr-2 inline h-4 w-4"/>Trennen</button></form></div>:<Link href="/api/plaud/connect" className="mt-5 flex w-full items-center justify-center rounded-xl bg-[#5CB800] px-4 py-3 font-extrabold text-white"><Link2 className="mr-2 h-4 w-4"/>PLAUD verbinden</Link>}
    </section>

    {connected&&<section className="rounded-[1.75rem] border bg-white p-5 shadow-sm print:hidden"><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[#5CB800]">Neue PLAUD-Aufnahmen</p><h2 className="mt-1 text-xl font-extrabold text-[#07142F]">{inboxLoading?'Aufnahmen werden geprüft':recordings.length?`${recordings.length} Meetings entscheiden`:'Keine neuen Aufnahmen'}</h2><p className="mt-2 text-sm text-slate-500">Hier werden nur Titel, Zeitpunkt und Dauer angezeigt. Der Inhalt wird erst nach deiner Freigabe abgerufen.</p>{inboxLoading?<LoadingCard/>:<div className="mt-5 space-y-3">{recordings.map((recording)=><RecordingCard key={recording.id} recording={recording} busy={processingId===recording.id} blocked={Boolean(processingId)} onDecision={decideRecording}/>)}</div>}</section>}

    <section className="rounded-[1.75rem] border bg-white p-5 shadow-sm print:hidden" aria-busy={stateLoading}><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[#5CB800]">EMA Vorschläge</p><h2 className="mt-1 text-xl font-extrabold text-[#07142F]">{stateLoading?'Daten werden geladen':suggestedItems.length?`${suggestedItems.length} Elemente prüfen`:'Alles geprüft'}</h2>{stateLoading?<LoadingCard/>:<div className="mt-5 space-y-3">{suggestedItems.map((item)=><SuggestionCard key={item.id} item={item} disabled={pending} onDecision={decideSuggestion}/>)}</div>}{!stateLoading&&!suggestedItems.length&&<Link href="/tasks" className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 font-extrabold text-[#1F2A44]">Gespeicherte Aufgaben und Termine öffnen</Link>}</section>

    <section id="plaud-notes" className="scroll-mt-6 space-y-3 print:hidden"><div><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[#5CB800]">PLAUD Notizen</p><h2 className="mt-1 text-xl font-extrabold text-[#07142F]">Übernommene Meetings</h2></div>{stateLoading?<LoadingCard/>:activeNotes.length?activeNotes.map((note)=><article key={note.id} className="rounded-[1.75rem] border bg-white p-5 shadow-sm"><div className="flex gap-3"><FileText className="h-7 w-7 shrink-0 text-[#2F8A00]"/><div className="min-w-0 flex-1">{editingId===note.id?<div className="flex gap-2"><input value={titleDraft} onChange={(event)=>setTitleDraft(event.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2 font-bold" aria-label="PLAUD-Überschrift"/><button disabled={pending||!titleDraft.trim()} onClick={()=>saveTitle(note)} className="rounded-xl bg-[#5CB800] px-3 text-white" aria-label="Überschrift speichern"><Save/></button></div>:<div className="flex items-start gap-2"><h3 className="flex-1 text-lg font-extrabold text-[#07142F]">{note.title}</h3><button onClick={()=>{setEditingId(note.id);setTitleDraft(note.title)}} className="rounded-lg p-2" aria-label="Überschrift bearbeiten"><Pencil className="h-4 w-4"/></button><button disabled={pending} onClick={()=>archiveNote(note)} className="rounded-lg p-2 text-slate-500" aria-label="PLAUD-Notiz archivieren"><Archive className="h-4 w-4"/></button></div>}<p className="mt-1 text-xs text-slate-400">{formatDate(note.recorded_at)}{note.duration_ms?` · ${formatDuration(note.duration_ms)}`:''}</p>{note.source_language&&<p className="mt-2 inline-flex items-center rounded-full bg-[#5CB800]/10 px-2.5 py-1 text-[11px] font-extrabold text-[#2F7D00]"><Languages className="mr-1 h-3.5 w-3.5"/>Deutsch + Original</p>}</div></div><button disabled={openingId===note.id} onClick={()=>void openNote(note)} className="mt-4 block w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition active:scale-[.99] disabled:opacity-60" aria-label="PLAUD-Notiz öffnen"><p className="line-clamp-4 text-sm leading-relaxed text-slate-600">{noteSummary(note)}</p><span className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#1F2A44] py-3 font-extrabold text-white">{openingId===note.id?<Loader2 className="animate-spin"/>:<Eye/>}{openingId===note.id?'Notiz wird geladen':'Notiz und Transkript öffnen'}</span></button></article>):<div className="rounded-[1.75rem] border bg-white p-8 text-center text-sm font-semibold text-slate-500">Noch kein PLAUD-Meeting in EMA übernommen.</div>}</section>

    {preview&&<PlaudPreview note={preview} onClose={()=>setPreview(null)}/>}
  </main>
}

function LoadingCard(){return <div className="mt-5 animate-pulse rounded-2xl border p-4" role="status"><span className="sr-only">Daten werden geladen</span><div className="h-4 w-24 rounded bg-slate-200"/><div className="mt-4 h-5 w-4/5 rounded bg-slate-200"/><div className="mt-3 h-4 w-1/2 rounded bg-slate-100"/></div>}

function RecordingCard({recording,busy,blocked,onDecision}:{recording:PendingRecording;busy:boolean;blocked:boolean;onDecision:(id:string,accept:boolean)=>void}){return <article className="rounded-2xl border p-4"><div className="flex gap-3"><Mic2 className="shrink-0 text-[#1F2A44]"/><div><h3 className="font-extrabold text-[#07142F]">{recording.name}</h3><p className="mt-1 text-sm text-slate-500">{formatDate(recording.createdAt)}{recording.durationMs?` · ${formatDuration(recording.durationMs)}`:''}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={blocked} onClick={()=>onDecision(recording.id,false)} className="rounded-xl border py-2.5 font-bold disabled:opacity-50"><X className="mr-1 inline h-4 w-4"/>Nicht übernehmen</button><button disabled={blocked} onClick={()=>onDecision(recording.id,true)} className="rounded-xl bg-[#5CB800] py-2.5 font-extrabold text-white disabled:opacity-60">{busy?<Loader2 className="mr-1 inline h-4 w-4 animate-spin"/>:<Check className="mr-1 inline h-4 w-4"/>}{busy?'Wird aufbereitet':'In EMA übernehmen'}</button></div></article>}

function SuggestionCard({item,disabled,onDecision}:{item:StoredItem;disabled:boolean;onDecision:(item:StoredItem,accept:boolean)=>void}){const Icon=item.kind==='appointment'?CalendarDays:CheckSquare;return <article className="rounded-2xl border p-4"><div className="flex gap-3"><Icon/><div><span className="text-[10px] font-extrabold uppercase text-slate-400">{item.kind==='appointment'?'Termin':'Aufgabe'}</span><h3 className="font-extrabold">{item.title}</h3>{item.detail&&<p className="text-sm text-slate-600">{item.detail}</p>}<p className="mt-2 text-xs text-slate-400"><Clock3 className="mr-1 inline h-3.5 w-3.5"/>{item.source||'Aus PLAUD erkannt'}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={disabled} onClick={()=>onDecision(item,false)} className="rounded-xl border py-2.5 font-bold"><X className="mr-1 inline h-4 w-4"/>Verwerfen</button><button disabled={disabled} onClick={()=>onDecision(item,true)} className="rounded-xl bg-[#5CB800] py-2.5 font-extrabold text-white"><Check className="mr-1 inline h-4 w-4"/>Übernehmen</button></div></article>}

function PlaudPreview({note,onClose}:{note:PlaudNote;onClose:()=>void}){const[language,setLanguage]=useState<'de'|'original'>('de');const legacy=note.external_id===CURRENT_PLAUD_NOTE.externalId&&!note.transcript_de;const canShowOriginal=Boolean(note.transcript_original||note.summary_original);const summary=legacy?CURRENT_PLAUD_NOTE.sections.map(([heading,text])=>`${heading}\n${text}`).join('\n\n'):language==='original'?(note.summary_original||note.summary_de||''):(note.summary_de||note.summary_original||'');const transcript=legacy?'':language==='original'?(note.transcript_original||note.transcript_de||''):(note.transcript_de||note.transcript_original||'');return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-3 print:static print:bg-white print:p-0"><div className="mx-auto max-w-[850px]"><div className="sticky top-2 z-10 mb-3 rounded-2xl bg-white p-2 shadow-xl print:hidden"><div className="flex gap-2"><button onClick={onClose} className="flex-1 rounded-xl border py-3 font-bold"><X className="mr-2 inline h-4 w-4"/>Schließen</button><button onClick={()=>window.print()} className="flex-1 rounded-xl bg-[#5CB800] py-3 font-extrabold text-white"><Printer className="mr-2 inline h-4 w-4"/>PDF sichern</button></div>{canShowOriginal&&<div className="mt-2 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button onClick={()=>setLanguage('de')} className={`rounded-lg py-2 text-sm font-extrabold ${language==='de'?'bg-white text-[#07142F] shadow-sm':'text-slate-500'}`}>Deutsch</button><button onClick={()=>setLanguage('original')} className={`rounded-lg py-2 text-sm font-extrabold ${language==='original'?'bg-white text-[#07142F] shadow-sm':'text-slate-500'}`}>Original</button></div>}</div><article className="plaud-pdf min-h-[1120px] bg-white p-8 text-[#1F2A44] shadow-2xl md:p-14"><div className="border-b-4 border-[#5CB800] pb-6"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">EMA Enterprise GmbH · PLAUD Gesprächsnotiz</p><h1 className="mt-4 text-3xl font-extrabold text-[#07142F]">{note.title}</h1><p className="mt-3 text-sm text-slate-500">{formatDate(note.recorded_at)}{note.duration_ms?` · ${formatDuration(note.duration_ms)}`:''}</p></div>{legacy?CURRENT_PLAUD_NOTE.sections.map(([heading,text])=><section key={heading} className="mt-7 break-inside-avoid"><h2 className="text-xl font-extrabold text-[#07142F]">{heading}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{text}</p></section>):<><section className="mt-7"><h2 className="text-xl font-extrabold text-[#07142F]">Zusammenfassung</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{summary||'Keine Zusammenfassung verfügbar.'}</p></section>{transcript&&<section className="mt-8"><h2 className="text-xl font-extrabold text-[#07142F]">Vollständiges Transkript</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{transcript}</p></section>}</>}</article></div><style jsx global>{`@media print{body *{visibility:hidden!important}.plaud-pdf,.plaud-pdf *{visibility:visible!important}.plaud-pdf{position:absolute!important;left:0;top:0;width:100%!important;box-shadow:none!important;padding:14mm!important}@page{size:A4;margin:0}}`}</style></div>}

function noteSummary(note:PlaudNote){if(note.summary_de)return note.summary_de;if(note.summary_original)return note.summary_original;if(note.external_id===CURRENT_PLAUD_NOTE.externalId)return CURRENT_PLAUD_NOTE.sections[0][1];return 'Vollständige PLAUD-Notiz öffnen.'}
function formatDate(value:string|null){if(!value)return 'Datum nicht verfügbar';const date=new Date(value);return Number.isNaN(date.getTime())?'Datum nicht verfügbar':date.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function formatDuration(ms:number){const minutes=Math.max(1,Math.round(ms/60000));return minutes<60?`${minutes} Min.`:`${Math.floor(minutes/60)} Std. ${minutes%60} Min.`}
function Stat({href,icon:Icon,label,value}:{href:string;icon:typeof Mic2;label:string;value:string}){return <Link href={href} aria-label={`${label} öffnen`} className="cursor-pointer rounded-2xl border bg-white p-3 shadow-sm transition active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5CB800]"><Icon className="h-5 w-5"/><p className="mt-3 text-[10px] font-extrabold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold">{value}</p></Link>}
