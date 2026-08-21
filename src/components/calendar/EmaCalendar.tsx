'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CloudOff,
  ExternalLink, Loader2, Plus, RefreshCw, Trash2, Video, X,
} from 'lucide-react'
import { toast } from 'sonner'

type ProjectOption = { id: string; name: string }
type Reminder = 'none' | '15m' | '1h' | '1d' | '3d' | '7d'
type EventSource = 'local' | 'plaud' | 'outlook'
type CalendarEvent = {
  id: string; title: string; date: string; time: string; endTime?: string; projectId: string
  reminder: Reminder; notified?: boolean; source: EventSource; location?: string; webLink?: string; joinUrl?: string
}
type PlaudAppointment = { id: string; title: string; due_at: string }
type OutlookEvent = { id: string; title: string; start: string; end: string; location?: string; webLink?: string; joinUrl?: string }
type MicrosoftConnection = { connected: boolean; name?: string; email?: string; error?: string }

const STORAGE_KEY = 'ema-calendar-events-v1'
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const REMINDERS: { value: Reminder; label: string; minutes: number }[] = [
  { value: 'none', label: 'Keine Erinnerung', minutes: 0 },
  { value: '15m', label: '15 Minuten vorher', minutes: 15 },
  { value: '1h', label: '1 Stunde vorher', minutes: 60 },
  { value: '1d', label: '1 Tag vorher', minutes: 1440 },
  { value: '3d', label: '3 Tage vorher', minutes: 4320 },
  { value: '7d', label: '1 Woche vorher', minutes: 10080 },
]
const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-[#07142F] shadow-sm outline-none [color-scheme:light] focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15'

function isoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const startOffset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - startOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function localDateAndTime(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  if (match) return { date: match[1], time: match[2] }
  const parsed = new Date(value)
  return { date: isoDate(parsed), time: parsed.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }
}

function messageFromResponse(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error
  return fallback
}

export function EmaCalendar({ projects, plaudAppointments = [] }: { projects: ProjectOption[]; plaudAppointments?: PlaudAppointment[] }) {
  const [month, setMonth] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [outlookEvents, setOutlookEvents] = useState<CalendarEvent[]>([])
  const [connection, setConnection] = useState<MicrosoftConnection | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [projectId, setProjectId] = useState('')
  const [attendees, setAttendees] = useState('')
  const [isOnlineMeeting, setIsOnlineMeeting] = useState(false)
  const [reminder, setReminder] = useState<Reminder>('1d')
  const [saving, setSaving] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setEvents((JSON.parse(stored) as CalendarEvent[]).map((event) => ({ ...event, source: 'local' })))
    } catch {}
    setPermission('Notification' in window ? Notification.permission : 'unsupported')
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  }, [events, hydrated])

  useEffect(() => {
    const controller = new AbortController()
    async function loadConnection() {
      try {
        const response = await fetch('/api/microsoft/status', { cache: 'no-store', signal: controller.signal })
        const payload = await response.json() as MicrosoftConnection
        if (!response.ok) throw new Error(messageFromResponse(payload, 'Outlook-Verbindung konnte nicht geprüft werden.'))
        setConnection(payload)
      } catch (error) {
        if (controller.signal.aborted) return
        setConnection({ connected: false, error: error instanceof Error ? error.message : 'Outlook-Verbindung konnte nicht geprüft werden.' })
      }
    }
    loadConnection()
    return () => controller.abort()
  }, [])

  const loadOutlookEvents = useCallback(async (visibleMonth: Date, signal?: AbortSignal, showSuccess = false) => {
    setSyncing(true)
    setSyncError('')
    try {
      const days = monthGrid(visibleMonth)
      const rangeEnd = new Date(days[days.length - 1])
      rangeEnd.setDate(rangeEnd.getDate() + 1)
      const params = new URLSearchParams({ start: days[0].toISOString(), end: rangeEnd.toISOString() })
      const response = await fetch(`/api/microsoft/events?${params}`, { cache: 'no-store', signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(messageFromResponse(payload, 'Outlook-Termine konnten nicht geladen werden.'))
      const mapped = ((payload.events || []) as OutlookEvent[]).map<CalendarEvent>((event) => {
        const start = localDateAndTime(event.start)
        const end = localDateAndTime(event.end)
        return {
          id: `outlook-${event.id}`, title: event.title, date: start.date, time: start.time, endTime: end.time,
          projectId: '', reminder: 'none', notified: true, source: 'outlook', location: event.location,
          webLink: event.webLink, joinUrl: event.joinUrl,
        }
      })
      setOutlookEvents(mapped)
      if (showSuccess) toast.success('Outlook-Kalender wurde aktualisiert.')
    } catch (error) {
      if (signal?.aborted) return
      const message = error instanceof Error ? error.message : 'Outlook-Termine konnten nicht geladen werden.'
      setSyncError(message)
      if (showSuccess) toast.error(message)
    } finally {
      if (!signal?.aborted) setSyncing(false)
    }
  }, [])

  useEffect(() => {
    if (!connection?.connected) return
    const controller = new AbortController()
    loadOutlookEvents(month, controller.signal)
    return () => controller.abort()
  }, [connection?.connected, loadOutlookEvents, month])

  useEffect(() => {
    const check = () => {
      const now = Date.now()
      let changed = false
      const next = events.map((event) => {
        if (event.notified || event.reminder === 'none') return event
        const minutes = REMINDERS.find((item) => item.value === event.reminder)?.minutes ?? 0
        const eventTime = new Date(`${event.date}T${event.time || '09:00'}:00`).getTime()
        const notifyAt = eventTime - minutes * 60000
        if (now >= notifyAt && now < eventTime + 3600000) {
          if ('Notification' in window && Notification.permission === 'granted') new Notification('EMA Kalender', { body: `${event.title} – ${event.date} ${event.time}` })
          changed = true
          return { ...event, notified: true }
        }
        return event
      })
      if (changed) setEvents(next)
    }
    check()
    const timer = window.setInterval(check, 60000)
    return () => window.clearInterval(timer)
  }, [events])

  const importedEvents = useMemo<CalendarEvent[]>(() => plaudAppointments.map((item) => {
    const date = new Date(item.due_at)
    return {
      id: `plaud-${item.id}`, title: item.title, date: isoDate(date),
      time: date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      projectId: '', reminder: 'none', notified: true, source: 'plaud',
    }
  }), [plaudAppointments])
  const allEvents = useMemo(() => [...events, ...importedEvents, ...outlookEvents], [events, importedEvents, outlookEvents])
  const days = useMemo(() => monthGrid(month), [month])
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()
    for (const event of allEvents) grouped.set(event.date, [...(grouped.get(event.date) || []), event])
    return grouped
  }, [allEvents])
  const selectedEvents = useMemo(() => [...(eventsByDate.get(selectedDate) || [])].sort((a, b) => a.time.localeCompare(b.time)), [eventsByDate, selectedDate])

  async function requestNotifications() {
    if (!('Notification' in window)) return
    setPermission(await Notification.requestPermission())
  }

  function resetForm() {
    setTitle(''); setTime('09:00'); setEndTime('10:00'); setProjectId(''); setAttendees('')
    setIsOnlineMeeting(false); setReminder('1d'); setShowForm(false)
  }

  async function addEvent() {
    if (!title.trim() || !selectedDate || saving) return
    const start = `${selectedDate}T${time}:00`
    const end = `${selectedDate}T${endTime}:00`
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      toast.error('Das Terminende muss nach dem Beginn liegen.')
      return
    }
    setSaving(true)
    try {
      if (connection?.connected) {
        const response = await fetch('/api/microsoft/events', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(), project: projects.find((project) => project.id === projectId)?.name || '', start, end,
            attendees: attendees.split(/[;,\n]/).map((email) => email.trim()).filter(Boolean), isOnlineMeeting,
            reminderMinutes: REMINDERS.find((item) => item.value === reminder)?.minutes ?? 0,
          }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(messageFromResponse(payload, 'Termin konnte nicht in Outlook gespeichert werden.'))
        toast.success(attendees.trim() ? 'Outlook-Termin erstellt und Einladung versendet.' : 'Termin in Outlook gespeichert.')
        resetForm()
        await loadOutlookEvents(month)
        return
      }
      const event: CalendarEvent = {
        id: crypto.randomUUID(), title: title.trim(), date: selectedDate, time, endTime,
        projectId, reminder, notified: false, source: 'local',
      }
      setEvents((current) => [...current, event])
      if (reminder !== 'none') {
        const minutes = REMINDERS.find((item) => item.value === reminder)?.minutes ?? 0
        const reminderTime = new Date(new Date(start).getTime() - minutes * 60000)
        await fetch('/api/ema/assistant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'create_reminder',
            args: { title: `${title.trim()}${projectId ? ` · ${projects.find((project) => project.id === projectId)?.name ?? ''}` : ''}`, due_at: reminderTime.toISOString() },
          }),
        }).catch(() => undefined)
      }
      toast.success('Termin lokal in EMA gespeichert.')
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Termin konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  const monthLabel = month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  return <div className="page-container space-y-5 pt-4 md:pt-8">
    <Link href="/dashboard" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-[#07142F] shadow-sm"><ArrowLeft className="h-5 w-5" /> Dashboard</Link>
    <section className="rounded-[2rem] bg-gradient-to-br from-[#07142F] via-[#10245A] to-[#16472f] px-5 py-5 text-white shadow-lg md:px-8 md:py-7"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#87d33b]">EMA Intelligence</p><h1 className="mt-1 text-4xl font-extrabold tracking-tight">Kalender</h1><p className="mt-2 text-sm text-slate-300">Outlook-Termine, Einladungen und EMA-Erinnerungen an einem Ort.</p></div><CalendarDays className="h-11 w-11 text-[#87d33b]" /></div></section>

    {connection === null ? <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-[#5CB800]" /> Outlook-Verbindung wird geprüft …</div> : connection.connected ? <div className="flex flex-col gap-3 rounded-2xl border border-[#5CB800]/25 bg-[#F1FAE9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><CheckCircle2 className="h-6 w-6 shrink-0 text-[#2F8A00]" /><div className="min-w-0"><p className="font-extrabold text-[#07142F]">Outlook synchronisiert</p><p className="truncate text-xs font-semibold text-slate-500">{connection.email || connection.name || 'Microsoft 365'}{syncError ? ` · ${syncError}` : ''}</p></div></div><button onClick={() => loadOutlookEvents(month, undefined, true)} disabled={syncing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-[#07142F] shadow-sm disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Jetzt synchronisieren</button></div> : <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><CloudOff className="h-6 w-6 shrink-0 text-amber-600" /><div><p className="font-extrabold text-[#07142F]">Outlook ist nicht verbunden</p><p className="text-xs font-semibold text-slate-500">{connection.error || 'Verbinde Microsoft 365, damit Termine automatisch erscheinen.'}</p></div></div><Link href="/api/microsoft/connect" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#07142F] px-4 text-sm font-extrabold text-white">Outlook verbinden</Link></div>}

    {permission !== 'granted' && permission !== 'unsupported' ? <button onClick={requestNotifications} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#5CB800]/30 bg-[#5CB800]/10 px-4 py-3 text-sm font-extrabold text-[#2F8A00]"><Bell className="h-5 w-5" /> Benachrichtigungen aktivieren</button> : null}

    <section className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6"><div className="mb-4 flex items-center justify-between"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="mobile-header-action" aria-label="Vorheriger Monat"><ChevronLeft className="h-5 w-5" /></button><h2 className="text-xl font-extrabold capitalize text-[#07142F]">{monthLabel}</h2><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="mobile-header-action" aria-label="Nächster Monat"><ChevronRight className="h-5 w-5" /></button></div><div className="grid grid-cols-7 gap-1 text-center text-xs font-extrabold text-slate-400">{WEEKDAYS.map((day) => <div key={day} className="py-2">{day}</div>)}</div><div className="grid grid-cols-7 gap-1">{days.map((date) => { const key = isoDate(date); const current = date.getMonth() === month.getMonth(); const active = key === selectedDate; const today = key === isoDate(new Date()); const dayEvents = eventsByDate.get(key) || []; return <button key={key} onClick={() => setSelectedDate(key)} className={`relative min-h-16 rounded-xl border p-1.5 text-left transition ${active ? 'border-[#5CB800] bg-[#F1FAE9]' : 'border-transparent bg-slate-50'} ${!current ? 'opacity-35' : ''}`}><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${today ? 'bg-[#07142F] text-white' : 'text-[#07142F]'}`}>{date.getDate()}</span><div className="mt-1 flex flex-wrap gap-1">{dayEvents.slice(0, 3).map((event) => <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${event.source === 'plaud' ? 'bg-violet-500' : event.source === 'outlook' ? 'bg-[#1473E6]' : 'bg-[#5CB800]'}`} />)}</div></button> })}</div></section>

    <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">Ausgewählter Tag</p><h3 className="mt-1 text-xl font-extrabold text-[#07142F]">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</h3></div><button onClick={() => setShowForm(true)} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#5CB800] text-white shadow-sm" aria-label="Termin anlegen"><Plus className="h-6 w-6" /></button></div><div className="mt-4 space-y-3">{selectedEvents.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-400">Keine Termine an diesem Tag.</p> : selectedEvents.map((event) => { const project = projects.find((item) => item.id === event.projectId); return <div key={event.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"><div className="min-w-0"><p className="font-extrabold text-[#07142F]">{event.time}{event.endTime ? `–${event.endTime}` : ''} · {event.title}</p>{project ? <p className="mt-1 truncate text-xs font-semibold text-slate-500">{project.name}</p> : null}{event.location ? <p className="mt-1 truncate text-xs font-semibold text-slate-500">{event.location}</p> : null}{event.source === 'plaud' ? <p className="mt-1 text-xs font-extrabold text-violet-600">Aus PLAUD übernommen</p> : null}{event.source === 'outlook' ? <p className="mt-1 text-xs font-extrabold text-[#1473E6]">Outlook{event.joinUrl ? ' · Teams-Besprechung' : ''}</p> : null}{event.source === 'local' && connection?.connected ? <p className="mt-1 text-xs font-extrabold text-amber-600">Nur lokal in EMA</p> : null}</div>{event.source === 'local' ? <button onClick={() => setEvents((current) => current.filter((item) => item.id !== event.id))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500" aria-label="Termin löschen"><Trash2 className="h-4 w-4" /></button> : event.source === 'outlook' && (event.joinUrl || event.webLink) ? <a href={event.joinUrl || event.webLink} target="_blank" rel="noreferrer" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1473E6]" aria-label={event.joinUrl ? 'Teams-Besprechung öffnen' : 'Termin in Outlook öffnen'}>{event.joinUrl ? <Video className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}</a> : <Link href="/tasks" className="rounded-xl border px-3 py-2 text-xs font-extrabold text-[#1F2A44]">Verwalten</Link>}</div> })}</div></section>

    {showForm ? <div className="fixed inset-0 z-[70] flex items-end bg-slate-900/25 p-3 backdrop-blur-sm md:items-center md:justify-center"><form onSubmit={(event) => { event.preventDefault(); addEvent() }} className="max-h-[92vh] w-full overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl md:max-w-lg"><div className="flex items-center justify-between"><div><h3 className="text-2xl font-extrabold text-[#07142F]">Termin anlegen</h3><p className="mt-1 text-xs font-semibold text-slate-500">{connection?.connected ? 'Wird direkt in deinem Outlook-Kalender gespeichert.' : 'Wird nur lokal in EMA gespeichert.'}</p></div><button type="button" onClick={() => setShowForm(false)} className="mobile-header-action" aria-label="Schließen"><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-4"><label className="block"><span className="text-xs font-bold text-slate-500">Titel</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} required /></label><div className="grid grid-cols-2 gap-3"><label className="block"><span className="text-xs font-bold text-slate-500">Datum</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className={inputClass} required /></label><label className="block"><span className="text-xs font-bold text-slate-500">Beginn</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={inputClass} required /></label></div><div className="grid grid-cols-2 gap-3"><label className="block"><span className="text-xs font-bold text-slate-500">Ende</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={inputClass} required /></label><label className="block"><span className="text-xs font-bold text-slate-500">Erinnerung</span><select value={reminder} onChange={(event) => setReminder(event.target.value as Reminder)} className={inputClass}>{REMINDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><label className="block"><span className="text-xs font-bold text-slate-500">Projekt optional</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={inputClass}><option value="">Kein Projekt</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>{connection?.connected ? <><label className="block"><span className="text-xs font-bold text-slate-500">Teilnehmer optional</span><input value={attendees} onChange={(event) => setAttendees(event.target.value)} className={inputClass} placeholder="E-Mail-Adressen mit Komma trennen" /><span className="mt-1 block text-xs text-slate-400">Outlook verschickt die Einladungen automatisch.</span></label><label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#6264A7]/20 bg-[#6264A7]/5 p-4"><span className="flex items-center gap-3"><Video className="h-6 w-6 text-[#6264A7]" /><span className="text-sm font-extrabold text-[#07142F]">Teams-Besprechung erstellen</span></span><input type="checkbox" checked={isOnlineMeeting} onChange={(event) => setIsOnlineMeeting(event.target.checked)} className="h-5 w-5 accent-[#6264A7]" /></label></> : null}<div className="grid grid-cols-2 gap-3 pt-1"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-extrabold text-[#07142F]">Abbrechen</button><button type="submit" disabled={!title.trim() || saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5CB800] px-4 py-3 font-extrabold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{connection?.connected ? 'In Outlook speichern' : 'Termin speichern'}</button></div></div></form></div> : null}
  </div>
}
