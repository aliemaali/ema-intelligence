'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Bell, Brain, Check, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Memory = { id: string; title: string; content: string; created_at: string; updated_at: string }
type Reminder = { id: string; title: string; notes: string | null; due_at: string; completed_at: string | null; push_sent_at: string | null }

const sensitive = /(passwort|password|pin\b|token\b|api[-_ ]?key|iban\b|kreditkarten?|credit card|bankdaten)/i

export function AssistantWorkspace({ initialMemories, initialReminders }: { initialMemories: Memory[]; initialReminders: Reminder[] }) {
  const supabase = createClient()
  const [memories, setMemories] = useState(initialMemories)
  const [reminders, setReminders] = useState(initialReminders)
  const [memory, setMemory] = useState('')
  const [reminder, setReminder] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [message, setMessage] = useState('')

  const today = useMemo(() => {
    const end = new Date(); end.setHours(23, 59, 59, 999)
    return reminders.filter(r => !r.completed_at && new Date(r.due_at) <= end)
  }, [reminders])

  async function addMemory(event: FormEvent) {
    event.preventDefault(); setMessage('')
    const content = memory.trim(); if (!content) return
    if (sensitive.test(content)) { setMessage('EMA speichert keine Passwörter, PINs, Tokens oder Bankdaten.'); return }
    const { data, error } = await supabase.from('ema_memories').insert({ content }).select().single()
    if (error) { setMessage(error.message); return }
    setMemories(current => [data as Memory, ...current]); setMemory('')
  }

  async function addReminder(event: FormEvent) {
    event.preventDefault(); setMessage('')
    if (!reminder.trim() || !dueAt) return
    const { data, error } = await supabase.from('ema_reminders').insert({ title: reminder.trim(), due_at: new Date(dueAt).toISOString() }).select().single()
    if (error) { setMessage(error.message); return }
    setReminders(current => [...current, data as Reminder].sort((a,b) => +new Date(a.due_at) - +new Date(b.due_at))); setReminder(''); setDueAt('')
  }

  async function remove(table: 'ema_memories'|'ema_reminders', id: string) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { setMessage(error.message); return }
    if (table === 'ema_memories') setMemories(v => v.filter(x => x.id !== id)); else setReminders(v => v.filter(x => x.id !== id))
  }

  async function complete(id: string) {
    const completed_at = new Date().toISOString()
    const { error } = await supabase.from('ema_reminders').update({ completed_at }).eq('id', id)
    if (!error) setReminders(v => v.map(x => x.id === id ? { ...x, completed_at } : x))
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-4 pb-28 md:p-8">
    <div><p className="text-sm font-semibold text-emerald-600">EMA</p><h1 className="text-3xl font-bold text-slate-900">Meine Assistenz</h1><p className="mt-2 text-slate-600">Dein privates Gedächtnis, Aufgaben und Wiedervorlagen.</p></div>
    {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}
    <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Bell className="h-5 w-5"/><h2 className="text-xl font-semibold">Heute & überfällig</h2></div>{today.length ? <div className="space-y-2">{today.map(r => <ReminderRow key={r.id} reminder={r} onComplete={complete} onDelete={id => remove('ema_reminders', id)}/>)}</div> : <p className="text-slate-500">Für heute ist nichts offen.</p>}</section>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Brain className="h-5 w-5"/><h2 className="text-xl font-semibold">Gedächtnis</h2></div><form onSubmit={addMemory} className="flex gap-2"><input value={memory} onChange={e=>setMemory(e.target.value)} placeholder="EMA, merke dir …" className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button className="rounded-xl bg-slate-900 px-3 text-white" aria-label="Merken"><Plus/></button></form><div className="mt-4 space-y-2">{memories.map(m => <div key={m.id} className="flex gap-3 rounded-2xl bg-slate-50 p-3"><p className="flex-1 text-sm">{m.content}</p><button onClick={()=>remove('ema_memories',m.id)} aria-label="Löschen"><Trash2 className="h-4 w-4"/></button></div>)}</div></section>
      <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Bell className="h-5 w-5"/><h2 className="text-xl font-semibold">Erinnerungen</h2></div><form onSubmit={addReminder} className="space-y-2"><input value={reminder} onChange={e=>setReminder(e.target.value)} placeholder="Woran soll EMA dich erinnern?" className="w-full rounded-xl border px-3 py-2"/><input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} className="w-full rounded-xl border px-3 py-2"/><button className="w-full rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white">Erinnerung hinzufügen</button></form><div className="mt-4 space-y-2">{reminders.filter(r=>!r.completed_at).map(r => <ReminderRow key={r.id} reminder={r} onComplete={complete} onDelete={id => remove('ema_reminders', id)}/>)}</div></section>
    </div>
  </main>
}

function ReminderRow({ reminder, onComplete, onDelete }: { reminder: Reminder; onComplete:(id:string)=>void; onDelete:(id:string)=>void }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><button onClick={()=>onComplete(reminder.id)} className="rounded-full border p-1" aria-label="Erledigt"><Check className="h-4 w-4"/></button><div className="min-w-0 flex-1"><p className="font-medium">{reminder.title}</p><p className="text-xs text-slate-500">{new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(reminder.due_at))}</p></div><button onClick={()=>onDelete(reminder.id)} aria-label="Löschen"><Trash2 className="h-4 w-4"/></button></div>
}
