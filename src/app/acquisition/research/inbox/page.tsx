import Link from 'next/link'
import { ArrowLeft, Check, ExternalLink, Inbox, Search, ShieldAlert, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { approveResearchCandidate, rejectResearchCandidate } from '@/lib/actions/research-inbox.actions'

export const dynamic = 'force-dynamic'

type Candidate = {
  id: string
  acquisition_type: 'project' | 'roof'
  company_name: string
  website: string | null
  email: string | null
  contact_name: string | null
  city: string | null
  source_name: string
  source_url: string | null
  source_snippet: string | null
  score: number
  status: string
  duplicate_reason: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu', approved: 'Übernommen', rejected: 'Verworfen', duplicate: 'Dublette',
}

export default async function ResearchInboxPage({ searchParams }: { searchParams: { queued?: string; approved?: string; error?: string; score?: string } }) {
  const supabase = await createClient()
  const db = supabase as any
  const { data, error } = await db
    .from('acquisition_research_candidates')
    .select('id,acquisition_type,company_name,website,email,contact_name,city,source_name,source_url,source_snippet,score,status,duplicate_reason,created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const candidates = (data || []) as Candidate[]
  const openCount = candidates.filter((item) => item.status === 'new').length

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/acquisition/research" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#132060]"><ArrowLeft className="h-4 w-4" /> Zurück zur Recherche</Link>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#5CB800]"><Inbox className="h-4 w-4" /> EMA Scout Recherche-Postfach</div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#132060]">Gefundene Chancen prüfen</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Recherchetreffer landen zuerst hier. Erst nach deiner Bestätigung werden sie als echte Leads übernommen.</p>
          </div>
          <Link href="/acquisition/research" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#132060] px-4 py-3 text-sm font-semibold text-white"><Search className="h-4 w-4" /> Recherche erfassen</Link>
        </div>

        {searchParams.queued && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Vorschlag wurde mit Score {searchParams.score || '–'} in die Prüfliste aufgenommen.</div>}
        {searchParams.approved && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Vorschlag wurde als Lead übernommen.</div>}
        {searchParams.error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{searchParams.error === 'duplicate' ? 'Der Vorschlag wurde als Dublette erkannt und nicht übernommen.' : 'Die Aktion konnte nicht ausgeführt werden.'}</div>}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Offen zur Prüfung</p><p className="mt-2 text-3xl font-semibold text-[#132060]">{openCount}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Alle Vorschläge</p><p className="mt-2 text-3xl font-semibold text-[#132060]">{candidates.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Sicherheitsprinzip</p><p className="mt-2 text-sm font-semibold text-[#132060]">Kein automatischer Lead-Import</p></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-[#132060]">Recherche-Vorschläge</h2><p className="mt-1 text-xs text-slate-400">Nach Score priorisiert und mit Quelle nachvollziehbar</p></div>
          {error ? (
            <div className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Die Datenbank-Migration für das Recherche-Postfach ist noch nicht aktiv.</div>
          ) : candidates.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><Inbox className="h-9 w-9 text-slate-300" /><h3 className="mt-4 font-semibold text-[#132060]">Noch keine Recherche-Vorschläge</h3><p className="mt-2 max-w-md text-sm text-slate-500">Neue Treffer aus der Recherche erscheinen zuerst hier und werden nicht automatisch als Lead gespeichert.</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {candidates.map((candidate) => (
                <article key={candidate.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[11px] font-semibold text-[#132060]">{candidate.acquisition_type === 'roof' ? 'Dachfläche' : 'Projekt'}</span>
                        <span className="text-xs font-semibold text-[#5CB800]">Score {candidate.score}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{STATUS_LABELS[candidate.status] || candidate.status}</span>
                      </div>
                      <h3 className="mt-2 font-semibold text-slate-900">{candidate.company_name}</h3>
                      <p className="mt-1 text-xs text-slate-500">{[candidate.contact_name, candidate.city, candidate.email].filter(Boolean).join(' · ') || 'Kontaktdaten noch offen'}</p>
                      {candidate.source_snippet && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{candidate.source_snippet}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>Quelle: {candidate.source_name}</span>
                        {candidate.source_url && <a href={candidate.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#132060]">Fundstelle öffnen <ExternalLink className="h-3.5 w-3.5" /></a>}
                        {candidate.website && <span>{candidate.website}</span>}
                      </div>
                      {candidate.duplicate_reason && <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"><ShieldAlert className="h-4 w-4" /> {candidate.duplicate_reason}</div>}
                    </div>

                    {candidate.status === 'new' && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <form action={approveResearchCandidate}><input type="hidden" name="candidate_id" value={candidate.id} /><button className="inline-flex items-center gap-2 rounded-xl bg-[#5CB800] px-4 py-2.5 text-sm font-semibold text-white"><Check className="h-4 w-4" /> Als Lead übernehmen</button></form>
                        <form action={rejectResearchCandidate}><input type="hidden" name="candidate_id" value={candidate.id} /><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"><X className="h-4 w-4" /> Verwerfen</button></form>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
