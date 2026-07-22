/** EMA Intelligence database types */

export type ProjectType =
  | 'pv_freiflaeche'
  | 'pv_dach'
  | 'bess'
  | 'hybrid'
  | 'wind'
  | 'rechenzentrum'
  | 'sonstiges'

export type ProjectStatus = 'lead' | 'vorpruefung' | 'investorensuche' | 'dd' | 'loi' | 'spa' | 'closing' | 'verkauft' | 'abgelehnt'
export type ProjectPriority = 'hoch' | 'mittel' | 'niedrig'
export type MarketingStatus = 'nicht_gestartet' | 'in_vermarktung' | 'an_investoren_versendet' | 'dd_laeuft' | 'loi_erhalten' | 'exklusiv_reserviert' | 'verkauft'
export type MarginType = 'percent' | 'per_kwp' | 'included_per_kwp' | 'per_mwh'
export type PurchasePriceType = 'fixed' | 'per_kwp'
export type DataCenterStatus = 'in_entwicklung' | 'rtb'
export type DealStatus = 'open' | 'negotiating' | 'closed_won' | 'closed_lost'
export type DocumentType = 'expose' | 'lageplan' | 'netzanschluss' | 'pachtvertrag' | 'genehmigung' | 'gutachten' | 'bild' | 'nda' | 'loi' | 'spa' | 'sonstiges'
export type TaskPriority = 'hoch' | 'mittel' | 'niedrig'
export type TaskStatus = 'offen' | 'in_bearbeitung' | 'erledigt'
export type ActivityType = 'status_change' | 'document_upload' | 'investor_contact' | 'note_added' | 'email_sent' | 'deal_update' | 'task_created' | 'partner_linked' | 'investor_linked' | 'manual'
export type CommissionStatus = 'offen' | 'faellig' | 'bezahlt'
export type AiOutputStatus = 'draft' | 'approved' | 'rejected' | 'published'

export interface DevStatus { netzanschluss: boolean | null; baugenehmigung: boolean | null; pachtvertrag: boolean | null; eeg_faehigkeit: boolean | null; gutachten: boolean | null; umweltpruefung: boolean | null }
export interface HybridConfig { pv_mwp: number | null; bess_mwh: number | null; bess_mw: number | null; wind_mw?: number | null }
export interface ActivityMetadata { file_name?: string; document_type?: string; email_subject?: string; email_to?: string; [key: string]: unknown }

export interface Profile { id: string; email: string; full_name: string; company: string; role: string; avatar_url: string | null; phone: string | null; created_at: string; updated_at: string }
export interface Partner { id: string; user_id: string; full_name: string; company: string | null; email: string | null; phone: string | null; website: string | null; location_city: string | null; location_state: string | null; notes: string | null; project_count: number; deal_count: number; close_rate: number; total_volume: number; is_active: boolean; created_at: string; updated_at: string }
export interface Investor { id: string; user_id: string; full_name: string; company: string | null; email: string | null; phone: string | null; website: string | null; location_city: string | null; location_country: string | null; interest_pv: boolean; interest_bess: boolean; interest_hybrid: boolean; interest_wind: boolean; size_preferences: string[]; investment_type: string | null; min_ticket_eur: number | null; max_ticket_eur: number | null; dd_ready: boolean; last_contact: string | null; notes: string | null; is_active: boolean; created_at: string; updated_at: string }

export interface Project {
  id: string; user_id: string; partner_id: string | null; project_number: string; project_name: string; project_type: ProjectType; status: ProjectStatus; priority: ProjectPriority; marketing_status: MarketingStatus;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null; location_address: string | null; location_city: string | null; location_state: string | null; location_country: string; location_lat: number | null; location_lng: number | null;
  pv_mwp: number | null; pv_ac_mw: number | null; bess_mw: number | null; bess_mwh: number | null; bess_duration_h: number | null; hybrid_config: HybridConfig | null;
  data_center_grid_mw?: number | null; data_center_it_mw?: number | null; land_area_sqm?: number | null; transformer_status?: string | null; data_center_status?: DataCenterStatus | null;
  dev_status: DevStatus; ai_score: number | null; ai_score_details: Record<string, unknown> | null; ai_last_analyzed: string | null; notes: string | null; tags: string[]; last_activity_at: string | null; is_archived: boolean; created_at: string; updated_at: string;
}

export interface Deal {
  id: string; project_id: string; user_id: string; investor_id: string | null; deal_number: string; is_active: boolean; deal_status: DealStatus;
  purchase_price_type?: PurchasePriceType; purchase_price: number | null; purchase_per_kwp: number | null; purchase_per_mwh: number | null; margin_type: MarginType; margin_value: number | null; margin_eur: number | null; included_margin_per_kwp?: number | null;
  sales_price: number | null; gross_margin: number | null; gross_margin_pct: number | null; net_profit: number | null; net_profit_pct: number | null; offer_date: string | null; loi_date: string | null; spa_date: string | null; closing_date: string | null; notes: string | null; created_at: string; updated_at: string;
}

