import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bot, Database, FileArchive, Files } from 'lucide-react'
import { DmsWorkspace } from '@/components/dms/DmsWorkspace'
import { NdaGeneratorCard } from '@/components/templates/NdaGeneratorCard'
import { AdditionalDocumentGenerators } from '@/components/templates/AdditionalDocumentGenerators'
import { createClient } from '@/lib/supabase/server'
import type { DmsDataRoom, DmsDocument, DmsFolder, DmsProjectOption } from '@/lib/dms/types'
import type { DocumentInvestor } from '@/lib/templates/documentTypes'

export const metadata = { title: 'EMA DMS' }
export const dynamic = 'force-dynamic'

export default async function DmsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/dms')

  const [documentsResult, foldersResult, dataRoomsResult, projectsResult, investorsResult] = await Promise.all([
    (supabase as any).from('documents').select('id, project_id, user_id, document_type, display_name, file_name, file_path, file_size_bytes, mime_type, storage_bucket, source_app, source_kind, source_record_id, sha256, folder_id, is_data_room_archive, ai_analyzed, analysis_status, is_archived, created_at').eq('user_id', user.id).eq('is_archived', false).order('created_at', { ascending: false }),
    (supabase as any).from('document_folders').select('id, name, parent_id').eq('user_id', user.id).order('name'),
    (supabase as any).from('dms_data_rooms').select('id, project_id, archive_document_id, name, project_profile, status, file_count, total_uncompressed_bytes, error_message, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, project_name, project_number, project_type').eq('user_id', user.id).eq('is_archived', false).order('project_name'),
    supabase.from('investors').select('id, full_name, contact_person, company, company_name, email, phone, street_address, postal_code, location_city, location_country, country, status, is_active').eq('user_id', user.id).neq('status', 'Inaktiv').order('company_name'),
  ])

  const documents = (documentsResult.data ?? []) as DmsDocument[]
  const dataRooms = (dataRoomsResult.data ?? []) as DmsDataRoom[]
  const projects: DmsProjectOption[] = (projectsResult.data ?? []).map((project: any) => ({
    id: project.id,
    label: project.project_name || project.project_number || 'Projekt',
    projectType: project.project_type || 'sonstiges',
  }))
  const documentInvestors: DocumentInvestor[] = (investorsResult.data ?? []).filter((investor: any) => investor.is_active !== false).map((investor: any) => ({
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
    <main className="dms-premium min-h-screen px-3 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-7 md:py-7">
      <div className="mx-auto max-w-[1380px]">
        <header className="dms-hero mb-5 overflow-hidden rounded-[2rem] border border-white/10 bg-[#06162f] p-5 text-white shadow-[0_25px_70px_rgba(1,10,27,.26)] md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <Link href="/apps" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[.06] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_32px_rgba(92,184,0,.12)]" aria-label="EMA Startzentrale öffnen"><Image src="/brand/ema-mark-white.png" alt="EMA" width={506} height={247} className="h-auto w-full" /></Link>
              <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#8eee51]">EMA Enterprise · Single Source of Truth</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-.04em] md:text-5xl">EMA DMS</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">Die gemeinsame Dokumentenquelle für EMA Intelligence und EMA Office – inklusive Datenraum und KI-gestützter Due Diligence.</p></div>
            </div>
            <Link href="/ema" className="flex min-h-12 items-center gap-2 rounded-2xl border border-blue-300/15 bg-white/[.06] px-4 text-sm font-extrabold text-white"><Bot className="h-5 w-5 text-[#8eee51]" /> EMA AI öffnen</Link>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2 md:max-w-2xl md:gap-3">
            <div className="dms-stat-tile rounded-2xl border border-white/10 bg-white/[.045] p-3"><Files className="h-4 w-4 text-[#8eee51]" /><strong className="mt-2 block text-xl md:text-2xl">{documents.length}</strong><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Dokumente</span></div>
            <div className="dms-stat-tile rounded-2xl border border-white/10 bg-white/[.045] p-3"><FileArchive className="h-4 w-4 text-[#8eee51]" /><strong className="mt-2 block text-xl md:text-2xl">{dataRooms.length}</strong><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Datenräume</span></div>
            <div className="dms-stat-tile rounded-2xl border border-white/10 bg-white/[.045] p-3"><Database className="h-4 w-4 text-[#8eee51]" /><strong className="mt-2 block text-xl md:text-2xl">1</strong><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Zentrale</span></div>
          </div>
        </header>

        <section className="dms-section mb-5 rounded-[1.7rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5"><p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8eee51]">Dokumente erstellen</p><div className="flex flex-wrap gap-3"><NdaGeneratorCard /><AdditionalDocumentGenerators userId={user.id} folders={(foldersResult.data ?? []) as any} investors={documentInvestors} /></div></section>
        <DmsWorkspace userId={user.id} documents={documents} folders={(foldersResult.data ?? []) as DmsFolder[]} dataRooms={dataRooms} projects={projects} />
      </div>
    </main>
  )
}
