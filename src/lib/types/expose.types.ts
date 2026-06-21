/**
 * EMA Intelligence – Exposé Generator V1 Typen
 *
 * WICHTIG: Jedes Feld ist `string | null`. `null` bedeutet "nicht verfügbar"
 * und wird in der UI explizit so angezeigt – niemals stillschweigend
 * weggelassen oder mit Platzhalterwerten gefüllt.
 */

import type {
  ProjectType, ProjectStatus, DealStatus, DevStatus,
} from '@/lib/types/database.types'

// ── Eingabedaten (aus Supabase geladen, bevor generiert wird) ────────────────

export interface ExposeSourceData {
  project: {
    id:               string
    project_number:   string
    project_name:      string
    project_type:      ProjectType
    status:            ProjectStatus
    location_city:     string | null
    location_state:    string | null
    location_country:  string
    location_address:  string | null
    pv_mwp:            number | null
    pv_ac_mw:          number | null
    bess_mw:           number | null
    bess_mwh:          number | null
    bess_duration_h:   number | null
    dev_status:        DevStatus
    notes:             string | null
    created_at:        string
  }
  deal: {
    deal_number:       string
    deal_status:       DealStatus
    purchase_price:    number | null
    sales_price:       number | null
  } | null
  partner: {
    full_name: string
    company:   string | null
  } | null
  documents: Array<{
    document_type: string
    display_name:  string
    created_at:    string
  }>
  linkedInvestors: Array<{
    full_name: string
    company:   string | null
    status:    string
  }>
}

// ── Generiertes Exposé (regelbasiert, deterministisch aus ExposeSourceData) ──

export interface ExposeField {
  label:     string
  value:     string | null   // null = "nicht verfügbar"
}

export interface ExposeSection {
  id:     string
  title:  string
  fields: ExposeField[]
}

export interface GeneratedExpose {
  // Deckblatt
  coverTitle:        string
  coverSubtitle:      string
  coverProjectNumber: string
  coverDate:          string

  // Strukturierte Sektionen (Reihenfolge = Anzeigereihenfolge)
  sections: ExposeSection[]

  // Chancen & Risiken – regelbasiert aus Entwicklungsstand/Daten abgeleitet
  opportunities: string[]
  risks:         string[]

  // Vollständigkeits-Score (wie viele Felder sind tatsächlich befüllt)
  completeness: {
    filled:  number
    total:   number
    percent: number
  }

  // Metadaten für ai_outputs
  generatedAt: string
}

export const NOT_AVAILABLE = 'nicht verfügbar' as const
