import { getProjects } from '@/lib/actions/project.actions'
import { EmaCalendar } from '@/components/calendar/EmaCalendar'

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

  return <EmaCalendar projects={options} />
}
