import { getProjects } from '@/lib/actions/project.actions'
import { MicrosoftHub } from '@/components/microsoft/MicrosoftHub'

export const metadata = {
  title: 'Microsoft 365',
  description: 'Outlook-Kontakte, Kalender und Teams-Besprechungen in EMA Intelligence',
}

export default async function MicrosoftPage() {
  const projects = await getProjects({})
  const options = projects.map((project: any) => ({
    id: String(project.id),
    name: project.project_number
      ? `${project.project_number} – ${project.project_name}`
      : project.project_name || 'Unbenanntes Projekt',
  }))

  return <MicrosoftHub projects={options} />
}
