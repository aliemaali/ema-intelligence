'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, CheckSquare, Clock3, Trash2 } from 'lucide-react'
import { completePlaudItem, deletePlaudItem } from '@/app/plaud/actions'

export type PlaudTaskItem = {
  id:string
  kind:'task'|'appointment'
  title:string
  detail:string|null
  due_at:string|null
  status:'open'|'completed'
}

export function PlaudTaskList({ initialItems }:{ initialItems:PlaudTaskItem[] }) {
  const router = useRouter()
  const [items,setItems] = useState(initialItems)
  const [pending,startTransition] = useTransition()
  const [message,setMessage] = useState('')
  const open = items.filter((item) => item.status === 'open')
  const completed = items.filter((item) => item.status === 'completed')

  function complete(id:string) {
    startTransition(async () => {
      try {
        await completePlaudItem(id)
        setItems((current) => current.map((item) => item.id === id ? { ...item,status:'completed' as const } : item))
        setMessage('Eintrag als erledigt gespeichert.')
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Der Eintrag konnte nicht aktualisiert werden.')
      }
    })
  }

  function remove(id:string) {
    startTransition(async () => {
      try {
        await deletePlaudItem(id)
        setItems((current) => current.filter((item) => item.id !== id))
        setMessage('Erledigter Eintrag wurde gelöscht.')
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Der Eintrag konnte nicht gelöscht werden.')
      }
    })
  }

  return <div className="space-y-6">
    {message && <div role="status" className="rounded-2xl bg-[#5CB800]/10 px-4 py-3 text-sm font-bold text-[#2F7D00]">{message}</div>}
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#5CB800]">Offen</p><h2 className="mt-1 text-2xl font-extrabold text-[#07142F]">Aufgaben und Termine</h2></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-extrabold">{open.length}</span></div><div className="mt-5 space-y-3">{open.length ? open.map((item) => <TaskRow key={item.id} item={item} pending={pending} onComplete={complete} />) : <p className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">Keine offenen Einträge.</p>}</div></section>
    {completed.length > 0 && <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7"><div className="flex items-center justify-between"><h2 className="text-xl font-extrabold text-[#07142F]">Erledigt</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-extrabold">{completed.length}</span></div><div className="mt-4 space-y-3">{completed.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><div className="min-w-0"><p className="truncate font-bold text-slate-500 line-through">{item.title}</p><p className="mt-1 text-xs text-slate-400">{item.kind === 'appointment' ? 'Termin' : 'Aufgabe'} · erledigt</p></div><button disabled={pending} onClick={() => remove(item.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white text-red-600" aria-label={`„${item.title}“ löschen`}><Trash2 className="h-5 w-5" /></button></div>)}</div></section>}
    <div className="grid grid-cols-2 gap-3"><Link href="/plaud" className="rounded-2xl border bg-white px-4 py-3 text-center font-extrabold text-[#1F2A44]">Zu PLAUD</Link><Link href="/calendar" className="rounded-2xl bg-[#1F2A44] px-4 py-3 text-center font-extrabold text-white">Kalender öffnen</Link></div>
  </div>
}

function TaskRow({ item,pending,onComplete }:{ item:PlaudTaskItem; pending:boolean; onComplete:(id:string)=>void }) {
  const Icon = item.kind === 'appointment' ? CalendarDays : CheckSquare
  const due = item.due_at ? new Date(item.due_at).toLocaleString('de-DE',{ day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' }) : null
  return <article className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1F2A44]/8"><Icon className="h-5 w-5 text-[#1F2A44]" /></span><div className="min-w-0 flex-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-[#5CB800]">{item.kind === 'appointment' ? 'Termin' : 'Aufgabe'}</span><h3 className="mt-1 font-extrabold text-[#07142F]">{item.title}</h3>{item.detail && <p className="mt-1 text-sm text-slate-500">{item.detail}</p>}{due && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-400"><Clock3 className="h-3.5 w-3.5" />{due}</p>}</div></div><button disabled={pending} onClick={() => onComplete(item.id)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5CB800] px-4 py-3 font-extrabold text-white"><Check className="h-4 w-4" />Als erledigt markieren</button></article>
}
