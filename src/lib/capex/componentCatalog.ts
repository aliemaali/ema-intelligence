import type { ComponentKind, InverterMode } from '@/lib/types/capex.types'

export interface ModuleCatalogItem {
  manufacturer: string
  model: string
  powerWp: number
  technology: string
  lengthMm: number
  widthMm: number
  heightMm: number
  dimensionSourceUrl: string
}

export interface InverterCatalogModel {
  model: string
  acPowerKw: number
  maxRecommendedUnits?: number
}

export interface InverterCatalogItem {
  manufacturer: string
  family: string
  mode: InverterMode
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
    lengthMm: 1762,
    widthMm: 1134,
    heightMm: 30,
    dimensionSourceUrl: 'https://www.jinkosolar.com/',
  },
  {
    manufacturer: 'LONGi',
    model: 'Hi-MO 6 LR5-54HTH-450M',
    powerWp: 450,
    technology: 'HPBC',
    lengthMm: 1722,
    widthMm: 1134,
    heightMm: 30,
    dimensionSourceUrl: 'https://www.longi.com/cn/products/modules/hi-mo-x6-artist-full-black/',
  },
  {
    manufacturer: 'Trina Solar',
    model: 'Vertex S+ TSM-NEG9R.28 450',
    powerWp: 450,
    technology: 'N-Type i-TOPCon',
    lengthMm: 1762,
    widthMm: 1134,
    heightMm: 30,
    dimensionSourceUrl: 'https://www.trinasolar.com/de/NEG9R.28/',
  },
  {
    manufacturer: 'JA Solar',
    model: 'DeepBlue 4.0 Pro JAM54D41-450/LB',
    powerWp: 450,
    technology: 'N-Type bifazial',
    lengthMm: 1762,
    widthMm: 1134,
    heightMm: 30,
    dimensionSourceUrl: 'https://www.jasolar.com/',
  },
  {
    manufacturer: 'Canadian Solar',
    model: 'TOPHiKu6 CS6.1-54TM-450',
    powerWp: 450,
    technology: 'N-Type TOPCon',
    lengthMm: 1800,
    widthMm: 1134,
    heightMm: 30,
    dimensionSourceUrl: 'https://www.csisolar.com/',
  },
]

export const INVERTER_CATALOG: InverterCatalogItem[] = [
  {
    manufacturer: 'Huawei',
    family: 'SUN2000 · C&I String',
    mode: 'standard',
    models: [
      { model: 'SUN2000-150K-MG0', acPowerKw: 150 },
    ],
  },
  {
    manufacturer: 'Sungrow',
    family: 'SG · C&I String',
    mode: 'standard',
    models: [
      { model: 'SG150CX', acPowerKw: 150 },
    ],
  },
  {
    manufacturer: 'SMA',
    family: 'Sunny Highpower PEAK3',
    mode: 'standard',
    models: [
      { model: 'Sunny Highpower PEAK3 180', acPowerKw: 180 },
    ],
  },
  {
    manufacturer: 'GoodWe',
    family: 'GT · C&I String',
    mode: 'standard',
    models: [
      { model: 'GW150K-GT-G10', acPowerKw: 150 },
    ],
  },
  {
    manufacturer: 'Solis',
    family: 'S6-GC · C&I String',
    mode: 'standard',
    models: [
      { model: 'S6-GC125K', acPowerKw: 125 },
    ],
  },
  {
    manufacturer: 'Sungrow',
    family: 'SH · C&I Hybrid',
    mode: 'hybrid',
    models: [
      { model: 'SH125CX', acPowerKw: 125 },
    ],
  },
  {
    manufacturer: 'GoodWe',
    family: 'ET · C&I Hybrid',
    mode: 'hybrid',
    models: [
      { model: 'GW50K-ET-10', acPowerKw: 50 },
    ],
  },
  {
    manufacturer: 'Huawei',
    family: 'SUN2000-MAP0 · 3-phasig Hybrid',
    mode: 'hybrid',
    models: [
      { model: 'SUN2000-12K-MAP0', acPowerKw: 12 },
    ],
  },
  {
    manufacturer: 'SMA',
    family: 'Sunny Tripower Hybrid X',
    mode: 'hybrid',
    models: [
      {
        model: 'Sunny Tripower Hybrid X 30',
        acPowerKw: 30,
        maxRecommendedUnits: 5,
      },
    ],
  },
  {
    manufacturer: 'Solis',
    family: 'S6-EH3P · C&I Hybrid',
    mode: 'hybrid',
    models: [
      { model: 'S6-EH3P50K-H', acPowerKw: 50 },
      { model: 'S6-EH3P60K-H', acPowerKw: 60 },
      { model: 'S6-EH3P125K10-NV-YD-H', acPowerKw: 125, maxRecommendedUnits: 6 },
    ],
  },
  {
    manufacturer: 'Deye',
    family: 'SUN-SG02HP3 · C&I Hybrid',
    mode: 'hybrid',
    models: [
      { model: 'SUN-50K-SG02HP3-EU-BM4-P', acPowerKw: 50 },
    ],
  },
  {
    manufacturer: 'ATESS',
    family: 'HPS · All-in-one Hybrid',
    mode: 'hybrid',
    models: [
      { model: 'HPS50', acPowerKw: 50 },
      { model: 'HPS100', acPowerKw: 100 },
      { model: 'HPS120', acPowerKw: 120 },
      { model: 'HPS150', acPowerKw: 150 },
    ],
  },
]

export const MODULE_POWER_OPTIONS = [430, 440, 450, 460, 500, 550, 580, 600, 700] as const
export const MODULE_POWER_MIN_WP = 300
export const MODULE_POWER_MAX_WP = 800

export const MODULE_MANUFACTURERS = MODULE_CATALOG.map((item) => item.manufacturer)

export function getInverterManufacturers(mode: InverterMode) {
  return [...new Set(
    INVERTER_CATALOG
      .filter((item) => item.mode === mode)
      .map((item) => item.manufacturer),
  )]
}

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
    lengthMm: powerWp === item.powerWp ? item.lengthMm : 0,
    widthMm: powerWp === item.powerWp ? item.widthMm : 0,
    heightMm: powerWp === item.powerWp ? item.heightMm : 0,
  }
}

function getRecommendationCandidates(
  plantKwp: number,
  mode: InverterMode,
  manufacturer?: string,
): InverterRecommendation[] {
  const dcPowerKwp = Math.max(0, Number(plantKwp) || 0)
  if (dcPowerKwp <= 0) return []

  return INVERTER_CATALOG
    .filter((brand) => (
      brand.mode === mode
      && (!manufacturer || brand.manufacturer === manufacturer)
    ))
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

export function getInverterRecommendation(
  manufacturer: string,
  plantKwp: number,
  mode: InverterMode,
) {
  return getRecommendationCandidates(plantKwp, mode, manufacturer)
    .sort(rankRecommendations)[0] ?? null
}

export function getBestInverterRecommendation(plantKwp: number, mode: InverterMode) {
  return getRecommendationCandidates(plantKwp, mode)
    .sort(rankRecommendations)[0] ?? null
}

export function isApprovedInverter(
  manufacturer: string,
  model: string,
  mode: InverterMode,
) {
  return INVERTER_CATALOG.some((brand) => (
    brand.manufacturer === manufacturer
    && brand.mode === mode
    && brand.models.some((entry) => entry.model === model)
  ))
}

export function componentUnitLabel(kind: ComponentKind) {
  return kind === 'module' ? 'pro Modul' : 'pro Wechselrichter'
}
