import { getProjects } from '@/lib/actions/project.actions'
import { EmaCalendar } from '@/components/calendar/EmaCalendar'
import { TopHeader } from '@/components/layout/TopHeader'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Kalender',
  description: 'Monatskalender für EMA Intelligence',
}

export default async function CalendarPage() {
  const supabase = await createClient()
  const [{ data:{ user } },projects] = await Promise.all([supabase.auth.getUser(),getProjects()])
  const { data:plaudAppointments } = user ? await supabase.from('plaud_items').select('id,title,due_at').eq('team_shared',true).eq('kind','appointment').eq('status','open').not('due_at','is',null).order('due_at',{ ascending:true }) : { data:[] }
  const options = projects.map((project: any) => ({
    id: String(project.id),
    name: project.project_number
      ? `${project.project_number} – ${project.project_name}`
      : project.project_name ?? 'Unbenanntes Projekt',
  }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f9fc] via-white to-[#f4f8f1]">
      <TopHeader />
      <EmaCalendar projects={options} plaudAppointments={(plaudAppointments ?? []) as Array<{id:string;title:string;due_at:string}>} />
    </div>
  )
}
