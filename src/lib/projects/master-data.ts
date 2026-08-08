export type ProjectSource =
  | 'manual'
  | 'customer_intake'
  | 'data_center_site_check'
  | 'project_intake_pdf'
  | 'legacy_html'
  | 'capex'
  | 'document_import'

export interface ProjectFieldSource {
  source: ProjectSource
  sourceName?: string
  importedAt?: string
  verifiedAt?: string
}

export interface ProjectCustomerIntake {
  companyName?: string
  contactPerson?: string
  phone?: string
  email?: string
  customerType?: string
  buildingType?: string
  usageType?: string
  postalCode?: string
  parcel?: string
  gridOperator?: string
  roofAreaSqm?: number
  annualConsumptionKwh?: number
  notes?: string
}

export type DataCenterZoningDesignation =
  | 'agricultural'
  | 'industrial'
  | 'commercial'
  | 'mixed'
  | 'special'
  | 'unknown'

export type DataCenterCheckState = 'yes' | 'no' | 'in_preparation' | 'verify' | 'planned' | 'unknown'

export interface DataCenterSiteCheck {
  district?: string
  streetPlot?: string
  gpsCoordinates?: string
  siteAreaHectares?: number
  landCost?: string
  pricePerSqmEur?: number
  zoningDesignation?: DataCenterZoningDesignation
  otherDesignation?: string
  zoningPlanStatus?: DataCenterCheckState
  dataCenterPermitted?: DataCenterCheckState
  planningNotes?: string
  hvDistanceMeters?: number
  hvStationName?: string
  gridOperator?: string
  fiberDistanceMeters?: number
  fiberProvider?: string
  fiberStatus?: DataCenterCheckState
  assessmentDate?: string
  additionalNotes?: string
  savedAt?: string
}

export interface ProjectMasterData {
  id: string
  projectNumber: string
  projectName: string
  projectType: string
  projectStage?: string | null
  locationAddress?: string | null
  locationCity?: string | null
  locationState?: string | null
  locationCountry?: string | null
  pvKwp?: number | null
  bessMw?: number | null
  bessMwh?: number | null
  feedInType?: string | null
  feedInTariffCtKwh?: number | null
  specificYieldKwhKwp?: number | null
  leaseTermYears?: number | null
  investmentVolumeEur?: number | null
  customerIntake: ProjectCustomerIntake
  sourceMetadata: Record<string, ProjectFieldSource>
  masterDataVersion: number
  masterDataUpdatedAt: string
}

/**
 * Dokumente sind Ausgaben, keine zweite Datenquelle.
 * Jede Ausgabe trägt die Version der Projektdaten, aus der sie erzeugt wurde.
 */
export interface ProjectGeneratedOutput {
  type:
    | 'investment_memorandum'
    | 'project_intake_pdf'
    | 'acquisition_docx'
    | 'customer_intake_pdf'
    | 'standalone_html'
  generatedAt: string
  masterDataVersion: number
  documentId?: string
}
