'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'

type ProjectOption = { id: string; name: string }
type Reminder = 'none' | '15m' | '1h' | '1d' | '3d' | '7d'
type CalendarEvent = {
  id: string
  title: string
  date: string
  time: string
  projectId: string
  reminder: Reminder
  notified?: boolean
}

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

function isoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const startOffset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return date
  })
}

export function EmaCalendar({ projects }: { projects: ProjectOption[] }) {
  const [month, setMonth] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('09:00')
  const [projectId, setProjectId] = useState('')
  const [reminder, setReminder] = useState<Reminder>('1d')
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setEvents(JSON.parse(stored))
    } catch {}
    setPermission('Notification' in window ? Notification.permission : 'unsupported')
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  }, [events])

  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now()
      let changed = false
      const next = events.map((event) => {
        if (event.notified || event.reminder === 'none') return event
        const minutes = REMINDERS.find((r) => r.value === event.reminder)?.minutes ?? 0
        const eventTime = new Date(`${event.date}T${event.time || '09:00'}:00`).getTime()
        const notifyAt = eventTime - minutes * 60_000
        if (now >= notifyAt && now < eventTime + 60 * 60_000) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('EMA Kalender', { body: `${event.title} – ${event.date} ${event.time}` })
          }
          changed = true
          return { ...event, notified: true }
        }
        return event
      })
      if (changed) setEvents(next)
    }
    checkReminders()
    const timer = window.setInterval(checkReminders, 60_000)
    return () => window.clearInterval(timer)
  }, [events])

  const days = useMemo(() => monthGrid(month), [month])
  const selectedEvents = events
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time))

  async function requestNotifications() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  function addEvent() {
    if (!title.trim() || !selectedDate) return
    setEvents((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        date: selectedDate,
        time,
        projectId,
        reminder,
        notified: false,
      },
    ])
    setTitle('')
    setTime('09:00')
    setProjectId('')
    setReminder('1d')
    setShowForm(false)
  }

  const monthLabel = month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  return (
    <div className="page-container space-y-5">
      <section className="rounded-[2rem] bg-gradient-to-br from-[#07142F] via-[#10245A] to-[#16472f] px-5 py-7 text-white shadow-lg md:px-8 md:py-9">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#87d33b]">EMA Intelligence</p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Kalender</h1>
            <p className="mt-2 text-sm text-slate-300">Monatsansicht mit frei benennbaren Terminen.</p>
          </div>
          <CalendarDays className="h-12 w-12 text-[#87d33b]" />
        </div>
      </section>

      {permission !== 'granted' && permission !== 'unsupported' && (
        <button onClick={requestNotifications} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#5CB800]/30 bg-[#5CB800]/10 px-4 py-3 text-sm font-extrabold text-[#2F8A00]">
          <Bell className="h-5 w-5" /> Benachrichtigungen aktivieren
        </button>
      )}

      <section className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="mobile-header-action" aria-label="Vorheriger Monat"><ChevronLeft className="h-5 w-5" /></button>
          <h2 className="text-xl font-extrabold capitalize text-[#07142F]">{monthLabel}</h2>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="mobile-header-action" aria-label="Nächster Monat"><ChevronRight className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-extrabold text-slate-400">
          {WEEKDAYS.map((day) => <div key={day} className="py-2">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const key = isoDate(date)
            const isCurrentMonth = date.getMonth() === month.getMonth()
            const dayEvents = events.filter((event) => event.date === key)
            const active = key === selectedDate
            const today = key === isoDate(new Date())
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                className={`relative min-h-16 rounded-xl border p-1.5 text-left transition ${active ? 'border-[#5CB800] bg-[#F1FAE9]' : 'border-transparent bg-slate-50'} ${!isCurrentMonth ? 'opacity-35' : ''}`}
              >
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${today ? 'bg-[#07142F] text-white' : 'text-[#07142F]'}`}>{date.getDate()}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {dayEvents.slice(0, 3).map((event) => <span key={event.id} className="h-1.5 w-1.5 rounded-full bg-[#5CB800]" />)}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">Ausgewählter Tag</p>
            <h3 className="mt-1 text-xl font-extrabold text-[#07142F]">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</h3>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#5CB800] text-white shadow-sm"><Plus className="h-6 w-6" /></button>
        </div>

        <div className="mt-4 space-y-3">
          {selectedEvents.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-400">Keine Termine an diesem Tag.</p>
          ) : selectedEvents.map((event) => {
            const project = projects.find((item) => item.id === event.projectId)
            return (
              <div key={event.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-[#07142F]">{event.time} · {event.title}</p>
                  {project && <p className="mt-1 truncate text-xs font-semibold text-slate-500">{project.name}</p>}
                </div>
                <button onClick={() => setEvents((current) => current.filter((item) => item.id !== event.id))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            )
          })}
        </div>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-[70] flex items-end bg-[#07142F]/35 p-3 backdrop-blur-sm md:items-center md:justify-center">
          <div className="w-full rounded-[2rem] bg-white p-5 shadow-2xl md:max-w-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-extrabold text-[#07142F]">Termin anlegen</h3>
              <button onClick={() => setShowForm(false)} className="mobile-header-action"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block"><span className="text-xs font-bold text-slate-500">Titel</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-[#07142F]" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-bold text-slate-500">Datum</span><input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-bold" /></label>
                <label className="block"><span className="text-xs font-bold text-slate-500">Uhrzeit</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-bold" /></label>
              </div>
              <label className="block"><span className="text-xs font-bold text-slate-500">Projekt optional</span><select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-bold"><option value="">Kein Projekt</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label className="block"><span className="text-xs font-bold text-slate-500">Erinnerung</span><select value={reminder} onChange={(e) => setReminder(e.target.value as Reminder)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-bold">{REMINDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <button onClick={addEvent} disabled={!title.trim()} className="w-full rounded-xl bg-[#5CB800] px-4 py-3 font-extrabold text-white disabled:opacity-40">Termin speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
