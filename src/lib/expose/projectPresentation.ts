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

function text(project: ProjectLike, keys: string | string[], fallback = 'Noch offen'): string {
  const current = value(project, ...(Array.isArray(keys) ? keys : [keys]))
  return current === null ? fallback : String(current)
}

function stageLabel(raw: unknown): string {
  if (raw === 'rtb') return 'RTB'
  if (raw === 'betrieb') return 'Im Betrieb'
  return 'In Planung'
}

function developmentLabel(project: ProjectLike, key: string): string {
  const devStatus = project.dev_status && typeof project.dev_status === 'object'
    ? project.dev_status as Record<string, unknown>
    : {}
  const current = devStatus[key]
  if (current === true) return 'Vorhanden'
  if (current === false) return 'Nicht vorhanden'
  return 'Noch offen'
}

function moneyOrOpen(raw: unknown, format: Formatter): string {
  return raw === null || raw === undefined || raw === '' ? 'Noch offen' : format.money(raw)
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

export function getExposePresentation(project: ProjectLike, location: string, format: Formatter): ExposePresentation {
  const projectType = String(project.project_type ?? '')
  const type = typeDetails(projectType)
  const purchasePrice = value(project, 'purchase_price', 'deal_purchase_price')
  const investmentVolume = value(project, 'investment_volume_eur')
  const stage = stageLabel(value(project, 'project_stage'))
  const leaseTerm = value(project, 'lease_term_years', 'pachtdauer_jahre')
  const commonProfile: ExposeProfileRow[] = [
    { label: 'Standort', value: location },
    { label: 'Projektstatus', value: stage },
    { label: 'Netzanschluss', value: developmentLabel(project, 'netzanschluss') },
    { label: 'Pachtdauer', value: leaseTerm ? `${format.number(leaseTerm)} Jahre` : 'Noch offen' },
  ]

  if (projectType === 'rechenzentrum') {
    const gridMw = value(project, 'data_center_grid_mw')
    const itMw = value(project, 'data_center_it_mw')
    const land = value(project, 'land_area_sqm')
    return {
      typeLabel: type.label,
      heroImage: String(value(project, 'project_image_url') || type.image),
      summary: `Rechenzentrumsprojekt in ${location} mit den hinterlegten Anschluss-, Grundstücks- und Investitionsdaten.`,
      metrics: [
        { label: 'Projekttyp', value: type.label },
        { label: 'Netzanschluss', value: gridMw ? `${format.number(gridMw, 2)} MW` : developmentLabel(project, 'netzanschluss') },
        { label: 'IT-Leistung', value: itMw ? `${format.number(itMw, 2)} MW` : 'Noch offen' },
        { label: 'Grundstück', value: land ? `${format.number(land)} m²` : 'Noch offen' },
        { label: 'Investitionsvolumen', value: moneyOrOpen(investmentVolume, format) },
        { label: 'Kaufpreis', value: moneyOrOpen(purchasePrice, format) },
      ],
      profile: [...commonProfile, { label: 'Transformator / Umspannwerk', value: text(project, 'transformer_status') }],
      highlights: [`Projektstatus: ${stage}`, gridMw ? `${format.number(gridMw, 2)} MW Anschlussleistung` : null, investmentVolume ? `Investitionsvolumen ${format.money(investmentVolume)}` : null].filter(Boolean) as string[],
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
      summary: `Batteriespeicherprojekt in ${location} mit den verfügbaren Leistungs-, Kapazitäts- und Entwicklungsdaten.`,
      metrics: [
        { label: 'Projekttyp', value: type.label },
        { label: 'Leistung', value: bessMw ? `${format.number(bessMw, 2)} MW` : 'Noch offen' },
        { label: 'Kapazität', value: bessMwh ? `${format.number(bessMwh, 2)} MWh` : 'Noch offen' },
        { label: 'Dauer', value: duration ? `${format.number(duration, 1)} h` : 'Noch offen' },
        { label: 'Investitionsvolumen', value: moneyOrOpen(investmentVolume, format) },
        { label: 'Kaufpreis', value: moneyOrOpen(purchasePrice, format) },
      ],
      profile: commonProfile,
      highlights: [`Projektstatus: ${stage}`, bessMw ? `${format.number(bessMw, 2)} MW Speicherleistung` : null, bessMwh ? `${format.number(bessMwh, 2)} MWh Kapazität` : null].filter(Boolean) as string[],
      showPvEconomics: false,
    }
  }

  const pvKwp = value(project, 'pv_kwp', 'pv_mwp', 'capacity_kwp')
  const specificYield = value(project, 'specific_yield', 'specific_yield_kwh_kwp', 'yield_kwh_kwp')
  const tariff = value(project, 'feed_in_tariff', 'feed_in_tariff_ct_kwh', 'tariff_ct_kwh')
  const metrics: ExposeMetric[] = [
    { label: 'Projekttyp', value: type.label },
    { label: projectType === 'wind' ? 'Leistung' : 'PV-Leistung', value: pvKwp ? `${format.number(pvKwp, 2)} kWp` : 'Noch offen' },
    { label: 'Kaufpreis', value: moneyOrOpen(purchasePrice, format) },
    { label: 'Spez. Ertrag', value: specificYield ? `${format.number(specificYield)} kWh/kWp` : 'Noch offen' },
    { label: 'Vergütung', value: format.tariff(tariff) },
    { label: 'Pachtdauer', value: leaseTerm ? `${format.number(leaseTerm)} Jahre` : 'Noch offen' },
  ]

  if (projectType === 'hybrid') {
    metrics[4] = { label: 'BESS-Kapazität', value: value(project, 'bess_mwh') ? `${format.number(value(project, 'bess_mwh'), 2)} MWh` : 'Noch offen' }
  }

  return {
    typeLabel: type.label,
    heroImage: String(value(project, 'project_image_url') || type.image),
    summary: `${type.label} in ${location} mit den hinterlegten technischen und wirtschaftlichen Kennzahlen.`,
    metrics,
    profile: [...commonProfile, { label: 'Einspeiseart', value: text(project, 'feed_in_type', '—') }],
    highlights: [
      specificYield ? `Spezifischer Ertrag von ${format.number(specificYield)} kWh/kWp` : null,
      tariff ? `Vergütung von ${format.tariff(tariff)}` : null,
      developmentLabel(project, 'netzanschluss') === 'Vorhanden' ? 'Netzanschluss vorhanden' : null,
      `Projektstatus: ${stage}`,
    ].filter(Boolean) as string[],
    showPvEconomics: ['pv_dach', 'pv_freiflaeche', 'hybrid'].includes(projectType),
  }
}