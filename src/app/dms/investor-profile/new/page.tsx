import { redirect } from 'next/navigation'
import { DocumentGeneratorPage } from '@/components/templates/DocumentGeneratorPage'
import { InvestorProfileGenerator } from '@/components/templates/InvestorProfileGenerator'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Investoren-Suchprofil erstellen · EMA DMS' }
export const dynamic = 'force-dynamic'

export default async function NewInvestorProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/dms/investor-profile/new')

  const { data } = await (supabase as any)
    .from('document_folders')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name')

  return (
    <DocumentGeneratorPage title="Investoren-Suchprofil" description="Zweisprachiges Suchprofil als PDF erstellen.">
      <InvestorProfileGenerator userId={user.id} folders={(data ?? []) as Array<{ id: string; name: string }>} />
    </DocumentGeneratorPage>
  )
}
