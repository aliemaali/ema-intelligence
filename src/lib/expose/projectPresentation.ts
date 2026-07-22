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

function value(project: ProjectLike, key: string): unknown {
  const current = project[key]
  return current === null || current === undefined || current === '' ? null : current
}

function text(project: ProjectLike, key: string, fallback = 'Noch offen'): string {
  const current = value(project, key)
  return current === null ? fallback : String(current)
}

function dataCenterStatus(project: ProjectLike): string {
  const status = text(project, 'data_center_status', '')
  if (status === 'rtb') return 'RTB'
  if (status === 'in_entwicklung') return 'In Entwicklung'
  return 'Noch offen'
}

export function getExposePresentation(
  project: ProjectLike,
  location: string,
  format: Formatter,
): ExposePresentation {
  const projectType = String(project.project_type ?? '')
  const purchasePrice = value(project, 'purchase_price')

  if (projectType === 'rechenzentrum') {
    const gridMw = value(project, 'data_center_grid_mw')
    const itMw = value(project, 'data_center_it_mw')
    const land = value(project, 'land_area_sqm')
    const transformer = text(project, 'transformer_status')
    const status = dataCenterStatus(project)

    return {
      typeLabel: 'Rechenzentrum',
      heroImage: '/hero-datacenter.svg',
      summary: `Rechenzentrumsprojekt in ${location}. Die Darstellung konzentriert sich auf Netzanschlussleistung, IT-Leistung, Grundstück und Projektentwicklungsstatus.`,
      metrics: [
        { label: 'Netzanschluss', value: gridMw ? `${format.number(gridMw, 2)} MW` : 'Noch offen' },
        { label: 'IT-Leistung', value: itMw ? `${format.number(itMw, 2)} MW` : 'Noch offen' },
        { label: 'Grundstück', value: land ? `${format.number(land)} m²` : 'Noch offen' },
        { label: 'Projektstatus', value: status },
        { label: 'Trafo / UW', value: transformer },
        { label: 'Kaufpreis', value: purchasePrice ? format.money(purchasePrice) : 'Noch offen' },
      ],
      profile: [
        { label: 'Standort', value: location },
        { label: 'Status', value: status },
        { label: 'Netzanschlussleistung', value: gridMw ? `${format.number(gridMw, 2)} MW` : 'Noch offen' },
        { label: 'Transformator / Umspannwerk', value: transformer },
      ],
      highlights: [
        gridMw ? `${format.number(gridMw, 2)} MW elektrische Anschlussleistung` : null,
        itMw ? `${format.number(itMw, 2)} MW geplante IT-Leistung` : null,
        land ? `${format.number(land)} m² Grundstücksfläche` : null,
        `Projektstatus: ${status}`,
      ].filter(Boolean) as string[],
      showPvEconomics: false,
    }
  }

  if (projectType === 'sonstiges') {
    const status = text(project, 'status', 'Projektstatus offen')
    return {
      typeLabel: 'Sonstiges Projekt',
      heroImage: '/hero-generic-project.svg',
      summary: `Individuelles Infrastrukturprojekt in ${location}. Im Exposé werden ausschließlich tatsächlich hinterlegte Projektdaten dargestellt.`,
      metrics: [
        { label: 'Standort', value: location },
        { label: 'Status', value: status },
        { label: 'Kaufpreis', value: purchasePrice ? format.money(purchasePrice) : 'Noch offen' },
      ],
      profile: [
        { label: 'Standort', value: location },
        { label: 'Projektstatus', value: status },
        { label: 'Projektart', value: 'Sonstiges' },
      ],
      highlights: [
        project.notes ? 'Individuelle Projektbeschreibung und Dokumentation hinterlegt' : null,
        `Projektstatus: ${status}`,
      ].filter(Boolean) as string[],
      showPvEconomics: false,
    }
  }

  const pvKwp = value(project, 'pv_mwp')
  const specificYield = value(project, 'specific_yield_kwh_kwp')
  const tariff = value(project, 'feed_in_tariff_ct_kwh')
  const typeLabel = projectType === 'pv_dach'
    ? 'PV-Dachprojekt'
    : projectType === 'pv_freiflaeche'
      ? 'PV-Freiflächenanlage'
      : projectType === 'bess'
        ? 'Batteriespeicherprojekt'
        : projectType === 'hybrid'
          ? 'PV- & BESS-Hybridprojekt'
          : projectType === 'wind'
            ? 'Windprojekt'
            : 'Energieinfrastrukturprojekt'

  return {
    typeLabel,
    heroImage: '/hero-dashboard.png',
    summary: `${typeLabel} in ${location} mit den für diesen Projekttyp hinterlegten technischen und wirtschaftlichen Kennzahlen.`,
    metrics: [
      { label: 'Leistung', value: pvKwp ? `${format.number(pvKwp, 2)} kWp` : 'Noch offen' },
      { label: 'Kaufpreis', value: purchasePrice ? format.money(purchasePrice) : 'Noch offen' },
      { label: 'Spez. Ertrag', value: specificYield ? `${format.number(specificYield)} kWh/kWp` : 'Noch offen' },
      { label: 'Vergütung', value: format.tariff(tariff) },
    ],
    profile: [
      { label: 'Standort', value: location },
      { label: 'Projektstatus', value: text(project, 'status', 'Projektstatus offen') },
      { label: 'Netzanschluss', value: text(project, 'grid_connection_status') },
      { label: 'Einspeiseart', value: text(project, 'feed_in_type', '—') },
    ],
    highlights: [
      specificYield ? `Spezifischer Ertrag von ${format.number(specificYield)} kWh/kWp` : null,
      tariff ? `Vergütung von ${format.tariff(tariff)}` : null,
      project.status ? `Projektstatus: ${String(project.status)}` : null,
    ].filter(Boolean) as string[],
    showPvEconomics: true,
  }
}
