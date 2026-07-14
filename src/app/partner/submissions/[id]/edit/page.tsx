import Link from 'next/link'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { PartnerSubmissionEditForm } from '@/components/partner/PartnerSubmissionEditForm'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Projekt bearbeiten' }

const EDITABLE_STATUSES = new Set(['eingereicht', 'in_pruefung', 'rueckfrage'])

export default async function EditPartnerSubmissionPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: submission } = await supabase
    .from('project_submissions')
    .select('*')
    .eq('id', params.id)
    .eq('partner_user_id', user.id)
    .maybeSingle()

  if (!submission) notFound()

  const { count } = await supabase
    .from('submission_documents')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submission.id)
    .eq('partner_user_id', user.id)

  const editable = EDITABLE_STATUSES.has(submission.status)

  return (
    <main className="min-h-screen bg-white text-[#1F2A44]">
      <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="flex items-center justify-between gap-4 py-3">
          <Link href={`/partner/submissions/${submission.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold shadow-sm"><ArrowLeft className="h-4 w-4" /> Zurück</Link>
          <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-11 w-auto rounded-xl object-contain" />
        </header>

        <section className="py-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">Projekt aktualisieren</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.04em]">{submission.project_name}</h1>
          <p className="mt-3 text-slate-600">Projektdaten korrigieren, Angaben ergänzen oder weitere Unterlagen nachreichen.</p>
        </section>

        {editable ? (
          <PartnerSubmissionEditForm submission={submission} existingDocumentCount={count ?? 0} />
        ) : (
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-6 w-6 text-slate-500" /><div><h2 className="text-xl font-extrabold">Bearbeitung gesperrt</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">Angenommene oder abgelehnte Projekte können nicht mehr selbstständig geändert werden. Bitte wenden Sie sich bei Änderungsbedarf an EMA Enterprise.</p></div></div>
          </section>
        )}
      </div>
    </main>
  )
}
