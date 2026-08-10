'use client'

import { BatteryCharging, CheckSquare2, PanelsTopLeft } from 'lucide-react'
import {
  CHECKLIST_STATUS_LABELS,
  normalizeTechnicalChecklist,
  type ChecklistStatus,
} from '@/lib/partner-submission-checklist'

const inputClass = 'mt-2 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[#07142F] [color-scheme:light] outline-none focus:border-[#5CB800]'
const PROJECT_TYPES = [
  { value: 'pv_freiflaeche', label: 'PV-Freifläche', icon: PanelsTopLeft },
  { value: 'pv_dach', label: 'PV-Dach', icon: PanelsTopLeft },
  { value: 'bess', label: 'BESS', icon: BatteryCharging },
  { value: 'hybrid', label: 'Hybrid', icon: BatteryCharging },
]

export function PartnerProjectTypeSelector({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <section className="rounded-[1.75rem] border border-[#5CB800]/25 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">Schritt 1</p>
      <h2 className="mt-2 text-xl font-extrabold text-[#1F2A44]">Welches Projekt möchten Sie anbieten?</h2>
      <p className="mt-1 text-sm text-slate-500">Die passende technische Checkliste wird automatisch eingeblendet.</p>
      <input type="hidden" name="project_type" value={value} />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PROJECT_TYPES.map((option) => {
          const selected = value === option.value
          return (
            <button key={option.value} type="button" disabled={disabled} onClick={() => onChange(option.value)} aria-pressed={selected} className={`flex min-h-24 flex-col items-center justify-center rounded-2xl border px-3 py-4 text-center transition ${selected ? 'border-[#5CB800] bg-[#5CB800] text-white shadow-lg shadow-[#5CB800]/20' : 'border-slate-200 bg-white text-[#1F2A44] hover:border-[#5CB800]/50'} disabled:opacity-60`}>
              <option.icon className="h-6 w-6" />
              <span className="mt-2 text-sm font-extrabold">{option.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function StatusField({ name, label, initialValue }: { name: string; label: string; initialValue?: ChecklistStatus }) {
  return (
    <label><span className="text-sm font-bold">{label} *</span><select name={name} required defaultValue={initialValue ?? 'nicht_bekannt'} className={inputClass}>{Object.entries(CHECKLIST_STATUS_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
  )
}

export function PartnerTechnicalChecklistForm({ projectType, initialValue }: { projectType: string; initialValue?: unknown }) {
  const checklist = normalizeTechnicalChecklist(initialValue)
  const includesPv = projectType === 'pv_freiflaeche' || projectType === 'pv_dach' || projectType === 'hybrid'
  const includesBess = projectType === 'bess' || projectType === 'hybrid'

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-start gap-3"><CheckSquare2 className="mt-0.5 h-6 w-6 text-[#2F8A00]" /><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">Schritt 3</p><h2 className="mt-1 text-xl font-extrabold text-[#1F2A44]">Technische Projektcheckliste</h2><p className="mt-1 text-sm text-slate-500">Bitte den aktuellen Stand ehrlich angeben. „Nicht bekannt“ ist besser als eine Schätzung.</p></div></div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label><span className="text-sm font-bold">Projektstatus *</span><select name="checklist_project_stage" required defaultValue={checklist?.common.projectStage ?? 'entwicklung'} className={inputClass}><option value="entwicklung">In Entwicklung</option><option value="rtb">RTB</option><option value="baureif">Baureif</option><option value="betrieb">Im Betrieb</option></select></label>
        <label><span className="text-sm font-bold">Geplante Inbetriebnahme</span><input name="checklist_planned_commissioning" placeholder="z. B. Q3 2027" defaultValue={checklist?.common.plannedCommissioning ?? ''} className={inputClass} /></label>
        <label><span className="text-sm font-bold">Angebotspreis (€)</span><input name="checklist_purchase_price_eur" inputMode="decimal" defaultValue={checklist?.common.purchasePriceEur ?? ''} className={inputClass} /></label>
      </div>

      {includesPv && <div className="mt-7 rounded-2xl bg-[#f7fbf3] p-4 sm:p-5"><h3 className="flex items-center gap-2 font-extrabold text-[#1F2A44]"><PanelsTopLeft className="h-5 w-5 text-[#2F8A00]" /> PV-Checkliste</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">
        {projectType !== 'pv_dach' && <label><span className="text-sm font-bold">Grundstücksfläche (ha)</span><input name="checklist_pv_land_area_ha" inputMode="decimal" defaultValue={checklist?.pv?.landAreaHa ?? ''} className={inputClass} /></label>}
        {projectType === 'pv_dach' && <label><span className="text-sm font-bold">Nutzbare Dachfläche (m²)</span><input name="checklist_pv_roof_area_sqm" inputMode="decimal" defaultValue={checklist?.pv?.roofAreaSqm ?? ''} className={inputClass} /></label>}
        <StatusField name="checklist_pv_lease_status" label={projectType === 'pv_dach' ? 'Dachnutzungsvertrag / Eigentümerzustimmung' : 'Pachtvertrag / Grundstückssicherung'} initialValue={checklist?.pv?.leaseStatus} />
        <StatusField name="checklist_pv_grid_request_status" label="Netzanschlussanfrage" initialValue={checklist?.pv?.gridRequestStatus} />
        <StatusField name="checklist_pv_grid_commitment_status" label="Netzzusage" initialValue={checklist?.pv?.gridCommitmentStatus} />
        <StatusField name="checklist_pv_building_permit_status" label="Baugenehmigung / Baurecht" initialValue={checklist?.pv?.buildingPermitStatus} />
        <StatusField name="checklist_pv_eeg_award_status" label="EEG-Zuschlag" initialValue={checklist?.pv?.eegAwardStatus} />
        <StatusField name="checklist_pv_yield_report_status" label="Ertragsgutachten / PV-Sol" initialValue={checklist?.pv?.yieldReportStatus} />
      </div></div>}

      {includesBess && <div className="mt-7 rounded-2xl bg-[#f4f7fb] p-4 sm:p-5"><h3 className="flex items-center gap-2 font-extrabold text-[#1F2A44]"><BatteryCharging className="h-5 w-5 text-[#2F8A00]" /> BESS-Checkliste</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label><span className="text-sm font-bold">Benötigte Fläche (m²)</span><input name="checklist_bess_land_area_sqm" inputMode="decimal" defaultValue={checklist?.bess?.landAreaSqm ?? ''} className={inputClass} /></label>
        <label><span className="text-sm font-bold">Netzverknüpfungspunkt</span><input name="checklist_bess_grid_connection_point" defaultValue={checklist?.bess?.gridConnectionPoint ?? ''} className={inputClass} /></label>
        <label><span className="text-sm font-bold">Spannungsebene (kV)</span><input name="checklist_bess_voltage_level_kv" inputMode="decimal" defaultValue={checklist?.bess?.voltageLevelKv ?? ''} className={inputClass} /></label>
        <StatusField name="checklist_bess_grid_connection_status" label="Netzanschluss / Netzzusage" initialValue={checklist?.bess?.gridConnectionStatus} />
        <StatusField name="checklist_bess_building_permit_status" label="Baugenehmigung / Baurecht" initialValue={checklist?.bess?.buildingPermitStatus} />
        <StatusField name="checklist_bess_fire_safety_status" label="Brandschutzkonzept" initialValue={checklist?.bess?.fireSafetyStatus} />
        <StatusField name="checklist_bess_transformer_status" label="Transformator / Umspannwerk" initialValue={checklist?.bess?.transformerStatus} />
      </div></div>}
    </section>
  )
}
