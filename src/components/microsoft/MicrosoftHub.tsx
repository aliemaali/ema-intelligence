'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { MicrosoftTeamsIcon } from './MicrosoftTeamsIcon'

type Contact = {
  id: string
  name: string
  company: string
  role: string
  email: string
  phone: string
  initials: string
}

type CalendarEvent = {
  id: string
  title: string
  start: string
  end: string
  location: string
  attendees: { name: string; email: string; status: string }[]
  isOnlineMeeting: boolean
  joinUrl: string
  webLink: string
  bodyPreview: string
}

type Connection = {
  connected: boolean
  name?: string
  email?: string
  error?: string
}

type ProjectOption = { id: string; name: string }

type EventForm = {
  title: string
  project: string
  start: string
  end: string
  attendees: string
  location: string
  notes: string
  isOnlineMeeting: boolean
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function freshForm(): EventForm {
  const start = new Date()
  start.setMinutes(start.getMinutes() + (60 - start.getMinutes()), 0, 0)
  const end = new Date(start.getTime() + 45 * 60 * 1000)
  return {
    title: '',
    project: '',
    start: toLocalInput(start),
    end: toLocalInput(end),
    attendees: '',
    location: '',
    notes: '',
    isOnlineMeeting: true,
  }
}

function eventDate(value: string) {
  const date = new Date(value)
  return {
    day: new Intl.DateTimeFormat('de-DE', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(date).replace('.', '').toUpperCase(),
    time: new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date),
  }
}

function eventTimeRange(start: string, end: string) {
  const startTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(start))
  const endTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(end))
  return `${startTime} – ${endTime}`
}

function messageFromResponse(payload: any, fallback: string) {
  return typeof payload?.error === 'string' ? payload.error : fallback
}

