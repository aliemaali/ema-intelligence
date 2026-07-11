import Link from 'next/link'
import {
  ArrowRight,
  BatteryCharging,
  FileText,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react'
import { getProjects } from '@/lib/actions/project.actions'
import { EmptyState } from '@/components/ui'
import type { ProjectType, ProjectStatus } from '@/lib/types/database.types'

export const metadata = { title: 'Projekte' }

interface ProjectsPageProps {
  searchParams: { type?: string; status?: string; search?: string }
}

function typeLabel(type?: string | null) {
  if (type === 'pv_freiflaeche') return 'PV-Freifläche'
  if (type === 'pv_dach') return 'PV-Dachanlage'
  if (type === 'bess') return 'BESS'
  if (type === 'hybrid') return 'Hybridprojekt'
  if (type === 'wind') return 'Windprojekt'
  return 'Energieprojekt'
}

function projectLocation(project: any) {
  return [project.location_city, project.location_state].filter(Boolean).join(', ') || 'Standort offen'
}

function projectPower(project: any) {
  const pv = Number(project.pv_kwp ?? project.pv_mwp ?? project.capacity_kwp ?? 0)
  const bess = Number(project.bess_mwh ?? project.storage_capacity_mwh ?? 0)
  if (project.project_type === 'bess') return bess ? `${bess.toLocaleString('de-DE')} MWh` : 'Leistung offen'
  if (project.project_type === 'hybrid') {
    const parts = []
    if (pv) parts.push(`${pv.toLocaleString('de-DE')} kWp`)
    if (bess) parts.push(`${bess.toLocaleString('de-DE')} MWh`)
    return parts.join(' / ') || 'Leistung offen'
  }
  return pv ? `${pv.toLocaleString('de-DE')} kWp` : 'Leistung offen'
}

function statusLabel(status?: string | null) {
  if (!status) return 'Status offen'
  return String(status).replaceAll('_', ' ')
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const projects = await getProjects({
    type: searchParams.type as ProjectType | undefined,
    status: searchParams.status as ProjectStatus | undefined,
    search: searchParams.search,
  })

  const types = [
    { value: '', label: 'Alle' },
    { value: 'pv_freiflaeche', label: 'PV Freifläche' },
    { value: 'pv_dach', label: 'PV Dach' },
    { value: 'bess', label: 'BESS' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'wind', label: 'Wind' },
  ]

  return (
    <div className="w-full max-w-full space-y-7 overflow-x-hidden pb-28 md:mx-auto md:max-w-[1480px] md:space-y-8">
      <section className="relative mx-3 overflow-hidden rounded-[2rem] bg-[#07142F] text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] md:mx-0 md:rounded-[2.2rem]">
        <div className="relative min-h-[470px] md:min-h-[520px]">
          <img src="/hero-dashboard.png" alt="Erneuerbare-Energien-Projekte" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07142F]/95 via-[#07142F]/62 to-[#07142F]/12" />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#07142F]/95 via-[#07142F]/45 to-transparent" />

          <div className="relative flex min-h-[470px] flex-col justify-between px-6 py-8 md:min-h-[520px] md:px-10 md:py-10">
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#07142F]/78 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#87D33B] ring-1 ring-white/15">
                <Sparkles className="h-4 w-4" /> EMA Intelligence
              </span>
              <Link href="/projects/new" className="inline-flex items-center gap-2 rounded-full bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#5CB800]/25 transition hover:bg-[#4ea000]">
                <Plus className="h-5 w-5" /> Neu
              </Link>
            </div>

            <div className="max-w-3xl pb-2">
              <p className="text-sm font-extrabold uppercase tracking-[.24em] text-[#87D33B]">Projektportfolio</p>
              <h1 className="mt-4 text-5xl font-extrabold leading-[.95] tracking-[-.045em] md:text-7xl">Projekte</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/82 md:text-lg">
                Alle PV-, BESS-, Hybrid- und Windprojekte zentral verwalten, bewerten und für Investoren aufbereiten.
              </p>
              <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/10 backdrop-blur">
                <FileText className="h-5 w-5 text-[#87D33B]" /> {projects.length} Projekt{projects.length === 1 ? '' : 'e'} im Portfolio
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-3 md:px-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">Portfolioübersicht</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#07142F] md:text-4xl">Projekte verwalten</h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-600 shadow-sm">{projects.length} Projekte</span>
        </div>

        <div className="mt-6 space-y-3">
          <form method="GET" className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              name="search"
              type="search"
              defaultValue={searchParams.search}
              placeholder="Projekt suchen..."
              className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base font-semibold text-[#07142F] shadow-sm outline-none transition focus:border-[#5CB800] focus:ring-4 focus:ring-[#5CB800]/10"
            />
            {searchParams.type && <input type="hidden" name="type" value={searchParams.type} />}
          </form>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {types.map((type) => {
              const params = new URLSearchParams(searchParams as Record<string, string>)
              if (type.value) params.set('type', type.value)
              else params.delete('type')
              params.delete('search')
              const active = (searchParams.type ?? '') === type.value
              return (
                <Link
                  key={type.value}
                  href={`/projects?${params.toString()}`}
                  className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-extrabold transition ${active ? 'bg-[#5CB800] text-white shadow-lg shadow-[#5CB800]/20' : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-[#07142F]'}`}
                >
                  {type.label}
                </Link>
              )
            })}
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="mt-7">
            <EmptyState
              icon="📁"
              title="Keine Projekte gefunden"
              description={searchParams.search || searchParams.type ? 'Versuche andere Filterkriterien.' : 'Erstelle dein erstes Projekt, um loszulegen.'}
              action={!searchParams.search && !searchParams.type ? <Link href="/projects/new" className="btn-primary mt-2">+ Neues Projekt</Link> : undefined}
            />
          </div>
        ) : (
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project: any) => {
              const isBess = project.project_type === 'bess'
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/overview`}
                  className="group rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.07)] transition hover:-translate-y-1 hover:border-[#5CB800]/40 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F9E8] text-[#3D9200]">
                      {isBess ? <BatteryCharging className="h-7 w-7" /> : <Zap className="h-7 w-7" />}
                    </div>
                    <span className="rounded-full bg-[#07142F] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-white">{typeLabel(project.project_type)}</span>
                  </div>

                  <p className="mt-5 text-sm font-bold text-slate-400">{project.project_number || 'Ohne Projektnummer'}</p>
                  <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-[#07142F]">{project.project_name}</h3>

                  <div className="mt-5 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#5CB800]" /> {projectLocation(project)}</div>
                    <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-[#5CB800]" /> {projectPower(project)}</div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold capitalize text-slate-600">{statusLabel(project.status)}</span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5CB800]/10 text-[#3D9200] transition group-hover:translate-x-1 group-hover:bg-[#5CB800] group-hover:text-white"><ArrowRight className="h-5 w-5" /></span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
