export type ExposeMetric = { label: string; value: string }
export type ExposeProfileRow = { label: string; value: string }

export type ExposePresentation = {
  typeLabel: string
  heroImage: string
  summary: string
  metrics: ExposeMetric[]
  profile: ExposeProfileRow[]
  highlights: string[]
  showPvEconomics: boolean
}

type ProjectLike = Record<string, unknown>
type Formatter = {
  number: (value: unknown, digits?: number) => string
  money: (value: unknown) => string
  tariff: (value: unknown) => string
}

function value(project: ProjectLike, ...keys: string[]): unknown {
  for (const key of keys) {
    const current = project[key]
    if (current !== null && current !== undefined && current !== '') return current
  }
  return null
}

function hasValue(raw: unknown): boolean {
  return raw !== null && raw !== undefined && raw !== '' && raw !== 'Noch offen' && raw !== '—'
}

function stageLabel(raw: unknown): string {
  if (raw === 'rtb') return 'RTB'
  if (raw === 'betrieb') return 'Im Betrieb'
  return raw ? 'In Planung' : ''
}

function developmentLabel(project: ProjectLike, key: string): string {
  const devStatus = project.dev_status && typeof project.dev_status === 'object'
    ? project.dev_status as Record<string, unknown>
    : {}
  const current = devStatus[key]
  if (current === true) return 'Vorhanden'
  if (current === false) return 'Nicht vorhanden'
  return ''
}

function typeDetails(projectType: string) {
  switch (projectType) {
    case 'pv_dach': return { label: 'PV-Dachanlage', image: '/project-dach.svg' }
    case 'pv_freiflaeche': return { label: 'PV-Freiflächenanlage', image: '/project-freiflaeche.svg' }
    case 'bess': return { label: 'Batteriespeicherprojekt', image: '/project-bess.svg' }
    case 'hybrid': return { label: 'PV- & BESS-Hybridprojekt', image: '/hero-dashboard.png' }
    case 'wind': return { label: 'Windenergieprojekt', image: '/hero-wind.svg' }
    case 'rechenzentrum': return { label: 'Rechenzentrum', image: '/hero-datacenter.svg' }
    default: return { label: 'Energieinfrastrukturprojekt', image: '/hero-generic-project.svg' }
  }
}

function compact<T extends { value: string }>(items: T[]): T[] {
  return items.filter((item) => hasValue(item.value))
}

