import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProjects } from '@/lib/actions/project.actions'
import { ExposeWizard } from '@/components/expose/ExposeWizard'
import { exposeKind } from '@/lib/expose/wizard'

export const metadata = { title: 'EMA Exposé' }
export default async function ExposePage() {
  const projects = await getProjects()
  const options = projects.filter(project => exposeKind(project.project_type)).map(project => ({
    id: String(project.id), name: String(project.project_name), number: String(project.project_number || ''),
    type: String(project.project_type), location: [project.location_city, project.location_country].filter(Boolean).join(', '),
  }))
  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-4 py-6 pb-28">
    <Link href="/apps" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-300"><ArrowLeft className="h-4 w-4" /> EMA Anwendungen</Link>
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-[#8bf04a]">EMA Exposé</p><h1 className="mt-2 text-3xl font-extrabold text-white">Dein Projekt. Klar präsentiert.</h1><p className="mt-2 text-sm text-slate-400">Projektdaten übernehmen, Inhalte prüfen und dein Exposé erstellen.</p></header>
    <ExposeWizard projects={options} />
  </main>
}
