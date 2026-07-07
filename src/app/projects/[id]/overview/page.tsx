import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/actions/project.actions'
import { SectionHeader, InfoRow, DevStatusDot } from '@/components/ui'
import { formatMW, formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils'
import ExposeButton from '@/components/projects/ExposeButton'
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

  const hasPv   = project.pv_mwp  !== null
  const hasBess = project.bess_mwh !== null

  const devItems = [
    { label: 'Netzanschluss',  value: project.dev_status?.netzanschluss  ?? null },
    { label: 'Baugenehmigung', value: project.dev_status?.baugenehmigung ?? null },
    { label: 'Pachtvertrag',   value: project.dev_status?.pachtvertrag   ?? null },
    { label: 'EEG-Fähigkeit',  value: project.dev_status?.eeg_faehigkeit ?? null },
    { label: 'Gutachten',      value: project.dev_status?.gutachten       ?? null },
    { label: 'Umweltprüfung',  value: project.dev_status?.umweltpruefung ?? null },
  ]

  const devDone  = devItems.filter((d) => d.value === true).length
  const devTotal = devItems.length
  const devPct   = Math.round((devDone / devTotal) * 100)

  return (
    <div className="py-4 space-y-5 max-w-2xl">
      <div className="flex justify-end">
        <ExposeButton project={project} />
      </div>

      {/* Allgemeine Daten */}
      <div className="card-padded">
        <SectionHeader title="Allgemeine Daten" />
        <div className="space-y-0">
          <InfoRow label="Projektnummer"    value={project.project_number} mono />
          <InfoRow label="Typ"              value={(PROJECT_TYPE_LABELS as any)[project.project_type]} />
          <InfoRow label="Status"           value={(PROJECT_STATUS_LABELS as any)[project.status]} />
          <InfoRow label="Priorität"        value={(PRIORITY_LABELS as any)[project.priority]} />
          <InfoRow label="Vermarktung"      value={(MARKETING_STATUS_LABELS as any)[project.marketing_status]} />
          <InfoRow label="Land"             value={project.location_country} />
          {project.location_state && <InfoRow label="Bundesland" value={project.location_state} />}
          {project.location_city  && <InfoRow label="Ort"        value={project.location_city} />}
          <InfoRow label="Erstellt"         value={formatDate(project.created_at)} />
          <InfoRow label="Letzte Aktivität" value={formatRelativeTime(project.last_activity_at)} />
        </div>
      </div>

      {/* Kontakt */}
      {(project.contact_name || project.partner_name) && (
        <div className="card-padded">
          <SectionHeader title="Kontakt" />
          <div className="space-y-0">
            {project.partner_company && <InfoRow label="Partner"         value={project.partner_company} />}
            {project.contact_name    && <InfoRow label="Ansprechpartner" value={project.contact_name} />}
            {project.contact_email   && <InfoRow label="E-Mail"          value={project.contact_email} />}
            {project.contact_phone   && <InfoRow label="Telefon"         value={project.contact_phone} />}
          </div>
        </div>
      )}

      {/* Technische Daten */}
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
              <InfoRow label="BESS Energie"  value={formatMW(project.bess_mwh, 'MWh')} />
              {project.bess_duration_h && <InfoRow label="Dauer" value={`${project.bess_duration_h} h`} />}
            </>
          )}
          {!hasPv && !hasBess && (
            <p className="text-sm text-muted-foreground py-2">Noch keine technischen Daten erfasst.</p>
          )}
        </div>
      </div>

      {/* Entwicklungsstand */}
      <div className="card-padded">
        <SectionHeader
          title="Entwicklungsstand"
          action={
            <span className="text-xs font-medium text-muted-foreground">
              {devDone}/{devTotal} abgeschlossen
            </span>
          }
        />
        <div className="w-full h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-[#5CB800] rounded-full transition-all"
            style={{ width: `${devPct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
          {devItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <DevStatusDot value={item.value} />
              <span className="text-sm text-foreground">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Erfüllt
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Nicht erfüllt
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30 border border-border" /> Offen
          </span>
        </div>
      </div>

      {/* Deal Snapshot */}
      {project.deal_net_profit !== null && (
        <div className="card-padded border-[#5CB800]/20 bg-[#5CB800]/5">
          <SectionHeader title="Deal Snapshot" />
          <div className="space-y-0">
            <InfoRow label="EK-Preis"      value={formatCurrency(project.deal_purchase_price)} />
            <InfoRow label="Verkaufspreis" value={formatCurrency(project.deal_sales_price)} />
            <InfoRow label="Bruttomarge"   value={formatCurrency(project.deal_gross_margin)} />
            <div className="flex items-center justify-between py-2 gap-3">
              <span className="text-xs text-muted-foreground">Nettogewinn</span>
              <span className="text-base font-bold text-[#5CB800]">
                {formatCurrency(project.deal_net_profit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Notizen */}
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
