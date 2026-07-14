import Link from 'next/link'
import {
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  MapPin,
  MessageCircleQuestion,
  PlusCircle,
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
  pv_kwp: number | null
  bess_mwh: number | null
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

function KpiCard({ icon, label, value, hint, tone = 'green' }: { icon: React.ReactNode; label: string; value: string; hint: string; tone?: 'green' | 'blue' | 'orange' | 'navy' }) {
  const tones = {
    green: 'bg-[#5CB800]/10 text-[#2F8A00]',
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    navy: 'bg-[#1F2A44]/8 text-[#1F2A44]',
  }
  return (
    <div className="rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</span>
        <div><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-3xl font-extrabold tracking-tight text-[#1F2A44]">{value}</p><p className="mt-1 text-xs font-semibold text-slate-400">{hint}</p></div>
      </div>
    </div>
  )
}

export default async function PartnerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: submissionsData }] = await Promise.all([
    supabase.from('profiles').select('full_name, company').eq('id', user.id).maybeSingle(),
    supabase
      .from('project_submissions')
      .select('id, project_name, project_type, location_city, location_state, status, remuneration_model, remuneration_ct_kwh, submitted_at, review_note, pv_kwp, bess_mwh')
      .eq('partner_user_id', user.id)
      .order('submitted_at', { ascending: false }),
  ])

  const submissions = (submissionsData ?? []) as Submission[]
  const submissionIds = submissions.map((submission) => submission.id)
  const documentCounts = new Map<string, number>()
  if (submissionIds.length > 0) {
    const { data: documents } = await supabase.from('submission_documents').select('submission_id').in('submission_id', submissionIds)
    for (const document of documents ?? []) documentCounts.set(document.submission_id, (documentCounts.get(document.submission_id) ?? 0) + 1)
  }

  const firstName = profile?.full_name?.trim().split(' ')[0] || 'Partner'
  const company = profile?.company?.trim()
  const openQuestions = submissions.filter((item) => item.status === 'rueckfrage')
  const inReview = submissions.filter((item) => ['eingereicht', 'in_pruefung'].includes(item.status)).length
  const accepted = submissions.filter((item) => item.status === 'angenommen').length
  const totalPv = submissions.reduce((sum, item) => sum + Number(item.pv_kwp ?? 0), 0)
  const totalBess = submissions.reduce((sum, item) => sum + Number(item.bess_mwh ?? 0), 0)
  const projectTypeCounts = {
    pv_freiflaeche: submissions.filter((item) => item.project_type === 'pv_freiflaeche').length,
    pv_dach: submissions.filter((item) => item.project_type === 'pv_dach').length,
    bess: submissions.filter((item) => item.project_type === 'bess').length,
    hybrid: submissions.filter((item) => item.project_type === 'hybrid').length,
  }
  const recent = submissions.slice(0, 5)
  const total = Math.max(submissions.length, 1)
  const acceptedShare = Math.round((accepted / total) * 100)
  const reviewShare = Math.round((inReview / total) * 100)
  const questionShare = Math.round((openQuestions.length / total) * 100)

  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#1F2A44]">
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-4"><img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-12 w-auto rounded-xl object-contain sm:h-14" /><div className="hidden sm:block"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">EMA Partner Portal</p><p className="text-sm font-semibold text-slate-500">{company || 'Projektpartner'}</p></div></div>
          <PartnerSignOutButton />
        </header>

        <section className="mt-5 rounded-[2rem] bg-white p-6 shadow-[0_18px_55px_rgba(31,42,68,0.07)] sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div><span className="inline-flex items-center gap-2 rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]"><ShieldCheck className="h-4 w-4" /> Sicheres Partnerportal</span><h1 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Guten Morgen, {firstName} 👋</h1><p className="mt-2 text-slate-500">Hier sehen Sie Ihre Projekte, Rückfragen und den aktuellen Prüfstatus.</p></div>
            <Link href="/partner/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 font-extrabold text-white shadow-[0_14px_30px_rgba(92,184,0,0.22)]"><PlusCircle className="h-5 w-5" /> Neues Projekt einreichen</Link>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard icon={<FolderOpen className="h-6 w-6" />} label="Gesamt eingereicht" value={String(submissions.length)} hint="Alle Projekte" />
          <KpiCard icon={<Clock3 className="h-6 w-6" />} label="In Prüfung" value={String(inReview)} hint="Aktuell in Bearbeitung" tone="blue" />
          <KpiCard icon={<CheckCircle2 className="h-6 w-6" />} label="Angenommen" value={String(accepted)} hint="Von EMA bestätigt" />
          <KpiCard icon={<MessageCircleQuestion className="h-6 w-6" />} label="Rückfragen" value={String(openQuestions.length)} hint={openQuestions.length ? 'Antwort erforderlich' : 'Keine offenen Punkte'} tone="orange" />
          <KpiCard icon={<Sun className="h-6 w-6" />} label="Gesamtleistung" value={totalPv > 0 ? `${totalPv.toLocaleString('de-DE')} kWp` : `${totalBess.toLocaleString('de-DE')} MWh`} hint={totalPv > 0 && totalBess > 0 ? `plus ${totalBess.toLocaleString('de-DE')} MWh BESS` : 'Eingereichte Leistung'} tone="navy" />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_0.8fr]">
          <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">Projektübersicht</p><h2 className="mt-1 text-2xl font-extrabold">Meine Projekt-Einreichungen</h2></div><Link href="/partner/new" className="hidden items-center gap-2 text-sm font-extrabold text-[#2F8A00] sm:inline-flex">Neue Einreichung <ArrowRight className="h-4 w-4" /></Link></div>

            {recent.length === 0 ? <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 p-8 text-center"><FolderOpen className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-extrabold">Noch keine Projekte eingereicht</p></div> : <div className="mt-5 space-y-3">{recent.map((submission) => {
              const documents = documentCounts.get(submission.id) ?? 0
              const location = [submission.location_city, submission.location_state].filter(Boolean).join(', ')
              return <Link key={submission.id} href={`/partner/submissions/${submission.id}`} className={`block rounded-[1.4rem] border p-4 transition hover:border-[#5CB800]/50 hover:shadow-sm ${submission.status === 'rueckfrage' ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200'}`}><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1F2A44]/8"><ProjectTypeIcon type={submission.project_type} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-extrabold">{submission.project_name}</h3><p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{projectTypeLabel(submission.project_type)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-extrabold ${statusClasses[submission.status] ?? 'bg-slate-100 text-slate-700'}`}>{statusLabels[submission.status] ?? submission.status}</span></div><div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-3"><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#2F8A00]" /> {location || 'Standort offen'}</p><p className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#2F8A00]" /> {documents} Unterlagen</p><p className="font-semibold text-[#1F2A44]">{submission.remuneration_model ? remunerationLabels[submission.remuneration_model] ?? submission.remuneration_model : 'Vergütung offen'}</p></div></div><ArrowRight className="mt-2 h-5 w-5 shrink-0 text-slate-300" /></div></Link>
            })}</div>}
          </div>

          <div className="space-y-5">
            <section className="rounded-[2rem] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-extrabold">Projekte nach Status</h2>
              <div className="mt-6 flex items-center gap-6"><div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: `conic-gradient(#5CB800 0 ${acceptedShare}%, #3B82F6 ${acceptedShare}% ${acceptedShare + reviewShare}%, #F59E0B ${acceptedShare + reviewShare}% ${acceptedShare + reviewShare + questionShare}%, #E2E8F0 ${acceptedShare + reviewShare + questionShare}% 100%)` }}><div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-extrabold">{submissions.length}</span><span className="text-xs font-bold text-slate-400">Gesamt</span></div></div><div className="space-y-3 text-sm"><p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#5CB800]" /> Angenommen: <strong>{accepted}</strong></p><p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-500" /> In Prüfung: <strong>{inReview}</strong></p><p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" /> Rückfragen: <strong>{openQuestions.length}</strong></p></div></div>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-extrabold">Projekte nach Art</h2>
              <p className="mt-1 text-sm text-slate-500">Welche Projektarten Sie bisher übermittelt haben.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ['pv_freiflaeche', projectTypeCounts.pv_freiflaeche],
                  ['pv_dach', projectTypeCounts.pv_dach],
                  ['bess', projectTypeCounts.bess],
                  ['hybrid', projectTypeCounts.hybrid],
                ].map(([type, count]) => (
                  <div key={String(type)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#2F8A00] shadow-sm"><ProjectTypeIcon type={String(type)} /></span>
                      <strong className="text-2xl text-[#1F2A44]">{Number(count)}</strong>
                    </div>
                    <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-slate-500">{projectTypeLabel(String(type))}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-extrabold">Schnellzugriff</h2>
              <div className="mt-4 space-y-3"><Link href="/partner/new" className="flex items-center gap-3 rounded-2xl bg-[#5CB800]/10 p-4 font-extrabold text-[#2F8A00]"><UploadCloud className="h-5 w-5" /> Neues Projekt einreichen <ArrowRight className="ml-auto h-4 w-4" /></Link><Link href="/partner" className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 font-extrabold"><FolderOpen className="h-5 w-5" /> Meine Projekte <ArrowRight className="ml-auto h-4 w-4" /></Link></div>
            </section>
          </div>
        </section>

        {openQuestions.length > 0 && <section className="mt-5 rounded-[2rem] border border-orange-200 bg-orange-50 p-5 sm:p-7"><div className="flex items-center gap-3"><MessageCircleQuestion className="h-6 w-6 text-orange-700" /><div><h2 className="text-xl font-extrabold text-orange-900">Offene Rückfragen</h2><p className="text-sm text-orange-700">Bitte prüfen und beantworten Sie die folgenden Punkte.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{openQuestions.slice(0, 4).map((item) => <Link key={item.id} href={`/partner/submissions/${item.id}`} className="rounded-2xl bg-white p-4 shadow-sm"><p className="font-extrabold">{item.project_name}</p><p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.review_note || 'EMA hat eine Rückfrage zu diesem Projekt.'}</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-orange-700">Jetzt beantworten <ArrowRight className="h-4 w-4" /></span></Link>)}</div></section>}

        <footer className="pt-10 text-center text-xs text-slate-400">Ihre Daten sind sicher und vertraulich · EMA Enterprise GmbH</footer>
      </div>
    </main>
  )
}
