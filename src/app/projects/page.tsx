import Link from 'next/link'
import { Archive, ArrowRight, BatteryCharging, FileClock, FileText, MapPin, Plus, Search, Sparkles, Zap } from 'lucide-react'
import { getProjects } from '@/lib/actions/project.actions'
import { EmptyState } from '@/components/ui'
import { BulkMemorandumCenter } from '@/components/projects/BulkMemorandumCenter'
import { ProjectAuditPdfButton } from '@/components/projects/ProjectAuditPdfButton'
import { formatProjectLocationLabel } from '@/lib/projects/location'
import { createClient } from '@/lib/supabase/server'
import type { ProjectType, ProjectStatus } from '@/lib/types/database.types'

export const metadata = { title: 'Projekte' }
interface ProjectsPageProps { searchParams: { type?: string; status?: string; q?: string } }

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
  if (project.project_type === 'hybrid') { const parts = []; if (pv) parts.push(`${pv.toLocaleString('de-DE')} kWp`); if (bess) parts.push(`${bess.toLocaleString('de-DE')} MWh`); return parts.join(' / ') || 'Leistung offen' }
  return pv ? `${pv.toLocaleString('de-DE')} kWp` : 'Leistung offen'
}
function stageLabel(stage?: string | null) { return stage === 'rtb' ? 'RTB' : 'In Planung' }

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const allProjects = await getProjects({ type: searchParams.type as ProjectType | undefined, status: searchParams.status as ProjectStatus | undefined })
  const query = (searchParams.q ?? '').trim().toLocaleLowerCase('de-DE')
  const projects = query ? allProjects.filter((project: any) => [project.project_number, project.project_name, project.location_city, project.location_state, project.location_country].some((value) => String(value ?? '').toLocaleLowerCase('de-DE').includes(query))) : allProjects
  const types = [{ value: '', label: 'Alle' }, { value: 'pv_freiflaeche', label: 'PV Freifläche' }, { value: 'pv_dach', label: 'PV Dach' }, { value: 'bess', label: 'BESS' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'wind', label: 'Wind' }]
  const supabase = await createClient()
  const [{ data: investors }, { data: partners }] = await Promise.all([
    supabase.from('investors').select('id, company_name, contact_person, email').not('email', 'is', null).order('company_name'),
    supabase.from('profiles').select('id, company, full_name, email, role').in('role', ['partner', 'sales_partner', 'vertriebspartner']).eq('is_active', true).not('email', 'is', null).order('company'),
  ])
  const recipients = [...(investors ?? []).map((item: any) => ({ id: `investor:${item.id}`, name: item.company_name || item.contact_person || item.email, email: item.email, type: 'investor' as const })), ...(partners ?? []).map((item: any) => ({ id: `partner:${item.id}`, name: item.company || item.full_name || item.email, email: item.email, type: 'partner' as const }))]
  const bulkProjects = allProjects.map((project: any) => ({ id: project.id, name: project.project_name || 'Projekt', number: project.project_number || 'Ohne Projektnummer', location: projectLocation(project), typeLabel: typeLabel(project.project_type) }))
  const auditProjectIds = projects.map((project: any) => project.id)

  return <div className="w-full max-w-full space-y-6 overflow-x-hidden pb-28 md:mx-auto md:max-w-[1480px] md:space-y-7">
    <section className="relative mx-3 overflow-hidden rounded-[2rem] bg-[#07142F] text-white shadow-[0_20px_55px_rgba(15,23,42,0.16)] md:mx-0"><img src="/hero-dashboard.png" alt="Erneuerbare-Energien-Projekte" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#07142F]/97 via-[#07142F]/78 to-[#07142F]/30" /><div className="relative px-6 py-7 md:px-10 md:py-9"><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-[#07142F]/72 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#87D33B] ring-1 ring-white/15"><Sparkles className="h-4 w-4" /> EMA Intelligence</span><div className="flex items-center gap-2"><Link href="/projects/archive" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/20" aria-label="Projektarchiv"><Archive className="h-5 w-5" /></Link><Link href="/projects/new" className="inline-flex items-center gap-2 rounded-full bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white"><Plus className="h-5 w-5" /> Neu</Link></div></div><div className="mt-12 max-w-3xl md:mt-16"><p className="text-xs font-extrabold uppercase tracking-[.24em] text-[#87D33B]">Projektportfolio</p><h1 className="mt-3 text-4xl font-extrabold md:text-6xl">Projekte</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 md:text-base">Alle Energieprojekte zentral finden, öffnen und verwalten.</p><div className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold"><FileText className="h-5 w-5 text-[#87D33B]" /> {allProjects.length} Projekt{allProjects.length === 1 ? '' : 'e'} im Portfolio</div></div></div></section>

    <section className="px-3 md:px-0"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">Portfolioübersicht</p><h2 className="mt-2 text-3xl font-extrabold text-[#07142F] md:text-4xl">Projekte verwalten</h2></div><div className="flex flex-wrap gap-2"><ProjectAuditPdfButton projectIds={auditProjectIds} /><Link href="/dispatch/history" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#07142F] shadow-sm"><FileClock className="h-4 w-4 text-[#5CB800]" /> Versandhistorie</Link><BulkMemorandumCenter projects={bulkProjects} recipients={recipients} /></div></div>
      <form className="mt-5 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" action="/projects">{searchParams.type && <input type="hidden" name="type" value={searchParams.type} />}<Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" /><input name="q" defaultValue={searchParams.q ?? ''} placeholder="Projektname, Nummer oder Standort suchen" className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-sm text-[#07142F] outline-none placeholder:text-slate-400" /><button className="min-h-11 rounded-xl bg-[#07142F] px-4 text-sm font-extrabold text-white">Suchen</button></form>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">{types.map((type) => { const params = new URLSearchParams(); if (type.value) params.set('type', type.value); if (searchParams.q) params.set('q', searchParams.q); const active = (searchParams.type ?? '') === type.value; return <Link key={type.value} href={`/projects?${params.toString()}`} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-extrabold ${active ? 'bg-[#5CB800] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{type.label}</Link> })}</div>
      {projects.length === 0 ? <div className="mt-6"><EmptyState icon="📁" title="Keine Projekte gefunden" description={query ? 'Passe die Suche oder den Filter an.' : 'Erstelle dein erstes Projekt, um loszulegen.'} action={query ? <Link href="/projects" className="btn-secondary mt-2">Filter zurücksetzen</Link> : <Link href="/projects/new" className="btn-primary mt-2">+ Neues Projekt</Link>} /></div> : <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project: any) => <article key={project.id} className="group overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-[#5CB800]/40"><Link href={`/projects/${project.id}/overview`} className="block"><div className="relative h-36 overflow-hidden bg-slate-100 md:h-40"><img src={project.project_image_url || fallbackImage(project.project_type)} alt={project.project_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#07142F]/78 via-transparent to-transparent" /><span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-extrabold uppercase text-[#07142F]">{typeLabel(project.project_type)}</span><div className="absolute bottom-3 left-4 right-4"><p className="text-[11px] font-bold text-white/70">{project.project_number || 'Ohne Projektnummer'}</p><h3 className="mt-1 truncate text-xl font-extrabold text-white">{project.project_name}</h3></div></div><div className="p-4"><div className="space-y-2.5 text-sm text-slate-600"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#5CB800]" /><span className="truncate">{projectLocation(project)}</span></div><div className="flex items-center gap-2">{project.project_type === 'bess' ? <BatteryCharging className="h-4 w-4 shrink-0 text-[#5CB800]" /> : <Zap className="h-4 w-4 shrink-0 text-[#5CB800]" />}<span className="truncate">{projectPower(project)}</span></div></div></div></Link><div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-600">{stageLabel(project.project_stage)}</span><Link href={`/projects/${project.id}/overview`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#07142F] px-4 py-2 text-xs font-extrabold text-white">Öffnen <ArrowRight className="h-4 w-4" /></Link></div></article>)}</div>}
    </section>
  </div>
}
