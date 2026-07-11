import { getProjects } from '@/lib/actions/project.actions'
import { EmaCalendar } from '@/components/calendar/EmaCalendar'
import { TopHeader } from '@/components/layout/TopHeader'

export const metadata = {
  title: 'Kalender',
  description: 'Monatskalender für EMA Intelligence',
}

export default async function CalendarPage() {
  const projects = await getProjects()
  const options = projects.map((project: any) => ({
    id: String(project.id),
    name: project.project_number
      ? `${project.project_number} – ${project.project_name}`
      : project.project_name ?? 'Unbenanntes Projekt',
  }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f9fc] via-white to-[#f4f8f1]">
      <TopHeader />
      <EmaCalendar projects={options} />
    </div>
  )
}
