import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/actions/project.actions'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { VerifiedProjectValuesForm } from '@/components/projects/VerifiedProjectValuesForm'
import { RoofDevelopmentStatusFilter } from '@/components/projects/RoofDevelopmentStatusFilter'
import { CityStateAutoFill } from '@/components/projects/CityStateAutoFill'

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
    <div className="page-container max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/projects/${params.id}/overview`} className="btn-icon text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="page-title">Projekt bearbeiten</h1>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{(project as any).project_number}</p>
        </div>
      </div>

      <RoofDevelopmentStatusFilter projectType={(project as any).project_type} />
      <CityStateAutoFill />
      <ProjectForm mode="edit" project={project as never} partners={(partners ?? []) as any} />
      <VerifiedProjectValuesForm project={project as any} />
    </div>
  )
}