export interface Expense { id: string; deal_id: string; project_id: string; user_id: string; category: 'aussenprovision' | 'reise' | 'beratung' | 'sonstiges'; description: string | null; amount_eur: number; date_incurred: string | null; is_confirmed: boolean; created_at: string; updated_at: string }
export interface ExternalCommission { id: string; project_id: string; deal_id: string | null; partner_id: string; user_id: string; commission_type: 'percent' | 'fixed'; commission_value: number; commission_eur: number | null; status: CommissionStatus; due_date: string | null; paid_date: string | null; invoice_number: string | null; notes: string | null; created_at: string; updated_at: string }
export interface ProjectInvestor { id: string; project_id: string; investor_id: string; user_id: string; status: string; teaser_sent_at: string | null; expose_sent_at: string | null; dd_started_at: string | null; loi_received_at: string | null; match_score: number | null; notes: string | null; contacted_at: string | null; created_at: string; updated_at: string }
export interface Document { id: string; project_id: string; user_id: string; document_type: DocumentType; display_name: string; file_name: string; file_path: string; file_size_bytes: number | null; mime_type: string | null; external_url: string | null; external_provider: string | null; version: number; parent_id: string | null; ai_analyzed: boolean; ai_extracted_data: Record<string, unknown> | null; ai_analyzed_at: string | null; notes: string | null; is_archived: boolean; created_at: string; updated_at: string }
export interface Task { id: string; user_id: string; project_id: string | null; title: string; description: string | null; due_date: string | null; priority: TaskPriority; status: TaskStatus; investor_id: string | null; partner_id: string | null; completed_at: string | null; created_at: string; updated_at: string }
export interface ActivityLog { id: string; project_id: string | null; user_id: string; activity_type: ActivityType; title: string; description: string | null; old_value: string | null; new_value: string | null; investor_id: string | null; partner_id: string | null; document_id: string | null; task_id: string | null; metadata: ActivityMetadata; created_at: string }
export interface AiOutput { id: string; project_id: string | null; user_id: string; output_type: string; content: string | null; content_html: string | null; metadata: Record<string, unknown>; status: AiOutputStatus; approved_at: string | null; approved_by: string | null; rejection_note: string | null; version: number; parent_id: string | null; created_at: string; updated_at: string }

export interface DashboardKPIs { user_id: string; total_active_projects: number; projects_lead: number; projects_vorpruefung: number; projects_investorensuche: number; projects_dd: number; projects_loi: number; projects_spa: number; projects_closing: number; projects_sold: number; projects_new_30d: number; total_volume_eur: number; total_gross_margin_eur: number; total_net_profit_eur: number; deals_closed_won_ytd: number }
export interface ProjectWithDeal extends Project { deal_id: string | null; deal_number: string | null; deal_status: DealStatus | null; deal_purchase_price: number | null; deal_sales_price: number | null; deal_gross_margin: number | null; deal_net_profit: number | null; deal_margin_type: MarginType | null; deal_margin_value: number | null; partner_company: string | null; partner_name: string | null }

export type InsertProject = Omit<Project, 'id' | 'project_number' | 'ai_score' | 'ai_score_details' | 'ai_last_analyzed' | 'last_activity_at' | 'created_at' | 'updated_at'>
export type InsertDeal = Omit<Deal, 'id' | 'created_at' | 'updated_at'>
export type InsertPartner = Omit<Partner, 'id' | 'project_count' | 'deal_count' | 'close_rate' | 'total_volume' | 'created_at' | 'updated_at'>
export type InsertInvestor = Omit<Investor, 'id' | 'created_at' | 'updated_at'>
export type InsertTask = Omit<Task, 'id' | 'completed_at' | 'created_at' | 'updated_at'>
export type InsertActivityLog = Omit<ActivityLog, 'id' | 'created_at'>
export type InsertDocument = Omit<Document, 'id' | 'ai_analyzed' | 'ai_extracted_data' | 'ai_analyzed_at' | 'created_at' | 'updated_at'>
export type UpdateProject = Partial<InsertProject>
export type UpdateDeal = Partial<InsertDeal>
export type UpdatePartner = Partial<InsertPartner>
export type UpdateTask = Partial<InsertTask>

export interface Database { public: { Tables: Record<string, unknown>; Views: Record<string, unknown>; Functions: Record<string, unknown>; Enums: Record<string, unknown> } }
