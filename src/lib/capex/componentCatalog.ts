import type { ComponentKind } from '@/lib/types/capex.types'

export interface ModuleCatalogItem {
  manufacturer: string
  model: string
  powerWp: number
  technology: string
}

export interface InverterCatalogModel {
  model: string
  acPowerKw: number
  hybrid: true
  maxRecommendedUnits?: number
}

export interface InverterCatalogItem {
  manufacturer: string
  family: string
  models: InverterCatalogModel[]
}

export interface InverterRecommendation {
  manufacturer: string
  family: string
  model: string
  acPowerKw: number
  quantity: number
  totalAcPowerKw: number
  dcAcRatio: number
}

export const INVERTER_TARGET_DC_AC_RATIO = 1.15
export const INVERTER_MIN_DC_AC_RATIO = 0.9
export const INVERTER_MAX_DC_AC_RATIO = 1.3

const DEFAULT_MAX_RECOMMENDED_UNITS = 20

export const MODULE_CATALOG: ModuleCatalogItem[] = [
  {
    manufacturer: 'JinkoSolar',
    model: 'Tiger Neo JKM450N-54HL4R-V',
    powerWp: 450,
    technology: 'N-Type TOPCon',
  },
  {
    manufacturer: 'LONGi',
    model: 'Hi-MO 6 LR5-54HTH-450M',
    powerWp: 450,
    technology: 'HPBC',
  },
  {
    manufacturer: 'Trina Solar',
    model: 'Vertex S+ TSM-NEG9R.28 450',
    powerWp: 450,
    technology: 'N-Type i-TOPCon',
  },
  {
    manufacturer: 'JA Solar',
    model: 'DeepBlue 4.0 Pro JAM54D41-450/LB',
    powerWp: 450,
    technology: 'N-Type bifazial',
  },
  {
    manufacturer: 'Canadian Solar',
    model: 'TOPHiKu6 CS6.1-54TM-450',
    powerWp: 450,
    technology: 'N-Type TOPCon',
  },
]

export const INVERTER_CATALOG: InverterCatalogItem[] = [
  {
    manufacturer: 'Sungrow',
    family: 'SH · C&I Hybrid',
    models: [
      { model: 'SH125CX', acPowerKw: 125, hybrid: true },
    ],
  },
  {
    manufacturer: 'GoodWe',
    family: 'ET · C&I Hybrid',
    models: [
      { model: 'GW50K-ET-10', acPowerKw: 50, hybrid: true },
    ],
  },
  {
    manufacturer: 'Huawei',
    family: 'SUN2000-MAP0 · 3-phasig Hybrid',
    models: [
      { model: 'SUN2000-12K-MAP0', acPowerKw: 12, hybrid: true },
    ],
  },
  {
    manufacturer: 'SMA',
    family: 'Sunny Tripower Hybrid X',
    models: [
      {
        model: 'Sunny Tripower Hybrid X 30',
        acPowerKw: 30,
        hybrid: true,
        maxRecommendedUnits: 5,
      },
    ],
  },
  {
    manufacturer: 'Solis',
    family: 'S6-EH3P · C&I Hybrid',
    models: [
      { model: 'S6-EH3P50K-H', acPowerKw: 50, hybrid: true },
      { model: 'S6-EH3P60K-H', acPowerKw: 60, hybrid: true },
    ],
  },
  {
    manufacturer: 'Deye',
    family: 'SUN-SG02HP3 · C&I Hybrid',
    models: [
      { model: 'SUN-50K-SG02HP3-EU-BM4-P', acPowerKw: 50, hybrid: true },
    ],
  },
  {
    manufacturer: 'ATESS',
    family: 'HPS · All-in-one Hybrid',
    models: [
      { model: 'HPS50', acPowerKw: 50, hybrid: true },
      { model: 'HPS100', acPowerKw: 100, hybrid: true },
      { model: 'HPS120', acPowerKw: 120, hybrid: true },
      { model: 'HPS150', acPowerKw: 150, hybrid: true },
    ],
  },
]

export const MODULE_POWER_OPTIONS = [430, 440, 450, 460, 500, 550, 580, 600, 700] as const
export const MODULE_POWER_MIN_WP = 300
export const MODULE_POWER_MAX_WP = 800

export const MODULE_MANUFACTURERS = MODULE_CATALOG.map((item) => item.manufacturer)
export const INVERTER_MANUFACTURERS = INVERTER_CATALOG.map((item) => item.manufacturer)

export function getModuleRecommendation(manufacturer: string, requestedPowerWp?: number) {
  const item = MODULE_CATALOG.find((entry) => entry.manufacturer === manufacturer)
  if (!item) return null

  const requested = Math.round(Number(requestedPowerWp))
  const powerWp = Number.isFinite(requested)
    && requested >= MODULE_POWER_MIN_WP
    && requested <= MODULE_POWER_MAX_WP
    ? requested
    : item.powerWp

  return {
    ...item,
    powerWp,
    model: powerWp === item.powerWp
      ? item.model
      : `${item.manufacturer} · ${powerWp} Wp Leistungsklasse`,
  }
}

function getRecommendationCandidates(
  plantKwp: number,
  manufacturer?: string,
): InverterRecommendation[] {
  const dcPowerKwp = Math.max(0, Number(plantKwp) || 0)
  if (dcPowerKwp <= 0) return []

  return INVERTER_CATALOG
    .filter((brand) => !manufacturer || brand.manufacturer === manufacturer)
    .flatMap((brand) => brand.models.flatMap((model) => {
      const maxUnits = model.maxRecommendedUnits ?? DEFAULT_MAX_RECOMMENDED_UNITS
      const candidates: InverterRecommendation[] = []

      for (let quantity = 1; quantity <= maxUnits; quantity += 1) {
        const totalAcPowerKw = quantity * model.acPowerKw
        const dcAcRatio = dcPowerKwp / totalAcPowerKw
        if (
          dcAcRatio < INVERTER_MIN_DC_AC_RATIO
          || dcAcRatio > INVERTER_MAX_DC_AC_RATIO
        ) {
          continue
        }

        candidates.push({
          manufacturer: brand.manufacturer,
          family: brand.family,
          model: model.model,
          acPowerKw: model.acPowerKw,
          quantity,
          totalAcPowerKw,
          dcAcRatio,
        })
      }

      return candidates
    }))
}

function rankRecommendations(
  a: InverterRecommendation,
  b: InverterRecommendation,
) {
  if (a.quantity !== b.quantity) return a.quantity - b.quantity

  const aDistance = Math.abs(a.dcAcRatio - INVERTER_TARGET_DC_AC_RATIO)
  const bDistance = Math.abs(b.dcAcRatio - INVERTER_TARGET_DC_AC_RATIO)
  if (aDistance !== bDistance) return aDistance - bDistance

  return b.acPowerKw - a.acPowerKw
}

export function getInverterRecommendation(manufacturer: string, plantKwp: number) {
  return getRecommendationCandidates(plantKwp, manufacturer)
    .sort(rankRecommendations)[0] ?? null
}

export function getBestInverterRecommendation(plantKwp: number) {
  return getRecommendationCandidates(plantKwp)
    .sort(rankRecommendations)[0] ?? null
}

export function isApprovedHybridInverter(manufacturer: string, model: string) {
  return INVERTER_CATALOG.some((brand) => (
    brand.manufacturer === manufacturer
    && brand.models.some((entry) => entry.model === model && entry.hybrid)
  ))
}

export function componentUnitLabel(kind: ComponentKind) {
  return kind === 'module' ? 'pro Modul' : 'pro Hybrid-Wechselrichter'
}
