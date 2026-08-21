import { redirect } from 'next/navigation'
import { CalendarDays, CheckSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PlaudTaskList, type PlaudTaskItem, type PlaudTaskView } from '@/components/tasks/PlaudTaskList'

export const metadata = { title:'Aufgaben' }

export default async function TasksPage({ searchParams }:{ searchParams?:{ view?:string } }) {
  const view:PlaudTaskView = searchParams?.view === 'appointments' ? 'appointments' : searchParams?.view === 'tasks' ? 'tasks' : 'all'
  const supabase = await createClient()
  const { data:{ user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  let query = supabase.from('plaud_items').select('id,user_id,kind,title,detail,due_at,status').eq('team_shared',true).in('status',['open','completed'])
  if (view === 'appointments') query = query.eq('kind','appointment')
  if (view === 'tasks') query = query.eq('kind','task')
  const { data,error } = await query.order('due_at',{ ascending:true,nullsFirst:false })
  const items = (data ?? []).map((item) => ({ ...item, can_delete:item.user_id === user.id }))
  const title = view === 'appointments' ? 'Termine' : view === 'tasks' ? 'Aufgaben' : 'Aufgaben und Termine'
  const description = view === 'appointments' ? 'Geteilte PLAUD-Termine von Ali und Tuba. Erledigt wird synchronisiert; löschen kann nur der Ersteller.' : view === 'tasks' ? 'Geteilte PLAUD-Aufgaben von Ali und Tuba. Erledigt wird synchronisiert; löschen kann nur der Ersteller.' : 'Geteilte PLAUD-Aufgaben und Termine von Ali und Tuba – synchronisiert und mit privatem Ersteller-Löschrecht.'
  const HeaderIcon = view === 'appointments' ? CalendarDays : CheckSquare
  return <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:px-0 md:py-8"><header className="rounded-[2rem] bg-[#1F2A44] p-6 text-white"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><HeaderIcon className="text-[#76d22a]" /></span><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#76d22a]">EMA Intelligence</p><h1 className="text-3xl font-extrabold">{title}</h1></div></div><p className="mt-4 text-white/75">{description}</p></header>{error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{title} konnten nicht geladen werden.</div> : <PlaudTaskList key={view} initialItems={items as PlaudTaskItem[]} view={view} />}</div>
}