export function getExposePresentation(project: ProjectLike, location: string, format: Formatter): ExposePresentation {
  const projectType = String(project.project_type ?? '')
  const type = typeDetails(projectType)
  const purchasePrice = value(project, 'purchase_price', 'deal_purchase_price', 'total_purchase_price')
  const investmentVolume = value(project, 'investment_volume_eur')
  const amortisation = value(project, 'amortisation_years', 'amortization_years', 'payback_years')
  const stage = stageLabel(value(project, 'project_stage'))
  const leaseTerm = value(project, 'lease_term_years', 'pachtdauer_jahre')
  const gridConnection = developmentLabel(project, 'netzanschluss')

  const commonProfile = compact<ExposeProfileRow>([
    { label: 'Standort', value: location },
    { label: 'Projektstatus', value: stage },
    { label: 'Netzanschluss', value: gridConnection },
    { label: 'Pachtdauer', value: leaseTerm ? `${format.number(leaseTerm)} Jahre` : '' },
  ])

  if (projectType === 'rechenzentrum') {
    const gridMw = value(project, 'data_center_grid_mw')
    const itMw = value(project, 'data_center_it_mw')
    const land = value(project, 'land_area_sqm')
    const transformer = value(project, 'transformer_status')
    return {
      typeLabel: type.label,
      heroImage: String(value(project, 'project_image_url') || type.image),
      summary: `Rechenzentrumsprojekt in ${location} mit den vorhandenen Anschluss-, Grundstücks- und Investitionsdaten.`,
      metrics: compact([
        { label: 'Netzanschluss', value: gridMw ? `${format.number(gridMw, 2)} MW` : gridConnection },
        { label: 'IT-Leistung', value: itMw ? `${format.number(itMw, 2)} MW` : '' },
        { label: 'Grundstück', value: land ? `${format.number(land)} m²` : '' },
        { label: 'Investitionsvolumen', value: investmentVolume ? format.money(investmentVolume) : '' },
        { label: 'Kaufpreis', value: purchasePrice ? format.money(purchasePrice) : '' },
      ]),
      profile: compact([...commonProfile, { label: 'Transformator / Umspannwerk', value: transformer ? String(transformer) : '' }]),
      highlights: [stage ? `Projektstatus: ${stage}` : '', gridMw ? `${format.number(gridMw, 2)} MW Anschlussleistung` : '', investmentVolume ? `Investitionsvolumen ${format.money(investmentVolume)}` : ''].filter(Boolean),
      showPvEconomics: false,
    }
  }

  if (projectType === 'bess') {
    const bessMw = value(project, 'bess_mw')
    const bessMwh = value(project, 'bess_mwh')
    const duration = value(project, 'bess_duration_h')
    return {
      typeLabel: type.label,
      heroImage: String(value(project, 'project_image_url') || type.image),
      summary: `Batteriespeicherprojekt in ${location} mit den vorhandenen Leistungs-, Kapazitäts- und Entwicklungsdaten.`,
      metrics: compact([
        { label: 'Leistung', value: bessMw ? `${format.number(bessMw, 2)} MW` : '' },
        { label: 'Kapazität', value: bessMwh ? `${format.number(bessMwh, 2)} MWh` : '' },
        { label: 'Dauer', value: duration ? `${format.number(duration, 1)} h` : '' },
        { label: 'Investitionsvolumen', value: investmentVolume ? format.money(investmentVolume) : '' },
        { label: 'Kaufpreis', value: purchasePrice ? format.money(purchasePrice) : '' },
      ]),
      profile: commonProfile,
      highlights: [stage ? `Projektstatus: ${stage}` : '', bessMw ? `${format.number(bessMw, 2)} MW Speicherleistung` : '', bessMwh ? `${format.number(bessMwh, 2)} MWh Kapazität` : ''].filter(Boolean),
      showPvEconomics: false,
    }
  }

  const pvKwp = value(project, 'pv_kwp', 'pv_mwp', 'capacity_kwp', 'plant_capacity_kwp')
  const specificYield = value(project, 'specific_yield', 'specific_yield_kwh_kwp', 'yield_kwh_kwp')
  const tariff = value(project, 'feed_in_tariff', 'feed_in_tariff_ct_kwh', 'tariff_ct_kwh')
  const feedInType = value(project, 'feed_in_type')
  const bessMwh = value(project, 'bess_mwh')

  const metrics = compact<ExposeMetric>([
    { label: projectType === 'wind' ? 'Leistung' : 'PV-Leistung', value: pvKwp ? `${format.number(pvKwp, 2)} kWp` : '' },
    { label: 'Amortisation', value: amortisation ? `${format.number(amortisation, 1)} Jahre` : '' },
    { label: 'Kaufpreis', value: purchasePrice ? format.money(purchasePrice) : '' },
    { label: projectType === 'hybrid' ? 'BESS-Kapazität' : 'Vergütung', value: projectType === 'hybrid' ? (bessMwh ? `${format.number(bessMwh, 2)} MWh` : '') : (tariff ? format.tariff(tariff) : '') },
    { label: 'Spez. Ertrag', value: specificYield ? `${format.number(specificYield)} kWh/kWp` : '' },
  ])

  return {
    typeLabel: type.label,
    heroImage: String(value(project, 'project_image_url') || type.image),
    summary: `${type.label} in ${location} mit den vorhandenen technischen und wirtschaftlichen Projektdaten.`,
    metrics,
    profile: compact([...commonProfile, { label: 'Einspeiseart', value: feedInType ? String(feedInType) : '' }]),
    highlights: [
      specificYield ? `Spezifischer Ertrag von ${format.number(specificYield)} kWh/kWp` : '',
      tariff ? `Vergütung von ${format.tariff(tariff)}` : '',
      gridConnection === 'Vorhanden' ? 'Netzanschluss vorhanden' : '',
      stage ? `Projektstatus: ${stage}` : '',
    ].filter(Boolean),
    showPvEconomics: ['pv_dach', 'pv_freiflaeche', 'hybrid'].includes(projectType),
  }
}
