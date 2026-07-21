import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PartnerDetailClient } from '@/components/crm/PartnerDetailClient'
import { ContactDocuments } from '@/components/crm/ContactDocuments'

export default async function PartnerDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: partner } = await supabase
    .from('partners')
    .select('id, company, full_name, email, phone, category, notes')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!partner) notFound()

  return (
    <div className="page-container max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/partners" className="btn-icon"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="page-title">Partner bearbeiten</h1>
          <p className="mt-1 text-sm text-muted-foreground">{partner.company || partner.full_name}</p>
        </div>
      </div>

      <PartnerDetailClient partner={partner as any} />
      <ContactDocuments
        entityType="partner"
        entityId={partner.id}
        documentTypes={['NDA', 'Provisionsvereinbarung', 'Kooperationsvereinbarung', 'Sonstiges']}
      />
    </div>
  )
}
