import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/actions/project.actions'
import { DataCenterSiteCheckEditor } from '@/components/projects/DataCenterSiteCheckEditor'

interface SiteCheckPageProps { params: { id: string } }

export default async function SiteCheckPage({ params }: SiteCheckPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let project: any
  try { project = await getProject(params.id) } catch { notFound() }
  if (!project || project.project_type !== 'rechenzentrum') notFound()

  return <div className="max-w-3xl py-4"><DataCenterSiteCheckEditor projectId={project.id} project={project} /></div>
}
