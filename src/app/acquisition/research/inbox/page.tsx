import Link from 'next/link'
import { ArrowLeft, Check, ExternalLink, Filter, Globe2, Inbox, MailPlus, Search, ShieldAlert, Sparkles, TrendingUp, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  approveResearchCandidate,
  bulkApproveResearchCandidates,
  bulkRejectResearchCandidates,
  rejectResearchCandidate,
} from '@/lib/actions/research-inbox.actions'
import { enrichResearchCandidate } from '@/lib/actions/website-enrichment.actions'

export const dynamic = 'force-dynamic'

type Candidate = {
  id: string
  acquisition_type: 'project' | 'roof'
  company_name: string
  website: string | null
  email: string | null
  contact_name: string | null
  contact_role: string | null
  city: string | null
  state: string | null
  industry: string | null
  contact_url: string | null
  source_name: string
  source_url: string | null
  source_snippet: string | null
  score: number
  status: string
  duplicate_reason: string | null
  enrichment_status: string
  enrichment_error: string | null
  enriched_at: string | null
  reviewed_at: string | null
  created_at: string
}

type SearchParams = {
  queued?: string
  approved?: string
  drafted?: string
  enriched?: string
  error?: string
  score?: string
  bulkApproved?: string
  bulkDrafted?: string
  bulkRejected?: string
  duplicates?: string
  type?: string
  priority?: string
  region?: string
  industry?: string
  contact?: string
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu', approved: 'Übernommen', rejected: 'Verworfen', duplicate: 'Dublette',
}

const ENRICHMENT_LABELS: Record<string, string> = {
  pending: 'Noch nicht geprüft', running: 'Prüfung läuft', completed: 'Website geprüft', failed: 'Prüfung fehlgeschlagen', skipped: 'Ohne Website',
}

function priorityOf(candidate: Candidate) {
  if (candidate.score >= 70 && candidate.email) return 'now'
  if (candidate.score >= 45 || candidate.website) return 'research'
  return 'low'
}

const PRIORITY_LABELS = {
  now: 'Sofort prüfen',
  research: 'Weiter recherchieren',
  low: 'Niedrige Priorität',
} as const

