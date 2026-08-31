import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/actions/project.actions'
import { DevelopmentStatusEditor } from '@/components/projects/DevelopmentStatusEditor'
import { CustomerIntakeEditor } from '@/components/projects/CustomerIntakeEditor'
import { SectionHeader, InfoRow } from '@/components/ui'
import { formatMW, formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils'
import {
  PROJECT_STATUS_LABELS, PRIORITY_LABELS,
  MARKETING_STATUS_LABELS, PROJECT_TYPE_LABELS,
} from '@/lib/types/constants'
import { formatProjectCountryLabel } from '@/lib/projects/location'
import type { ProjectCustomerIntake } from '@/lib/projects/master-data'
import { calculateBessPortfolioTotals, portfolioFromSourceMetadata } from '@/lib/projects/bessPortfolio'

interface OverviewTabProps { params: Promise<{ id: string }> }

export default async function OverviewTab(props: OverviewTabProps) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let project: any
  try { project = await getProject(params.id) } catch { notFound() }
  if (!project) notFound()

  const hasPv = project.pv_mwp !== null
  const hasBess = project.bess_mwh !== null
  const status = project.dev_status ?? {}
  const customerIntake = (project.customer_intake ?? {}) as ProjectCustomerIntake
  const bessPortfolio = portfolioFromSourceMetadata(project.source_metadata)
  const portfolioTotals = calculateBessPortfolioTotals(bessPortfolio)

  const devItems = project.project_type === 'pv_dach'
    ? [
        { key: 'netzanschluss', label: 'Netzanschluss', value: status.netzanschluss ?? null },
        { key: 'pachtvertrag', label: 'Pachtvertrag', value: status.pachtvertrag ?? null },
        { key: 'eeg_faehigkeit', label: 'EEG-Fähigkeit', value: status.eeg_faehigkeit ?? null },
      ]
    : [
        { key: 'netzanschluss', label: 'Netzanschluss', value: status.netzanschluss ?? null },
        { key: 'baugenehmigung', label: 'Baugenehmigung', value: status.baugenehmigung ?? null },
        { key: 'pachtvertrag', label: 'Pachtvertrag', value: status.pachtvertrag ?? null },
        { key: 'eeg_faehigkeit', label: 'EEG-Fähigkeit', value: status.eeg_faehigkeit ?? null },
        { key: 'gutachten', label: 'Gutachten', value: status.gutachten ?? null },
        { key: 'umweltpruefung', label: 'Umweltprüfung', value: status.umweltpruefung ?? null },
      ]

  return (
    <div className="py-4 space-y-5 max-w-2xl">
      <div className="card-padded">
        <SectionHeader title="Allgemeine Daten" />
        <div className="space-y-0">
          <InfoRow label="Projektnummer" value={project.project_number} mono />
          <InfoRow label="Typ" value={(PROJECT_TYPE_LABELS as any)[project.project_type]} />
          <InfoRow label="Status" value={(PROJECT_STATUS_LABELS as any)[project.status]} />
          <InfoRow label="Priorität" value={(PRIORITY_LABELS as any)[project.priority]} />
          <InfoRow label="Vermarktung" value={(MARKETING_STATUS_LABELS as any)[project.marketing_status]} />
          <InfoRow label="Land" value={formatProjectCountryLabel(project.location_country)} />
          {project.location_state && <InfoRow label="Bundesland" value={project.location_state} />}
          {project.location_city && <InfoRow label="Ort" value={project.location_city} />}
          <InfoRow label="Erstellt" value={formatDate(project.created_at)} />
          <InfoRow label="Letzte Aktivität" value={formatRelativeTime(project.last_activity_at)} />
        </div>
      </div>

      {bessPortfolio && <div className="card-padded border-[#5CB800]/25 bg-[#5CB800]/5">
        <SectionHeader title="BESS-Portfolio · Paketverkauf" />
        <div className="mb-4 grid grid-cols-3 gap-2 text-center"><PortfolioTotal label="Standorte" value={String(portfolioTotals.siteCount)} /><PortfolioTotal label="Leistung" value={`${portfolioTotals.mw.toLocaleString('de-DE')} MW`} /><PortfolioTotal label="Kapazität" value={`${portfolioTotals.mwh.toLocaleString('de-DE')} MWh`} /></div>
        <div className="space-y-3">{bessPortfolio.sites.map((site) => <div key={site.name} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-[#07142F]">{site.name}</h3><p className="mt-1 text-xs text-slate-500">{site.state || 'Deutschland'}</p></div><strong className="text-right text-sm text-[#2F8A00]">{site.mw ?? '—'} MW<br /><span className="text-xs text-slate-500">{site.mwh ?? '—'} MWh</span></strong></div><div className="mt-3 grid gap-2 text-xs"><SiteStatus label="Netz" value={[site.gridOperator, site.gridStatus].filter(Boolean).join(' · ')} /><SiteStatus label="Fläche" value={site.landStatus} /><SiteStatus label="Genehmigung" value={site.permitStatus} /></div></div>)}</div>
      </div>}

      {(project.contact_name || project.partner_name) && (
        <div className="card-padded">
          <SectionHeader title="Kontakt" />
          <div className="space-y-0">
            {project.partner_company && <InfoRow label="Partner" value={project.partner_company} />}
            {project.contact_name && <InfoRow label="Ansprechpartner" value={project.contact_name} />}
            {project.contact_email && <InfoRow label="E-Mail" value={project.contact_email} />}
            {project.contact_phone && <InfoRow label="Telefon" value={project.contact_phone} />}
          </div>
        </div>
      )}

      <div className="card-padded"><CustomerIntakeEditor projectId={project.id} value={customerIntake} /></div>

      <div className="card-padded">
        <SectionHeader title="Technische Daten" />
        <div className="space-y-0">
          {hasPv && <><InfoRow label="DC-Leistung" value={formatMW(project.pv_mwp, 'kWp')} />{project.pv_ac_mw && <InfoRow label="AC-Leistung" value={formatMW(project.pv_ac_mw, 'kWp')} />}</>}
          {hasBess && <><InfoRow label="BESS Leistung" value={formatMW(project.bess_mw, 'MW')} /><InfoRow label="BESS Energie" value={formatMW(project.bess_mwh, 'MWh')} />{project.bess_duration_h && <InfoRow label="Dauer" value={`${project.bess_duration_h} h`} />}</>}
          {!hasPv && !hasBess && <p className="text-sm text-muted-foreground py-2">Noch keine technischen Daten erfasst.</p>}
        </div>
      </div>

      <div className="card-padded"><DevelopmentStatusEditor projectId={project.id} items={devItems} /></div>

      {project.deal_net_profit !== null && (
        <div className="card-padded border-[#5CB800]/20 bg-[#5CB800]/5">
          <SectionHeader title="Deal Snapshot" />
          <div className="space-y-0">
            <InfoRow label="EK-Preis" value={formatCurrency(project.deal_purchase_price)} />
            <InfoRow label="Verkaufspreis" value={formatCurrency(project.deal_sales_price)} />
            <InfoRow label="Bruttomarge" value={formatCurrency(project.deal_gross_margin)} />
            <div className="flex items-center justify-between py-2 gap-3"><span className="text-xs text-muted-foreground">Nettogewinn</span><span className="text-base font-bold text-[#5CB800]">{formatCurrency(project.deal_net_profit)}</span></div>
          </div>
        </div>
      )}

      {project.notes && <div className="card-padded"><SectionHeader title="Notizen" /><p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{project.notes}</p></div>}
    </div>
  )
}

function PortfolioTotal({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#07142F] px-2 py-3 text-white"><p className="text-[9px] font-bold uppercase tracking-wide text-white/55">{label}</p><p className="mt-1 text-sm font-extrabold">{value}</p></div>
}

function SiteStatus({ label, value }: { label: string; value: string }) {
  const pending = !value || /nicht|offen|unbekannt/i.test(value)
  return <div className="grid grid-cols-[75px_1fr] gap-2 border-t border-slate-100 pt-2"><span className="text-slate-500">{label}</span><strong className={`text-right ${pending ? 'text-amber-700' : 'text-[#07142F]'}`}>{value || 'Nicht bekannt'}</strong></div>
}
