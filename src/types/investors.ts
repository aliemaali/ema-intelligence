// src/types/investors.ts
//
// Typdefinitionen für das Investoren-CRM.
// Diese Typen spiegeln das SQL-Schema aus supabase/0001_investors_crm.sql.
//
// Falls du `supabase gen types typescript` nutzt, ersetzen die generierten
// Database-Typen idealerweise diese Datei (oder werden importiert und hier
// re-exportiert). Bis dahin sind dies die handgepflegten "Source of truth"-Typen.

export type InvestorFocus = "PV" | "BESS" | "PV_BESS";

export type InvestorStatus =
  | "Neu"
  | "Kontaktiert"
  | "DD_laeuft"
  | "Angebot_gesendet"
  | "Investiert"
  | "Inaktiv";

export type ContactChannel =
  | "Telefon"
  | "E-Mail"
  | "Meeting"
  | "Video-Call"
  | "Sonstige";

export const INVESTOR_STATUS_LABELS: Record<InvestorStatus, string> = {
  Neu: "Neu",
  Kontaktiert: "Kontaktiert",
  DD_laeuft: "DD läuft",
  Angebot_gesendet: "Angebot gesendet",
  Investiert: "Investiert",
  Inaktiv: "Inaktiv",
};

export const INVESTOR_FOCUS_LABELS: Record<InvestorFocus, string> = {
  PV: "PV",
  BESS: "BESS",
  PV_BESS: "PV + BESS",
};

export interface Investor {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string | null;

  ticket_size_min_eur: number | null;
  ticket_size_max_eur: number | null;
  focus: InvestorFocus;
  status: InvestorStatus;

  last_contact_at: string | null; // ISO date (YYYY-MM-DD)
  next_contact_at: string | null; // ISO date (YYYY-MM-DD)

  notes: string | null;

  created_by: string | null;
  created_at: string; // ISO timestamptz
  updated_at: string; // ISO timestamptz
}

/** Erweiterte Zeile aus der `investors_with_stats` View */
export interface InvestorWithStats extends Investor {
  project_count: number;
  note_count: number;
}

export interface InvestorContact {
  id: string;
  investor_id: string;
  channel: ContactChannel;
  occurred_at: string; // ISO timestamptz
  summary: string;
  created_by: string | null;
  created_at: string;
}

export interface InvestorNote {
  id: string;
  investor_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

/** Minimalprojektion aus der bestehenden projects-Tabelle.
 *  Passe an dein echtes Project-Interface an, falls vorhanden. */
export interface LinkedProject {
  id: string;
  name: string;
  status?: string | null;
  project_type?: string | null;
}

export interface InvestorProjectLink {
  id: string;
  investor_id: string;
  project_id: string;
  linked_at: string;
  created_by: string | null;
  project?: LinkedProject; // bei join-Abfragen befüllt
}

/** Payload für createInvestor / updateInvestor Server Actions */
export interface InvestorFormInput {
  company_name: string;
  contact_person: string;
  email: string;
  phone?: string | null;
  ticket_size_min_eur?: number | null;
  ticket_size_max_eur?: number | null;
  focus: InvestorFocus;
  status: InvestorStatus;
  last_contact_at?: string | null;
  next_contact_at?: string | null;
  notes?: string | null;
}

/** Filter-/Suchparameter für getInvestors */
export interface InvestorFilters {
  search?: string;
  focus?: InvestorFocus | "Alle";
  status?: InvestorStatus | "Alle";
  projectId?: string | "Alle";
  sortBy?: "company_name" | "last_contact_at" | "next_contact_at" | "created_at";
  sortDirection?: "asc" | "desc";
}

/** Aggregierte KPIs für das Dashboard */
export interface InvestorDashboardKpis {
  totalInvestors: number;
  activeInvestors: number; // status nicht in [Inaktiv]
  totalTicketVolumeEur: number; // Summe der oberen Ticketgrenze (konservativ: max)
  contactedLast30Days: number;
  mostRecentContactAt: string | null;
}

/** Einheitliches Result-Objekt für Server Actions (kein throw nach außen) */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
