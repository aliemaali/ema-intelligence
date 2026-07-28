import Link from 'next/link'
import { Archive, ArrowLeft, FolderOpen, MapPin } from 'lucide-react'
import { getArchivedProjects } from '@/lib/actions/project-archive.actions'
import { ArchivedProjectActions } from '@/components/projects/ArchivedProjectActions'
import { EmptyState } from '@/components/ui'
import { formatProjectLocationLabel } from '@/lib/projects/location'

export const metadata = { title: 'Projektarchiv' }

export default async function ProjectArchivePage() {
  const projects = await getArchivedProjects()

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 pb-32 pt-4 md:px-0 md:pb-12">
      <div className="rounded-[2rem] bg-[#07142F] p-6 text-white shadow-xl md:p-8">
        <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-bold text-white/75 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Zurück zu Projekte
        </Link>
        <div className="mt-6 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]">
            <Archive className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#87D33B]">Projektverwaltung</p>
            <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Archiv</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Archivierte Projekte bleiben vollständig erhalten. Du kannst sie wiederherstellen oder nach einer zweiten Bestätigung endgültig löschen.</p>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-6 w-6" />} title="Das Archiv ist leer" description="Archivierte Projekte erscheinen hier." action={<Link href="/projects" className="btn-primary mt-2">Zu den Projekten</Link>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project: any) => (
            <article key={project.id} className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-500">{project.project_number || 'Ohne Projektnummer'}</p>
                  <h2 className="mt-1 truncate text-xl font-extrabold text-[#07142F]">{project.project_name}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold uppercase text-slate-600">Archiviert</span>
              </div>

              <div className="my-5 flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4 text-[#5CB800]" />
                {formatProjectLocationLabel(project.location_country, project.location_city, project.location_state)}
              </div>

              <ArchivedProjectActions projectId={project.id} projectName={project.project_name} />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
