/**
 * EMA Intelligence – Database Types
 * Auto-generated structure matching 001_initial_schema.sql
 *
 * In production, regenerate with:
 *   npm run db:types
 * (requires Supabase CLI and local instance running)
 */

export type ProjectType =
  | 'pv_freiflaeche'
  | 'pv_dach'
  | 'bess'
  | 'hybrid'
  | 'wind'
  | 'rechenzentrum'
  | 'sonstiges'

export type ProjectStatus =
  | 'lead'
  | 'vorpruefung'
  | 'investorensuche'
  | 'dd'
  | 'loi'
  | 'spa'
  | 'closing'
  | 'verkauft'
  | 'abgelehnt'

export type ProjectPriority = 'hoch' | 'mittel' | 'niedrig'

export type MarketingStatus =
  | 'nicht_gestartet'
  | 'in_vermarktung'
  | 'an_investoren_versendet'
  | 'dd_laeuft'
  | 'loi_erhalten'
  | 'exklusiv_reserviert'
  | 'verkauft'

export type MarginType = 'percent' | 'per_kwp' | 'included_per_kwp' | 'per_mwh'
export type PurchasePriceType = 'fixed' | 'per_kwp'
export type DataCenterStatus = 'in_entwicklung' | 'rtb'
export type DealStatus = 'open' | 'negotiating' | 'closed_won' | 'closed_lost'

export type DocumentType =
  | 'expose'
  | 'lageplan'
  | 'netzanschluss'
  | 'pachtvertrag'
  | 'genehmigung'
  | 'gutachten'
  | 'bild'
  | 'nda'
  | 'loi'
  | 'spa'
  | 'sonstiges'

export type TaskPriority = 'hoch' | 'mittel' | 'niedrig'
export type TaskStatus = 'offen' | 'in_bearbeitung' | 'erledigt'

export type ActivityType =
  | 'status_change'
  | 'document_upload'
  | 'investor_contact'
  | 'note_added'
  | 'email_sent'
  | 'deal_update'
  | 'task_created'
  | 'partner_linked'
  | 'investor_linked'
  | 'manual'

export type CommissionStatus = 'offen' | 'faellig' | 'bezahlt'
export type AiOutputStatus = 'draft' | 'approved' | 'rejected' | 'published'

export interface DevStatus {
  netzanschluss: boolean | null
  baugenehmigung: boolean | null
  pachtvertrag: boolean | null
  eeg_faehigkeit: boolean | null
  gutachten: boolean | null
  umweltpruefung: boolean | null
}

export interface HybridConfig {
  pv_mwp: number | null
  bess_mwh: number | null
  bess_mw: number | null
  wind_mw?: number | null
}

export interface ActivityMetadata {
  file_name?: string
  document_type?: string
  email_subject?: string
  email_to?: string
  [key: string]: unknown
}

export interface Profile {
  id: string
  email: string
  full_name: string
  company: string
  role: string
  avatar_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Partner {
  id: string
  user_id: string
  full_name: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  location_city: string | null
  location_state: string | null
  notes: string | null
  project_count: number
  deal_count: number
  close_rate: number
  total_volume: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Investor {
  id: string
  user_id: string
  full_name: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  location_city: string | null
  location_country: string | null
  interest_pv: boolean
  interest_bess: boolean
  interest_hybrid: boolean
  interest_wind: boolean
  size_preferences: string[]
  investment_type: string | null
  min_ticket_eur: number | null
  max_ticket_eur: number | null
  dd_ready: boolean
  last_contact: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  partner_id: string | null
  project_number: string
  project_name: string
  project_type: ProjectType
  status: ProjectStatus
  priority: ProjectPriority
  marketing_status: MarketingStatus
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  location_address: string | null
  location_city: string | null
  location_state: string | null
  location_country: string
  location_lat: number | null
  location_lng: number | null
  pv_mwp: number | null
  pv_ac_mw: number | null
  bess_mw: number | null
  bess_mwh: number | null
  bess_duration_h: number | null
  hybrid_config: HybridConfig | null
  datacenter_grid_mw?: number | null
  datacenter_it_mw?: number | null
  datacenter_land_sqm?: number | null
  datacenter_transformer_status?: string | null
  datacenter_status?: DataCenterStatus | null
  dev_status: DevStatus
  ai_score: number | null
  ai_score_details: Record<string, unknown> | null
  ai_last_analyzed: string | null
  notes: string | null
  tags: string[]
  last_activity_at: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  project_id: string
  user_id: string
  investor_id: string | null
  deal_number: string
  is_active: boolean
  deal_status: DealStatus
  purchase_price_type?: PurchasePriceType
  purchase_price: number | null
  purchase_per_kwp: number | null
  purchase_per_mwh: number | null
  margin_type: MarginType
  margin_value: number | null
  margin_eur: number | null
}

export interface Expense {
  id: string
  deal_id: string
  user_id: string
  category: string
  amount_eur: number
  description: string | null
  created_at: string
  updated_at: string
}