export function MicrosoftHub({ projects }: { projects: ProjectOption[] }) {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<EventForm>(freshForm)
  const [saving, setSaving] = useState(false)

  async function loadMicrosoftData(showSuccess = false) {
    setRefreshing(true)
    try {
      const statusResponse = await fetch('/api/microsoft/status', { cache: 'no-store' })
      const status = await statusResponse.json() as Connection
      setConnection(status)

      if (!status.connected) {
        setContacts([])
        setEvents([])
        return
      }

      const [contactsResponse, eventsResponse] = await Promise.all([
        fetch('/api/microsoft/contacts', { cache: 'no-store' }),
        fetch('/api/microsoft/events', { cache: 'no-store' }),
      ])
      const contactsPayload = await contactsResponse.json()
      const eventsPayload = await eventsResponse.json()

      if (!contactsResponse.ok) throw new Error(messageFromResponse(contactsPayload, 'Kontakte konnten nicht geladen werden.'))
      if (!eventsResponse.ok) throw new Error(messageFromResponse(eventsPayload, 'Termine konnten nicht geladen werden.'))

      setContacts(contactsPayload.contacts || [])
      setEvents(eventsPayload.events || [])
      if (showSuccess) toast.success('Outlook wurde aktualisiert.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Microsoft-Daten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadMicrosoftData()
  }, [])

  const visibleContacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de-DE')
    if (!normalized) return contacts
    return contacts.filter((contact) => [contact.name, contact.company, contact.role, contact.email, contact.phone]
      .some((value) => value.toLocaleLowerCase('de-DE').includes(normalized)))
  }, [contacts, query])

  const upcomingEvents = useMemo(() => events.filter((event) => new Date(event.end).getTime() >= Date.now()), [events])
  const teamsCount = upcomingEvents.filter((event) => event.isOnlineMeeting && event.joinUrl).length

  function openEventForm(contact?: Contact) {
    const next = freshForm()
    if (contact?.email) {
      next.attendees = contact.email
      next.title = `Termin mit ${contact.name}`
    }
    setForm(next)
    setShowForm(true)
  }

  function updateForm<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function createEvent(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const attendees = form.attendees.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean)
      const response = await fetch('/api/microsoft/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, attendees }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(messageFromResponse(payload, 'Termin konnte nicht erstellt werden.'))

      toast.success(attendees.length > 0 ? 'Termin erstellt und Einladung versendet.' : 'Termin erstellt.')
      setShowForm(false)
      setForm(freshForm())
      await loadMicrosoftData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Termin konnte nicht erstellt werden.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="text-center text-[#1F2A44]"><Loader2 className="mx-auto h-9 w-9 animate-spin text-[#5CB800]" /><p className="mt-4 font-bold">Microsoft 365 wird geladen …</p></div>
      </div>
    )
  }

  if (!connection?.connected) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-14">
        <Link href="/dashboard" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm" aria-label="Zurück zum Dashboard"><ArrowLeft className="h-5 w-5" /></Link>
        <section className="mt-6 overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br from-white via-white to-[#EEF1FF] p-7 text-center shadow-[0_24px_70px_rgba(15,23,42,0.10)] md:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-[#6264A7]/10"><MicrosoftTeamsIcon className="h-12 w-12" /></div>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">Microsoft 365</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] text-[#07142F] md:text-5xl">Outlook mit EMA verbinden</h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">Verbinde einmal dein Microsoft-Konto. Danach stehen deine Outlook-Kontakte, Kalendertermine, Einladungen und Teams-Besprechungen direkt in EMA zur Verfügung.</p>
          {connection?.error && <p className="mx-auto mt-5 max-w-xl rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{connection.error}</p>}
          <a href="/api/microsoft/connect" className="mt-7 inline-flex items-center justify-center gap-3 rounded-2xl bg-[#6264A7] px-6 py-4 font-extrabold text-white shadow-[0_16px_35px_rgba(98,100,167,0.28)]"><MicrosoftTeamsIcon className="h-6 w-6" /> Microsoft 365 verbinden</a>
          <p className="mt-5 text-xs leading-5 text-slate-400">EMA liest Kontakte und Kalender nur nach deiner Anmeldung. Kontakte werden in Outlook nicht gelöscht oder verändert.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 pb-28 md:px-6 md:py-9">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm" aria-label="Zurück zum Dashboard"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex items-center gap-2">
          <button onClick={() => loadMicrosoftData(true)} disabled={refreshing} className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-600 shadow-sm disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Sync</button>
          <a href="/api/microsoft/disconnect" className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-500 shadow-sm">Trennen</a>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br from-white via-white to-[#EEF1FF] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.09)] md:p-9">
        <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-[#3D8F00]"><Sparkles className="h-4 w-4" /> Microsoft 365 Hub</div>
            <h1 className="max-w-3xl text-4xl font-black tracking-[-0.05em] text-[#07142F] md:text-6xl">Kontakte und Termine an einem Ort.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">Verbunden als <span className="font-extrabold text-[#1F2A44]">{connection.name}</span>{connection.email ? ` · ${connection.email}` : ''}</p>
          </div>
          <button onClick={() => openEventForm()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3.5 font-extrabold text-white shadow-[0_14px_30px_rgba(92,184,0,0.28)]"><Plus className="h-5 w-5" /> Neuen Termin planen</button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-2 md:gap-4">
          <div className="rounded-[1.3rem] border border-slate-100 bg-white p-3 shadow-sm md:p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#3D8F00]"><Users className="h-5 w-5" /></div><p className="mt-4 text-2xl font-black md:text-3xl">{contacts.length}</p><p className="mt-1 text-[11px] font-semibold text-slate-500 md:text-sm">Outlook-Kontakte</p></div>
          <div className="rounded-[1.3rem] border border-slate-100 bg-white p-3 shadow-sm md:p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><CalendarDays className="h-5 w-5" /></div><p className="mt-4 text-2xl font-black md:text-3xl">{upcomingEvents.length}</p><p className="mt-1 text-[11px] font-semibold text-slate-500 md:text-sm">Kommende Termine</p></div>
          <div className="rounded-[1.3rem] border border-slate-100 bg-white p-3 shadow-sm md:p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6264A7]/10"><MicrosoftTeamsIcon /></div><p className="mt-4 text-2xl font-black md:text-3xl">{teamsCount}</p><p className="mt-1 text-[11px] font-semibold text-slate-500 md:text-sm">Teams-Meetings</p></div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] md:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-2xl font-black tracking-tight text-[#07142F]">Outlook-Kontakte</h2><p className="mt-1 text-sm text-slate-500">Live synchronisiert und direkt für Einladungen nutzbar.</p></div>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Kontakte suchen" placeholder="Kontakt suchen" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-[#5CB800] focus:bg-white sm:w-64" /></div>
          </div>

          <div className="mt-5 max-h-[720px] space-y-3 overflow-y-auto pr-1">
            {visibleContacts.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">Keine passenden Outlook-Kontakte gefunden.</div>}
            {visibleContacts.map((contact) => (
              <article key={contact.id} className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#07142F] text-sm font-black text-white">{contact.initials}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-[#07142F]">{contact.name}</h3>
                    {contact.role && <p className="mt-0.5 text-sm text-slate-500">{contact.role}</p>}
                    {contact.company && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><Building2 className="h-4 w-4 text-slate-400" /> {contact.company}</p>}
                    <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                      {contact.email && <a href={`mailto:${contact.email}`} className="flex min-w-0 items-center gap-2 hover:text-[#2F8A00]"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{contact.email}</span></a>}
                      {contact.phone && <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-[#2F8A00]"><Phone className="h-4 w-4" />{contact.phone}</a>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {contact.email && <a href={`mailto:${contact.email}`} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700">E-Mail</a>}
                      {contact.phone && <a href={`tel:${contact.phone}`} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700">Anrufen</a>}
                      <button onClick={() => openEventForm(contact)} className="rounded-xl bg-[#07142F] px-3 py-2 text-xs font-extrabold text-white">Termin planen</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] md:p-7">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-2xl font-black tracking-tight text-[#07142F]">Nächste Termine</h2><p className="mt-1 text-sm text-slate-500">Outlook-Kalender mit direktem Teams-Beitritt.</p></div><CalendarDays className="h-7 w-7 text-[#5CB800]" /></div>
          <div className="mt-5 space-y-4">
            {upcomingEvents.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">Keine kommenden Termine vorhanden.</div>}
            {upcomingEvents.map((appointment) => {
              const date = eventDate(appointment.start)
              return (
                <article key={appointment.id} className="rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#07142F] text-white"><span className="text-xl font-black leading-none">{date.day}</span><span className="mt-1 text-[10px] font-extrabold tracking-[0.12em] text-white/70">{date.month}</span></div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-xs font-extrabold text-[#3D8F00]"><Clock3 className="h-4 w-4" />{eventTimeRange(appointment.start, appointment.end)}</p>
                      <h3 className="mt-2 font-extrabold leading-snug text-[#07142F]">{appointment.title}</h3>
                      {appointment.location && <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><MapPin className="h-4 w-4" />{appointment.location}</p>}
                      {appointment.attendees.length > 0 && <p className="mt-2 text-xs text-slate-500">{appointment.attendees.slice(0, 3).map((item) => item.name || item.email).join(' · ')}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {appointment.joinUrl && <a href={appointment.joinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#6264A7] px-3 py-2 text-xs font-extrabold text-white"><MicrosoftTeamsIcon className="h-4 w-4" /> Teams beitreten</a>}
                        {appointment.webLink && <a href={appointment.webLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700">Outlook <ExternalLink className="h-3.5 w-3.5" /></a>}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-5 rounded-[1.5rem] bg-[#07142F] p-5 text-white">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#8CD93C]">Schnellaktion</p>
            <h3 className="mt-2 text-xl font-black">Einladung in unter einer Minute</h3>
            <p className="mt-2 text-sm leading-6 text-white/70">Kontakt auswählen, Projekt zuordnen, Teams-Link aktivieren und Einladung versenden.</p>
            <button onClick={() => openEventForm()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-[#07142F]"><Video className="h-4 w-4" /> Termin erstellen</button>
          </div>
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#07142F]/45 p-0 backdrop-blur-sm md:items-center md:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false) }}>
          <form onSubmit={createEvent} className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl md:rounded-[2rem] md:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">Outlook & Teams</p><h2 className="mt-2 text-2xl font-black text-[#07142F]">Neuen Termin planen</h2><p className="mt-1 text-sm text-slate-500">Zeitzone: Europa/Berlin</p></div><button type="button" onClick={() => setShowForm(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100" aria-label="Schließen"><X className="h-5 w-5" /></button></div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">Titel<input required value={form.title} onChange={(event) => updateForm('title', event.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-[#5CB800]" placeholder="z. B. PVA Delitzsch – Investorenabstimmung" /></label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">EMA-Projekt<select value={form.project} onChange={(event) => updateForm('project', event.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-[#5CB800]"><option value="">Kein Projekt zuordnen</option>{projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">Beginn<input required type="datetime-local" value={form.start} onChange={(event) => updateForm('start', event.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-[#5CB800]" /></label>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">Ende<input required type="datetime-local" value={form.end} onChange={(event) => updateForm('end', event.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-[#5CB800]" /></label>
              </div>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">Teilnehmer<input value={form.attendees} onChange={(event) => updateForm('attendees', event.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-[#5CB800]" placeholder="E-Mail-Adressen mit Komma trennen" /><span className="text-xs font-normal text-slate-400">Outlook versendet automatisch Einladungen an diese Adressen.</span></label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">Ort<input value={form.location} onChange={(event) => updateForm('location', event.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-[#5CB800]" placeholder="Optional, z. B. Büro Nürnberg" /></label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">Notiz<textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className="min-h-24 rounded-2xl border border-slate-200 p-4 outline-none focus:border-[#5CB800]" placeholder="Agenda oder kurze Nachricht an die Teilnehmer" /></label>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#6264A7]/20 bg-[#6264A7]/5 p-4"><span className="flex items-center gap-3"><MicrosoftTeamsIcon className="h-7 w-7" /><span><span className="block font-extrabold text-[#07142F]">Teams-Besprechung erstellen</span><span className="mt-0.5 block text-xs text-slate-500">Der Beitrittslink wird automatisch in die Einladung eingefügt.</span></span></span><input type="checkbox" checked={form.isOnlineMeeting} onChange={(event) => updateForm('isOnlineMeeting', event.target.checked)} className="h-5 w-5 accent-[#6264A7]" /></label>
            </div>

            <button disabled={saving} type="submit" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-4 font-extrabold text-white shadow-[0_14px_30px_rgba(92,184,0,0.25)] disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Termin erstellen und Einladung senden</button>
          </form>
        </div>
      )}
    </div>
  )
}
