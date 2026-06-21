/**
 * EMA Intelligence – KI-Projektanalyse V1 Typen
 *
 * Wie der Exposé-Generator ist auch dieses Modul in v1 REGELBASIERT
 * (kein Anthropic/OpenAI API-Aufruf). "KI" bezeichnet hier die Kategorie
 * der Funktion innerhalb von EMA Intelligence (ai_outputs-Tabelle, gleicher
 * Freigabe-Workflow), nicht die zugrunde liegende Technik. Eine echte
 * KI-gestützte Formulierungsschicht ist für v1.1 vorgesehen.
 *
 * Jede Bewertung basiert ausschließlich auf vorhandenen Datenbankwerten.
 * Fehlt eine Information, fließt sie als "fehlend" in die Analyse ein,
 * wird aber niemals durch eine Annahme ersetzt.
 */

import type {
  ProjectType, ProjectStatus, DevStatus, DocumentType,
} from '@/lib/types/database.types'

// ── Eingabedaten ──────────────────────────────────────────────────────────────

export interface AnalysisSourceData {
  project: {
    id:               string
    project_number:   string
    project_name:     string
    project_type:     ProjectType
    status:           ProjectStatus
    location_city:    string | null
    location_state:   string | null
    pv_mwp:           number | null
    bess_mw:          number | null
    bess_mwh:         number | null
    dev_status:       DevStatus
    created_at:       string
    last_activity_at: string | null
  }
  deal: {
    deal_status:    string
    purchase_price: number | null
    sales_price:    number | null
    net_profit:     number | null
  } | null
  documents: Array<{
    document_type: DocumentType
  }>
  linkedInvestors: Array<{
    investor_id:      string
    full_name:        string
    company:          string | null
    status:           string
    interest_pv:      boolean
    interest_bess:    boolean
    interest_hybrid:  boolean
    size_preferences: string[]
  }>
}

// ── Bewertungs-Bausteine ───────────────────────────────────────────────────────

export type RiskSeverity = 'hoch' | 'mittel' | 'niedrig'

export interface RiskItem {
  severity:    RiskSeverity
  title:       string
  description: string
}

export interface MissingDocument {
  type:  DocumentType
  label: string
}

export interface InvestorFit {
  investorId:   string
  name:         string
  matchScore:   number   // 0–100, via bestehende calculateMatchScore()-Logik
  reasoning:    string[]
}

export type MarketingRecommendation =
  | 'bereit_zur_vermarktung'
  | 'unterlagen_vervollstaendigen'
  | 'entwicklung_fortsetzen'
  | 'nicht_vermarktungsfaehig'

export interface GeneratedAnalysis {
  projectId:     string
  projectNumber: string
  analyzedAt:    string

  // 1. Entwicklungsstand-Bewertung
  devStatusScore: {
    completed:  number   // Anzahl erfüllter Kriterien
    total:      number   // Anzahl Kriterien gesamt (6)
    open:       number   // Anzahl nicht erfasster Kriterien
    failed:     number   // Anzahl explizit nicht erfüllter Kriterien
    percent:    number
  }

  // 2. Fehlende Unterlagen
  missingDocuments: MissingDocument[]

  // 3. Risikoanalyse
  risks: RiskItem[]

  // 4. Investoren-Eignung
  investorFit: InvestorFit[]
  hasNoLinkedInvestors: boolean

  // 5. Vermarktungsempfehlung
  marketingRecommendation: MarketingRecommendation
  marketingReasoning:      string[]

  // Gesamtscore (0–100), wird zusätzlich in projects.ai_score gespiegelt
  overallScore: number
}

export const MARKETING_RECOMMENDATION_LABELS: Record<MarketingRecommendation, string> = {
  bereit_zur_vermarktung:        'Bereit zur Vermarktung',
  unterlagen_vervollstaendigen:  'Unterlagen vervollständigen',
  entwicklung_fortsetzen:        'Entwicklung fortsetzen',
  nicht_vermarktungsfaehig:      'Nicht vermarktungsfähig',
}

export const RISK_SEVERITY_LABELS: Record<RiskSeverity, string> = {
  hoch:    'Hoch',
  mittel:  'Mittel',
  niedrig: 'Niedrig',
}
