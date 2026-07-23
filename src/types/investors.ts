// src/types/investors.ts
//
// Typdefinitionen für das Investoren-CRM.

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

export interface InvestorSearchProfile {
  version: 1;
  source_form: string;
  position_title: string;
  headquarters: string;
  technologies: {
    pv_ground: boolean;
    pv_rooftop: boolean;
    bess: boolean;
    wind: boolean;
    other: string;
  };
  project_sizes: {
    pv_from_mwp: string;
    pv_to_mwp: string;
    bess_from_mwh: string;
    bess_to_mwh: string;
  };
  project_stages: string[];
  investment_models: string[];
  regions: {
    germany: boolean;
    dach: boolean;
    eu: boolean;
    international: boolean;
    details: string;
  };
  investment_volume_bands: string[];
  criteria: {
    esg_compliant: boolean;
    grid_connection_secured: boolean;
    long_term_ppa_required: boolean;
    exclusivity_required: boolean;
    minimum_irr: string;
  };
  comments: string;
  consents: {
    gdpr: boolean;
    confidentiality: boolean;
    place_date: string;
    signature_present: boolean;
  };
  raw_fields: Record<string, string>;
}

export interface Investor {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string | null;
  position_title?: string | null;

  ticket_size_min_eur: number | null;
  ticket_size_max_eur: number | null;
  focus: InvestorFocus;
  status: InvestorStatus;

  last_contact_at: string | null;
  next_contact_at: string | null;
  notes: string | null;

  search_profile?: InvestorSearchProfile | null;
  profile_imported_at?: string | null;
  profile_source?: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestorWithStats extends Investor {
  project_count: number;
  note_count: number;
}

export interface InvestorContact {
  id: string;
  investor_id: string;
  channel: ContactChannel;
  occurred_at: string;
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
  project?: LinkedProject;
}

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

export interface InvestorFilters {
  search?: string;
  focus?: InvestorFocus | "Alle";
  status?: InvestorStatus | "Alle";
  projectId?: string | "Alle";
  sortBy?: "company_name" | "last_contact_at" | "next_contact_at" | "created_at";
  sortDirection?: "asc" | "desc";
}

export interface InvestorDashboardKpis {
  totalInvestors: number;
  activeInvestors: number;
  totalTicketVolumeEur: number;
  contactedLast30Days: number;
  mostRecentContactAt: string | null;
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
