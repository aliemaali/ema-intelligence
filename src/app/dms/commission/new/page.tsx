import { redirect } from 'next/navigation'
import { CommissionGenerator } from '@/components/templates/CommissionGenerator'
import { DocumentGeneratorPage } from '@/components/templates/DocumentGeneratorPage'
import { createClient } from '@/lib/supabase/server'
import type { DocumentInvestor } from '@/lib/templates/documentTypes'

export const metadata = { title: 'Provisionsvereinbarung erstellen · EMA DMS' }
export const dynamic = 'force-dynamic'

export default async function NewCommissionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/dms/commission/new')

  const [foldersResult, investorsResult] = await Promise.all([
    (supabase as any).from('document_folders').select('id, name').eq('user_id', user.id).order('name'),
    supabase.from('investors').select('id, full_name, contact_person, company, company_name, email, phone, street_address, postal_code, location_city, location_country, country, status, is_active').eq('user_id', user.id).neq('status', 'Inaktiv').order('company_name'),
  ])

  const investors: DocumentInvestor[] = (investorsResult.data ?? [])
    .filter((investor: any) => investor.is_active !== false)
    .map((investor: any) => ({
      id: investor.id,
      company: investor.company_name || investor.company || investor.full_name || '',
      contactPerson: investor.contact_person || investor.full_name || '',
      email: investor.email || '',
      phone: investor.phone || '',
      street: investor.street_address || '',
      postalCode: investor.postal_code || '',
      city: investor.location_city || '',
      country: investor.location_country || investor.country || '',
    }))

  return (
    <DocumentGeneratorPage title="Provisionsvereinbarung" description="Deutsch und Englisch in einem gemeinsamen PDF.">
      <CommissionGenerator userId={user.id} folders={(foldersResult.data ?? []) as Array<{ id: string; name: string }>} investors={investors} />
    </DocumentGeneratorPage>
  )
}
