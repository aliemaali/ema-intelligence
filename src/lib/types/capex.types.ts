// src/lib/types/capex.types.ts
//
// Domänen-Typen für die CAPEX-Kalkulation.
// `CapexCalculationRow` entspricht 1:1 der Supabase-Tabelle `capex_calculations`
// (snake_case, wie von Supabase generiert). `CapexProject` ist das camelCase
// Arbeitsmodell, das die UI/Berechnungslogik verwendet.

export type ComponentKind = 'module' | 'inverter'

export interface ComponentPriceSource {
  retailer: string
  url: string
  priceNetEur: number
  shippingNetEur: number
  available: boolean
  observedAt: string
  note: string
}

export interface ComponentPricingSelection {
  manufacturer: string
  model: string
  ratedPower: number
  onlineAverageNetEur: number
  discountPct: number
  priceDate: string
  sources: ComponentPriceSource[]
}

export interface CapexComponentPricing {
  module: ComponentPricingSelection
  inverter: ComponentPricingSelection
}

export interface CapexCalculationRow {
  id: string
  project_id: string
  name: string

  anlagenleistung_kwp: number
  spez_ertrag_kwh_kwp: number
  strompreis_eur_kwh: number
  degradation_pct: number
  betriebskosten_pct: number
  pachtdauer_jahre: number

  modulleistung_wp: number
  preis_pro_modul: number

  wr_hersteller: string
  wr_einzelpreis: number
  wr_anzahl: number
  component_pricing: CapexComponentPricing | null

  uk_hersteller: string
  uk_preis_pro_kwp: number

  dc_preis_pro_kwp: number
  ac_preis_pro_kwp: number

  planung_engineering: number
  bauliche_massnahmen: number
  logistik_transport: number
  inbetriebnahme: number
  contingency: number
  pachtzahlung_pro_kwp: number
  projektrechte_pro_kwp: number

  strompreissteigerung_pct: number
  wacc_pct: number

  created_by: string | null
  created_at: string
  updated_at: string
}

export type CapexCalculationInsert = Omit<
  CapexCalculationRow,
  'id' | 'created_at' | 'updated_at'
> & {
  id?: string
}

export type CapexCalculationUpdate = Partial<
  Omit<CapexCalculationRow, 'id' | 'project_id' | 'created_at' | 'updated_at'>
>

export interface CapexProject {
  id: string | null
  projectId: string | null
  calculationName: string
  createdAt: string | null

  projektname: string
  anlagenleistungKwp: number
  spezErtragKwhKwp: number
  strompreisEurKwh: number
  degradationPct: number
  betriebskostenPct: number
  pachtdauerJahre: number

  modulleistungWp: number
  preisProModul: number

  wrHersteller: string
  wrEinzelpreis: number
  wrAnzahl: number
  componentPricing: CapexComponentPricing

  ukHersteller: string
  ukPreisProKwp: number

  dcPreisProKwp: number
  acPreisProKwp: number

  planungEngineering: number
  baulicheMassnahmen: number
  logistikTransport: number
  inbetriebnahme: number
  contingency: number
  pachtzahlungProKwp: number
  projektrechteProKwp: number

  strompreissteigerungPct: number
  waccPct: number
}

export interface CapexPosition {
  name: string
  cost: number
  share: number
  eurPerKwp: number
}

export interface CapexYearCashflow {
  year: number
  energy: number | null
  price: number | null
  revenue: number | null
  opex: number | null
  ncf: number
  cum: number
}

export interface CapexCalcResult {
  moduleCount: number
  moduleCost: number
  actualKwp: number
  wrTotal: number
  wrEurPerKwp: number
  ukTotal: number
  dcTotal: number
  acTotal: number
  positions: CapexPosition[]
  totalCapex: number
  specificCapex: number
  energyY1: number
  revenueY1: number
  opexY1: number
  ncfY1: number
  staticPayback: number | null
  years: CapexYearCashflow[]
  irr: number | null
  npv: number
  dynPayback: number | null
}

