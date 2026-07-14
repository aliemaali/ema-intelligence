import Link from 'next/link'
import { ArrowLeft, ArrowRight, Archive, FileText, MapPin } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Archivierte Partner-Einreichungen' }

export default async function PartnerSubmissionArchivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: submissions, error } = await supabase
    .from('project_submissions')
    .select('id, project_name, project_type, location_city, location_state, status, submitted_at, profiles!project_submissions_partner_user_id_fkey(full_name, company), submission_documents(count)')
    .eq('status', 'archiviert')
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2 sm:pt-4">
      <Link href="/partner-submissions" className="inline-flex min-h-10 items-center gap-2 text-sm font-extrabold text-[#2F8A00]"><ArrowLeft className="h-4 w-4" /> Zurück zu Einreichungen</Link>

      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#2F8A00]">EMA Partner Portal</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-[#07142F]"><Archive className="h-7 w-7" /> Archiv</h1>
        <p className="mt-2 text-sm text-muted-foreground">Archivierte Projekte bleiben vollständig erhalten und können jederzeit wieder aktiviert werden.</p>
      </div>

      <div className="space-y-3">
        {submissions?.length === 0 && <div className="rounded-[1.75rem] border border-border bg-white p-8 text-center text-sm text-muted-foreground">Das Archiv ist leer.</div>}
        {submissions?.map((submission: any) => {
          const partner = submission.profiles
          const documentCount = submission.submission_documents?.[0]?.count ?? 0
          return (
            <Link key={submission.id} href={`/partner-submissions/${submission.id}`} className="premium-lift block rounded-[1.6rem] border border-border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-extrabold text-[#07142F]">{submission.project_name}</h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">Archiviert</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{partner?.company || partner?.full_name || 'Vertriebspartner'}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {[submission.location_city, submission.location_state].filter(Boolean).join(', ')}</span>
                    <span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4" /> {documentCount} Unterlagen</span>
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
