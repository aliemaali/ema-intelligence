import Link from 'next/link'
import { ArrowLeft, Check, MailCheck, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { approveAcquisitionEmail, rejectAcquisitionEmail } from '@/lib/actions/acquisition.actions'

export const dynamic = 'force-dynamic'

type ApprovalEmail = {
  id: string
  recipient_email: string
  subject: string
  body: string
  status: string
  created_at: string
  acquisition_leads: { company_name: string; contact_name: string | null } | null
}

export default async function AcquisitionApprovalsPage() {
  const supabase = await createClient()
  const db = supabase as any

  const { data, error } = await db
    .from('acquisition_emails')
    .select('id, recipient_email, subject, body, status, created_at, acquisition_leads(company_name, contact_name)')
    .in('status', ['draft', 'ready_for_approval', 'approved'])
    .order('created_at', { ascending: false })

  const emails = (data || []) as ApprovalEmail[]

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/acquisition" className="inline-flex items-center gap-2 text-sm font-semibold text-[#132060]">
            <ArrowLeft className="h-4 w-4" /> Zurück zur Akquise
          </Link>
          <div className="mt-5 flex items-start gap-3">
            <div className="rounded-xl bg-[#EEF2F7] p-3 text-[#132060]"><MailCheck className="h-6 w-6" /></div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#132060]">E-Mail-Freigaben</h1>
              <p className="mt-2 text-sm text-slate-500">Keine Erstkontakt-E-Mail wird ohne deine Freigabe versendet.</p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Das Akquise-Schema ist noch nicht in Supabase aktiviert.</div>
        ) : emails.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <MailCheck className="mx-auto h-8 w-8 text-slate-300" />
            <h2 className="mt-4 font-semibold text-[#132060]">Keine E-Mails zur Freigabe</h2>
            <p className="mt-2 text-sm text-slate-500">Sobald EMA Scout einen Entwurf erstellt, erscheint er hier.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {emails.map((email) => (
              <article key={email.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5CB800]">{email.acquisition_leads?.company_name || 'Lead'}</p>
                    <h2 className="mt-1 font-semibold text-[#132060]">{email.subject}</h2>
                    <p className="mt-1 text-xs text-slate-500">An: {email.recipient_email}</p>
                  </div>
                  <span className="self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 sm:self-auto">
                    {email.status === 'approved' ? 'Freigegeben' : 'Wartet auf Freigabe'}
                  </span>
                </div>
                <div className="whitespace-pre-wrap px-5 py-5 text-sm leading-7 text-slate-700">{email.body}</div>
                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
                  {email.status !== 'approved' && (
                    <>
                      <form action={rejectAcquisitionEmail}>
                        <input type="hidden" name="email_id" value={email.id} />
                        <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                          <X className="h-4 w-4" /> Ablehnen
                        </button>
                      </form>
                      <form action={approveAcquisitionEmail}>
                        <input type="hidden" name="email_id" value={email.id} />
                        <button className="inline-flex items-center gap-2 rounded-xl bg-[#5CB800] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95">
                          <Check className="h-4 w-4" /> Freigeben
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
