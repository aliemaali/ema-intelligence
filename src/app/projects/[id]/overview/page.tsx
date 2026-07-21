import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/actions/project.actions'
import { DevelopmentStatusEditor } from '@/components/projects/DevelopmentStatusEditor'
import { SectionHeader, InfoRow } from '@/components/ui'
import { formatMW, formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils'
import {
  PROJECT_STATUS_LABELS, PRIORITY_LABELS,
  MARKETING_STATUS_LABELS, PROJECT_TYPE_LABELS,
} from '@/lib/types/constants'

interface OverviewTabProps {
  params: { id: string }
}

export default async function OverviewTab({ params }: OverviewTabProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let project: any
  try {
    project = await getProject(params.id)
  } catch {
    notFound()
  }
  if (!project) notFound()

  const hasPv = project.pv_mwp !== null
  const hasBess = project.bess_mwh !== null
  const status = project.dev_status ?? {}

  const devItems = project.project_type === 'pv_dach'
    ? [
        { key: 'expose', label: 'Exposé', value: status.expose ?? null },
        { key: 'pv_sol', label: 'PV-Sol', value: status.pv_sol ?? null },
        { key: 'netzanschluss', label: 'Netzanschluss', value: status.netzanschluss ?? null },
        { key: 'pachtvertrag', label: 'Pachtvertrag', value: status.pachtvertrag ?? null },
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
      <div className="card-padded border-[#5CB800]/20 bg-[#5CB800]/5">
        <SectionHeader title="Exposé & Amortisation" />
        <p className="text-sm leading-6 text-muted-foreground">
          Exposés und Amortisationsberechnungen werden ausschließlich zentral über EMA-AI erstellt.
        </p>
      </div>

      <div className="card-padded">
        <SectionHeader title="Allgemeine Daten" />
        <div className="space-y-0">
          <InfoRow label="Projektnummer" value={project.project_number} mono />
          <InfoRow label="Typ" value={(PROJECT_TYPE_LABELS as any)[project.project_type]} />
          <InfoRow label="Status" value={(PROJECT_STATUS_LABELS as any)[project.status]} />
          <InfoRow label="Priorität" value={(PRIORITY_LABELS as any)[project.priority]} />
          <InfoRow label="Vermarktung" value={(MARKETING_STATUS_LABELS as any)[project.marketing_status]} />
          <InfoRow label="Land" value={project.location_country} />
          {project.location_state && <InfoRow label="Bundesland" value={project.location_state} />}
          {project.location_city && <InfoRow label="Ort" value={project.location_city} />}
          <InfoRow label="Erstellt" value={formatDate(project.created_at)} />
          <InfoRow label="Letzte Aktivität" value={formatRelativeTime(project.last_activity_at)} />
        </div>
      </div>

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

      <div className="card-padded">
        <SectionHeader title="Technische Daten" />
        <div className="space-y-0">
          {hasPv && (
            <>
              <InfoRow label="DC-Leistung" value={formatMW(project.pv_mwp, 'kWp')} />
              {project.pv_ac_mw && <InfoRow label="AC-Leistung" value={formatMW(project.pv_ac_mw, 'kWp')} />}
            </>
          )}
          {hasBess && (
            <>
              <InfoRow label="BESS Leistung" value={formatMW(project.bess_mw, 'MW')} />
              <InfoRow label="BESS Energie" value={formatMW(project.bess_mwh, 'MWh')} />
              {project.bess_duration_h && <InfoRow label="Dauer" value={`${project.bess_duration_h} h`} />}
            </>
          )}
          {!hasPv && !hasBess && (
            <p className="text-sm text-muted-foreground py-2">Noch keine technischen Daten erfasst.</p>
          )}
        </div>
      </div>

      <div className="card-padded">
        <DevelopmentStatusEditor projectId={project.id} items={devItems} />
      </div>

      {project.deal_net_profit !== null && (
        <div className="card-padded border-[#5CB800]/20 bg-[#5CB800]/5">
          <SectionHeader title="Deal Snapshot" />
          <div className="space-y-0">
            <InfoRow label="EK-Preis" value={formatCurrency(project.deal_purchase_price)} />
            <InfoRow label="Verkaufspreis" value={formatCurrency(project.deal_sales_price)} />
            <InfoRow label="Bruttomarge" value={formatCurrency(project.deal_gross_margin)} />
            <div className="flex items-center justify-between py-2 gap-3">
              <span className="text-xs text-muted-foreground">Nettogewinn</span>
              <span className="text-base font-bold text-[#5CB800]">
                {formatCurrency(project.deal_net_profit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {project.notes && (
        <div className="card-padded">
          <SectionHeader title="Notizen" />
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {project.notes}
          </p>
        </div>
      )}
    </div>
  )
}
