import Link from 'next/link'
import { ArrowRight, Bell, CalendarDays, FileText, MapPin, Search, Sparkles } from 'lucide-react'
import { getProjects } from '@/lib/actions/project.actions'

export const metadata = { title: 'Investment Memorandum' }

function typeLabel(type?: string | null) {
  if (type === 'pv_freiflaeche') return 'PV-Freifläche'
  if (type === 'pv_dach') return 'PV-Dachanlage'
  if (type === 'bess') return 'BESS'
  if (type === 'hybrid') return 'Hybridprojekt'
  return 'Energieprojekt'
}

export default async function ExposePage() {
  const projects = await getProjects()

  return (
    <div className="min-h-screen bg-[#f7f9fc] pb-28">
      <header className="border-b border-slate-200 bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] shadow-sm md:px-8 md:pb-5 md:pt-6">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/dashboard" aria-label="Zum Dashboard">
            <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-16 w-auto object-contain md:h-20" />
          </Link>
          <div className="flex items-center gap-2">
            <button className="mobile-header-action hidden sm:flex" type="button" aria-label="Suche"><Search className="h-5 w-5" /></button>
            <Link href="/calendar" className="mobile-header-action" aria-label="Kalender"><CalendarDays className="h-5 w-5" /></Link>
            <button className="mobile-header-action relative" type="button" aria-label="Benachrichtigungen"><Bell className="h-5 w-5" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#5CB800]" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1480px] space-y-8 px-3 pt-6 md:px-0 md:pt-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#07142F] text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] md:rounded-[2.2rem]">
          <div className="relative min-h-[520px] md:min-h-[440px]">
            <img src="/hero-dashboard.png" alt="Photovoltaik-Freiflächenanlage aus der Luft" className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07142F]/96 via-[#07142F]/66 to-[#07142F]/10" />
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/55 to-transparent" />

            <div className="relative flex min-h-[520px] flex-col justify-between px-6 py-8 md:min-h-[440px] md:px-10 md:py-10">
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex rounded-full bg-[#07142F]/75 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#87D33B] ring-1 ring-white/15">EMA Intelligence</span>
                <span className="hidden rounded-full border border-white/20 bg-black/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[.14em] text-white/85 sm:inline-flex">Premium Investment Documents</span>
              </div>

              <div className="max-w-3xl pb-2">
                <p className="text-sm font-extrabold uppercase tracking-[.24em] text-[#87D33B]">Investment Memorandum</p>
                <h1 className="mt-4 text-5xl font-extrabold leading-[.95] tracking-[-.045em] md:text-7xl">Institutionelle Projektunterlagen</h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 md:text-lg">Direkt aus den zentral gespeicherten Projektdaten von EMA Intelligence erstellt.</p>
                <div className="mt-6 flex items-center gap-3 text-sm font-bold text-white"><Sparkles className="h-5 w-5 text-[#87D33B]" /> Ohne eigene Fotos wird automatisch ein passendes Premium-Motiv verwendet.</div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[.18em] text-[#5CB800]">Projekt auswählen</p>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-[#0B1633] md:text-4xl">Memorandum erstellen</h2>
            </div>
            <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">{projects.length} Projekte</span>
          </div>

          {projects.length === 0 ? (
            <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <FileText className="mx-auto h-10 w-10 text-[#5CB800]" />
              <h3 className="mt-4 text-xl font-extrabold text-[#0B1633]">Noch kein Projekt vorhanden</h3>
              <p className="mt-2 text-slate-500">Lege zuerst ein Projekt an. Danach kann das Investment Memorandum automatisch erzeugt werden.</p>
              <Link href="/projects/new" className="mt-6 inline-flex rounded-2xl bg-[#5CB800] px-5 py-3 font-extrabold text-white">Neues Projekt</Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project: any) => (
                <Link key={project.id} href={`/expose/${project.id}`} className="group rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#5CB800]/50 hover:shadow-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F9E8] text-[#4C9800]"><FileText className="h-6 w-6" /></div>
                    <span className="rounded-full bg-[#0B1633] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">{typeLabel(project.project_type)}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold text-[#0B1633]">{project.project_name}</h3>
                  <p className="mt-1 text-sm font-bold text-slate-400">{project.project_number || 'Ohne Projektnummer'}</p>
                  <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><MapPin className="h-4 w-4 text-[#5CB800]" />{[project.location_city, project.location_state].filter(Boolean).join(', ') || 'Standort nicht hinterlegt'}</div>
                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-extrabold text-[#0B1633]"><span>Investment Memorandum öffnen</span><ArrowRight className="h-5 w-5 text-[#5CB800] transition group-hover:translate-x-1" /></div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
