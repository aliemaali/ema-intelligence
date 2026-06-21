import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLatestExpose } from '@/lib/actions/expose.actions'
import { ExposeClient } from '@/components/expose/ExposeClient'

interface ExposePageProps {
  params: { id: string }
}

export const metadata = { title: 'Exposé' }

export default async function ExposePage({ params }: ExposePageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Prüfen, ob das Projekt existiert und dem User gehört
  const { data: project, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !project) notFound()

  const latestExpose = await getLatestExpose(params.id)

  return (
    <div className="py-4 max-w-3xl">
      <ExposeClient projectId={params.id} initialExpose={latestExpose} />
    </div>
  )
}
