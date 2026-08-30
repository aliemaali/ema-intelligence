'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ExternalLink, Video } from 'lucide-react'

type PlaudAppointment = { id: string; title: string; due_at: string }
type ListEvent = { id: string; title: string; date: string; time: string; endTime?: string; source: 'local' | 'plaud' | 'outlook'; location?: string; webLink?: string; joinUrl?: string }
type StoredEvent = { id: string; title: string; date: string; time: string; endTime?: string; location?: string }
type OutlookEvent = { id: string; title: string; start: string; end: string; location?: string; webLink?: string; joinUrl?: string }

const STORAGE_KEY = 'ema-calendar-events-v1'

function isoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localDateAndTime(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  if (match) return { date: match[1], time: match[2] }
  const parsed = new Date(value)
  return { date: isoDate(parsed), time: parsed.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }
}

export function UpcomingMonthEvents({ plaudAppointments = [] }: { plaudAppointments?: PlaudAppointment[] }) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date())
  const [localEvents, setLocalEvents] = useState<ListEvent[]>([])
  const [outlookEvents, setOutlookEvents] = useState<ListEvent[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const readLocal = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as StoredEvent[]
        setLocalEvents(stored.map((event) => ({ ...event, source: 'local' as const })))
      } catch { setLocalEvents([]) }
    }
    readLocal()
    const timer = window.setInterval(() => { readLocal(); setNow(Date.now()) }, 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const syncVisibleMonth = () => {
      const headings = Array.from(document.querySelectorAll('h2'))
      const heading = headings.find((node) => /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}$/i.test(node.textContent?.trim() || ''))
      if (!heading?.textContent) return
      const parsed = new Date(`${heading.textContent.trim()} 1`)
      if (!Number.isNaN(parsed.getTime())) setVisibleMonth(parsed)
    }
    syncVisibleMonth()
    const observer = new MutationObserver(syncVisibleMonth)
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    async function loadOutlook() {
      try {
        const start = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
        const end = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
        const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() })
        const response = await fetch(`/api/microsoft/events?${params}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) { setOutlookEvents([]); return }
        const payload = await response.json()
        setOutlookEvents(((payload.events || []) as OutlookEvent[]).map((event) => {
          const eventStart = localDateAndTime(event.start)
          const eventEnd = localDateAndTime(event.end)
          return { id: `outlook-${event.id}`, title: event.title, date: eventStart.date, time: eventStart.time, endTime: eventEnd.time, source: 'outlook' as const, location: event.location, webLink: event.webLink, joinUrl: event.joinUrl }
        }))
      } catch { if (!controller.signal.aborted) setOutlookEvents([]) }
    }
    loadOutlook()
    return () => controller.abort()
  }, [visibleMonth])

  const plaudEvents = useMemo<ListEvent[]>(() => plaudAppointments.map((item) => {
    const date = new Date(item.due_at)
    return { id: `plaud-${item.id}`, title: item.title, date: isoDate(date), time: date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), source: 'plaud' }
  }), [plaudAppointments])

  const upcoming = useMemo(() => {
    const monthKey = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`
    return [...localEvents, ...plaudEvents, ...outlookEvents]
      .filter((event) => event.date.startsWith(monthKey))
      .filter((event) => {
        const end = new Date(`${event.date}T${event.endTime || event.time || '23:59'}:00`).getTime()
        return Number.isFinite(end) && end >= now
      })
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
  }, [localEvents, plaudEvents, outlookEvents, visibleMonth, now])

  const monthName = visibleMonth.toLocaleDateString('de-DE', { month: 'long' })

  return <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#5CB800]"><CalendarDays className="h-5 w-5" /></div><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">Monatsübersicht</p><h3 className="mt-0.5 text-xl font-extrabold capitalize text-[#07142F]">Anstehende Termine im {monthName}</h3></div></div>
    <div className="mt-4 space-y-3">{upcoming.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-400">Keine anstehenden Termine in diesem Monat.</p> : upcoming.map((event) => <div key={`${event.source}-${event.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"><div className="min-w-0"><p className="text-xs font-extrabold capitalize text-[#5CB800]">{new Date(`${event.date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}</p><p className="mt-1 font-extrabold text-[#07142F]">{event.time}{event.endTime ? `–${event.endTime}` : ''} · {event.title}</p>{event.location ? <p className="mt-1 truncate text-xs font-semibold text-slate-500">{event.location}</p> : null}<p className={`mt-1 text-xs font-extrabold ${event.source === 'outlook' ? 'text-[#1473E6]' : event.source === 'plaud' ? 'text-violet-600' : 'text-[#5CB800]'}`}>{event.source === 'outlook' ? 'Outlook' : event.source === 'plaud' ? 'PLAUD' : 'EMA'}</p></div>{event.source === 'outlook' && (event.joinUrl || event.webLink) ? <a href={event.joinUrl || event.webLink} target="_blank" rel="noreferrer" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1473E6]" aria-label={event.joinUrl ? 'Teams-Besprechung öffnen' : 'Termin in Outlook öffnen'}>{event.joinUrl ? <Video className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}</a> : null}</div>)}</div>
  </section>
}
