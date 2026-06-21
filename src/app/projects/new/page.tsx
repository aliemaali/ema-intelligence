import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Neues Projekt' }

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch partners for the dropdown
  const { data: partners } = await supabase
    .from('partners')
    .select('id, full_name, company, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('full_name')

  return (
    <div className="page-container max-w-xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/projects"
          className="btn-icon text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="page-title">Neues Projekt</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Projektnummer wird automatisch vergeben
          </p>
        </div>
      </div>

      <ProjectForm
        mode="create"
        partners={(partners ?? []) as any}
      />
    </div>
  )
}
