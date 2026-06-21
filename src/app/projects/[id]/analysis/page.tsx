import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLatestAnalysis } from '@/lib/actions/analysis.actions'
import { AnalysisClient } from '@/components/analysis/AnalysisClient'

interface AnalysisPageProps {
  params: { id: string }
}

export const metadata = { title: 'KI-Projektanalyse' }

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !project) notFound()

  const latestAnalysis = await getLatestAnalysis(params.id)

  return (
    <div className="py-4 max-w-2xl">
      <AnalysisClient projectId={params.id} initialAnalysis={latestAnalysis} />
    </div>
  )
}