function isToday(value: string | null) {
  if (!value) return false
  const date = new Date(value)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function Select({ name, defaultValue, children }: { name: string; defaultValue?: string; children: React.ReactNode }) {
  return <select name={name} defaultValue={defaultValue || ''} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#5CB800]">{children}</select>
}

export default async function ResearchInboxPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const db = supabase as any
  const { data, error } = await db
    .from('acquisition_research_candidates')
    .select('id,acquisition_type,company_name,website,email,contact_name,contact_role,city,state,industry,contact_url,source_name,source_url,source_snippet,score,status,duplicate_reason,enrichment_status,enrichment_error,enriched_at,reviewed_at,created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(250)

  const candidates = (data || []) as Candidate[]
  const openCandidates = candidates.filter((item) => item.status === 'new')
  const regions = [...new Set(openCandidates.map((item) => item.state || item.city).filter(Boolean) as string[])].sort()
  const industries = [...new Set(openCandidates.map((item) => item.industry).filter(Boolean) as string[])].sort()

  const filtered = openCandidates.filter((item) => {
    if (searchParams.type && item.acquisition_type !== searchParams.type) return false
    if (searchParams.priority && priorityOf(item) !== searchParams.priority) return false
    if (searchParams.region && (item.state || item.city) !== searchParams.region) return false
    if (searchParams.industry && item.industry !== searchParams.industry) return false
    if (searchParams.contact === 'complete' && !(item.email && (item.contact_name || item.website))) return false
    if (searchParams.contact === 'missing' && item.email && (item.contact_name || item.website)) return false
    return true
  })

  const groups = {
    now: filtered.filter((item) => priorityOf(item) === 'now'),
    research: filtered.filter((item) => priorityOf(item) === 'research'),
    low: filtered.filter((item) => priorityOf(item) === 'low'),
  }

  const topToday = openCandidates.filter((item) => priorityOf(item) === 'now').slice(0, 5)
  const newToday = candidates.filter((item) => isToday(item.created_at)).length
  const enrichedToday = candidates.filter((item) => isToday(item.enriched_at)).length
  const approvedToday = candidates.filter((item) => item.status === 'approved' && isToday(item.reviewed_at)).length
  const openCount = openCandidates.length

  const errorMessage = searchParams.error === 'duplicate'
    ? 'Der Vorschlag wurde als Dublette erkannt und nicht übernommen.'
    : searchParams.error === 'no-website'
      ? 'Für diesen Vorschlag ist keine Website hinterlegt.'
      : searchParams.error === 'enrichment'
        ? 'Die Website-Prüfung konnte nicht abgeschlossen werden. Details stehen beim Vorschlag.'
        : searchParams.error === 'selection'
          ? 'Für die Sammelaktion sind keine offenen Treffer ausgewählt.'
          : searchParams.error
            ? 'Die Aktion konnte nicht ausgeführt werden.'
            : null

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/acquisition/research" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#132060]"><ArrowLeft className="h-4 w-4" /> Zurück zur Recherche</Link>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#5CB800]"><Inbox className="h-4 w-4" /> EMA Scout Recherche-Postfach</div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#132060]">Top-Chancen und Tagesliste</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Offene Treffer werden nach Qualität priorisiert. Nach deiner Übernahme erstellt EMA Scout bei vorhandener E-Mail automatisch einen Entwurf zur Freigabe.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/acquisition/approvals" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#132060]"><MailPlus className="h-4 w-4" /> Freigaben</Link>
            <Link href="/acquisition/research" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#132060] px-4 py-3 text-sm font-semibold text-white"><Search className="h-4 w-4" /> Recherche starten</Link>
          </div>
        </div>

        {searchParams.queued && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Vorschlag wurde mit Score {searchParams.score || '–'} in die Prüfliste aufgenommen.</div>}
        {searchParams.approved && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Vorschlag wurde als Lead übernommen.{searchParams.drafted === '1' ? ' Der passende E-Mail-Entwurf wartet jetzt im Freigabe-Center.' : ''}</div>}
        {searchParams.enriched && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Website wurde geprüft und der Vorschlag neu mit Score {searchParams.score || '–'} bewertet.</div>}
        {searchParams.bulkApproved && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{searchParams.bulkApproved} Leads übernommen, {searchParams.bulkDrafted || '0'} Entwürfe vorbereitet{Number(searchParams.duplicates || 0) > 0 ? `, ${searchParams.duplicates} Dubletten erkannt` : ''}.</div>}
        {searchParams.bulkRejected && <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{searchParams.bulkRejected} Vorschläge wurden verworfen.</div>}
        {errorMessage && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{errorMessage}</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Neue Treffer heute</p><p className="mt-2 text-3xl font-semibold text-[#132060]">{newToday}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Heute angereichert</p><p className="mt-2 text-3xl font-semibold text-[#132060]">{enrichedToday}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Heute übernommen</p><p className="mt-2 text-3xl font-semibold text-[#132060]">{approvedToday}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Offen zur Prüfung</p><p className="mt-2 text-3xl font-semibold text-[#132060]">{openCount}</p></div>
        </div>

        <section className="rounded-2xl border border-[#5CB800]/30 bg-gradient-to-br from-white to-green-50 p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-[#5CB800] p-2.5 text-white"><TrendingUp className="h-5 w-5" /></div><div><h2 className="font-semibold text-[#132060]">Top-Chancen heute</h2><p className="text-xs text-slate-500">Hoher Score und erreichbare E-Mail-Adresse</p></div></div>
          {topToday.length === 0 ? <p className="mt-5 text-sm text-slate-500">Aktuell gibt es keine vollständig kontaktierbare Top-Chance.</p> : (
            <div className="mt-5 grid gap-3 lg:grid-cols-5">
              {topToday.map((item) => <div key={item.id} className="rounded-xl border border-green-100 bg-white p-4"><p className="text-xs font-semibold text-[#5CB800]">Score {item.score}</p><p className="mt-1 truncate text-sm font-semibold text-slate-900">{item.company_name}</p><p className="mt-1 truncate text-xs text-slate-500">{item.city || item.state || 'Standort offen'}</p></div>)}
            </div>
          )}
        </section>

        <form method="get" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#132060]"><Filter className="h-4 w-4" /> Filter</div>
          <Select name="type" defaultValue={searchParams.type}><option value="">Alle Arten</option><option value="roof">Dachflächen</option><option value="project">Projektentwickler</option></Select>
          <Select name="priority" defaultValue={searchParams.priority}><option value="">Alle Prioritäten</option><option value="now">Sofort prüfen</option><option value="research">Weiter recherchieren</option><option value="low">Niedrige Priorität</option></Select>
          <Select name="region" defaultValue={searchParams.region}><option value="">Alle Regionen</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select name="industry" defaultValue={searchParams.industry}><option value="">Alle Branchen</option>{industries.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select name="contact" defaultValue={searchParams.contact}><option value="">Alle Kontaktdaten</option><option value="complete">Kontakt vollständig</option><option value="missing">Daten fehlen</option></Select>
          <button className="rounded-xl bg-[#132060] px-4 py-2.5 text-sm font-semibold text-white">Anwenden</button>
          <Link href="/acquisition/research/inbox" className="rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-slate-500">Zurücksetzen</Link>
        </form>

        {filtered.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div><p className="text-sm font-semibold text-[#132060]">Sammelaktion für {filtered.length} sichtbare offene Treffer</p><p className="mt-1 text-xs text-slate-500">Bei der Übernahme werden Entwürfe nur erstellt, wenn eine E-Mail-Adresse vorhanden ist.</p></div>
            <div className="flex flex-wrap gap-2">
              <form action={bulkApproveResearchCandidates}>{filtered.map((item) => <input key={item.id} type="hidden" name="candidate_id" value={item.id} />)}<button className="inline-flex items-center gap-2 rounded-xl bg-[#5CB800] px-4 py-2.5 text-sm font-semibold text-white"><Sparkles className="h-4 w-4" /> Alle sichtbaren übernehmen</button></form>
              <form action={bulkRejectResearchCandidates}>{filtered.map((item) => <input key={item.id} type="hidden" name="candidate_id" value={item.id} />)}<button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"><X className="h-4 w-4" /> Alle sichtbaren verwerfen</button></form>
            </div>
          </div>
        )}

        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Die Datenbank für das Recherche-Postfach ist nicht verfügbar.</div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center"><Inbox className="h-9 w-9 text-slate-300" /><h3 className="mt-4 font-semibold text-[#132060]">Keine passenden offenen Vorschläge</h3><p className="mt-2 text-sm text-slate-500">Passe die Filter an oder starte eine neue Recherche.</p></div>
        ) : (
          <div className="space-y-6">
            {(Object.keys(groups) as Array<keyof typeof groups>).map((groupKey) => groups[groupKey].length > 0 && (
              <section key={groupKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-[#132060]">{PRIORITY_LABELS[groupKey]}</h2><p className="mt-1 text-xs text-slate-400">{groups[groupKey].length} offene Treffer</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${groupKey === 'now' ? 'bg-green-50 text-green-700' : groupKey === 'research' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{groupKey === 'now' ? 'Hohe Priorität' : groupKey === 'research' ? 'Mittlere Priorität' : 'Später prüfen'}</span></div>
                <div className="divide-y divide-slate-100">
                  {groups[groupKey].map((candidate) => (
                    <article key={candidate.id} className="p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[11px] font-semibold text-[#132060]">{candidate.acquisition_type === 'roof' ? 'Dachfläche' : 'Projekt'}</span>
                            <span className="text-xs font-semibold text-[#5CB800]">Score {candidate.score}</span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{STATUS_LABELS[candidate.status] || candidate.status}</span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${candidate.enrichment_status === 'completed' ? 'bg-green-50 text-green-700' : candidate.enrichment_status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{ENRICHMENT_LABELS[candidate.enrichment_status] || candidate.enrichment_status}</span>
                          </div>
                          <h3 className="mt-2 font-semibold text-slate-900">{candidate.company_name}</h3>
                          <p className="mt-1 text-xs text-slate-500">{[candidate.contact_name, candidate.contact_role, candidate.city, candidate.state, candidate.email].filter(Boolean).join(' · ') || 'Kontaktdaten noch offen'}</p>
                          {candidate.industry && <p className="mt-2 text-xs font-semibold text-[#132060]">Branche: {candidate.industry}</p>}
                          {(!candidate.email || !candidate.contact_name) && <div className="mt-3 flex flex-wrap gap-2">{!candidate.email && <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">E-Mail fehlt</span>}{!candidate.contact_name && <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">Ansprechpartner fehlt</span>}</div>}
                          {candidate.source_snippet && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{candidate.source_snippet}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span>Quelle: {candidate.source_name}</span>{candidate.source_url && <a href={candidate.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#132060]">Fundstelle <ExternalLink className="h-3.5 w-3.5" /></a>}{candidate.website && <a href={/^https?:\/\//i.test(candidate.website) ? candidate.website : `https://${candidate.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#132060]">Website <ExternalLink className="h-3.5 w-3.5" /></a>}{candidate.contact_url && <a href={candidate.contact_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#132060]">Kontakt/Impressum <ExternalLink className="h-3.5 w-3.5" /></a>}</div>
                          {candidate.duplicate_reason && <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"><ShieldAlert className="h-4 w-4" /> {candidate.duplicate_reason}</div>}
                          {candidate.enrichment_error && <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700"><ShieldAlert className="h-4 w-4" /> {candidate.enrichment_error}</div>}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {candidate.website && candidate.enrichment_status !== 'running' && <form action={enrichResearchCandidate}><input type="hidden" name="candidate_id" value={candidate.id} /><button className="inline-flex items-center gap-2 rounded-xl border border-[#132060] px-4 py-2.5 text-sm font-semibold text-[#132060]"><Globe2 className="h-4 w-4" /> {candidate.enrichment_status === 'completed' ? 'Erneut prüfen' : 'Website prüfen'}</button></form>}
                          <form action={approveResearchCandidate}><input type="hidden" name="candidate_id" value={candidate.id} /><button className="inline-flex items-center gap-2 rounded-xl bg-[#5CB800] px-4 py-2.5 text-sm font-semibold text-white"><Check className="h-4 w-4" /> Übernehmen{candidate.email ? ' + Entwurf' : ''}</button></form>
                          <form action={rejectResearchCandidate}><input type="hidden" name="candidate_id" value={candidate.id} /><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"><X className="h-4 w-4" /> Verwerfen</button></form>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
