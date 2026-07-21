import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { linkInvestorToProject } from '@/lib/actions/project-investor.actions'

interface InvestorsTabProps {
  params: { id: string }
}

export default async function InvestorsTab({ params }: InvestorsTabProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: links }, { data: allInvestors }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, project_name, project_number')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('project_investors')
      .select(`
        *,
        investors (
          id, full_name, company, email, phone,
          interest_pv, interest_bess, interest_hybrid
        )
      `)
      .eq('project_id', params.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('investors')
      .select('id, full_name, company, email')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('company', { ascending: true }),
  ])

  if (!project) redirect('/projects')

  const linkedInvestorIds = new Set((links ?? []).map((link: any) => link.investor_id))
  const availableInvestors = (allInvestors ?? []).filter((investor: any) => !linkedInvestorIds.has(investor.id))
  const linkAction = linkInvestorToProject.bind(null, params.id)

  const STATUS_LABELS: Record<string, string> = {
    kontaktiert: 'Kontaktiert',
    interesse: 'Interesse',
    dd: 'DD',
    loi: 'LOI',
    abgelehnt: 'Abgelehnt',
    reserviert: 'Reserviert',
  }

  const STATUS_COLORS: Record<string, string> = {
    kontaktiert: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    interesse: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    dd: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    loi: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    abgelehnt: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    reserviert: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
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
              <p className="mt-4 rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">
                Alle vorhandenen Investoren sind bereits verknüpft oder es wurde noch kein Investor angelegt.
              </p>
            )}
            <a href="/investors" className="btn-secondary mt-3 flex w-full justify-center">Investoren verwalten</a>
          </div>
        </details>
      </div>

      {(!links || links.length === 0) ? (
        <EmptyState
          icon="🏦"
          title="Noch keine Investoren verknüpft"
          description="Wähle oben einen vorhandenen Investor aus, um den Vermarktungsfortschritt zu verfolgen."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {links.map((link: any) => {
            const investor = link.investors as {
              id: string
              full_name: string
              company: string | null
              email: string | null
              phone: string | null
            } | null
            if (!investor) return null

            const exposeUrl = `https://app.ema-enterprise.de/expose/${project.id}`
            const subject = encodeURIComponent(`Projekt-Exposé ${project.project_number} – ${project.project_name}`)
            const body = encodeURIComponent(
              `Sehr geehrte Damen und Herren,\n\n` +
              `anbei erhalten Sie das aktuelle Exposé zum Projekt ${project.project_name} (${project.project_number}).\n\n` +
              `Exposé öffnen: ${exposeUrl}\n\n` +
              `Für Rückfragen stehen wir Ihnen gerne zur Verfügung.\n\n` +
              `Mit freundlichen Grüßen\nEMA Enterprise GmbH`,
            )
            const mailto = investor.email ? `mailto:${investor.email}?subject=${subject}&body=${body}` : null

            return (
              <div key={link.id} className="card-padded">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">{investor.full_name}</p>
                    {investor.company && <p className="text-xs text-muted-foreground">{investor.company}</p>}
                    {investor.email && <p className="text-xs text-muted-foreground mt-0.5">{investor.email}</p>}
                  </div>
                  <span className={`badge ${STATUS_COLORS[link.status] ?? ''}`}>
                    {STATUS_LABELS[link.status] ?? link.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <a href={exposeUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Exposé öffnen</a>
                  {mailto ? (
                    <a href={mailto} className="btn-primary btn-sm">Exposé per Outlook senden</a>
                  ) : (
                    <span className="text-xs text-muted-foreground self-center">Keine E-Mail-Adresse hinterlegt</span>
                  )}
                </div>

                <div className="mt-3 flex gap-4 text-xs text-muted-foreground flex-wrap">
                  {link.teaser_sent_at && <span>📤 Teaser: {formatDate(link.teaser_sent_at)}</span>}
                  {link.expose_sent_at && <span>📋 Exposé: {formatDate(link.expose_sent_at)}</span>}
                  {link.dd_started_at && <span>🔍 DD: {formatDate(link.dd_started_at)}</span>}
                  {link.loi_received_at && <span>✅ LOI: {formatDate(link.loi_received_at)}</span>}
                </div>

                {link.notes && (
                  <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">{link.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
