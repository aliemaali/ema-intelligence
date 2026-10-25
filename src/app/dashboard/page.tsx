import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IntelligenceCenter } from '@/components/control/IntelligenceCenter'

export const metadata = { title: 'Deine Zentrale' }
export const dynamic = 'force-dynamic'
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [profile, tasks, reminders, drafts, projects] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('plaud_items').select('id,title,due_at,kind').eq('user_id', user.id).eq('status','open').order('due_at', {ascending:true,nullsFirst:false}).limit(20),
    supabase.from('ema_reminders').select('id,title,due_at').eq('user_id',user.id).is('completed_at',null).order('due_at',{ascending:true}).limit(20),
    supabase.from('ai_outputs').select('id,project_id,created_at').eq('user_id',user.id).eq('output_type','expose_wizard_v1').eq('status','draft').order('created_at',{ascending:false}).limit(100),
    supabase.from('projects').select('id,project_name,location_city,project_type').eq('user_id',user.id).eq('is_archived',false).order('project_name').limit(100),
  ])
  const name = String(profile.data?.full_name || user.user_metadata?.full_name || 'Ali').split(/\s+/)[0]
  const openItems = [...(tasks.data || []).map(item => ({id:String(item.id),title:String(item.title),dueAt:item.due_at as string|null,kind:String(item.kind)})),...(reminders.data || []).map(item => ({id:String(item.id),title:String(item.title),dueAt:item.due_at as string|null,kind:'reminder'}))]
  const draftProjects = Array.from(new Set((drafts.data || []).map(item => String(item.project_id)))).filter(id => (projects.data || []).some(project => project.id === id))
  return <IntelligenceCenter firstName={name} items={openItems} draftProjects={draftProjects} projects={(projects.data || []).map(project => ({id:String(project.id),name:String(project.project_name),incomplete:!project.location_city}))} dataWarning={Boolean(tasks.error || reminders.error || drafts.error || projects.error)} />
}
