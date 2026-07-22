export type ExposeMetric = {
  label: string
  value: string
}

export type ExposeProfileRow = {
  label: string
  value: string
}

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

function statusLabel(raw: unknown): string {
  if (raw === 'rtb') return 'RTB – Ready to Build'
  if (raw === 'in_entwicklung') return 'In Entwicklung'
  return raw ? String(raw) : 'Noch offen'
}

function moneyOrOpen(raw: unknown, format: Formatter): string {
  return raw === null || raw === undefined || raw === '' ? 'Noch offen' : format.money(raw)
}

export function getExposePresentation(
  project: ProjectLike,
  location: string,
  format: Formatter,
): ExposePresentation {
  const projectType = String(project.project_type ?? '')
  const purchasePrice = value(project, 'purchase_price', 'deal_purchase_price')
  const investmentVolume = value(project, 'investment_volume_eur')
  const generalStatus = text(project, 'status', 'Projektstatus offen')

  if (projectType === 'rechenzentrum') {
    const gridMw = value(project, 'data_center_grid_mw')
    const itMw = value(project, 'data_center_it_mw')
    const land = value(project, 'land_area_sqm')
    const transformer = text(project, 'transformer_status')
    const status = statusLabel(value(project, 'data_center_status'))

    return {
      typeLabel: 'Rechenzentrum',
      heroImage: '/hero-datacenter.svg',
      summary: `Rechenzentrumsprojekt in ${location}. Im Mittelpunkt stehen elektrische Anschlussleistung, IT-Leistung, Grundstück, Genehmigungsstand und Investitionsvolumen.`,
      metrics: [
        { label: 'Netzanschluss', value: gridMw ? `${format.number(gridMw, 2)} MW` : 'Noch offen' },
        { label: 'IT-Leistung', value: itMw ? `${format.number(itMw, 2)} MW` : 'Noch offen' },
        { label: 'Grundstück', value: land ? `${format.number(land)} m²` : 'Noch offen' },
        { label: 'Projektstatus', value: status },
        { label: 'Investitionsvolumen', value: moneyOrOpen(investmentVolume, format) },
        { label: 'Kaufpreis', value: moneyOrOpen(purchasePrice, format) },
      ],
      profile: [
        { label: 'Standort', value: location },
        { label: 'Status', value: status },
        { label: 'Netzanschlussleistung', value: gridMw ? `${format.number(gridMw, 2)} MW` : 'Noch offen' },
        { label: 'IT-Leistung', value: itMw ? `${format.number(itMw, 2)} MW` : 'Noch offen' },
        { label: 'Transformator / Umspannwerk', value: transformer },
        { label: 'Baugenehmigung', value: text(project, 'building_permit_status') },
      ],
      highlights: [
        gridMw ? `${format.number(gridMw, 2)} MW elektrische Anschlussleistung` : null,
        itMw ? `${format.number(itMw, 2)} MW geplante IT-Leistung` : null,
        land ? `${format.number(land)} m² Grundstücksfläche` : null,
        investmentVolume ? `Investitionsvolumen ${format.money(investmentVolume)}` : null,
        `Projektstatus: ${status}`,
      ].filter(Boolean) as string[],
      showPvEconomics: false,
    }
  }

  if (projectType === 'bess') {
    const bessMw = value(project, 'bess_mw')
    const bessMwh = value(project, 'bess_mwh')
    const duration = value(project, 'bess_duration_h')
    return {
      typeLabel: 'Batteriespeicherprojekt',
      heroImage: '/hero-bess.svg',
      summary: `Batteriespeicherprojekt in ${location}. Das Exposé zeigt Leistung, Speicherkapazität, Entladedauer und aktuellen Entwicklungsstand.`,
      metrics: [
        { label: 'Leistung', value: bessMw ? `${format.number(bessMw, 2)} MW` : 'Noch offen' },
        { label: 'Kapazität', value: bessMwh ? `${format.number(bessMwh, 2)} MWh` : 'Noch offen' },
        { label: 'Dauer', value: duration ? `${format.number(duration, 1)} h` : 'Noch offen' },
        { label: 'Status', value: generalStatus },
        { label: 'Investitionsvolumen', value: moneyOrOpen(investmentVolume, format) },
        { label: 'Kaufpreis', value: moneyOrOpen(purchasePrice, format) },
      ],
      profile: [
        { label: 'Standort', value: location },
        { label: 'Projektstatus', value: generalStatus },
        { label: 'Netzanschluss', value: text(project, 'grid_connection_status') },
        { label: 'Baugenehmigung', value: text(project, 'building_permit_status') },
      ],
      highlights: [
        bessMw ? `${format.number(bessMw, 2)} MW Speicherleistung` : null,
        bessMwh ? `${format.number(bessMwh, 2)} MWh Speicherkapazität` : null,
        duration ? `${format.number(duration, 1)} Stunden Entladedauer` : null,
        `Projektstatus: ${generalStatus}`,
      ].filter(Boolean) as string[],
      showPvEconomics: false,
    }
  }

  if (projectType === 'wind') {
    const windMw = value(project, 'wind_mw', 'capacity_mw')
    return {
      typeLabel: 'Windenergieprojekt',
      heroImage: '/hero-wind.svg',
      summary: `Windenergieprojekt in ${location}. Es werden ausschließlich die verfügbaren technischen, genehmigungsbezogenen und wirtschaftlichen Daten gezeigt.`,
      metrics: [
        { label: 'Leistung', value: windMw ? `${format.number(windMw, 2)} MW` : 'Noch offen' },
        { label: 'Status', value: generalStatus },
        { label: 'Netzanschluss', value: text(project, 'grid_connection_status') },
        { label: 'Genehmigung', value: text(project, 'building_permit_status') },
        { label: 'Investitionsvolumen', value: moneyOrOpen(investmentVolume, format) },
        { label: 'Kaufpreis', value: moneyOrOpen(purchasePrice, format) },
      ],
      profile: [
        { label: 'Standort', value: location },
        { label: 'Projektstatus', value: generalStatus },
        { label: 'Netzanschluss', value: text(project, 'grid_connection_status') },
        { label: 'Genehmigungsstand', value: text(project, 'building_permit_status') },
      ],
      highlights: [
        windMw ? `${format.number(windMw, 2)} MW geplante Leistung` : null,
        `Projektstatus: ${generalStatus}`,
      ].filter(Boolean) as string[],
      showPvEconomics: false,
    }
  }

  if (projectType === 'sonstiges') {
    return {
      typeLabel: 'Sonstiges Projekt',
      heroImage: '/hero-generic-project.svg',
      summary: `Individuelles Infrastrukturprojekt in ${location}. Im Exposé erscheinen ausschließlich tatsächlich hinterlegte Projektdaten.`,
      metrics: [
        { label: 'Standort', value: location },
        { label: 'Status', value: generalStatus },
        { label: 'Investitionsvolumen', value: moneyOrOpen(investmentVolume, format) },
        { label: 'Kaufpreis', value: moneyOrOpen(purchasePrice, format) },
      ],
      profile: [
        { label: 'Standort', value: location },
        { label: 'Projektstatus', value: generalStatus },
        { label: 'Projektart', value: 'Sonstiges' },
      ],
      highlights: [
        project.notes ? 'Individuelle Projektbeschreibung und Dokumentation hinterlegt' : null,
        investmentVolume ? `Investitionsvolumen ${format.money(investmentVolume)}` : null,
        `Projektstatus: ${generalStatus}`,
      ].filter(Boolean) as string[],
      showPvEconomics: false,
    }
  }

  const pvKwp = value(project, 'pv_kwp', 'pv_mwp', 'capacity_kwp')
  const specificYield = value(project, 'specific_yield', 'specific_yield_kwh_kwp', 'yield_kwh_kwp')
  const tariff = value(project, 'feed_in_tariff', 'feed_in_tariff_ct_kwh', 'tariff_ct_kwh')
  const isHybrid = projectType === 'hybrid'
  const typeLabel = projectType === 'pv_dach'
    ? 'PV-Dachprojekt'
    : projectType === 'pv_freiflaeche'
      ? 'PV-Freiflächenanlage'
      : isHybrid
        ? 'PV- & BESS-Hybridprojekt'
        : 'Energieinfrastrukturprojekt'

  const metrics: ExposeMetric[] = [
    { label: 'PV-Leistung', value: pvKwp ? `${format.number(pvKwp, 2)} kWp` : 'Noch offen' },
    { label: 'Kaufpreis', value: moneyOrOpen(purchasePrice, format) },
    { label: 'Spez. Ertrag', value: specificYield ? `${format.number(specificYield)} kWh/kWp` : 'Noch offen' },
    { label: 'Vergütung', value: format.tariff(tariff) },
  ]

  if (isHybrid) {
    const bessMw = value(project, 'bess_mw')
    const bessMwh = value(project, 'bess_mwh')
    metrics.push(
      { label: 'BESS-Leistung', value: bessMw ? `${format.number(bessMw, 2)} MW` : 'Noch offen' },
      { label: 'BESS-Kapazität', value: bessMwh ? `${format.number(bessMwh, 2)} MWh` : 'Noch offen' },
    )
  }

  return {
    typeLabel,
    heroImage: '/hero-dashboard.png',
    summary: `${typeLabel} in ${location} mit den hinterlegten technischen und wirtschaftlichen Kennzahlen.`,
    metrics,
    profile: [
      { label: 'Standort', value: location },
      { label: 'Projektstatus', value: generalStatus },
      { label: 'Netzanschluss', value: text(project, 'grid_connection_status') },
      { label: 'Einspeiseart', value: text(project, 'feed_in_type', '—') },
    ],
    highlights: [
      specificYield ? `Spezifischer Ertrag von ${format.number(specificYield)} kWh/kWp` : null,
      tariff ? `Vergütung von ${format.tariff(tariff)}` : null,
      isHybrid ? 'Kombination aus Erzeugung und Batteriespeicher' : null,
      `Projektstatus: ${generalStatus}`,
    ].filter(Boolean) as string[],
    showPvEconomics: true,
  }
}
