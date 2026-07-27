export type Erloesmodell =
  | 'eeg_einspeiseverguetung'
  | 'direktvermarktung'
  | 'ppa'
  | 'mieterstrom'
  | 'eigenverbrauch'
  | 'hybrid'

export type CapexKategorie =
  | 'module'
  | 'wechselrichter'
  | 'unterkonstruktion'
  | 'ac_installation'
  | 'dc_montage'
  | 'planung_engineering'
  | 'bauliche_massnahmen'
  | 'logistik_transport'
  | 'inbetriebnahme'
  | 'contingency'
  | 'pacht_vorauszahlung'
  | 'projektrechte'
  | 'sonstige'

export interface CapexPosition {
  kategorie: CapexKategorie
  bezeichnung: string
  menge: number
  einheit: string
  einzelpreis_eur: number
  betrag_eur: number
  sortierung: number
}

export interface ProjectFinancialInput {
  leistung_kwp: number | null
  spez_ertrag_kwh_kwp: number | null
  performance_ratio: number | null
  degradation_pct_pa: number | null
  betrachtungszeitraum_jahre: number | null

  erloesmodell: Erloesmodell
  eeg_verguetung_ct_kwh: number | null
  direktvermarktung_ct_kwh: number | null
  ppa_preis_ct_kwh: number | null
  verguetungsdauer_jahre: number | null
  eigenverbrauchsquote_pct: number | null
  strompreis_eigenverbrauch_ct_kwh: number | null
  strompreissteigerung_pct_pa: number | null

  opex_betriebsfuehrung_eur_pa: number | null
  opex_wartung_eur_pa: number | null
  opex_versicherung_eur_pa: number | null
  opex_pacht_eur_pa: number | null
  opex_sonstige_eur_pa: number | null
  ruecklage_rueckbau_eur_pa: number | null
  opex_steigerung_pct_pa: number | null

  ek_quote_pct: number | null
  fk_zins_pct: number | null
  fk_laufzeit_jahre: number | null
  diskontsatz_pct: number | null

  capex_positions: CapexPosition[]
}

export interface CashflowJahr {
  jahr: number
  ertrag_kwh: number | null
  erloes_eur: number | null
  opex_eur: number | null
  kapitaldienst_eur: number | null
  cashflow_vor_finanzierung_eur: number
  cashflow_nach_finanzierung_eur: number
  kumulierter_cashflow_eur: number
}

export interface ProjectFinancialResult {
  capex_gesamt_eur: number
  capex_eur_pro_kwp: number
  irr_projekt_pct: number | null
  irr_ek_pct: number | null
  npv_eur: number
  payback_jahre: number | null
  lcoe_ct_kwh: number | null
  cashflow_jahr1_eur: number
  dscr_min: number | null
  cashflow_reihe: CashflowJahr[]
}

export interface CalculationSuccess {
  ok: true
  data: ProjectFinancialResult
}

export interface CalculationFailure {
  ok: false
  errors: string[]
}

export type CalculationResult = CalculationSuccess | CalculationFailure
