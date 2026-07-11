import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/actions/project.actions'
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/ui'
import { ProjectActions } from '@/components/projects/ProjectActions'
import { TabLinkClient } from '@/components/projects/TabLink'

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
    <div className="flex flex-col min-h-full">

      {/* ── Project Header ──────────────────────────────────────── */}
      <div className="border-b border-border bg-card">
        <div className="page-container pb-0">

          {/* Back + Actions row */}
          <div className="flex items-center justify-between mb-3">
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Projekte</span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${params.id}/edit`}
                className="btn-secondary btn-sm gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bearbeiten</span>
              </Link>
              <ProjectActions
                projectId={params.id}
                projectName={project.project_name}
              />
            </div>
          </div>

          {/* Project meta */}
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-xs text-muted-foreground">
                {project.project_number}
              </span>
              <TypeBadge   type={project.project_type} />
              <StatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            <h1 className="text-lg font-semibold text-foreground leading-tight">
              {project.project_name}
            </h1>
            {(project.location_city || project.location_state) && (
              <p className="text-sm text-muted-foreground mt-0.5">
                📍 {[project.location_city, project.location_state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {/* Tab Bar */}
          <div className="flex gap-0 overflow-x-auto no-scrollbar -mb-px">
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

      {/* Tab Content */}
      <div className="flex-1 page-container">
        {children}
      </div>
    </div>
  )
}
