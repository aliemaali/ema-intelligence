import { BatteryCharging, CheckSquare2, PanelsTopLeft } from 'lucide-react'
import { CHECKLIST_STATUS_LABELS, normalizeTechnicalChecklist, type ChecklistStatus } from '@/lib/partner-submission-checklist'

function displayStatus(value: ChecklistStatus | undefined) {
  return value ? CHECKLIST_STATUS_LABELS[value] : 'Nicht bekannt'
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2.5 text-sm last:border-b-0"><span className="text-slate-500">{label}</span><strong className="text-right text-[#1F2A44]">{value || '–'}</strong></div>
}

export function PartnerSubmissionChecklistSummary({ value }: { value: unknown }) {
  const checklist = normalizeTechnicalChecklist(value)
  if (!checklist) return null

  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2"><CheckSquare2 className="h-5 w-5 text-[#2F8A00]" /><h2 className="text-xl font-extrabold text-[#07142F]">Technische Checkliste</h2></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-extrabold">Projekt</h3><div className="mt-2"><Row label="Projektstatus" value={checklist.common.projectStage} /><Row label="Geplante Inbetriebnahme" value={checklist.common.plannedCommissioning} /><Row label="Angebotspreis" value={checklist.common.purchasePriceEur ? `${checklist.common.purchasePriceEur.toLocaleString('de-DE')} €` : null} /></div></div>
        {checklist.pv && <div className="rounded-2xl border border-[#5CB800]/20 bg-[#fafff6] p-4"><h3 className="flex items-center gap-2 font-extrabold"><PanelsTopLeft className="h-5 w-5 text-[#2F8A00]" /> PV</h3><div className="mt-2"><Row label="Grundstück" value={checklist.pv.landAreaHa ? `${checklist.pv.landAreaHa.toLocaleString('de-DE')} ha` : null} /><Row label="Dachfläche" value={checklist.pv.roofAreaSqm ? `${checklist.pv.roofAreaSqm.toLocaleString('de-DE')} m²` : null} /><Row label="Pacht / Zustimmung" value={displayStatus(checklist.pv.leaseStatus)} /><Row label="Netzanfrage" value={displayStatus(checklist.pv.gridRequestStatus)} /><Row label="Netzzusage" value={displayStatus(checklist.pv.gridCommitmentStatus)} /><Row label="Baugenehmigung" value={displayStatus(checklist.pv.buildingPermitStatus)} /><Row label="EEG-Zuschlag" value={displayStatus(checklist.pv.eegAwardStatus)} /><Row label="Ertragsgutachten" value={displayStatus(checklist.pv.yieldReportStatus)} /></div></div>}
        {checklist.bess && <div className="rounded-2xl border border-slate-200 bg-[#f7f9fc] p-4"><h3 className="flex items-center gap-2 font-extrabold"><BatteryCharging className="h-5 w-5 text-[#2F8A00]" /> BESS</h3><div className="mt-2"><Row label="Flächenbedarf" value={checklist.bess.landAreaSqm ? `${checklist.bess.landAreaSqm.toLocaleString('de-DE')} m²` : null} /><Row label="Netzverknüpfungspunkt" value={checklist.bess.gridConnectionPoint} /><Row label="Spannungsebene" value={checklist.bess.voltageLevelKv ? `${checklist.bess.voltageLevelKv.toLocaleString('de-DE')} kV` : null} /><Row label="Netzanschluss" value={displayStatus(checklist.bess.gridConnectionStatus)} /><Row label="Baugenehmigung" value={displayStatus(checklist.bess.buildingPermitStatus)} /><Row label="Brandschutz" value={displayStatus(checklist.bess.fireSafetyStatus)} /><Row label="Trafo / Umspannwerk" value={displayStatus(checklist.bess.transformerStatus)} /></div></div>}
      </div>
    </section>
  )
}
