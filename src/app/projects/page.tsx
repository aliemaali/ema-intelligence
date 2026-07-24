import Link from 'next/link'
import { ArrowRight, BatteryCharging, FileText, MapPin, Plus, Sparkles, Zap } from 'lucide-react'
import { getProjects } from '@/lib/actions/project.actions'
import { EmptyState } from '@/components/ui'
import ExposeButton from '@/components/projects/ExposeButton'
import { formatProjectLocationLabel } from '@/lib/projects/location'
import type { ProjectType, ProjectStatus } from '@/lib/types/database.types'

export const metadata = { title: 'Projekte' }

interface ProjectsPageProps { searchParams: { type?: string; status?: string } }

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

function projectLocation(project: any) { return formatProjectLocationLabel(project.location_country, project.location_city, project.location_state) }

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

function stageLabel(stage?: string | null) {
  if (stage === 'rtb') return 'RTB'
  if (stage === 'betrieb') return 'Im Betrieb'
  return 'In Planung'
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const projects = await getProjects({ type: searchParams.type as ProjectType | undefined, status: searchParams.status as ProjectStatus | undefined })
  const types = [
    { value: '', label: 'Alle' }, { value: 'pv_freiflaeche', label: 'PV Freifläche' }, { value: 'pv_dach', label: 'PV Dach' },
    { value: 'bess', label: 'BESS' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'wind', label: 'Wind' },
  ]

  return (
    <div className="w-full max-w-full space-y-7 overflow-x-hidden pb-28 md:mx-auto md:max-w-[1480px] md:space-y-8">
      <section className="relative mx-3 overflow-hidden rounded-[2rem] bg-[#07142F] text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] md:mx-0 md:rounded-[2.2rem]">
        <div className="relative min-h-[470px] md:min-h-[520px]">
          <img src="/hero-dashboard.png" alt="Erneuerbare-Energien-Projekte" className="absolute inset-0 h-full w-full scale-[1.015] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07142F]/96 via-[#07142F]/64 to-[#07142F]/10" />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#07142F] via-[#07142F]/72 to-transparent" />
          <div className="relative flex min-h-[470px] flex-col justify-between px-6 py-8 md:min-h-[520px] md:px-10 md:py-10">
            <div className="flex items-center justify-between gap-4"><span className="inline-flex items-center gap-2 rounded-full bg-[#07142F]/72 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#87D33B] ring-1 ring-white/15"><Sparkles className="h-4 w-4" /> EMA Intelligence</span><Link href="/projects/new" className="inline-flex items-center gap-2 rounded-full bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white"><Plus className="h-5 w-5" /> Neu</Link></div>
            <div className="max-w-3xl pb-2"><p className="text-sm font-extrabold uppercase tracking-[.24em] text-[#87D33B]">Projektportfolio</p><h1 className="mt-4 text-5xl font-extrabold md:text-7xl">Projekte</h1><p className="mt-5 max-w-2xl text-base leading-7 text-white/82 md:text-lg">Alle PV-, BESS-, Hybrid- und Windprojekte zentral verwalten, bewerten und für Investoren aufbereiten.</p><div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold"><FileText className="h-5 w-5 text-[#87D33B]" /> {projects.length} Projekt{projects.length === 1 ? '' : 'e'} im Portfolio</div></div>
          </div>
        </div>
      </section>

      <section className="px-3 md:px-0">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">Portfolioübersicht</p><h2 className="mt-2 text-3xl font-extrabold text-[#07142F] md:text-4xl">Projekte verwalten</h2></div><span className="rounded-full border bg-white px-4 py-2 text-sm font-extrabold text-slate-600">{projects.length} Projekte</span></div>
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">{types.map((type) => { const params = new URLSearchParams(searchParams as Record<string, string>); if (type.value) params.set('type', type.value); else params.delete('type'); const active = (searchParams.type ?? '') === type.value; return <Link key={type.value} href={`/projects?${params.toString()}`} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-extrabold ${active ? 'bg-[#5CB800] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{type.label}</Link> })}</div>

        {projects.length === 0 ? <div className="mt-7"><EmptyState icon="📁" title="Keine Projekte gefunden" description="Erstelle dein erstes Projekt, um loszulegen." action={<Link href="/projects/new" className="btn-primary mt-2">+ Neues Projekt</Link>} /></div> : (
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project: any) => (
              <article key={project.id} className="group overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.07)] transition hover:-translate-y-1 hover:border-[#5CB800]/40">
                <Link href={`/projects/${project.id}/overview`} className="block">
                  <div className="relative h-44 overflow-hidden bg-slate-100"><img src={project.project_image_url || fallbackImage(project.project_type)} alt={project.project_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#07142F]/70 via-transparent to-transparent" /><span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-extrabold uppercase text-[#07142F]">{typeLabel(project.project_type)}</span><div className="absolute bottom-4 left-4 right-4"><p className="text-xs font-bold text-white/70">{project.project_number || 'Ohne Projektnummer'}</p><h3 className="mt-1 text-2xl font-extrabold text-white">{project.project_name}</h3></div></div>
                  <div className="p-5"><div className="space-y-3 text-sm text-slate-600"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#5CB800]" /> {projectLocation(project)}</div><div className="flex items-center gap-2">{project.project_type === 'bess' ? <BatteryCharging className="h-4 w-4 text-[#5CB800]" /> : <Zap className="h-4 w-4 text-[#5CB800]" />} {projectPower(project)}</div></div></div>
                </Link>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-600">{stageLabel(project.project_stage)}</span><div className="flex items-center gap-2"><ExposeButton project={project} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#07142F] px-4 py-2 text-xs font-extrabold text-white" /><Link href={`/projects/${project.id}/overview`} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5CB800]/10 text-[#3D9200]"><ArrowRight className="h-5 w-5" /></Link></div></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}