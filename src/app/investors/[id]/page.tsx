import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ContactDocuments } from '@/components/crm/ContactDocuments'

export default async function InvestorDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: investor } = await supabase
    .from('investors')
    .select('id, company_name, contact_person, email, phone, focus, status, notes')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!investor) notFound()

  return (
    <div className="page-container max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/investors" className="btn-icon"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="page-title">Investorenakte</h1>
          <p className="mt-1 text-sm text-muted-foreground">{investor.company_name} · {investor.contact_person}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p><span className="font-bold text-[#1F2A44]">E-Mail:</span> {investor.email || '–'}</p>
          <p><span className="font-bold text-[#1F2A44]">Telefon:</span> {investor.phone || '–'}</p>
          <p><span className="font-bold text-[#1F2A44]">Fokus:</span> {investor.focus || '–'}</p>
          <p><span className="font-bold text-[#1F2A44]">Status:</span> {investor.status || '–'}</p>
        </div>
        {investor.notes && <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">{investor.notes}</p>}
        <p className="mt-4 text-xs text-slate-500">Kontaktdaten können weiterhin über „Bearbeiten“ in der Investorenübersicht geändert werden.</p>
      </section>

      <ContactDocuments
        entityType="investor"
        entityId={investor.id}
        documentTypes={['NDA', 'Provisionsvereinbarung', 'Vermittlungsvereinbarung', 'Sonstiges']}
      />
    </div>
  )
}
