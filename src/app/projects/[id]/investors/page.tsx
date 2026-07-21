import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui'
import { linkInvestorToProject } from '@/lib/actions/project-investor.actions'
import { InvestorLinkCard } from '@/components/projects/InvestorLinkCard'

interface InvestorsTabProps {
  params: { id: string }
}

function projectTypeLabel(type?: string | null) {
  if (type === 'pv_dach') return 'PV-Dachprojekt'
  if (type === 'pv_freiflaeche') return 'PV-Freiflächenanlage'
  if (type === 'bess') return 'Batteriespeicherprojekt'
  if (type === 'hybrid') return 'Hybridprojekt'
  if (type === 'wind') return 'Windprojekt'
  return 'Energieprojekt'
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

  const pvKwp = Number((project as any).pv_mwp ?? 0)
  const purchasePrice = Number(activeDeal?.purchase_price ?? 0)
  const specificYield = Number((project as any).specific_yield_kwh_kwp ?? 0)
  const tariffRaw = Number((project as any).feed_in_tariff_ct_kwh ?? 0)
  const tariffEurKwh = tariffRaw > 1 ? tariffRaw / 100 : tariffRaw
  const storedAnnualYield = Number((project as any).annual_yield_kwh ?? 0)
  const calculatedAnnualYield = pvKwp > 0 && specificYield > 0 ? pvKwp * specificYield : 0
  const annualYield = storedAnnualYield > 0 ? storedAnnualYield : calculatedAnnualYield
  const annualRevenue = annualYield > 0 && tariffEurKwh > 0 ? annualYield * tariffEurKwh : 0
  const amortisation = purchasePrice > 0 && annualRevenue > 0 ? purchasePrice / annualRevenue : 0
  const location = [(project as any).location_city, (project as any).location_state].filter(Boolean).join(', ') || 'Deutschland'

  const pdfData = {
    projectName: project.project_name || 'Projekt',
    projectNumber: project.project_number || '—',
    projectType: projectTypeLabel((project as any).project_type),
    location,
    dateLabel: new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date()),
    status: (project as any).status || 'Projektstatus offen',
    pvKwp: Number.isFinite(pvKwp) ? pvKwp : 0,
    purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : 0,
    specificYield: Number.isFinite(specificYield) ? specificYield : 0,
    tariffEurKwh: Number.isFinite(tariffEurKwh) ? tariffEurKwh : 0,
    annualRevenue: Number.isFinite(annualRevenue) ? annualRevenue : 0,
    amortisation: Number.isFinite(amortisation) ? amortisation : 0,
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
