import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/actions/project.actions'
import { ProjectForm } from '@/components/projects/ProjectForm'

export const metadata = { title: 'Projekt bearbeiten' }

interface EditPageProps {
  params: { id: string }
}

export default async function EditProjectPage({ params }: EditPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let project
  try {
    project = await getProject(params.id)
  } catch {
    notFound()
  }
  if (!project) notFound()

  const { data: partners } = await supabase
    .from('partners')
    .select('id, full_name, company, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('full_name')

  return (
    <div className="page-container max-w-xl">

      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/projects/${params.id}/overview`}
          className="btn-icon text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="page-title">Projekt bearbeiten</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {(project as any).project_number}
          </p>
        </div>
      </div>

      <ProjectForm
        mode="edit"
        project={project as never}
        partners={(partners ?? []) as any}
      />
    </div>
  )
}
