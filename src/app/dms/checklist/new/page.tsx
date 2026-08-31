import { redirect } from 'next/navigation'
import { DocumentGeneratorPage } from '@/components/templates/DocumentGeneratorPage'
import { ProjectChecklistGenerator } from '@/components/templates/ProjectChecklistGenerator'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Projekt-Checkliste erstellen · EMA DMS' }
export const dynamic = 'force-dynamic'

export default async function NewChecklistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/dms/checklist/new')

  return (
    <DocumentGeneratorPage title="Projekt-Checkliste" description="PV- oder BESS-Checkliste als ausfüllbare PDF erstellen.">
      <ProjectChecklistGenerator />
    </DocumentGeneratorPage>
  )
}
