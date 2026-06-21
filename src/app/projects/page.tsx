import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { getProjects } from '@/lib/actions/project.actions'
import { ProjectCard, ProjectRow } from '@/components/projects/ProjectCard'
import { EmptyState } from '@/components/ui'
import type { ProjectType, ProjectStatus } from '@/lib/types/database.types'

export const metadata = { title: 'Projekte' }

interface ProjectsPageProps {
  searchParams: { type?: string; status?: string; search?: string }
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const projects = await getProjects({
    type:   searchParams.type   as ProjectType   | undefined,
    status: searchParams.status as ProjectStatus | undefined,
    search: searchParams.search,
  })

  const types = [
    { value: '',               label: 'Alle' },
    { value: 'pv_freiflaeche', label: 'PV Freifläche' },
    { value: 'pv_dach',        label: 'PV Dach' },
    { value: 'bess',           label: 'BESS' },
    { value: 'hybrid',         label: 'Hybrid' },
    { value: 'wind',           label: 'Wind' },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Projekte</h1>
        <Link href="/projects/new" className="btn-primary gap-1.5">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Neues Projekt</span>
          <span className="sm:hidden">Neu</span>
        </Link>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <form method="GET" className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input name="search" type="search" defaultValue={searchParams.search}
            placeholder="Projekt suchen..." className="form-input pl-9" />
          {searchParams.type && <input type="hidden" name="type" value={searchParams.type} />}
        </form>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {types.map((t) => {
            const params = new URLSearchParams(searchParams as Record<string, string>)
            if (t.value) params.set('type', t.value); else params.delete('type')
            params.delete('search')
            const isActive = (searchParams.type ?? '') === t.value
            return (
              <Link key={t.value} href={`/projects?${params.toString()}`}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive ? 'bg-[#5CB800] text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}>
                {t.label}
              </Link>
            )
          })}
        </div>
      </div>

      {projects.length > 0 && (
        <p className="text-xs text-muted-foreground mb-3">
          {projects.length} Projekt{projects.length !== 1 ? 'e' : ''}
        </p>
      )}

      {projects.length === 0 && (
        <EmptyState
          icon="📁"
          title="Keine Projekte gefunden"
          description={searchParams.search || searchParams.type
            ? 'Versuche andere Filterkriterien.'
            : 'Erstelle dein erstes Projekt um loszulegen.'}
          action={!searchParams.search && !searchParams.type
            ? <Link href="/projects/new" className="btn-primary mt-2">+ Neues Projekt</Link>
            : undefined}
        />
      )}

      {projects.length > 0 && (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  {['Projekt','Typ','Leistung','Status','Priorität','AI Score','Nettogewinn',''].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => <ProjectRow key={p.id} project={p} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
