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
export type ExposeLanguage = 'de' | 'en'
type Formatter = {
  number: (value: unknown, digits?: number) => string
  money: (value: unknown) => string
  tariff: (value: unknown) => string
}

function tr(language: ExposeLanguage, de: string, en: string): string {
  return language === 'en' ? en : de
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

function stageLabel(raw: unknown, language: ExposeLanguage): string {
  if (raw === 'rtb') return 'RTB'
  if (raw === 'betrieb') return tr(language, 'Im Betrieb', 'In operation')
  return raw ? tr(language, 'In Planung', 'In development') : ''
}

function developmentLabel(project: ProjectLike, key: string, language: ExposeLanguage): string {
  const devStatus = project.dev_status && typeof project.dev_status === 'object'
    ? project.dev_status as Record<string, unknown>
    : {}
  const current = devStatus[key]
  if (current === true) return tr(language, 'Vorhanden', 'Available')
  if (current === false) return tr(language, 'Nicht vorhanden', 'Not available')
  return ''
}

function typeDetails(projectType: string, language: ExposeLanguage) {
  switch (projectType) {
    case 'pv_dach': return { label: tr(language, 'PV-Dachanlage', 'Rooftop PV'), image: '/project-dach.svg' }
    case 'pv_freiflaeche': return { label: tr(language, 'PV-Freiflächenanlage', 'Ground-mounted PV'), image: '/project-freiflaeche.svg' }
    case 'bess': return { label: tr(language, 'Batteriespeicherprojekt', 'Battery storage project'), image: '/project-bess.svg' }
    case 'hybrid': return { label: tr(language, 'PV- & BESS-Hybridprojekt', 'PV & BESS hybrid project'), image: '/hero-dashboard.png' }
    case 'wind': return { label: tr(language, 'Windenergieprojekt', 'Wind energy project'), image: '/hero-wind.svg' }
    case 'rechenzentrum': return { label: tr(language, 'Rechenzentrum', 'Data center'), image: '/hero-datacenter.webp' }
    default: return { label: tr(language, 'Energieinfrastrukturprojekt', 'Energy infrastructure project'), image: '/hero-generic-project.svg' }
  }
}

function compact<T extends { value: string }>(items: T[]): T[] {
  return items.filter((item) => hasValue(item.value))
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown, language: ExposeLanguage, fallback?: string): string {
  const empty = fallback ?? tr(language, 'Nicht bekannt', 'Unknown')
  return hasValue(value) ? String(value) : empty
}

function checkStateLabel(value: unknown, language: ExposeLanguage): string {
  const labels: Record<DataCenterCheckState, [string, string]> = {
    yes: ['Ja', 'Yes'],
    no: ['Nein', 'No'],
    in_preparation: ['In Aufstellung', 'In preparation'],
    verify: ['Muss geprüft werden', 'Verification required'],
    planned: ['In Planung', 'Planned'],
    unknown: ['Nicht bekannt', 'Unknown'],
  }
  const label = labels[value as DataCenterCheckState]
  return label ? tr(language, label[0], label[1]) : tr(language, 'Nicht bekannt', 'Unknown')
}

function fiberStateLabel(value: unknown, language: ExposeLanguage): string {
  if (value === 'yes') return tr(language, 'Vorhanden', 'Available')
  if (value === 'no') return tr(language, 'Nicht vorhanden', 'Not available')
  return checkStateLabel(value, language)
}

function zoningLabel(value: unknown, language: ExposeLanguage): string {
  const labels: Record<DataCenterZoningDesignation, [string, string]> = {
    agricultural: ['Landwirtschaftlich', 'Agricultural'],
    industrial: ['Industriell', 'Industrial'],
    commercial: ['Gewerblich', 'Commercial'],
    mixed: ['Mischgebiet', 'Mixed-use'],
    special: ['Sondergebiet', 'Special-use area'],
    unknown: ['Nicht bekannt', 'Unknown'],
  }
  const label = labels[value as DataCenterZoningDesignation]
  return label ? tr(language, label[0], label[1]) : tr(language, 'Nicht bekannt', 'Unknown')
}

function feedInTypeLabel(value: unknown, language: ExposeLanguage): string {
  if (!hasValue(value) || language === 'de') return hasValue(value) ? String(value) : ''
  const key = String(value).trim().toLocaleLowerCase('de-DE')
  if (key.includes('voll')) return 'Full feed-in'
  if (key.includes('teil')) return 'Partial feed-in'
  if (key.includes('direkt')) return 'Direct marketing'
  return String(value)
}

function formatDate(value: unknown, language: ExposeLanguage): string {
  if (!hasValue(value)) return tr(language, 'Nicht bekannt', 'Unknown')
  const date = new Date(String(value))
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE').format(date)
}

export function getExposePresentation(project: ProjectLike, location: string, format: Formatter, language: ExposeLanguage = 'de'): ExposePresentation {
  const projectType = String(project.project_type ?? '')
  const type = typeDetails(projectType, language)
  const purchasePrice = value(project, 'purchase_price', 'deal_purchase_price', 'total_purchase_price')
  const investmentVolume = value(project, 'investment_volume_eur')
  const amortisation = value(project, 'amortisation_years', 'amortization_years', 'payback_years')
  const stage = stageLabel(value(project, 'project_stage'), language)
  const leaseTerm = value(project, 'lease_term_years', 'pachtdauer_jahre')
  const gridConnection = developmentLabel(project, 'netzanschluss', language)

  const commonProfile = compact<ExposeProfileRow>([
    { label: tr(language, 'Standort', 'Location'), value: location },
    { label: tr(language, 'Projektstatus', 'Project status'), value: stage },
    { label: tr(language, 'Netzanschluss', 'Grid connection'), value: gridConnection },
    { label: tr(language, 'Pachtdauer', 'Lease term'), value: leaseTerm ? `${format.number(leaseTerm)} ${tr(language, 'Jahre', 'years')}` : '' },
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
    const fiberStatus = fiberStateLabel(siteCheck.fiberStatus, language)
    const address = value(project, 'location_address') || siteCheck.streetPlot
    const gridStatus = gridConfirmed ? tr(language, 'Bestätigt', 'Confirmed') : tr(language, 'In Prüfung', 'Under review')
    const summaryParts = [
      tr(language, `Rechenzentrumsstandort in ${location}`, `Data center site in ${location}`),
      siteAreaHectares ? tr(language, `mit ${format.number(siteAreaHectares, 2)} ha Grundstücksfläche`, `with a site area of ${format.number(siteAreaHectares, 2)} ha`) : '',
      gridMw ? tr(language, `rund ${format.number(gridMw, 2)} MW Anschlussleistung`, `approximately ${format.number(gridMw, 2)} MW grid connection capacity`) : '',
      hvDistance !== null && hvDistance !== undefined && transformer
        ? tr(language, `${format.number(hvDistance)} m Entfernung zum ${text(transformer, language)}`, `${format.number(hvDistance)} m from ${text(transformer, language)}`)
        : '',
    ].filter(Boolean)
    const statusParts = [
      gridMw
        ? tr(language, `Die Netzleistung ist ${gridConfirmed ? 'bestätigt' : 'noch in Prüfung'}.`, `The grid capacity is ${gridConfirmed ? 'confirmed' : 'still under review'}.`)
        : tr(language, 'Die verfügbare Netzleistung ist noch nicht bekannt.', 'The available grid capacity is not yet known.'),
      tr(language, `Bebauungsplan: ${checkStateLabel(siteCheck.zoningPlanStatus, language)}.`, `Zoning plan: ${checkStateLabel(siteCheck.zoningPlanStatus, language)}.`),
      tr(language, `Zulässigkeit des Rechenzentrums: ${checkStateLabel(siteCheck.dataCenterPermitted, language)}.`, `Data center permitted: ${checkStateLabel(siteCheck.dataCenterPermitted, language)}.`),
      tr(language, `Glasfaser auf dem Grundstück: ${fiberStatus}.`, `On-site fiber connection: ${fiberStatus}.`),
    ]
    const dataCenterDetails: ExposeDataCenterDetails = {
      sourceDate: siteCheck.assessmentDate ? formatDate(siteCheck.assessmentDate, language) : undefined,
      sections: [
        {
          title: tr(language, 'Standort & Grundstück', 'Site & land'),
          rows: [
            { label: tr(language, 'Standort', 'Location'), value: location },
            { label: tr(language, 'Landkreis', 'District'), value: text(siteCheck.district, language) },
            { label: tr(language, 'Straße / Flurstück', 'Street / plot'), value: text(address, language) },
            { label: tr(language, 'GPS-Koordinaten', 'GPS coordinates'), value: text(siteCheck.gpsCoordinates, language) },
            { label: tr(language, 'Grundstücksfläche', 'Site area'), value: siteAreaHectares ? `${format.number(siteAreaHectares, 2)} ha` : tr(language, 'Nicht bekannt', 'Unknown') },
            { label: tr(language, 'Grundstückskosten / Pacht', 'Land cost / lease'), value: text(siteCheck.landCost, language) },
            { label: tr(language, 'Preis pro m²', 'Price per m²'), value: siteCheck.pricePerSqmEur ? `${format.number(siteCheck.pricePerSqmEur, 2)} €/m²` : tr(language, 'Nicht bekannt', 'Unknown') },
          ],
        },
        {
          title: tr(language, 'Baurecht & Flächennutzung', 'Planning law & land use'),
          rows: [
            { label: tr(language, 'Aktuelle Nutzungsart', 'Current land use'), value: zoningLabel(siteCheck.zoningDesignation, language) },
            { label: tr(language, 'Weitere Nutzung', 'Other designation'), value: text(siteCheck.otherDesignation, language) },
            { label: tr(language, 'Bebauungsplan', 'Zoning plan'), value: checkStateLabel(siteCheck.zoningPlanStatus, language) },
            { label: tr(language, 'Rechenzentrum zulässig', 'Data center permitted'), value: checkStateLabel(siteCheck.dataCenterPermitted, language) },
            { label: tr(language, 'Planungshinweis', 'Planning note'), value: text(siteCheck.planningNotes, language) },
          ],
        },
        {
          title: tr(language, 'Stromversorgung', 'Power supply'),
          rows: [
            { label: tr(language, 'Anschlussleistung', 'Grid connection capacity'), value: gridMw ? `${format.number(gridMw, 2)} MW` : tr(language, 'Nicht bekannt', 'Unknown') },
            { label: tr(language, 'Netzstatus', 'Grid status'), value: gridMw ? gridStatus : tr(language, 'Nicht bekannt', 'Unknown') },
            { label: tr(language, 'Entfernung zur HV-Station', 'Distance to HV substation'), value: hvDistance !== null && hvDistance !== undefined ? `${format.number(hvDistance)} m` : tr(language, 'Nicht bekannt', 'Unknown') },
            { label: tr(language, 'HV-Station / Umspannwerk', 'HV station / substation'), value: text(transformer, language) },
            { label: tr(language, 'Netzbetreiber', 'Grid operator'), value: text(siteCheck.gridOperator, language) },
            { label: tr(language, 'IT-Leistung', 'IT capacity'), value: itMw ? `${format.number(itMw, 2)} MW` : tr(language, 'Nicht bekannt', 'Unknown') },
          ],
        },
        {
          title: tr(language, 'Glasfaseranbindung', 'Fiber connectivity'),
          rows: [
            { label: tr(language, 'Glasfaser auf Grundstück', 'On-site fiber'), value: fiberStatus },
            { label: tr(language, 'Entfernung zur Glasfasertrasse', 'Distance to fiber route'), value: siteCheck.fiberDistanceMeters !== null && siteCheck.fiberDistanceMeters !== undefined ? `${format.number(siteCheck.fiberDistanceMeters)} m` : tr(language, 'Nicht bekannt', 'Unknown') },
            { label: tr(language, 'Glasfaseranbieter', 'Fiber provider'), value: text(siteCheck.fiberProvider, language) },
          ],
        },
      ],
    }
    return {
      typeLabel: type.label,
      heroImage: String(value(project, 'project_image_url') || type.image),
      summary: `${summaryParts.join(', ')}. ${statusParts.join(' ')}`,
      metrics: [
        { label: tr(language, 'Anschlussleistung', 'Grid capacity'), value: gridMw ? `${format.number(gridMw, 2)} MW` : tr(language, 'Nicht bekannt', 'Unknown') },
        { label: tr(language, 'Netzstatus', 'Grid status'), value: gridMw ? gridStatus : tr(language, 'Nicht bekannt', 'Unknown') },
        { label: tr(language, 'Grundstück', 'Site area'), value: siteAreaHectares ? `${format.number(siteAreaHectares, 2)} ha` : tr(language, 'Nicht bekannt', 'Unknown') },
        { label: tr(language, 'HV-Distanz', 'HV distance'), value: hvDistance !== null && hvDistance !== undefined ? `${format.number(hvDistance)} m` : tr(language, 'Nicht bekannt', 'Unknown') },
        { label: tr(language, 'Glasfaser', 'Fiber'), value: fiberStatus },
      ],
      profile: [
        ...commonProfile,
        { label: tr(language, 'Netzstatus', 'Grid status'), value: gridMw ? gridStatus : tr(language, 'Nicht bekannt', 'Unknown') },
        { label: tr(language, 'Transformator / Umspannwerk', 'Transformer / substation'), value: text(transformer, language) },
      ],
      highlights: [
        stage ? tr(language, `Projektstatus: ${stage}`, `Project status: ${stage}`) : tr(language, 'Projektstatus: In Planung', 'Project status: In development'),
        gridMw ? tr(language, `${format.number(gridMw, 2)} MW Anschlussleistung (${gridStatus.toLocaleLowerCase('de-DE')})`, `${format.number(gridMw, 2)} MW grid capacity (${gridStatus.toLocaleLowerCase('en-GB')})`) : tr(language, 'Anschlussleistung noch nicht bekannt', 'Grid capacity not yet known'),
        siteAreaHectares ? tr(language, `${format.number(siteAreaHectares, 2)} ha Grundstücksfläche`, `${format.number(siteAreaHectares, 2)} ha site area`) : tr(language, 'Grundstücksfläche noch nicht bekannt', 'Site area not yet known'),
        tr(language, `Rechenzentrum zulässig: ${checkStateLabel(siteCheck.dataCenterPermitted, language)}`, `Data center permitted: ${checkStateLabel(siteCheck.dataCenterPermitted, language)}`),
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
      summary: tr(language,
        `Batteriespeicherprojekt in ${location} mit den vorhandenen Leistungs-, Kapazitäts- und Entwicklungsdaten.`,
        `Battery storage project in ${location} based on the available power, capacity and development data.`,
      ),
      metrics: compact([
        { label: tr(language, 'Leistung', 'Power'), value: bessMw ? `${format.number(bessMw, 2)} MW` : '' },
        { label: tr(language, 'Kapazität', 'Capacity'), value: bessMwh ? `${format.number(bessMwh, 2)} MWh` : '' },
        { label: tr(language, 'Dauer', 'Duration'), value: duration ? `${format.number(duration, 1)} h` : '' },
        { label: tr(language, 'Investitionsvolumen', 'Investment volume'), value: investmentVolume ? format.money(investmentVolume) : '' },
        { label: tr(language, 'Kaufpreis', 'Purchase price'), value: purchasePrice ? format.money(purchasePrice) : '' },
      ]),
      profile: commonProfile,
      highlights: [
        stage ? tr(language, `Projektstatus: ${stage}`, `Project status: ${stage}`) : '',
        bessMw ? tr(language, `${format.number(bessMw, 2)} MW Speicherleistung`, `${format.number(bessMw, 2)} MW storage power`) : '',
        bessMwh ? tr(language, `${format.number(bessMwh, 2)} MWh Kapazität`, `${format.number(bessMwh, 2)} MWh capacity`) : '',
      ].filter(Boolean),
      showPvEconomics: false,
    }
  }

  const pvKwp = value(project, 'pv_kwp', 'pv_mwp', 'capacity_kwp', 'plant_capacity_kwp')
  const specificYield = value(project, 'specific_yield', 'specific_yield_kwh_kwp', 'yield_kwh_kwp')
  const tariff = value(project, 'feed_in_tariff', 'feed_in_tariff_ct_kwh', 'tariff_ct_kwh')
  const feedInType = value(project, 'feed_in_type')
  const bessMwh = value(project, 'bess_mwh')

  const metrics = compact<ExposeMetric>([
    { label: projectType === 'wind' ? tr(language, 'Leistung', 'Capacity') : tr(language, 'PV-Leistung', 'PV capacity'), value: pvKwp ? `${format.number(pvKwp, 2)} kWp` : '' },
    { label: tr(language, 'Amortisation', 'Payback period'), value: amortisation ? `${format.number(amortisation, 1)} ${tr(language, 'Jahre', 'years')}` : '' },
    { label: tr(language, 'Kaufpreis', 'Purchase price'), value: purchasePrice ? format.money(purchasePrice) : '' },
    { label: projectType === 'hybrid' ? tr(language, 'BESS-Kapazität', 'BESS capacity') : tr(language, 'Vergütung', 'Feed-in tariff'), value: projectType === 'hybrid' ? (bessMwh ? `${format.number(bessMwh, 2)} MWh` : '') : (tariff ? format.tariff(tariff) : '') },
    { label: tr(language, 'Spez. Ertrag', 'Specific yield'), value: specificYield ? `${format.number(specificYield)} kWh/kWp` : '' },
  ])

  return {
    typeLabel: type.label,
    heroImage: String(value(project, 'project_image_url') || type.image),
    summary: tr(language,
      `${type.label} in ${location} mit den vorhandenen technischen und wirtschaftlichen Projektdaten.`,
      `${type.label} in ${location} based on the available technical and financial project data.`,
    ),
    metrics,
    profile: compact([...commonProfile, { label: tr(language, 'Einspeiseart', 'Feed-in model'), value: feedInTypeLabel(feedInType, language) }]),
    highlights: [
      specificYield ? tr(language, `Spezifischer Ertrag von ${format.number(specificYield)} kWh/kWp`, `Specific yield of ${format.number(specificYield)} kWh/kWp`) : '',
      tariff ? tr(language, `Vergütung von ${format.tariff(tariff)}`, `Feed-in tariff of ${format.tariff(tariff)}`) : '',
      gridConnection === tr(language, 'Vorhanden', 'Available') ? tr(language, 'Netzanschluss vorhanden', 'Grid connection available') : '',
      stage ? tr(language, `Projektstatus: ${stage}`, `Project status: ${stage}`) : '',
    ].filter(Boolean),
    showPvEconomics: ['pv_dach', 'pv_freiflaeche', 'hybrid'].includes(projectType),
  }
}