export interface ProjectOption {
  id: string
  name: string
  pv_mwp?: number | null
  pv_ac_mw?: number | null
  bess_mw?: number | null
  bess_mwh?: number | null
  bess_duration_h?: number | null
  location_city?: string | null
  location_state?: string | null
  location_country?: string | null
  specific_yield?: number | null
  tariff_eur_kwh?: number | null
  lease_term_years?: number | null
}

export const WECHSELRICHTER_HERSTELLER = [
  'Sungrow', 'GoodWe', 'SMA', 'Solis', 'Deye', 'ATESS',
] as const

export const MODUL_HERSTELLER = [
  'JinkoSolar', 'LONGi', 'Trina Solar', 'JA Solar', 'Canadian Solar',
] as const

export const UNTERKONSTRUKTION_HERSTELLER = [
  'K2 Systems', 'Schletter', 'Renusol', 'Esdec', 'Van der Valk',
  'Mounting Systems', 'Aerocompact', 'S:FLEX', 'IBC Solar', 'Valmont',
] as const

export function emptyComponentPricing(): CapexComponentPricing {
  const selection = (): ComponentPricingSelection => ({
    manufacturer: '',
    model: '',
    ratedPower: 0,
    onlineAverageNetEur: 0,
    discountPct: 20,
    priceDate: '',
    sources: [],
  })

  return { module: selection(), inverter: selection() }
}

export function normalizeComponentPricing(value: unknown): CapexComponentPricing {
  const defaults = emptyComponentPricing()
  if (!value || typeof value !== 'object') return defaults

  const raw = value as Partial<Record<ComponentKind, Partial<ComponentPricingSelection>>>
  const normalizeSelection = (
    kind: ComponentKind,
    fallback: ComponentPricingSelection,
  ): ComponentPricingSelection => {
    const selection = raw[kind]
    if (!selection || typeof selection !== 'object') return fallback

    return {
      manufacturer: typeof selection.manufacturer === 'string' ? selection.manufacturer : '',
      model: typeof selection.model === 'string' ? selection.model : '',
      ratedPower: Number(selection.ratedPower) || 0,
      onlineAverageNetEur: Number(selection.onlineAverageNetEur) || 0,
      discountPct: Number.isFinite(Number(selection.discountPct))
        ? Math.max(0, Math.min(60, Number(selection.discountPct)))
        : 20,
      priceDate: typeof selection.priceDate === 'string' ? selection.priceDate : '',
      sources: Array.isArray(selection.sources)
        ? selection.sources.filter((source): source is ComponentPriceSource => (
          !!source
          && typeof source === 'object'
          && typeof source.url === 'string'
          && source.url.startsWith('https://')
        ))
        : [],
    }
  }

  return {
    module: normalizeSelection('module', defaults.module),
    inverter: normalizeSelection('inverter', defaults.inverter),
  }
}

export function defaultCapexProject(project: string | ProjectOption | null = null): CapexProject {
  const projectOption = typeof project === 'object' && project !== null ? project : null
  const projectId = typeof project === 'string' ? project : projectOption?.id ?? null

  return {
    id: null,
    projectId,
    calculationName: 'Neue CAPEX-Kalkulation',
    createdAt: null,

    projektname: projectOption?.name ?? '',
    anlagenleistungKwp: Number(projectOption?.pv_mwp ?? 0),
    spezErtragKwhKwp: Number(projectOption?.specific_yield ?? 0),
    strompreisEurKwh: Number(projectOption?.tariff_eur_kwh ?? 0),
    degradationPct: 0.5,
    betriebskostenPct: 1.5,
    pachtdauerJahre: Number(projectOption?.lease_term_years ?? 0),

    modulleistungWp: 0,
    preisProModul: 0,

    wrHersteller: '',
    wrEinzelpreis: 0,
    wrAnzahl: 0,
    componentPricing: emptyComponentPricing(),

    ukHersteller: '',
    ukPreisProKwp: 0,

    dcPreisProKwp: 0,
    acPreisProKwp: 0,

    planungEngineering: 0,
    baulicheMassnahmen: 0,
    logistikTransport: 0,
    inbetriebnahme: 0,
    contingency: 0,
    pachtzahlungProKwp: 0,
    projektrechteProKwp: 0,

    strompreissteigerungPct: 0,
    waccPct: 6.0,
  }
}

