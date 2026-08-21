import Link from 'next/link'
import { ArrowLeft, FolderOpen } from 'lucide-react'
import { redirect } from 'next/navigation'
import { NdaGenerator } from '@/components/templates/NdaGenerator'
import { AdditionalDocumentGenerators } from '@/components/templates/AdditionalDocumentGenerators'
import { TemplateDocumentsClient } from '@/components/templates/TemplateDocumentsClient'
import { getDocumentFolders, getTemplateDocuments } from '@/lib/actions/template-document.actions'
import { createClient } from '@/lib/supabase/server'
import type { DocumentInvestor } from '@/lib/templates/documentTypes'

export const metadata = { title: 'Dokumente' }
export const dynamic = 'force-dynamic'

export default async function DokumentePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [documents, folders, assignmentsResult, partnersResult, investorsResult, projectsResult] = await Promise.all([
    getTemplateDocuments(),
    getDocumentFolders(),
    (supabase as any).from('document_assignments').select('document_id, entity_type, entity_id').eq('user_id', user.id),
    supabase.from('partners').select('id, full_name, company, category').eq('user_id', user.id).eq('is_active', true).order('company'),
    // Investor CRM records are protected by RLS. New CRM investors can be owned via
    // created_by rather than the legacy user_id column, so filtering by user_id here
    // hid newly created investors from the document generators.
    supabase.from('investors').select('id, full_name, contact_person, company, company_name, email, phone, street_address, postal_code, location_city, location_country, country, status, is_active').neq('status', 'Inaktiv').order('company_name'),
    supabase.from('projects').select('id, project_number, project_name, location_city').eq('user_id', user.id).eq('is_archived', false).order('project_name'),
  ])

  const activeInvestorRows = (investorsResult.data ?? []).filter((item: any) => item.is_active !== false)
  const partners = (partnersResult.data ?? []).map((item: any) => ({ id: item.id, label: item.company || item.full_name || 'Partner', subtitle: [item.full_name, item.category].filter(Boolean).join(' · ') }))
  const investors = activeInvestorRows.map((item: any) => ({ id: item.id, label: item.company_name || item.company || item.full_name || 'Investor', subtitle: item.contact_person || item.full_name || item.email }))
  const documentInvestors: DocumentInvestor[] = activeInvestorRows.map((item: any) => ({
    id: item.id,
    company: item.company_name || item.company || item.full_name || '',
    contactPerson: item.contact_person || item.full_name || '',
    email: item.email || '',
    phone: item.phone || '',
    street: item.street_address || '',
    postalCode: item.postal_code || '',
    city: item.location_city || '',
    country: item.location_country || item.country || '',
  }))
  const projects = (projectsResult.data ?? []).map((item: any) => ({ id: item.id, label: item.project_name || item.project_number || 'Projekt', subtitle: [item.project_number, item.location_city].filter(Boolean).join(' · ') }))

  return (
    <main className="min-h-screen bg-[#F5F7F9] px-3 pb-20 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-8 md:py-8">
      <style>{`
        @media (max-width: 767px) {
          .fixed.inset-0 .btn-icon { flex: 0 0 auto; position: sticky; top: 0; z-index: 2; background: white; }
          .fixed.inset-0 .flex.items-start.justify-between > div:first-child { min-width: 0; }
          .fixed.inset-0 .flex.items-start.justify-between h2 { overflow-wrap: anywhere; }
        }
      `}</style>
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#07142F] shadow-sm"><ArrowLeft className="h-4 w-4" /> Zurück</Link>
          <Link href="/dashboard"><img src="/brand/ema-logo.png" alt="EMA Enterprise" className="h-12 w-auto" /></Link>
        </div>
        <section className="mb-6 overflow-hidden rounded-[2rem] bg-[#0B1633] p-6 text-white shadow-[0_20px_55px_rgba(15,23,42,0.18)] md:p-8">
          <div className="flex items-start gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800] text-white"><FolderOpen className="h-7 w-7" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#8ED640]">EMA Dokumentenzentrale</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] md:text-4xl">Dokumente</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">Dokumente erstellen, öffnen, in eigenen Ordnern organisieren und Partnern, Investoren oder Projekten zuordnen.</p></div></div>
        </section>
        <NdaGenerator userId={user.id} investors={documentInvestors} />
        <AdditionalDocumentGenerators userId={user.id} folders={folders as any} investors={documentInvestors} />
        <TemplateDocumentsClient userId={user.id} documents={documents as any} folders={folders as any} assignments={(assignmentsResult.data ?? []) as any} partners={partners} investors={investors} projects={projects} />
      </div>
    </main>
  )
}
