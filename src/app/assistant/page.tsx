import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssistantWorkspace } from '@/components/assistant/AssistantWorkspace'
import { PushControls } from '@/components/assistant/PushControls'

export const dynamic = 'force-dynamic'

export default async function AssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/assistant')
  const [{ data: memories }, { data: reminders }] = await Promise.all([
    supabase.from('ema_memories').select('id,title,content,created_at,updated_at').order('updated_at', { ascending: false }),
    supabase.from('ema_reminders').select('id,title,notes,due_at,completed_at,push_sent_at').order('due_at', { ascending: true }),
  ])
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 pb-28 pt-[calc(env(safe-area-inset-top)+1.25rem)] md:p-8">
      <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-[#07142F] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <ArrowLeft className="h-5 w-5 shrink-0" />
        <span>Zurück zum Dashboard</span>
      </Link>
      <AssistantWorkspace initialMemories={memories ?? []} initialReminders={reminders ?? []} />
      <PushControls />
    </main>
  )
}
