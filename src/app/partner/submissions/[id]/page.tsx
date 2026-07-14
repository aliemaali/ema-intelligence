import Link from 'next/link'
import { ArrowLeft, FileText, MapPin, PencilLine, LockKeyhole } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { PartnerReviewResponseForm } from '@/components/partner/PartnerReviewResponseForm'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Projektstatus' }

const EDITABLE_STATUSES = new Set(['eingereicht', 'in_pruefung', 'rueckfrage'])

export default async function PartnerSubmissionDetailPage({ params }: { params: { id: string } }) {
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

  const { data: documents } = await supabase
    .from('submission_documents')
    .select('id, display_name, document_type, created_at')
    .eq('submission_id', submission.id)
    .eq('partner_user_id', user.id)
    .order('created_at', { ascending: false })

  const editable = EDITABLE_STATUSES.has(submission.status)

  return (
    <main className="min-h-screen bg-white text-[#1F2A44]">
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="flex items-center justify-between gap-4 py-3">
          <Link href="/partner" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold shadow-sm"><ArrowLeft className="h-4 w-4" /> Zurück</Link>
          <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-11 w-auto rounded-xl object-contain" />
        </header>

        <section className="mt-6 rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">Projektstatus</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">{submission.project_name}</h1></div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold">{String(submission.status).replace('_', ' ')}</span>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#2F8A00]" /> {[submission.location_city, submission.location_state].filter(Boolean).join(', ')}</p>
            <p className="font-semibold">{submission.remuneration_model ? `${submission.remuneration_model} · ${Number(submission.remuneration_ct_kwh).toLocaleString('de-DE')} ct/kWh` : 'Vergütung offen'}</p>
          </div>
          {editable ? (
            <Link href={`/partner/submissions/${submission.id}/edit`} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 font-extrabold text-white shadow-sm"><PencilLine className="h-5 w-5" /> Projekt bearbeiten / Unterlagen nachreichen</Link>
          ) : (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" /><p>Dieses Projekt ist abgeschlossen und kann nicht mehr selbstständig geändert werden.</p></div>
          )}
        </section>

        {submission.review_note && (
          <section className="mt-5 rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 sm:p-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Rückfrage von EMA</p>
            <p className="mt-3 whitespace-pre-wrap text-base font-semibold leading-relaxed text-[#1F2A44]">{submission.review_note}</p>
          </section>
        )}

        <section className="mt-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-[#2F8A00]" /><h2 className="text-xl font-extrabold">Unterlagen</h2></div>
          <div className="mt-4 space-y-2">
            {(documents ?? []).length === 0 ? <p className="text-sm text-slate-500">Noch keine Unterlagen vorhanden.</p> : (documents ?? []).map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"><span className="truncate text-sm font-bold">{document.display_name}</span><span className="text-xs font-semibold uppercase text-slate-400">{document.document_type}</span></div>
            ))}
          </div>
        </section>

        {submission.status === 'rueckfrage' && <div className="mt-5"><PartnerReviewResponseForm submissionId={submission.id} userId={user.id} /></div>}

        {submission.partner_response && submission.status !== 'rueckfrage' && (
          <section className="mt-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">Deine letzte Antwort</p><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{submission.partner_response}</p></section>
        )}
      </div>
    </main>
  )
}
