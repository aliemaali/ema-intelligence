import Link from 'next/link'
import { ArrowLeft, FolderOpen } from 'lucide-react'
import { redirect } from 'next/navigation'
import { TemplateDocumentsClient } from '@/components/templates/TemplateDocumentsClient'
import { getTemplateDocuments } from '@/lib/actions/template-document.actions'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Musterformulare' }

export default async function MusterformularePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const documents = await getTemplateDocuments()

  return (
    <main className="min-h-screen bg-[#F5F7F9] px-3 pb-20 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-8 md:py-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#07142F] shadow-sm">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Link>
          <Link href="/dashboard"><img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-12 w-auto" /></Link>
        </div>

        <section className="mb-6 overflow-hidden rounded-[2rem] bg-[#0B1633] p-6 text-white shadow-[0_20px_55px_rgba(15,23,42,0.18)] md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800] text-white"><FolderOpen className="h-7 w-7" /></span>
            <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#8ED640]">EMA Vorlagenbibliothek</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] md:text-4xl">Musterformulare</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">Zentrale Ablage für NDA, Anfrageformulare, Vollmachten, Checklisten und weitere wiederverwendbare Dokumente.</p></div>
          </div>
        </section>

        <TemplateDocumentsClient userId={user.id} documents={documents as any} />
      </div>
    </main>
  )
}
