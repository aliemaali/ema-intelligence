import Link from 'next/link'
import { Archive, ArrowRight, FileText, MapPin } from 'lucide-react'
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

  const [{ data: submissions, error }, { count: archiveCount }] = await Promise.all([
    supabase
      .from('project_submissions')
      .select('id, project_name, project_type, location_city, location_state, status, remuneration_model, remuneration_ct_kwh, submitted_at, profiles!project_submissions_partner_user_id_fkey(full_name, company), submission_documents(count)')
      .neq('status', 'archiviert')
      .order('submitted_at', { ascending: false }),
    supabase.from('project_submissions').select('id', { count: 'exact', head: true }).eq('status', 'archiviert'),
  ])

  if (error) throw new Error(error.message)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-3 pb-28 pt-6 md:px-0 md:pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#2F8A00]">Partnerportal</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#07142F]">Einreichungen</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Neue Projekte prüfen, Unterlagen ansehen und über die weitere Bearbeitung entscheiden.</p>
        </div>
        <Link href="/partner-submissions/archive" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#1F2A44] shadow-sm">
          <Archive className="h-4 w-4" /> Archiv {archiveCount ? `(${archiveCount})` : ''}
        </Link>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-bold text-slate-600">Aktive Einreichungen</span>
        <span className="rounded-full bg-[#5CB800]/10 px-3 py-1 text-sm font-extrabold text-[#2F8A00]">{submissions?.length ?? 0}</span>
      </div>

      <div className="space-y-3">
        {submissions?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-7 text-center text-sm text-muted-foreground">Aktuell liegen keine neuen Partner-Einreichungen vor.</div>
        )}

        {submissions?.map((submission: any) => {
          const partner = submission.profiles
          const documentCount = submission.submission_documents?.[0]?.count ?? 0
          const location = [submission.location_city, submission.location_state].filter(Boolean).join(', ') || 'Standort offen'
          return (
            <Link key={submission.id} href={`/partner-submissions/${submission.id}`} className="premium-lift block rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-extrabold text-[#07142F]">{submission.project_name}</h2>
                    <span className="rounded-full bg-[#5CB800]/10 px-2.5 py-1 text-xs font-extrabold text-[#2F8A00]">{STATUS_LABELS[submission.status] ?? submission.status}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-600">{partner?.company || partner?.full_name || 'Vertriebspartner'}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#5CB800]" /> {location}</span>
                    <span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4 text-[#5CB800]" /> {documentCount} Unterlage{documentCount === 1 ? '' : 'n'}</span>
                  </div>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]"><ArrowRight className="h-5 w-5" /></span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
