import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ProjectDocumentPrintButton } from '@/components/projects/ProjectDocumentPrintButton'

function display(value: unknown, suffix = '') {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value)}${suffix}`
  return `${String(value)}${suffix}`
}

function projectTypeLabel(value: unknown) {
  const labels: Record<string, string> = { pv_dach: 'PV-Dachanlage', pv_freiflaeche: 'PV-Freifläche', bess: 'BESS', hybrid: 'Hybrid', wind: 'Wind', rechenzentrum: 'Rechenzentrum', sonstiges: 'Sonstiges' }
  return labels[String(value)] ?? display(value)
}

export default async function ProjectIntakeDocument(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: project } = await supabase.from('projects').select('*').eq('id', params.id).eq('user_id', user.id).single()
  if (!project) notFound()
  const rows = [
    ['Projektnummer', project.project_number], ['Projektname', project.project_name],
    ['Projekttyp', projectTypeLabel(project.project_type)], ['Projektphase', project.project_stage],
    ['Status', project.status], ['Land', project.location_country], ['Bundesland', project.location_state],
    ['Ort', project.location_city], ['PV-Leistung', display(project.pv_mwp, ' kWp')],
    ['AC-Leistung', display(project.pv_ac_mw, ' kWp')], ['BESS-Leistung', display(project.bess_mw, ' MW')],
    ['BESS-Kapazität', display(project.bess_mwh, ' MWh')], ['Pachtdauer', display(project.lease_term_years, ' Jahre')],
    ['Investitionsvolumen', project.investment_volume_eur ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(project.investment_volume_eur)) : '—'],
    ['Ansprechpartner', project.contact_name], ['E-Mail', project.contact_email], ['Telefon', project.contact_phone],
  ]

  return <div className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
    <div className="print:hidden mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3"><Link href={`/projects/${params.id}/overview`} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold"><ArrowLeft className="h-4 w-4" /> Zurück</Link><ProjectDocumentPrintButton projectId={params.id} type="project_intake_pdf" /></div>
    <article className="mx-auto max-w-4xl bg-white p-8 shadow-xl print:max-w-none print:shadow-none">
      <header className="flex items-start justify-between border-b-4 border-[#5CB800] pb-5"><img src="/brand/ema-logo.png" alt="EMA Enterprise" className="h-16 w-auto" /><div className="text-right"><h1 className="text-2xl font-extrabold text-[#1F2A44]">Projektaufnahmebogen</h1><p className="mt-1 text-sm font-bold text-[#5CB800]">{project.project_number}</p></div></header>
      <section className="mt-7 grid grid-cols-1 gap-x-8 md:grid-cols-2">{rows.map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 border-b py-3 text-sm"><span className="text-slate-500">{label}</span><strong className="text-right text-[#1F2A44]">{display(value)}</strong></div>)}</section>
      <section className="mt-7"><h2 className="text-sm font-extrabold uppercase tracking-wide text-[#1F2A44]">Projektbeschreibung / Notizen</h2><div className="mt-2 min-h-28 rounded-xl border p-4 text-sm leading-6 text-slate-700">{project.notes || '—'}</div></section>
      <footer className="mt-8 border-t pt-3 text-xs text-slate-400">Erzeugt aus den zentralen EMA-Projektdaten · Version {project.master_data_version ?? 1}</footer>
    </article>
  </div>
}
