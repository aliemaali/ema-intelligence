import type { DataCenterCheckState, DataCenterSiteCheck, DataCenterZoningDesignation } from '@/lib/projects/master-data'

export type ExposeMetric = { label: string; value: string }
export type ExposeProfileRow = { label: string; value: string }
export type ExposeDetailSection = { title: string; rows: ExposeProfileRow[] }
export type ExposeDataCenterDetails = { sections: ExposeDetailSection[]; sourceDate?: string }

export type ExposePresentation = {
  typeLabel: string
  heroImage: string
  summary: string
  metrics: ExposeMetric[]
  profile: ExposeProfileRow[]
  highlights: string[]
  showPvEconomics: boolean
  dataCenterDetails?: ExposeDataCenterDetails
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
    case 'rechenzentrum': return { label: 'Rechenzentrum', image: '/hero-datacenter.webp' }
    default: return { label: 'Energieinfrastrukturprojekt', image: '/hero-generic-project.svg' }
  }
}

function compact<T extends { value: string }>(items: T[]): T[] {
  return items.filter((item) => hasValue(item.value))
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown, fallback = 'Nicht bekannt'): string {
  return hasValue(value) ? String(value) : fallback
}

function checkStateLabel(value: unknown): string {
  const labels: Record<DataCenterCheckState, string> = {
    yes: 'Ja',
    no: 'Nein',
    in_preparation: 'In Aufstellung',
    verify: 'Muss geprüft werden',
    planned: 'In Planung',
    unknown: 'Nicht bekannt',
  }
  return labels[value as DataCenterCheckState] ?? 'Nicht bekannt'
}

function fiberStateLabel(value: unknown): string {
  if (value === 'yes') return 'Vorhanden'
  if (value === 'no') return 'Nicht vorhanden'
  return checkStateLabel(value)
}

function zoningLabel(value: unknown): string {
  const labels: Record<DataCenterZoningDesignation, string> = {
    agricultural: 'Landwirtschaftlich',
    industrial: 'Industriell',
    commercial: 'Gewerblich',
    mixed: 'Mischgebiet',
    special: 'Sondergebiet',
    unknown: 'Nicht bekannt',
  }
  return labels[value as DataCenterZoningDesignation] ?? 'Nicht bekannt'
}

