import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActivityLog } from '@/lib/actions/project.actions'
import { ActivityFeed, AddActivityNote } from '@/components/projects/ActivityFeed'

interface ActivityTabProps {
  params: Promise<{ id: string }>
}

export default async function ActivityTab(props: ActivityTabProps) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const log = await getActivityLog(params.id)

  return (
    <div className="py-4 space-y-5 max-w-2xl">
      <AddActivityNote projectId={params.id} />
      <ActivityFeed entries={log} />
    </div>
  )
}
