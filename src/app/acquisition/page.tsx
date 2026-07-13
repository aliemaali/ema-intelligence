import Link from 'next/link'
import {
  Building2,
  FolderSearch2,
  MailCheck,
  Plus,
  Search,
  Send,
  Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Lead = {
  id: string
  acquisition_type: 'project' | 'roof'
  company_name: string
  city: string | null
  contact_name: string | null
  score: number
  status: string
  estimated_potential_kwp: number | null
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  researching: 'In Prüfung',
  ready_for_approval: 'Zur Freigabe',
  approved: 'Freigegeben',
  contacted: 'Kontaktiert',
  replied: 'Antwort erhalten',
  qualified: 'Qualifiziert',
  rejected: 'Abgelehnt',
  blocked: 'Gesperrt',
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: number
  helper: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#132060]">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{helper}</p>
        </div>
        <div className="rounded-xl bg-[#EEF2F7] p-3 text-[#132060]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export default async function AcquisitionPage() {
  const supabase = await createClient()
  const db = supabase as any

  const { data, error } = await db
    .from('acquisition_leads')
    .select('id, acquisition_type, company_name, city, contact_name, score, status, estimated_potential_kwp, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  const leads = (data || []) as Lead[]
  const projectLeads = leads.filter((lead) => lead.acquisition_type === 'project').length
  const roofLeads = leads.filter((lead) => lead.acquisition_type === 'roof').length
  const pendingApproval = leads.filter((lead) => lead.status === 'ready_for_approval').length
  const contacted = leads.filter((lead) => ['contacted', 'replied', 'qualified'].includes(lead.status)).length

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#5CB800]">
              <Target className="h-4 w-4" />
              EMA Acquisition Agent
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#132060]">Akquise</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Projektchancen und große Dachflächen prüfen, bewerten und erst nach deiner Freigabe kontaktieren.
            </p>
          </div>

          <Link
            href="/acquisition/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#132060] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1F2A44]"
          >
            <Plus className="h-4 w-4" />
            Lead anlegen
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Projektchancen" value={projectLeads} helper="PV, BESS und Hybrid" icon={FolderSearch2} />
          <StatCard label="Dachflächen" value={roofLeads} helper="Gewerbe und Industrie" icon={Building2} />
          <StatCard label="Zur Freigabe" value={pendingApproval} helper="E-Mails warten auf dich" icon={MailCheck} />
          <StatCard label="Kontaktiert" value={contacted} helper="Aktive Akquise" icon={Send} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-[#132060]">Aktuelle Leads</h2>
                <p className="mt-1 text-xs text-slate-400">Nach Bewertung und Erstellungsdatum sortiert</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
                <Search className="h-4 w-4" />
                Suche folgt im nächsten Schritt
              </div>
            </div>

            {error ? (
              <div className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Das Akquise-Schema ist noch nicht in Supabase aktiviert. Führe zuerst die neue Migration aus.
              </div>
            ) : leads.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <div className="rounded-2xl bg-[#EEF2F7] p-4 text-[#132060]">
                  <Target className="h-7 w-7" />
                </div>
                <h3 className="mt-4 font-semibold text-[#132060]">Noch keine Akquise-Leads</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Lege den ersten Projekt- oder Dachflächen-Lead an. Danach bauen wir die automatische Recherche darauf auf.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <div key={lead.id} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[11px] font-semibold text-[#132060]">
                          {lead.acquisition_type === 'project' ? 'Projekt' : 'Dachfläche'}
                        </span>
                        <span className="text-xs font-semibold text-[#5CB800]">Score {lead.score}</span>
                      </div>
                      <p className="mt-2 truncate font-semibold text-slate-900">{lead.company_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[lead.contact_name, lead.city].filter(Boolean).join(' · ') || 'Kontaktdaten noch offen'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      {lead.estimated_potential_kwp ? (
                        <span className="text-sm font-semibold text-[#132060]">
                          {lead.estimated_potential_kwp.toLocaleString('de-DE')} kWp
                        </span>
                      ) : null}
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                        {STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-[#132060]">Freigabeprinzip</h2>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                {[
                  ['1', 'Agent findet und bewertet den Lead'],
                  ['2', 'E-Mail wird individuell vorbereitet'],
                  ['3', 'Du prüfst und gibst sie frei'],
                  ['4', 'Erst danach wird automatisch gesendet'],
                ].map(([number, text]) => (
                  <div key={number} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#132060] text-xs font-semibold text-white">
                      {number}
                    </span>
                    <p className="pt-1 leading-5">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-[#132060] p-5 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Sprint 1</p>
              <h2 className="mt-3 text-xl font-semibold">Das Fundament steht</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Als Nächstes folgen Lead-Formular, E-Mail-Entwürfe und dein Freigabe-Center.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
