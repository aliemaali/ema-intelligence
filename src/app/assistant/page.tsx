import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssistantWorkspace } from '@/components/assistant/AssistantWorkspace'

export const dynamic = 'force-dynamic'

export default async function AssistantPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/assistant')

  const [{ data: memories }, { data: reminders }] = await Promise.all([
    supabase.from('ema_memories').select('id,title,content,created_at,updated_at').order('updated_at', { ascending: false }),
    supabase.from('ema_reminders').select('id,title,notes,due_at,completed_at,push_sent_at').order('due_at', { ascending: true }),
  ])

  return <AssistantWorkspace initialMemories={memories ?? []} initialReminders={reminders ?? []} />
}