export function rowToCapexProject(row: CapexCalculationRow): CapexProject {
  return {
    id: row.id,
    projectId: row.project_id,
    calculationName: row.name,
    createdAt: row.created_at,

    projektname: row.name,
    anlagenleistungKwp: Number(row.anlagenleistung_kwp),
    spezErtragKwhKwp: Number(row.spez_ertrag_kwh_kwp),
    strompreisEurKwh: Number(row.strompreis_eur_kwh),
    degradationPct: Number(row.degradation_pct),
    betriebskostenPct: Number(row.betriebskosten_pct),
    pachtdauerJahre: Number(row.pachtdauer_jahre),

    modulleistungWp: Number(row.modulleistung_wp),
    preisProModul: Number(row.preis_pro_modul),

    wrHersteller: row.wr_hersteller,
    wrEinzelpreis: Number(row.wr_einzelpreis),
    wrAnzahl: Number(row.wr_anzahl),
    componentPricing: normalizeComponentPricing(row.component_pricing),

    ukHersteller: row.uk_hersteller,
    ukPreisProKwp: Number(row.uk_preis_pro_kwp),

    dcPreisProKwp: Number(row.dc_preis_pro_kwp),
    acPreisProKwp: Number(row.ac_preis_pro_kwp),

    planungEngineering: Number(row.planung_engineering),
    baulicheMassnahmen: Number(row.bauliche_massnahmen),
    logistikTransport: Number(row.logistik_transport),
    inbetriebnahme: Number(row.inbetriebnahme),
    contingency: Number(row.contingency),
    pachtzahlungProKwp: Number(row.pachtzahlung_pro_kwp),
    projektrechteProKwp: Number(row.projektrechte_pro_kwp),

    strompreissteigerungPct: Number(row.strompreissteigerung_pct),
    waccPct: Number(row.wacc_pct),
  }
}

export function capexProjectToRow(
  p: CapexProject,
  opts: { createdBy?: string | null } = {}
): CapexCalculationInsert {
  if (!p.projectId) {
    throw new Error('capexProjectToRow: projectId ist erforderlich (FK zu projects.id)')
  }
  return {
    project_id: p.projectId,
    name: p.projektname || p.calculationName,

    anlagenleistung_kwp: p.anlagenleistungKwp,
    spez_ertrag_kwh_kwp: p.spezErtragKwhKwp,
    strompreis_eur_kwh: p.strompreisEurKwh,
    degradation_pct: p.degradationPct,
    betriebskosten_pct: p.betriebskostenPct,
    pachtdauer_jahre: p.pachtdauerJahre,

    modulleistung_wp: p.modulleistungWp,
    preis_pro_modul: p.preisProModul,

    wr_hersteller: p.wrHersteller,
    wr_einzelpreis: p.wrEinzelpreis,
    wr_anzahl: p.wrAnzahl,
    component_pricing: p.componentPricing,

    uk_hersteller: p.ukHersteller,
    uk_preis_pro_kwp: p.ukPreisProKwp,

    dc_preis_pro_kwp: p.dcPreisProKwp,
    ac_preis_pro_kwp: p.acPreisProKwp,

    planung_engineering: p.planungEngineering,
    bauliche_massnahmen: p.baulicheMassnahmen,
    logistik_transport: p.logistikTransport,
    inbetriebnahme: p.inbetriebnahme,
    contingency: p.contingency,
    pachtzahlung_pro_kwp: p.pachtzahlungProKwp,
    projektrechte_pro_kwp: p.projektrechteProKwp,

    strompreissteigerung_pct: p.strompreissteigerungPct,
    wacc_pct: p.waccPct,

    created_by: opts.createdBy ?? null,
  }
}