function formatDate(value: unknown): string {
  if (!hasValue(value)) return 'Nicht bekannt'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('de-DE').format(date)
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
    const siteCheck = record(project.data_center_site_check) as DataCenterSiteCheck
    const gridMw = value(project, 'data_center_grid_mw')
    const itMw = value(project, 'data_center_it_mw')
    const gridConfirmed = project.data_center_grid_confirmed === true
    const landSqm = value(project, 'land_area_sqm')
    const siteAreaHectares = siteCheck.siteAreaHectares ?? (landSqm ? Number(landSqm) / 10_000 : null)
    const transformer = value(project, 'transformer_status') || siteCheck.hvStationName
    const hvDistance = siteCheck.hvDistanceMeters
    const fiberStatus = fiberStateLabel(siteCheck.fiberStatus)
    const address = value(project, 'location_address') || siteCheck.streetPlot
    const gridStatus = gridConfirmed ? 'Bestätigt' : 'In Prüfung'
    const summaryParts = [
      `Rechenzentrumsstandort in ${location}`,
      siteAreaHectares ? `mit ${format.number(siteAreaHectares, 2)} ha Grundstücksfläche` : '',
      gridMw ? `rund ${format.number(gridMw, 2)} MW Anschlussleistung` : '',
      hvDistance !== null && hvDistance !== undefined && transformer
        ? `${format.number(hvDistance)} m Entfernung zum ${text(transformer)}`
        : '',
    ].filter(Boolean)
    const statusParts = [
      gridMw ? `Die Netzleistung ist ${gridConfirmed ? 'bestätigt' : 'noch in Prüfung'}.` : 'Die verfügbare Netzleistung ist noch nicht bekannt.',
      `Bebauungsplan: ${checkStateLabel(siteCheck.zoningPlanStatus)}.`,
      `Zulässigkeit des Rechenzentrums: ${checkStateLabel(siteCheck.dataCenterPermitted)}.`,
      `Glasfaser auf dem Grundstück: ${fiberStatus}.`,
    ]
    const dataCenterDetails: ExposeDataCenterDetails = {
      sourceDate: siteCheck.assessmentDate ? formatDate(siteCheck.assessmentDate) : undefined,
      sections: [
        {
          title: 'Standort & Grundstück',
          rows: [
            { label: 'Standort', value: location },
            { label: 'Landkreis', value: text(siteCheck.district) },
            { label: 'Straße / Flurstück', value: text(address) },
            { label: 'GPS-Koordinaten', value: text(siteCheck.gpsCoordinates) },
            { label: 'Grundstücksfläche', value: siteAreaHectares ? `${format.number(siteAreaHectares, 2)} ha` : 'Nicht bekannt' },
            { label: 'Grundstückskosten / Pacht', value: text(siteCheck.landCost) },
            { label: 'Preis pro m²', value: siteCheck.pricePerSqmEur ? `${format.number(siteCheck.pricePerSqmEur, 2)} €/m²` : 'Nicht bekannt' },
          ],
        },
        {
          title: 'Baurecht & Flächennutzung',
          rows: [
            { label: 'Aktuelle Nutzungsart', value: zoningLabel(siteCheck.zoningDesignation) },
            { label: 'Weitere Nutzung', value: text(siteCheck.otherDesignation) },
            { label: 'Bebauungsplan', value: checkStateLabel(siteCheck.zoningPlanStatus) },
            { label: 'Rechenzentrum zulässig', value: checkStateLabel(siteCheck.dataCenterPermitted) },
            { label: 'Planungshinweis', value: text(siteCheck.planningNotes) },
          ],
        },
        {
          title: 'Stromversorgung',
          rows: [
            { label: 'Anschlussleistung', value: gridMw ? `${format.number(gridMw, 2)} MW` : 'Nicht bekannt' },
            { label: 'Netzstatus', value: gridMw ? gridStatus : 'Nicht bekannt' },
            { label: 'Entfernung zur HV-Station', value: hvDistance !== null && hvDistance !== undefined ? `${format.number(hvDistance)} m` : 'Nicht bekannt' },
            { label: 'HV-Station / Umspannwerk', value: text(transformer) },
            { label: 'Netzbetreiber', value: text(siteCheck.gridOperator) },
            { label: 'IT-Leistung', value: itMw ? `${format.number(itMw, 2)} MW` : 'Nicht bekannt' },
          ],
        },
        {
          title: 'Glasfaseranbindung',
          rows: [
            { label: 'Glasfaser auf Grundstück', value: fiberStatus },
            { label: 'Entfernung zur Glasfasertrasse', value: siteCheck.fiberDistanceMeters !== null && siteCheck.fiberDistanceMeters !== undefined ? `${format.number(siteCheck.fiberDistanceMeters)} m` : 'Nicht bekannt' },
            { label: 'Glasfaseranbieter', value: text(siteCheck.fiberProvider) },
          ],
        },
      ],
    }
    return {
      typeLabel: type.label,
      heroImage: String(value(project, 'project_image_url') || type.image),
      summary: `${summaryParts.join(', ')}. ${statusParts.join(' ')}`,
      metrics: [
        { label: 'Anschlussleistung', value: gridMw ? `${format.number(gridMw, 2)} MW` : 'Nicht bekannt' },
        { label: 'Netzstatus', value: gridMw ? gridStatus : 'Nicht bekannt' },
        { label: 'Grundstück', value: siteAreaHectares ? `${format.number(siteAreaHectares, 2)} ha` : 'Nicht bekannt' },
        { label: 'HV-Distanz', value: hvDistance !== null && hvDistance !== undefined ? `${format.number(hvDistance)} m` : 'Nicht bekannt' },
        { label: 'Glasfaser', value: fiberStatus },
      ],
      profile: [
        ...commonProfile,
        { label: 'Netzstatus', value: gridMw ? gridStatus : 'Nicht bekannt' },
        { label: 'Transformator / Umspannwerk', value: text(transformer) },
      ],
      highlights: [
        stage ? `Projektstatus: ${stage}` : 'Projektstatus: In Planung',
        gridMw ? `${format.number(gridMw, 2)} MW Anschlussleistung (${gridStatus.toLocaleLowerCase('de-DE')})` : 'Anschlussleistung noch nicht bekannt',
        siteAreaHectares ? `${format.number(siteAreaHectares, 2)} ha Grundstücksfläche` : 'Grundstücksfläche noch nicht bekannt',
        `Rechenzentrum zulässig: ${checkStateLabel(siteCheck.dataCenterPermitted)}`,
      ],
      showPvEconomics: false,
      dataCenterDetails,
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
