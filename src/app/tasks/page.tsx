import { redirect } from 'next/navigation'
import { CheckSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PlaudTaskList, type PlaudTaskItem } from '@/components/tasks/PlaudTaskList'

export const metadata = { title:'Aufgaben' }

export default async function TasksPage() {
  const supabase = await createClient()
  const { data:{ user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data,error } = await supabase.from('plaud_items').select('id,kind,title,detail,due_at,status').eq('user_id',user.id).in('status',['open','completed']).order('due_at',{ ascending:true,nullsFirst:false })
  return <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:px-0 md:py-8"><header className="rounded-[2rem] bg-[#1F2A44] p-6 text-white"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><CheckSquare className="text-[#76d22a]" /></span><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#76d22a]">EMA Intelligence</p><h1 className="text-3xl font-extrabold">Aufgaben</h1></div></div><p className="mt-4 text-white/75">Übernommene PLAUD-Aufgaben und Termine zentral erledigen und löschen.</p></header>{error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">Aufgaben konnten nicht geladen werden.</div> : <PlaudTaskList initialItems={(data ?? []) as PlaudTaskItem[]} />}</div>
}
