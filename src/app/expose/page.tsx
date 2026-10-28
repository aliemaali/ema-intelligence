import { getProjects } from '@/lib/actions/project.actions'
import { ExposeWizard } from '@/components/expose/ExposeWizard'
import { ControlHero } from '@/components/control/ControlHero'
import { exposeKind } from '@/lib/expose/wizard'

export const metadata = { title: 'EMA Exposé' }
export default async function ExposePage() {
  const projects = await getProjects()
  const options = projects.filter(project => exposeKind(project.project_type)).map(project => ({
    id: String(project.id), name: String(project.project_name), number: String(project.project_number || ''),
    type: String(project.project_type), location: [project.location_city, project.location_country].filter(Boolean).join(', '),
  }))
  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-4 py-6 pb-28">
    <ControlHero area="expose" title="Dein Projekt. Klar präsentiert." subtitle="BESS, PV und Data Center. In fünf Schritten zu deinem Exposé." />
    <ExposeWizard projects={options} />
  </main>
}
