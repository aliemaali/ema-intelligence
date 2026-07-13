import Link from 'next/link'
import { ArrowRight, FileText, MapPin } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const STATUS_LABELS: Record<string, string> = {
  eingereicht: 'Eingereicht',
  in_pruefung: 'In Prüfung',
  rueckfrage: 'Rückfrage',
  angenommen: 'Angenommen',
  abgelehnt: 'Abgelehnt',
}

export const metadata = { title: 'Partner-Einreichungen' }

export default async function PartnerSubmissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: submissions, error } = await supabase
    .from('project_submissions')
    .select('id, project_name, project_type, location_city, location_state, status, remuneration_model, remuneration_ct_kwh, submitted_at, profiles!project_submissions_partner_user_id_fkey(full_name, company), submission_documents(count)')
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#2F8A00]">EMA Partner Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#07142F]">Partner-Einreichungen</h1>
        <p className="mt-2 text-sm text-muted-foreground">Neue Projekte prüfen, Unterlagen ansehen und den Bearbeitungsstatus festlegen.</p>
      </div>

      <div className="space-y-3">
        {submissions?.length === 0 && (
          <div className="rounded-[1.75rem] border border-border bg-white p-8 text-center text-sm text-muted-foreground">Noch keine Partner-Einreichungen vorhanden.</div>
        )}

        {submissions?.map((submission: any) => {
          const partner = submission.profiles
          const documentCount = submission.submission_documents?.[0]?.count ?? 0
          return (
            <Link key={submission.id} href={`/partner-submissions/${submission.id}`} className="premium-lift block rounded-[1.6rem] border border-border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-extrabold text-[#07142F]">{submission.project_name}</h2>
                    <span className="rounded-full bg-[#5CB800]/10 px-2.5 py-1 text-xs font-extrabold text-[#2F8A00]">{STATUS_LABELS[submission.status] ?? submission.status}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{partner?.company || partner?.full_name || 'Vertriebspartner'}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {[submission.location_city, submission.location_state].filter(Boolean).join(', ')}</span>
                    <span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4" /> {documentCount} Unterlagen</span>
                    {submission.remuneration_model && <span>{String(submission.remuneration_model).replace('_', ' ')} · {submission.remuneration_ct_kwh ?? '–'} ct/kWh</span>}
                  </div>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[#2F8A00]" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
