import Link from 'next/link'
import { ArrowRight, FileText, MapPin, Sparkles } from 'lucide-react'
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
    <div className="page-container pb-28">
      <section className="overflow-hidden rounded-[2rem] bg-[#0B1633] text-white shadow-xl">
        <div className="grid min-h-[280px] lg:grid-cols-[1.05fr_.95fr]">
          <div className="flex flex-col justify-center px-6 py-10 md:px-10">
            <p className="text-xs font-extrabold uppercase tracking-[.24em] text-[#87D33B]">EMA Intelligence</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">Investment Memorandum</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">Institutionelle Projektunterlagen direkt aus den zentral gespeicherten Projektdaten erstellen.</p>
            <div className="mt-7 flex items-center gap-3 text-sm font-bold text-white"><Sparkles className="h-5 w-5 text-[#87D33B]" /> Ohne eigene Fotos wird automatisch ein passendes Premium-Motiv verwendet.</div>
          </div>
          <div className="relative min-h-[240px] overflow-hidden">
            <img src="/ema-pv-freiflaeche-default.svg" alt="PV-Freiflächenanlage" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1633] via-[#0B1633]/25 to-transparent lg:block" />
          </div>
        </div>
      </section>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div><p className="text-sm font-extrabold uppercase tracking-[.18em] text-[#5CB800]">Projekt auswählen</p><h2 className="mt-1 text-3xl font-extrabold text-[#0B1633]">Memorandum erstellen</h2></div>
        <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">{projects.length} Projekte</span>
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
    </div>
  )
}
