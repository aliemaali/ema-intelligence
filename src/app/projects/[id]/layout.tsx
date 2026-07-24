import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Home, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/actions/project.actions'
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/ui'
import { ProjectActions } from '@/components/projects/ProjectActions'
import { TabLinkClient } from '@/components/projects/TabLink'
import { BackNavigation } from '@/components/navigation/BackNavigation'

interface ProjectLayoutProps {
  children: React.ReactNode
  params:   { id: string }
}

const TABS = [
  { key: 'overview',  label: 'Übersicht' },
  { key: 'deal',      label: 'Deal' },
  { key: 'documents', label: 'Dokumente' },
  { key: 'investors', label: 'Investoren' },
  { key: 'activity',  label: 'Aktivität' },
  { key: 'analysis',  label: 'Analyse' },
]

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let project: any
  try {
    project = await getProject(params.id)
  } catch {
    notFound()
  }

  if (!project) notFound()

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border bg-card">
        <div className="page-container pb-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <BackNavigation fallbackHref="/dashboard" label="Zurück" />
              <Link
                href="/dashboard"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1F2A44] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#162039]"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${params.id}/edit`}
                className="btn-secondary btn-sm gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bearbeiten</span>
              </Link>
              <ProjectActions
                projectId={params.id}
                projectName={project.project_name}
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {project.project_number}
              </span>
              <TypeBadge type={project.project_type} />
              <StatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            <h1 className="text-lg font-semibold leading-tight text-foreground">
              {project.project_name}
            </h1>
            {(project.location_city || project.location_state) && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                📍 {[project.location_city, project.location_state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <div className="no-scrollbar -mb-px flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <TabLinkClient
                key={tab.key}
                href={`/projects/${params.id}/${tab.key}`}
                label={tab.label}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="page-container flex-1">
        {children}
      </div>
    </div>
  )
}
