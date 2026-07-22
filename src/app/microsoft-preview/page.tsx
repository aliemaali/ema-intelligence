import Link from 'next/link'
import { ArrowLeft, Building2, CalendarDays, ChevronRight, Clock3, Mail, MapPin, Phone, Search, Sparkles, Users, Video } from 'lucide-react'

const contacts = [
  { initials: 'MK', name: 'Maximilian König', company: 'König Energieprojekte GmbH', role: 'Geschäftsführer', email: 'm.koenig@energieprojekte.de', phone: '+49 171 234 56 78', projects: '2 Projekte' },
  { initials: 'SJ', name: 'Sarah Jung', company: 'Green Capital Partners', role: 'Investment Managerin', email: 's.jung@greencapital.de', phone: '+49 160 876 54 32', projects: '1 Projekt' },
  { initials: 'TG', name: 'Thomas Graf', company: 'Netzplanung Süd GmbH', role: 'Projektleiter Netzanschluss', email: 'thomas.graf@netzplanung.de', phone: '+49 151 456 78 90', projects: '3 Projekte' },
]

const appointments = [
  { day: '24', month: 'JUL', time: '10:00 – 10:45', title: 'PVA Delitzsch – Investorenabstimmung', contact: 'Sarah Jung · Green Capital Partners', type: 'Teams-Meeting' },
  { day: '25', month: 'JUL', time: '14:30 – 15:00', title: 'Netzanschluss – Technische Rücksprache', contact: 'Thomas Graf · Netzplanung Süd GmbH', type: 'Telefontermin' },
]

export default function MicrosoftPreviewPage() {
  return (
    <main className="min-h-screen bg-[#F5F8FC] pb-14 text-[#07142F]">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-9">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm" aria-label="Zurück zum Dashboard"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-slate-500 shadow-sm ring-1 ring-slate-200">DESIGN-TEST · NOCH OHNE MICROSOFT-VERBINDUNG</span>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br from-white via-white to-[#EEF5FF] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.09)] md:p-9">
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-[#3D8F00]"><Sparkles className="h-4 w-4" /> Microsoft 365 Hub</div>
              <h1 className="max-w-3xl text-4xl font-black tracking-[-0.05em] md:text-6xl">Kontakte und Termine an einem Ort.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">Outlook-Kontakte in EMA nutzen, Termine projektbezogen planen und Einladungen direkt versenden.</p>
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3.5 font-extrabold text-white shadow-[0_14px_30px_rgba(92,184,0,0.28)]"><CalendarDays className="h-5 w-5" /> Neuen Termin planen</button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#3D8F00]"><Users className="h-5 w-5" /></div><p className="mt-4 text-3xl font-black">248</p><p className="mt-1 text-sm font-semibold text-slate-500">Outlook-Kontakte</p></div>
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><CalendarDays className="h-5 w-5" /></div><p className="mt-4 text-3xl font-black">6</p><p className="mt-1 text-sm font-semibold text-slate-500">Termine diese Woche</p></div>
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Video className="h-5 w-5" /></div><p className="mt-4 text-3xl font-black">3</p><p className="mt-1 text-sm font-semibold text-slate-500">Teams-Besprechungen</p></div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] md:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-2xl font-black tracking-tight">Kontakte</h2><p className="mt-1 text-sm text-slate-500">Aus Outlook synchronisiert und in EMA nutzbar.</p></div>
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Kontakte suchen" placeholder="Kontakt suchen" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none sm:w-56" /></div>
            </div>

            <div className="mt-5 space-y-3">
              {contacts.map((contact) => (
                <article key={contact.email} className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#07142F] text-sm font-black text-white">{contact.initials}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2"><div><h3 className="font-extrabold">{contact.name}</h3><p className="mt-0.5 text-sm text-slate-500">{contact.role}</p></div><span className="rounded-full bg-[#5CB800]/10 px-2.5 py-1 text-[11px] font-extrabold text-[#3D8F00]">{contact.projects}</span></div>
                      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><Building2 className="h-4 w-4 text-slate-400" /> {contact.company}</p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2"><span className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{contact.email}</span></span><span className="flex items-center gap-2"><Phone className="h-4 w-4" />{contact.phone}</span></div>
                      <div className="mt-4 flex flex-wrap gap-2"><button className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700">E-Mail</button><button className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700">Anrufen</button><button className="rounded-xl bg-[#07142F] px-3 py-2 text-xs font-extrabold text-white">Termin planen</button></div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-extrabold text-slate-600">Alle Kontakte anzeigen <ChevronRight className="h-4 w-4" /></button>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] md:p-7">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-2xl font-black tracking-tight">Nächste Termine</h2><p className="mt-1 text-sm text-slate-500">Projektbezogen und direkt einladbar.</p></div><CalendarDays className="h-7 w-7 text-[#5CB800]" /></div>
            <div className="mt-5 space-y-4">
              {appointments.map((appointment) => (
                <article key={appointment.title} className="rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#07142F] text-white"><span className="text-xl font-black leading-none">{appointment.day}</span><span className="mt-1 text-[10px] font-extrabold tracking-[0.12em] text-white/70">{appointment.month}</span></div>
                    <div className="min-w-0"><p className="flex items-center gap-2 text-xs font-extrabold text-[#3D8F00]"><Clock3 className="h-4 w-4" />{appointment.time}</p><h3 className="mt-2 font-extrabold leading-snug">{appointment.title}</h3><p className="mt-2 text-sm text-slate-500">{appointment.contact}</p><p className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600">{appointment.type === 'Teams-Meeting' ? <Video className="h-4 w-4 text-violet-600" /> : <Phone className="h-4 w-4" />}{appointment.type}</p></div>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-5 rounded-[1.5rem] bg-[#07142F] p-5 text-white"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#8CD93C]">Schnellaktion</p><h3 className="mt-2 text-xl font-black">Einladung in unter einer Minute</h3><p className="mt-2 text-sm leading-6 text-white/70">Kontakt wählen, Projekt zuordnen, Termin festlegen und Einladung versenden.</p><button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-[#07142F]"><MapPin className="h-4 w-4" /> Termin erstellen</button></div>
          </section>
        </div>
      </div>
    </main>
  )
}
