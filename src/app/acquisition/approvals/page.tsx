import Link from 'next/link'
import { ArrowLeft, Check, MailCheck, Send, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { approveAcquisitionEmail, rejectAcquisitionEmail } from '@/lib/actions/acquisition.actions'
import { sendApprovedAcquisitionEmail } from '@/lib/actions/outlook.actions'

export const dynamic = 'force-dynamic'

type ApprovalEmail = {
  id: string
  recipient_email: string
  subject: string
  body: string
  status: string
  error_message: string | null
  sent_at: string | null
  created_at: string
  acquisition_leads: { company_name: string; contact_name: string | null } | null
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  ready_for_approval: 'Wartet auf Freigabe',
  approved: 'Freigegeben',
  sending: 'Wird gesendet',
  sent: 'Gesendet',
  failed: 'Versand fehlgeschlagen',
}

export default async function AcquisitionApprovalsPage({
  searchParams,
}: {
  searchParams: { created?: string; bulk?: string; sent?: string; error?: string }
}) {
  const supabase = await createClient()
  const db = supabase as any
  const outlookConfigured = Boolean(
    process.env.MICROSOFT_TENANT_ID &&
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.OUTLOOK_SENDER_EMAIL
  )

  const { data, error } = await db
    .from('acquisition_emails')
    .select('id, recipient_email, subject, body, status, error_message, sent_at, created_at, acquisition_leads(company_name, contact_name)')
    .in('status', ['draft', 'ready_for_approval', 'approved', 'sending', 'sent', 'failed'])
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

        <div className={`rounded-2xl border p-4 text-sm ${outlookConfigured ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {outlookConfigured
            ? `Outlook-Versand ist serverseitig aktiviert. Absender: ${process.env.OUTLOOK_SENDER_EMAIL}`
            : 'Outlook ist noch nicht aktiviert. Der Versand bleibt gesperrt, bis die Microsoft-Zugangsdaten in Vercel hinterlegt sind.'}
        </div>

        {searchParams.sent && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Die E-Mail wurde erfolgreich über Outlook versendet.</div>}
        {searchParams.error === 'outlook_config' && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Outlook ist noch nicht vollständig konfiguriert.</div>}
        {searchParams.error === 'send' && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Der Outlook-Versand ist fehlgeschlagen. Die genaue Meldung steht beim Entwurf.</div>}
        {searchParams.error === 'status' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Diese E-Mail ist nicht freigegeben oder wird bereits verarbeitet.</div>}

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
                    {STATUS_LABELS[email.status] || email.status}
                  </span>
                </div>
                <div className="whitespace-pre-wrap px-5 py-5 text-sm leading-7 text-slate-700">{email.body}</div>
                {email.error_message && <div className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">{email.error_message}</div>}
                {email.sent_at && <p className="px-5 pb-4 text-xs text-slate-400">Gesendet am {new Date(email.sent_at).toLocaleString('de-DE')}</p>}
                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
                  {!['approved', 'sending', 'sent', 'failed'].includes(email.status) && (
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

                  {['approved', 'failed'].includes(email.status) && (
                    <form action={sendApprovedAcquisitionEmail}>
                      <input type="hidden" name="email_id" value={email.id} />
                      <button
                        disabled={!outlookConfigured}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#132060] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send className="h-4 w-4" /> {email.status === 'failed' ? 'Erneut senden' : 'Über Outlook senden'}
                      </button>
                    </form>
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
