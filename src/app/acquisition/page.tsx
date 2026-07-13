import Link from 'next/link'
import { Building2, FolderSearch2, MailCheck, MailPlus, Plus, RefreshCw, Send, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAcquisitionEmailDraft, createAllAcquisitionEmailDrafts } from '@/lib/actions/acquisition.actions'
import { generateDueFollowUps, updateAcquisitionLeadStatus } from '@/lib/actions/followup.actions'

export const dynamic = 'force-dynamic'

type Lead = {
  id: string
  acquisition_type: 'project' | 'roof'
  company_name: string
  city: string | null
  contact_name: string | null
  email: string | null
  score: number
  status: string
  next_action: string | null
  next_action_at: string | null
  estimated_potential_kwp: number | null
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu', researching: 'In Prüfung', ready_for_approval: 'Zur Freigabe', approved: 'Freigegeben',
  contacted: 'Kontaktiert', replied: 'Antwort erhalten', qualified: 'Qualifiziert', rejected: 'Kein Interesse', blocked: 'Gesperrt',
}

function StatCard({ label, value, helper, icon: Icon }: { label: string; value: number; helper: string; icon: React.ComponentType<{ className?: string }> }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-[#132060]">{value}</p><p className="mt-1 text-xs text-slate-400">{helper}</p></div><div className="rounded-xl bg-[#EEF2F7] p-3 text-[#132060]"><Icon className="h-5 w-5" /></div></div></div>
}

export default async function AcquisitionPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = await createClient()
  const db = supabase as any
  const [{ data, error }, { count: approvalCount }] = await Promise.all([
    db.from('acquisition_leads').select('id, acquisition_type, company_name, city, contact_name, email, score, status, next_action, next_action_at, estimated_potential_kwp').order('created_at', { ascending: false }).limit(50),
    db.from('acquisition_emails').select('id', { count: 'exact', head: true }).in('status', ['draft', 'ready_for_approval']),
  ])

  const leads = (data || []) as Lead[]
  const projectLeads = leads.filter((lead) => lead.acquisition_type === 'project').length
  const roofLeads = leads.filter((lead) => lead.acquisition_type === 'roof').length
  const contacted = leads.filter((lead) => ['contacted', 'replied', 'qualified'].includes(lead.status)).length
  const draftable = leads.filter((lead) => lead.email && ['new', 'researching'].includes(lead.status)).length
  const dueFollowUps = leads.filter((lead) => lead.status === 'contacted' && lead.next_action_at && new Date(lead.next_action_at) <= new Date()).length

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 md:px-8 md:py-8"><div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#5CB800]"><Target className="h-4 w-4" /> EMA Scout</div><h1 className="text-3xl font-semibold tracking-tight text-[#132060]">Akquise-Center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Projektchancen und große Dachflächen erfassen, prüfen und erst nach deiner Freigabe kontaktieren.</p></div>
        <div className="flex flex-wrap gap-3">
          {dueFollowUps > 0 && <form action={generateDueFollowUps}><button className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"><RefreshCw className="h-4 w-4" /> Follow-ups erstellen ({dueFollowUps})</button></form>}
          {draftable > 0 && <form action={createAllAcquisitionEmailDrafts}><button className="inline-flex items-center gap-2 rounded-xl border border-[#5CB800] bg-white px-4 py-3 text-sm font-semibold text-[#3F7D00]"><MailPlus className="h-4 w-4" /> Alle Entwürfe erstellen ({draftable})</button></form>}
          <Link href="/acquisition/approvals" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#132060]"><MailCheck className="h-4 w-4" /> Freigaben{approvalCount ? ` (${approvalCount})` : ''}</Link>
          <Link href="/acquisition/new" className="inline-flex items-center gap-2 rounded-xl bg-[#132060] px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Lead anlegen</Link>
        </div></div>

      {searchParams.error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Aktion konnte nicht ausgeführt werden.</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Projektchancen" value={projectLeads} helper="PV, BESS und Hybrid" icon={FolderSearch2} /><StatCard label="Dachflächen" value={roofLeads} helper="Gewerbe und Industrie" icon={Building2} /><StatCard label="Zur Freigabe" value={approvalCount || 0} helper="E-Mails warten auf dich" icon={MailCheck} /><StatCard label="Kontaktiert" value={contacted} helper="Aktive Akquise" icon={Send} /></div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-[#132060]">Aktuelle Leads</h2><p className="mt-1 text-xs text-slate-400">Mit Follow-up-Termin und manuellem Ergebnisstatus</p></div>
        {error ? <div className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Das Akquise-Schema ist noch nicht in Supabase aktiviert.</div> : leads.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center"><Target className="h-8 w-8 text-slate-300" /><h3 className="mt-4 font-semibold text-[#132060]">Noch keine Akquise-Leads</h3></div> : <div className="divide-y divide-slate-100">{leads.map((lead) => (
          <div key={lead.id} className="grid gap-4 px-5 py-4 hover:bg-slate-50 lg:grid-cols-[1fr_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[11px] font-semibold text-[#132060]">{lead.acquisition_type === 'project' ? 'Projekt' : 'Dachfläche'}</span><span className="text-xs font-semibold text-[#5CB800]">Score {lead.score}</span></div><p className="mt-2 truncate font-semibold text-slate-900">{lead.company_name}</p><p className="mt-1 text-xs text-slate-500">{[lead.contact_name, lead.city, lead.email].filter(Boolean).join(' · ') || 'Kontaktdaten noch offen'}</p>{lead.next_action && <p className="mt-2 text-xs text-amber-700">{lead.next_action}{lead.next_action_at ? ` · ${new Date(lead.next_action_at).toLocaleDateString('de-DE')}` : ''}</p>}</div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">{lead.estimated_potential_kwp ? <span className="text-sm font-semibold text-[#132060]">{lead.estimated_potential_kwp.toLocaleString('de-DE')} kWp</span> : null}<span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">{STATUS_LABELS[lead.status] || lead.status}</span>
              {lead.email && ['new', 'researching'].includes(lead.status) && <form action={createAcquisitionEmailDraft}><input type="hidden" name="lead_id" value={lead.id} /><button className="rounded-lg border border-[#5CB800] px-3 py-2 text-xs font-semibold text-[#3F7D00]">Entwurf erstellen</button></form>}
              {['contacted', 'replied'].includes(lead.status) && <><form action={updateAcquisitionLeadStatus}><input type="hidden" name="lead_id" value={lead.id} /><input type="hidden" name="status" value="replied" /><button className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700">Antwort erhalten</button></form><form action={updateAcquisitionLeadStatus}><input type="hidden" name="lead_id" value={lead.id} /><input type="hidden" name="status" value="qualified" /><button className="rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700">Qualifiziert</button></form><form action={updateAcquisitionLeadStatus}><input type="hidden" name="lead_id" value={lead.id} /><input type="hidden" name="status" value="rejected" /><button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Kein Interesse</button></form></>}
            </div></div>))}</div>}
      </section>
    </div></div>
  )
}
