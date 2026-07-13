import Link from 'next/link'
import {
  ArrowRight,
  BatteryCharging,
  FileText,
  FolderOpen,
  MapPin,
  MessageCircleQuestion,
  ShieldCheck,
  Sun,
  UploadCloud,
} from 'lucide-react'
import { redirect } from 'next/navigation'
import { PartnerSignOutButton } from '@/components/partner/PartnerSignOutButton'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Partner Portal' }

type Submission = {
  id: string
  project_name: string
  project_type: string
  location_city: string
  location_state: string | null
  status: string
  remuneration_model: string | null
  remuneration_ct_kwh: number | null
  submitted_at: string
  review_note: string | null
}

const statusLabels: Record<string, string> = {
  entwurf: 'Entwurf',
  eingereicht: 'Eingereicht',
  in_pruefung: 'In Prüfung',
  rueckfrage: 'Rückfrage',
  angenommen: 'Angenommen',
  abgelehnt: 'Abgelehnt',
}

const statusClasses: Record<string, string> = {
  entwurf: 'bg-slate-100 text-slate-700',
  eingereicht: 'bg-blue-50 text-blue-700',
  in_pruefung: 'bg-amber-50 text-amber-700',
  rueckfrage: 'bg-orange-50 text-orange-700',
  angenommen: 'bg-[#5CB800]/10 text-[#2F8A00]',
  abgelehnt: 'bg-red-50 text-red-700',
}

const remunerationLabels: Record<string, string> = {
  ppa: 'PPA',
  volleinspeisung: 'Volleinspeisung',
  teileinspeisung: 'Teileinspeisung',
}

function ProjectTypeIcon({ type }: { type: string }) {
  if (type === 'bess') return <BatteryCharging className="h-5 w-5" />
  return <Sun className="h-5 w-5" />
}

function projectTypeLabel(type: string) {
  if (type === 'pv_dach') return 'PV-Dach'
  if (type === 'bess') return 'BESS'
  if (type === 'hybrid') return 'Hybrid'
  return 'PV-Freifläche'
}

export default async function PartnerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: submissionsData }] = await Promise.all([
    supabase.from('profiles').select('full_name, company').eq('id', user.id).maybeSingle(),
    supabase
      .from('project_submissions')
      .select('id, project_name, project_type, location_city, location_state, status, remuneration_model, remuneration_ct_kwh, submitted_at, review_note')
      .eq('partner_user_id', user.id)
      .order('submitted_at', { ascending: false }),
  ])

  const submissions = (submissionsData ?? []) as Submission[]
  const submissionIds = submissions.map((submission) => submission.id)
  const documentCounts = new Map<string, number>()

  if (submissionIds.length > 0) {
    const { data: documents } = await supabase.from('submission_documents').select('submission_id').in('submission_id', submissionIds)
    for (const document of documents ?? []) {
      documentCounts.set(document.submission_id, (documentCounts.get(document.submission_id) ?? 0) + 1)
    }
  }

  const firstName = profile?.full_name?.trim().split(' ')[0] || 'Partner'
  const company = profile?.company?.trim()
  const openQuestions = submissions.filter((submission) => submission.status === 'rueckfrage').length

  return (
    <main className="min-h-screen bg-[#F7F9FC] text-[#1F2A44]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="flex items-center justify-between gap-4 py-3">
          <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-12 w-auto rounded-xl object-contain sm:h-14" />
          <PartnerSignOutButton />
        </header>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_20px_60px_rgba(31,42,68,0.08)] sm:p-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]"><ShieldCheck className="h-4 w-4" /> EMA Partner Portal</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.04em] text-[#1F2A44] sm:text-5xl">Willkommen, {firstName}.</h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">Übermittle neue Projekte und verfolge den Prüfstatus deiner Einreichungen.</p>
            {company && <p className="mt-3 text-sm font-semibold text-slate-500">Unternehmen: {company}</p>}
          </div>
        </section>

        {openQuestions > 0 && (
          <div className="mt-5 flex items-center gap-3 rounded-[1.5rem] border border-orange-200 bg-orange-50 p-4 text-orange-800">
            <MessageCircleQuestion className="h-6 w-6 shrink-0" />
            <div><p className="font-extrabold">{openQuestions} offene Rückfrage{openQuestions === 1 ? '' : 'n'}</p><p className="text-sm">Öffne das betroffene Projekt und reiche die Antwort oder Unterlagen nach.</p></div>
          </div>
        )}

        <Link href="/partner/new" className="mt-5 flex items-center gap-4 rounded-[1.75rem] bg-[#5CB800] p-5 text-white shadow-[0_18px_45px_rgba(92,184,0,0.22)] transition active:scale-[0.99] sm:p-7">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/18"><UploadCloud className="h-7 w-7" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xl font-extrabold">Neues Projekt einreichen</span><span className="mt-1 block text-sm leading-relaxed text-white/85">Standort, Vergütung, Exposé und Unterlagen hochladen</span></span>
          <ArrowRight className="h-6 w-6 shrink-0" />
        </Link>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">Übersicht</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight">Meine Projekte</h2></div>
            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-extrabold shadow-sm">{submissions.length}</span>
          </div>

          {submissions.length === 0 ? (
            <div className="mt-4 rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-4 text-lg font-extrabold">Noch keine Projekte eingereicht</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">Sobald du ein Projekt übermittelst, erscheint es hier mit dem aktuellen Prüfstatus.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {submissions.map((submission) => {
                const documents = documentCounts.get(submission.id) ?? 0
                const location = [submission.location_city, submission.location_state].filter(Boolean).join(', ')
                const remuneration = submission.remuneration_model
                  ? `${remunerationLabels[submission.remuneration_model] ?? submission.remuneration_model}${submission.remuneration_ct_kwh != null ? ` · ${Number(submission.remuneration_ct_kwh).toLocaleString('de-DE')} ct/kWh` : ''}`
                  : 'Vergütung offen'

                return (
                  <Link key={submission.id} href={`/partner/submissions/${submission.id}`} className={`block rounded-[1.65rem] border bg-white p-4 shadow-sm transition active:scale-[0.995] sm:p-5 ${submission.status === 'rueckfrage' ? 'border-orange-300 ring-2 ring-orange-100' : 'border-slate-200/80'}`}>
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1F2A44]/8 text-[#1F2A44]"><ProjectTypeIcon type={submission.project_type} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0"><h3 className="truncate text-lg font-extrabold">{submission.project_name}</h3><p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{projectTypeLabel(submission.project_type)}</p></div>
                          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${statusClasses[submission.status] ?? 'bg-slate-100 text-slate-700'}`}>{statusLabels[submission.status] ?? submission.status}</span>
                        </div>
                        {submission.status === 'rueckfrage' && submission.review_note && <p className="mt-3 line-clamp-2 rounded-xl bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">{submission.review_note}</p>}
                        <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                          <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#2F8A00]" /> {location}</p>
                          <p className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-[#2F8A00]" /> {documents} Unterlage{documents === 1 ? '' : 'n'}</p>
                          <p className="font-semibold text-[#1F2A44]">{remuneration}</p>
                        </div>
                      </div>
                      <ArrowRight className="mt-2 h-5 w-5 shrink-0 text-slate-300" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <footer className="mt-auto pt-10 text-center text-xs text-slate-400">EMA Enterprise GmbH · Connecting Capital with Energy Infrastructure.</footer>
      </div>
    </main>
  )
}
