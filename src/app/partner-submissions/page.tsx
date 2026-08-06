import Link from 'next/link'
import { Archive, ArrowRight, FileText, Handshake, MapPin, ShieldCheck } from 'lucide-react'
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
    <div className="mx-auto w-full max-w-[1480px] space-y-6 px-3 pb-28 pt-4 md:px-0 md:pt-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-[#111820] px-5 py-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.28)] md:px-8 md:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(92,184,0,0.16),transparent_24rem),linear-gradient(135deg,rgba(31,42,68,0.55),transparent_62%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#5CB800]/25 bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#8de13c]">
              <Handshake className="h-4 w-4" /> Partnerportal
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] md:text-6xl">Einreichungen</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">Neue Projekte prüfen, Unterlagen ansehen und die weitere Bearbeitung sauber steuern.</p>
          </div>
          <Link href="/partner-submissions/archive" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-5 py-3 text-sm font-extrabold text-white backdrop-blur-md transition hover:bg-white/12">
            <Archive className="h-4 w-4" /> Archiv {archiveCount ? `(${archiveCount})` : ''}
          </Link>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.4rem] border border-white/8 bg-[#1a222c] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Aktive Einreichungen</p>
              <p className="mt-2 text-3xl font-extrabold text-white">{submissions?.length ?? 0}</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/12 text-[#8de13c]"><FileText className="h-5 w-5" /></span>
          </div>
        </div>
        <div className="rounded-[1.4rem] border border-white/8 bg-[#1a222c] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Prüfprozess</p>
              <p className="mt-2 text-lg font-extrabold text-white">Kontrolliert & nachvollziehbar</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/12 text-[#8de13c]"><ShieldCheck className="h-5 w-5" /></span>
          </div>
        </div>
      </div>

      <section className="rounded-[1.7rem] border border-white/8 bg-[#151d26]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-5">
        <div className="mb-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#8de13c]">Arbeitskorb</p>
          <h2 className="mt-1 text-2xl font-extrabold text-white">Offene Partnerprojekte</h2>
        </div>

        <div className="space-y-3">
          {submissions?.length === 0 && (
            <div className="ema-empty-state">Aktuell liegen keine neuen Partner-Einreichungen vor.</div>
          )}

          {submissions?.map((submission: any) => {
            const partner = submission.profiles
            const documentCount = submission.submission_documents?.[0]?.count ?? 0
            const location = [submission.location_city, submission.location_state].filter(Boolean).join(', ') || 'Standort offen'
            return (
              <Link key={submission.id} href={`/partner-submissions/${submission.id}`} className="group block rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4 transition hover:-translate-y-0.5 hover:border-[#5CB800]/28 hover:bg-white/[0.055] md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-extrabold text-white">{submission.project_name}</h3>
                      <span className="rounded-full border border-[#5CB800]/20 bg-[#5CB800]/10 px-2.5 py-1 text-xs font-extrabold text-[#8de13c]">{STATUS_LABELS[submission.status] ?? submission.status}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-300">{partner?.company || partner?.full_name || 'Vertriebspartner'}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
                      <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#8de13c]" /> {location}</span>
                      <span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4 text-[#8de13c]" /> {documentCount} Unterlage{documentCount === 1 ? '' : 'n'}</span>
                    </div>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-[#8de13c] transition group-hover:translate-x-0.5 group-hover:bg-[#5CB800]/12"><ArrowRight className="h-5 w-5" /></span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
