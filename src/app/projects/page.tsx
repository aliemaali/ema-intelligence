import Link from 'next/link'
import { Archive, ArrowRight, BatteryCharging, MapPin, Plus, Search, Sparkles, Zap } from 'lucide-react'
import { getProjects } from '@/lib/actions/project.actions'
import { EmptyState } from '@/components/ui'
import { CountryProjectFolders } from '@/components/projects/CountryProjectFolders'
import { formatEnergyFromMwh, formatPowerFromKwp } from '@/lib/format/power'
import { formatProjectLocationLabel } from '@/lib/projects/location'
import { createClient } from '@/lib/supabase/server'
import type { ProjectStatus, ProjectType } from '@/lib/types/database.types'

export const metadata = { title: 'Projekte' }
interface ProjectsPageProps { searchParams: { type?: string; status?: string; q?: string; view?: string } }

function typeLabel(type?: string | null) {
  if (type === 'pv_freiflaeche') return 'PV-Freifläche'
  if (type === 'pv_dach') return 'PV-Dachanlage'
  if (type === 'bess') return 'BESS'
  if (type === 'hybrid') return 'Hybridprojekt'
  if (type === 'wind') return 'Windprojekt'
  if (type === 'rechenzentrum') return 'Rechenzentrum'
  return 'Energieprojekt'
}

function fallbackImage(type?: string | null) {
  if (type === 'pv_dach') return '/project-dach.svg'
  if (type === 'bess') return '/project-bess.svg'
  if (type === 'wind') return '/hero-wind.svg'
  if (type === 'rechenzentrum') return '/hero-datacenter.svg'
  if (type === 'sonstiges') return '/hero-generic-project.svg'
  return '/project-freiflaeche.svg'
}

function projectLocation(project: any) {
  return formatProjectLocationLabel(project.location_country, project.location_city, project.location_state)
}

function projectPower(project: any) {
  const pv = Number(project.pv_kwp ?? project.pv_mwp ?? project.capacity_kwp ?? 0)
  const bess = Number(project.bess_mwh ?? project.storage_capacity_mwh ?? 0)
  if (project.project_type === 'bess') return bess ? formatEnergyFromMwh(bess) : 'Leistung offen'
  if (project.project_type === 'hybrid') {
    const parts = []
    if (pv) parts.push(formatPowerFromKwp(pv))
    if (bess) parts.push(formatEnergyFromMwh(bess))
    return parts.join(' / ') || 'Leistung offen'
  }
  return pv ? formatPowerFromKwp(pv) : 'Leistung offen'
}

