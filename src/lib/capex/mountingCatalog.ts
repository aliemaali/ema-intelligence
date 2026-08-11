import type { MountingApplication } from '@/lib/types/capex.types'

export interface MountingSystemItem {
  application: MountingApplication
  manufacturer: string
  system: string
  surfaceTypes: string[]
  terrainTypes: string[]
  referenceEurPerKwp: number
  productUrl: string
}

export const ROOF_SURFACE_TYPES = [
  'Flachdach · Folie/Bitumen',
  'Flachdach · Kies/Gründach',
  'Trapezblech/Sandwich',
  'Ziegeldach',
  'Stehfalz/Metalldach',
] as const

export const GROUND_TERRAIN_TYPES = [
  'Ebenes Gelände',
  'Leichte Hanglage',
  'Starke Hanglage/Uneben',
  'Agri-PV',
] as const

export const MOUNTING_SYSTEMS: MountingSystemItem[] = [
  {
    application: 'roof', manufacturer: 'K2 Systems', system: 'Dome 6',
    surfaceTypes: ['Flachdach · Folie/Bitumen', 'Flachdach · Kies/Gründach', 'Trapezblech/Sandwich'],
    terrainTypes: [], referenceEurPerKwp: 72,
    productUrl: 'https://k2-systems.com/produktloesungen/dome-6/',
  },
  {
    application: 'roof', manufacturer: 'Renusol', system: 'FS Pro',
    surfaceTypes: ['Flachdach · Folie/Bitumen', 'Flachdach · Kies/Gründach', 'Trapezblech/Sandwich'],
    terrainTypes: [], referenceEurPerKwp: 74,
    productUrl: 'https://www.renusol.com/de/pv-montagesystem/flachdach/fs-pro/',
  },
  {
    application: 'roof', manufacturer: 'Mounting Systems', system: 'LightX',
    surfaceTypes: ['Flachdach · Folie/Bitumen', 'Flachdach · Kies/Gründach'],
    terrainTypes: [], referenceEurPerKwp: 76,
    productUrl: 'https://www.mounting-systems.com/de/dach-gewerbe/pv-systeme/flachdachsysteme/lightx/',
  },
  {
    application: 'roof', manufacturer: 'Schletter', system: 'FixGrid Pro / ProLine',
    surfaceTypes: [...ROOF_SURFACE_TYPES], terrainTypes: [], referenceEurPerKwp: 78,
    productUrl: 'https://www.schletter-group.com/',
  },
  {
    application: 'roof', manufacturer: 'Van der Valk', system: 'ValkPro+',
    surfaceTypes: ['Flachdach · Folie/Bitumen', 'Flachdach · Kies/Gründach'],
    terrainTypes: [], referenceEurPerKwp: 80,
    productUrl: 'https://www.valksolarsystems.com/',
  },
  {
    application: 'ground', manufacturer: 'Mounting Systems', system: 'Sigma II',
    surfaceTypes: [], terrainTypes: [...GROUND_TERRAIN_TYPES], referenceEurPerKwp: 92,
    productUrl: 'https://www.mounting-systems.com/de/solarparks-grossprojekte/pv-systeme-ueberblick/sigma-ii/sigma-ii-3p-3v-technische-uebersicht/',
  },
  {
    application: 'ground', manufacturer: 'Schletter', system: 'FS Duo',
    surfaceTypes: [], terrainTypes: ['Ebenes Gelände', 'Leichte Hanglage'], referenceEurPerKwp: 94,
    productUrl: 'https://www.schletter-group.com/',
  },
  {
    application: 'ground', manufacturer: 'Zimmermann', system: 'ZIM Track / Fix',
    surfaceTypes: [], terrainTypes: [...GROUND_TERRAIN_TYPES], referenceEurPerKwp: 98,
    productUrl: 'https://www.pv-stahlbau.de/',
  },
  {
    application: 'ground', manufacturer: 'Mounting Systems', system: 'Sigma Tracker',
    surfaceTypes: [], terrainTypes: ['Ebenes Gelände', 'Leichte Hanglage'], referenceEurPerKwp: 110,
    productUrl: 'https://www.mounting-systems.com/',
  },
  {
    application: 'ground', manufacturer: 'Valmont Solar', system: 'Convert',
    surfaceTypes: [], terrainTypes: ['Ebenes Gelände', 'Leichte Hanglage', 'Agri-PV'], referenceEurPerKwp: 105,
    productUrl: 'https://www.valmontsolar.com/',
  },
]

export function getMountingRecommendations(
  application: MountingApplication | '',
  surfaceType: string,
  terrainType: string,
) {
  if (!application) return []
  return MOUNTING_SYSTEMS.filter((item) => {
    if (item.application !== application) return false
    if (application === 'roof' && surfaceType) return item.surfaceTypes.includes(surfaceType)
    if (application === 'ground' && terrainType) return item.terrainTypes.includes(terrainType)
    return true
  }).slice(0, 5)
}

export function getMountingSystem(manufacturer: string, system: string) {
  return MOUNTING_SYSTEMS.find((item) => (
    item.manufacturer === manufacturer && item.system === system
  )) ?? null
}
