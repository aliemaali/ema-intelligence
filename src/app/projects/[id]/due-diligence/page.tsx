import Link from 'next/link'
import { getDocuments } from '@/lib/actions/document.actions'
import { EmaDueDiligencePanel } from '@/components/ai/EmaDueDiligencePanel'
import { getProfessionalDdChecks, REVIEW_LENS_LABELS, type DdProjectProfile, type DdReviewLens } from '@/lib/due-diligence/profiles'

const PROFILES: { key: DdProjectProfile; label: string; description: string }[] = [
  { key: 'bess', label: 'BESS', description: 'Batteriespeicher' },
  { key: 'pv', label: 'PV', description: 'Photovoltaik' },
  { key: 'pv_bess', label: 'PV + BESS', description: 'Hybridprojekt' },
]
const LENSES: DdReviewLens[] = ['engineering','investor','legal']

export default async function DueDiligencePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ profile?: string }> }) {
  const { id } = await params
  const query = await searchParams
  const profile: DdProjectProfile = query.profile === 'pv' || query.profile === 'pv_bess' ? query.profile : 'bess'
  const documents = await getDocuments(id)
  const checks = getProfessionalDdChecks(profile)

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-28">
    <header className="rounded-3xl border border-white/10 bg-slate-950 p-6 text-white shadow-xl"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-400">EMA AI · Professional Due Diligence</p><h1 className="mt-2 text-3xl font-bold">Projektprüfung</h1><p className="mt-2 max-w-3xl text-sm text-slate-300">Drei unabhängige Perspektiven: Engineering, Investor und rechtliche Vorprüfung. Kritische Hard Gates können die Gesamtfreigabe blockieren.</p></header>

    <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Was soll EMA prüfen?</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{PROFILES.map(option=><Link key={option.key} href={`?profile=${option.key}`} className={`rounded-2xl border p-4 transition ${profile===option.key?'border-lime-500 bg-lime-50 ring-1 ring-lime-500':'hover:bg-slate-50'}`}><p className="font-bold text-slate-950">{option.label}</p><p className="mt-1 text-sm text-slate-500">{option.description}</p></Link>)}</div></section>

    <section className="grid gap-3 sm:grid-cols-3">{LENSES.map(lens=><div key={lens} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{REVIEW_LENS_LABELS[lens]}</p><p className="mt-2 text-2xl font-bold text-slate-950">{checks.filter(c=>c.lens===lens).length}</p><p className="mt-1 text-xs text-slate-500">Prüfpunkte im gewählten Profil</p></div>)}</section>

    <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">Datenraum</h2><p className="mt-1 text-sm text-slate-600">{documents.length} Dokument{documents.length===1?'':'e'} verfügbar. Nur analysierte Dokumentinhalte können als Evidenz in die Prüfung eingehen.</p></div><Link href={`/projects/${id}/documents`} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Datenraum öffnen</Link></div></section>

    <EmaDueDiligencePanel key={`${id}-${profile}`} projectId={id} suggestedProfile={profile}/>

    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Prüfstandard</h2><p className="mt-2 text-sm text-amber-900">EMA trennt technische, wirtschaftliche und rechtliche Befunde. Ein hoher Score in einem Bereich kann ein kritisches Hard Gate in einem anderen Bereich nicht ausgleichen. Die rechtliche Prüfung ist eine automatisierte Vorprüfung und ersetzt keine individuelle Rechtsberatung; technische Feststellungen ersetzen keine erforderliche Fachplanung oder Vor-Ort-Prüfung.</p></section>
  </main>
}
