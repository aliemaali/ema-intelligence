import { z } from 'zod'
import { getExposePresentation } from './projectPresentation'
import { resolvePvEconomics } from '@/lib/projects/pv-units'
import type { MemorandumPdfData } from '@/lib/pdf/memorandumPdf'

export const exposeKinds = [
  { id: 'bess', label: 'BESS', description: 'Batteriespeicher & Speicherportfolios', hero: '/project-bess.svg' },
  { id: 'pv', label: 'PV', description: 'Solarparks, Dachanlagen & Hybridprojekte', hero: '/pdf/hero-solarpark.jpg' },
  { id: 'data-center', label: 'Data Center', description: 'Rechenzentren & Entwicklungsstandorte', hero: '/hero-datacenter.webp' },
] as const
export type ExposeKind = typeof exposeKinds[number]['id']
export function exposeKind(type: string): ExposeKind | null {
  if (type === 'bess') return 'bess'
  if (['pv_dach', 'pv_freiflaeche', 'hybrid'].includes(type)) return 'pv'
  if (type === 'rechenzentrum') return 'data-center'
  return null
}
export function exposeHero(type: string) {
  return exposeKinds.find(item => item.id === exposeKind(type))?.hero ?? '/pdf/hero-solarpark.jpg'
}
export const exposeDraftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(1200),
  highlights: z.array(z.string().trim().max(240)).max(6),
  hero: z.enum(['type', 'project']),
})
export type ExposeDraft = z.infer<typeof exposeDraftSchema>
export type ExposeProjectOption = { id: string; name: string; number: string; type: string; location: string }
export type ExposeWizardSource = { data: MemorandumPdfData; projectImage: string | null; warnings: string[]; draft: ExposeDraft | null }

export function buildExposeSource(project: Record<string, unknown>): Omit<ExposeWizardSource, 'draft'> {
  const number = (raw: unknown, digits = 0) => Number(raw).toLocaleString('de-DE', { maximumFractionDigits: digits })
  const money = (raw: unknown) => Number(raw).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const economics = resolvePvEconomics(project)
  const location = [project.location_city, project.location_state].filter(Boolean).join(', ') || String(project.location_country || 'Standort offen')
  const presentation = getExposePresentation({ ...project, purchase_price: economics.purchasePrice, pv_kwp: economics.pvKwp, specific_yield: economics.specificYieldKwhPerKwp, feed_in_tariff: economics.tariffEurKwh, amortisation_years: economics.amortisationYears }, location, {
    number, money, tariff: raw => Number(raw) > 0 ? `${number(raw, 3)} €/kWh` : '',
  })
  const warnings: string[] = []
  if (!project.location_city) warnings.push('Projektort fehlt. Bitte in der Projektakte ergänzen.')
  if (exposeKind(String(project.project_type)) === 'pv' && !economics.pvKwp) warnings.push('PV-Leistung fehlt.')
  if (project.project_type === 'bess' && !Number(project.bess_mwh)) warnings.push('Speicherkapazität fehlt.')
  if (project.project_type === 'rechenzentrum' && !Number(project.data_center_grid_mw)) warnings.push('Anschlussleistung fehlt.')
  if (!presentation.metrics.length) warnings.push('Noch keine technischen Kennzahlen hinterlegt.')
  const projectImage = typeof project.project_image_url === 'string' && project.project_image_url.startsWith('https://') ? project.project_image_url : null
  return { projectImage, warnings, data: {
    projectName: String(project.project_name || 'Projekt'), projectNumber: String(project.project_number || ''), projectType: String(project.project_type || ''),
    typeLabel: presentation.typeLabel, location, country: String(project.location_country || ''), countryFlag: '',
    dateLabel: new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date()),
    status: project.project_stage === 'rtb' ? 'RTB' : project.project_stage === 'betrieb' ? 'Im Betrieb' : 'In Planung',
    summary: presentation.summary, metrics: presentation.metrics, profile: presentation.profile, highlights: presentation.highlights,
    dataCenterDetails: presentation.dataCenterDetails, bessPortfolioDetails: presentation.bessPortfolioDetails,
    heroImage: exposeHero(String(project.project_type)), language: 'de', showPvEconomics: presentation.showPvEconomics,
    pvEconomics: presentation.showPvEconomics ? {
      annualYield: economics.annualYieldKwh ?? 0, annualRevenue: economics.annualRevenue ?? 0, purchasePrice: economics.purchasePrice ?? 0,
      tariffEurKwh: economics.tariffEurKwh ?? 0, roi: economics.roiPercent ?? 0, amortisation: economics.amortisationYears ?? 0,
    } : null,
  } }
}
export function applyExposeDraft(source: ExposeWizardSource, draft: ExposeDraft): MemorandumPdfData {
  return { ...source.data, projectName: draft.title, summary: draft.summary, highlights: draft.highlights.filter(Boolean),
    projectImage: draft.hero === 'project' && source.projectImage ? source.projectImage : undefined }
}