function stageLabel(stage?: string | null) {
  return stage === 'rtb' ? 'RTB' : 'In Planung'
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const [allProjects, listResult] = await Promise.all([
    getProjects({ type: searchParams.type as ProjectType | undefined, status: searchParams.status as ProjectStatus | undefined }),
    createClient().then((supabase) =>
      supabase.from('country_project_lists').select('country, project_count, created_at').order('created_at', { ascending: false })
    ),
  ])

  const query = (searchParams.q ?? '').trim().toLocaleLowerCase('de-DE')
  const projects = query
    ? allProjects.filter((project: any) =>
        [project.project_number, project.project_name, project.location_city, project.location_state, project.location_country]
          .some((value) => String(value ?? '').toLocaleLowerCase('de-DE').includes(query))
      )
    : allProjects

  const showAll = searchParams.view === 'all' || Boolean(query) || Boolean(searchParams.type)
  const types = [
    { value: '', label: 'Alle' },
    { value: 'pv_freiflaeche', label: 'PV Freifläche' },
    { value: 'pv_dach', label: 'PV Dach' },
    { value: 'bess', label: 'BESS' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'wind', label: 'Wind' },
  ]
  const projectLists = (listResult.data ?? []) as Array<{ country: string; project_count: number; created_at: string }>

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden pb-28 text-white md:mx-auto md:max-w-[1480px] md:space-y-7">
      <section className="relative isolate mx-3 min-h-[23rem] overflow-hidden rounded-[2rem] border border-white/8 bg-[#0b1118] shadow-[0_28px_90px_rgba(0,0,0,0.42)] md:mx-0 md:min-h-[28rem]">
        <img src="/hero-dashboard.png" alt="Erneuerbare-Energien-Projekte" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1118] via-[#0b1118]/82 to-[#0b1118]/18" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1118] via-transparent to-black/30" />
        <div className="relative flex min-h-[23rem] flex-col justify-between px-5 py-6 md:min-h-[28rem] md:px-9 md:py-8">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/25 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#87D33B] backdrop-blur-xl">
              <Sparkles className="h-4 w-4" /> EMA Portfolio
            </span>
            <div className="flex items-center gap-2">
              <Link href="/projects/archive" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-white backdrop-blur-xl transition hover:bg-white/12" aria-label="Projektarchiv">
                <Archive className="h-5 w-5" />
              </Link>
              <Link href="/projects/new" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#5CB800] px-4 py-3 text-sm font-extrabold text-[#081109] shadow-[0_16px_36px_rgba(92,184,0,0.24)] transition hover:-translate-y-0.5 hover:bg-[#6bcf15]">
                <Plus className="h-5 w-5" /> Neues Projekt
              </Link>
            </div>
          </div>
          <div className="max-w-3xl pb-3">
            <p className="text-xs font-extrabold uppercase tracking-[.24em] text-[#87D33B]">Projektportfolio</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.055em] md:text-6xl">Projekte</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">Alle PV-, BESS-, Wind- und Hybridprojekte zentral nach Ländern, Leistung und Status organisiert.</p>
            <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-bold backdrop-blur-xl">
              <span className="h-2.5 w-2.5 rounded-full bg-[#5CB800] shadow-[0_0_16px_rgba(92,184,0,0.9)]" />
              {allProjects.length} aktive Projekte
            </div>
          </div>
        </div>
      </section>

      {!showAll && <div className="px-3 md:px-0"><CountryProjectFolders projects={allProjects} projectLists={projectLists} /></div>}

      <section className="px-3 md:px-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#76d22a]">{showAll ? 'Gesamtansicht' : 'Schnellsuche'}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-white">{showAll ? 'Alle Projekte' : 'Projekt direkt finden'}</h2>
          </div>
          {!showAll && (
            <Link href="/projects?view=all" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-white/10">
              Alle Projekte anzeigen <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        <form className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#171f28]/92 p-2 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur-xl" action="/projects">
          <input type="hidden" name="view" value="all" />
          <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
          <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Projektname, Nummer oder Standort suchen" className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-white outline-none placeholder:text-slate-500" />
          <button className="min-h-11 rounded-xl bg-[#5CB800] px-4 text-sm font-extrabold text-[#081109]">Suchen</button>
        </form>

        {showAll && (
          <>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {types.map((type) => {
                const params = new URLSearchParams({ view: 'all' })
                if (type.value) params.set('type', type.value)
                if (searchParams.q) params.set('q', searchParams.q)
                const active = (searchParams.type ?? '') === type.value
                return (
                  <Link key={type.value} href={`/projects?${params.toString()}`} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-extrabold transition ${active ? 'bg-[#5CB800] text-[#081109]' : 'border border-white/10 bg-white/6 text-slate-300 hover:bg-white/10'}`}>
                    {type.label}
                  </Link>
                )
              })}
            </div>

            {projects.length === 0 ? (
              <div className="mt-6"><EmptyState icon="📁" title="Keine Projekte gefunden" description="Passe die Suche oder den Filter an." action={<Link href="/projects?view=all" className="btn-secondary mt-2">Filter zurücksetzen</Link>} /></div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {projects.map((project: any) => (
                  <article key={project.id} className="group overflow-hidden rounded-[1.8rem] border border-white/8 bg-[#171f28]/94 shadow-[0_18px_55px_rgba(0,0,0,0.24)] transition hover:-translate-y-1 hover:border-[#5CB800]/35 hover:shadow-[0_26px_75px_rgba(0,0,0,0.36)]">
                    <Link href={`/projects/${project.id}/overview`} className="block">
                      <div className="relative h-40 overflow-hidden bg-[#0f151c] md:h-44">
                        <img src={project.project_image_url || fallbackImage(project.project_type)} alt={project.project_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#081018]/95 via-[#081018]/15 to-transparent" />
                        <span className="absolute right-3 top-3 rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-[10px] font-extrabold uppercase text-white backdrop-blur-xl">{typeLabel(project.project_type)}</span>
                        <div className="absolute bottom-3 left-4 right-4">
                          <p className="text-[11px] font-bold text-white/65">{project.project_number || 'Ohne Projektnummer'}</p>
                          <h3 className="mt-1 truncate text-xl font-extrabold text-white">{project.project_name}</h3>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="space-y-2.5 text-sm text-slate-300">
                          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#76d22a]" /><span className="truncate">{projectLocation(project)}</span></div>
                          <div className="flex items-center gap-2">{project.project_type === 'bess' ? <BatteryCharging className="h-4 w-4 shrink-0 text-[#76d22a]" /> : <Zap className="h-4 w-4 shrink-0 text-[#76d22a]" />}<span className="truncate">{projectPower(project)}</span></div>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3">
                      <span className="rounded-full bg-white/7 px-3 py-1.5 text-xs font-extrabold text-slate-300">{stageLabel(project.project_stage)}</span>
                      <Link href={`/projects/${project.id}/overview`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#5CB800] px-4 py-2 text-xs font-extrabold text-[#081109]">Öffnen <ArrowRight className="h-4 w-4" /></Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
