import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui'
import { linkInvestorToProject } from '@/lib/actions/project-investor.actions'
import { InvestorLinkCard } from '@/components/projects/InvestorLinkCard'
import { getExposePresentation } from '@/lib/expose/projectPresentation'
import type { MemorandumPdfData } from '@/lib/pdf/memorandumPdf'

interface InvestorsTabProps {
  params: { id: string }
}

const COUNTRY_CODES: Record<string, string> = {
  Deutschland: 'de', Germany: 'de', Italien: 'it', Italy: 'it', Türkei: 'tr', Turkey: 'tr',
  Österreich: 'at', Austria: 'at', Schweiz: 'ch', Switzerland: 'ch', Frankreich: 'fr', France: 'fr',
  Spanien: 'es', Spain: 'es', Niederlande: 'nl', Netherlands: 'nl', Polen: 'pl', Poland: 'pl',
  Griechenland: 'gr', Greece: 'gr', Portugal: 'pt', Belgien: 'be', Belgium: 'be',
}

function flagUrl(country: string) {
  const code = COUNTRY_CODES[country]
  return code ? `https://flagcdn.com/w80/${code}.png` : ''
}

function formatNumber(value: unknown, digits = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number)
}

function formatMoney(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(number)
}

function formatTariff(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Noch offen'
  return number > 1
    ? `${formatNumber(number, 2)} ct/kWh`
    : `${formatNumber(number, 3)} €/kWh`
}

export default async function InvestorsTab({ params }: InvestorsTabProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: project },
    { data: activeDeal },
    { data: links },
    { data: allInvestors },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', params.id).eq('user_id', user.id).single(),
    supabase.from('deals').select('purchase_price, sales_price, updated_at').eq('project_id', params.id).eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase
      .from('project_investors')
      .select(`*, investors (id, full_name, company, email, phone, interest_pv, interest_bess, interest_hybrid)`)
      .eq('project_id', params.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('investors').select('id, full_name, company, email').eq('user_id', user.id).eq('is_active', true).order('company', { ascending: true }),
  ])

  if (!project) redirect('/projects')

  const linkedInvestorIds = new Set((links ?? []).map((link: any) => link.investor_id))
  const availableInvestors = (allInvestors ?? []).filter((investor: any) => !linkedInvestorIds.has(investor.id))
  const linkAction = linkInvestorToProject.bind(null, params.id)

  const projectData = {
    ...(project as Record<string, unknown>),
    purchase_price: activeDeal?.purchase_price ?? null,
    sales_price: activeDeal?.sales_price ?? null,
  }
  const country = String((project as any).location_country || 'Deutschland')
  const countryFlag = flagUrl(country)
  const location = [(project as any).location_city, (project as any).location_state].filter(Boolean).join(', ') || country
  const presentation = getExposePresentation(projectData, location, {
    number: formatNumber,
    money: formatMoney,
    tariff: formatTariff,
  })

  const pvKwp = Number((project as any).pv_mwp ?? 0)
  const specificYield = Number((project as any).specific_yield_kwh_kwp ?? 0)
  const tariffRaw = Number((project as any).feed_in_tariff_ct_kwh ?? 0)
  const tariffEurKwh = tariffRaw > 1 ? tariffRaw / 100 : tariffRaw
  const storedAnnualYield = Number((project as any).annual_yield_kwh ?? 0)
  const calculatedAnnualYield = pvKwp > 0 && specificYield > 0 ? pvKwp * specificYield : 0
  const annualYield = storedAnnualYield > 0 ? storedAnnualYield : calculatedAnnualYield
  const purchasePrice = Number(activeDeal?.purchase_price ?? 0)
  const annualRevenue = annualYield > 0 && tariffEurKwh > 0 ? annualYield * tariffEurKwh : 0
  const amortisation = purchasePrice > 0 && annualRevenue > 0 ? purchasePrice / annualRevenue : 0
  const roi = purchasePrice > 0 && annualRevenue > 0 ? (annualRevenue / purchasePrice) * 100 : 0

  const pdfData: MemorandumPdfData = {
    projectName: project.project_name || 'Projekt',
    projectNumber: project.project_number || '—',
    projectType: String((project as any).project_type || 'sonstiges'),
    typeLabel: presentation.typeLabel,
    location,
    country,
    countryFlag,
    dateLabel: new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date()),
    status: String((project as any).project_stage || 'planung'),
    summary: presentation.summary,
    metrics: presentation.metrics,
    profile: presentation.profile,
    highlights: presentation.highlights,
    heroImage: presentation.heroImage,
    showPvEconomics: presentation.showPvEconomics,
    pvEconomics: presentation.showPvEconomics
      ? {
          annualYield: Number.isFinite(annualYield) ? annualYield : 0,
          annualRevenue: Number.isFinite(annualRevenue) ? annualRevenue : 0,
          purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : 0,
          tariffEurKwh: Number.isFinite(tariffEurKwh) ? tariffEurKwh : 0,
          roi: Number.isFinite(roi) ? roi : 0,
          amortisation: Number.isFinite(amortisation) ? amortisation : 0,
        }
      : null,
  }

  return (
    <div className="py-4 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Verknüpfte Investoren</h2>
        <details className="relative">
          <summary className="btn-secondary btn-sm cursor-pointer list-none">Investor hinzufügen</summary>
          <div className="absolute right-0 z-20 mt-2 w-[min(90vw,380px)] rounded-2xl border border-border bg-card p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-foreground">Investor auswählen</h3>
            <p className="mt-1 text-xs text-muted-foreground">Vorhandenen Investor mit diesem Projekt verknüpfen.</p>
            {availableInvestors.length > 0 ? (
              <form action={linkAction} className="mt-4 space-y-3">
                <select name="investor_id" required className="form-input">
                  <option value="">– Investor wählen –</option>
                  {availableInvestors.map((investor: any) => (
                    <option key={investor.id} value={investor.id}>
                      {investor.company || investor.full_name}{investor.company && investor.full_name ? ` · ${investor.full_name}` : ''}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-primary w-full">Investor verknüpfen</button>
              </form>
            ) : (
              <p className="mt-4 rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">Alle vorhandenen Investoren sind bereits verknüpft oder es wurde noch kein Investor angelegt.</p>
            )}
            <a href="/investors" className="btn-secondary mt-3 flex w-full justify-center">Investoren verwalten</a>
          </div>
        </details>
      </div>

      {(!links || links.length === 0) ? (
        <EmptyState icon="🏦" title="Noch keine Investoren verknüpft" description="Wähle oben einen vorhandenen Investor aus, um den Vermarktungsfortschritt zu verfolgen." />
      ) : (
        <div className="flex flex-col gap-3">
          {links.map((link: any) => {
            const investor = link.investors as { id: string; full_name: string; company: string | null; email: string | null } | null
            if (!investor) return null
            return (
              <InvestorLinkCard
                key={link.id}
                linkId={link.id}
                projectId={project.id}
                investor={investor}
                status={link.status}
                pdfData={pdfData}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
