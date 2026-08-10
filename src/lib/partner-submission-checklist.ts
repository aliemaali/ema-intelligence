export type ChecklistStatus = 'vorhanden' | 'in_pruefung' | 'nicht_vorhanden' | 'nicht_bekannt'

export type PartnerTechnicalChecklist = {
  version: 1
  common: {
    projectStage: string
    plannedCommissioning: string
    purchasePriceEur: number | null
  }
  pv?: {
    landAreaHa: number | null
    roofAreaSqm: number | null
    leaseStatus: ChecklistStatus
    gridRequestStatus: ChecklistStatus
    gridCommitmentStatus: ChecklistStatus
    buildingPermitStatus: ChecklistStatus
    eegAwardStatus: ChecklistStatus
    yieldReportStatus: ChecklistStatus
  }
  bess?: {
    landAreaSqm: number | null
    gridConnectionStatus: ChecklistStatus
    gridConnectionPoint: string
    voltageLevelKv: number | null
    buildingPermitStatus: ChecklistStatus
    fireSafetyStatus: ChecklistStatus
    transformerStatus: ChecklistStatus
  }
}

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  vorhanden: 'Vorhanden',
  in_pruefung: 'In Prüfung',
  nicht_vorhanden: 'Nicht vorhanden',
  nicht_bekannt: 'Nicht bekannt',
}

function text(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

function numberOrNull(form: FormData, name: string) {
  const value = text(form, name).replace(',', '.')
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function status(form: FormData, name: string): ChecklistStatus {
  const value = text(form, name) as ChecklistStatus
  return value in CHECKLIST_STATUS_LABELS ? value : 'nicht_bekannt'
}

export function normalizeTechnicalChecklist(value: unknown): PartnerTechnicalChecklist | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const checklist = value as Partial<PartnerTechnicalChecklist>
  if (checklist.version !== 1 || !checklist.common) return null
  return checklist as PartnerTechnicalChecklist
}

export function buildTechnicalChecklist(form: FormData, projectType: string): PartnerTechnicalChecklist {
  const includesPv = projectType === 'pv_freiflaeche' || projectType === 'pv_dach' || projectType === 'hybrid'
  const includesBess = projectType === 'bess' || projectType === 'hybrid'

  return {
    version: 1,
    common: {
      projectStage: text(form, 'checklist_project_stage'),
      plannedCommissioning: text(form, 'checklist_planned_commissioning'),
      purchasePriceEur: numberOrNull(form, 'checklist_purchase_price_eur'),
    },
    pv: includesPv ? {
      landAreaHa: numberOrNull(form, 'checklist_pv_land_area_ha'),
      roofAreaSqm: numberOrNull(form, 'checklist_pv_roof_area_sqm'),
      leaseStatus: status(form, 'checklist_pv_lease_status'),
      gridRequestStatus: status(form, 'checklist_pv_grid_request_status'),
      gridCommitmentStatus: status(form, 'checklist_pv_grid_commitment_status'),
      buildingPermitStatus: status(form, 'checklist_pv_building_permit_status'),
      eegAwardStatus: status(form, 'checklist_pv_eeg_award_status'),
      yieldReportStatus: status(form, 'checklist_pv_yield_report_status'),
    } : undefined,
    bess: includesBess ? {
      landAreaSqm: numberOrNull(form, 'checklist_bess_land_area_sqm'),
      gridConnectionStatus: status(form, 'checklist_bess_grid_connection_status'),
      gridConnectionPoint: text(form, 'checklist_bess_grid_connection_point'),
      voltageLevelKv: numberOrNull(form, 'checklist_bess_voltage_level_kv'),
      buildingPermitStatus: status(form, 'checklist_bess_building_permit_status'),
      fireSafetyStatus: status(form, 'checklist_bess_fire_safety_status'),
      transformerStatus: status(form, 'checklist_bess_transformer_status'),
    } : undefined,
  }
}
