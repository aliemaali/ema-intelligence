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
}

export interface InverterCatalogItem {
  manufacturer: string
  family: string
  models: InverterCatalogModel[]
}

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
    manufacturer: 'Huawei',
    family: 'SUN2000',
    models: [
      { model: 'SUN2000-50KTL-M3', acPowerKw: 50 },
      { model: 'SUN2000-100KTL-M2', acPowerKw: 100 },
    ],
  },
  {
    manufacturer: 'Sungrow',
    family: 'SG',
    models: [
      { model: 'SG50CX-P2', acPowerKw: 50 },
      { model: 'SG125CX-P2', acPowerKw: 125 },
    ],
  },
  {
    manufacturer: 'SMA',
    family: 'Sunny Tripower / Highpower',
    models: [
      { model: 'Sunny Tripower CORE1 STP 50-41', acPowerKw: 50 },
      { model: 'Sunny Highpower PEAK3 SHP 150-20', acPowerKw: 150 },
    ],
  },
  {
    manufacturer: 'Solis',
    family: 'S5 / S6',
    models: [
      { model: 'S5-GC50K', acPowerKw: 50 },
      { model: 'S6-GC125K', acPowerKw: 125 },
    ],
  },
  {
    manufacturer: 'KACO',
    family: 'blueplanet',
    models: [
      { model: 'blueplanet 60.0 TL3', acPowerKw: 60 },
      { model: 'blueplanet 125 NX3 M10', acPowerKw: 125 },
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

export function getInverterRecommendation(manufacturer: string, plantKwp: number) {
  const brand = INVERTER_CATALOG.find((item) => item.manufacturer === manufacturer)
  if (!brand) return null

  const targetAcKw = Math.max(0, plantKwp) / 1.15
  const sortedModels = [...brand.models].sort((a, b) => a.acPowerKw - b.acPowerKw)
  const preferredPower = targetAcKw <= 0
    ? sortedModels[0].acPowerKw
    : Math.min(125, Math.max(50, targetAcKw / Math.max(1, Math.ceil(targetAcKw / 125))))

  const model = sortedModels.reduce((best, current) => {
    return Math.abs(current.acPowerKw - preferredPower) < Math.abs(best.acPowerKw - preferredPower)
      ? current
      : best
  }, sortedModels[0])

  const quantity = targetAcKw > 0 ? Math.max(1, Math.ceil(targetAcKw / model.acPowerKw)) : 1
  return {
    manufacturer: brand.manufacturer,
    family: brand.family,
    model: model.model,
    acPowerKw: model.acPowerKw,
    quantity,
    totalAcPowerKw: quantity * model.acPowerKw,
    dcAcRatio: quantity * model.acPowerKw > 0 ? plantKwp / (quantity * model.acPowerKw) : 0,
  }
}

export function componentUnitLabel(kind: ComponentKind) {
  return kind === 'module' ? 'pro Modul' : 'pro Wechselrichter'
}
