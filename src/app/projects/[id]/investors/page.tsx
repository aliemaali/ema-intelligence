import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface InvestorsTabProps {
  params: { id: string }
}

export default async function InvestorsTab({ params }: InvestorsTabProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch linked investors for this project
  const { data: links } = await supabase
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
    .order('created_at', { ascending: false })

  const STATUS_LABELS: Record<string, string> = {
    kontaktiert: 'Kontaktiert',
    interesse:   'Interesse',
    dd:          'DD',
    loi:         'LOI',
    abgelehnt:   'Abgelehnt',
    reserviert:  'Reserviert',
  }

  const STATUS_COLORS: Record<string, string> = {
    kontaktiert: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    interesse:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    dd:          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    loi:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    abgelehnt:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    reserviert:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  }

  return (
    <div className="py-4 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Verknüpfte Investoren</h2>
        <Link href="/investors" className="btn-secondary btn-sm">
          Investor hinzufügen
        </Link>
      </div>

      {(!links || links.length === 0) ? (
        <EmptyState
          icon="🏦"
          title="Noch keine Investoren verknüpft"
          description="Verknüpfe Investoren mit diesem Projekt um den Vermarktungsfortschritt zu tracken."
          action={
            <Link href="/investors" className="btn-secondary mt-2">
              Zu den Investoren
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {links.map((link) => {
            const investor = (link as any).investors as {
              id: string; full_name: string; company: string | null
              email: string | null; phone: string | null
            } | null
            if (!investor) return null

            return (
              <div key={(link as any).id} className="card-padded">
                <div className="flex items-start justify-between gap-3 mb-3">
                  {/* Investor info */}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">{investor.full_name}</p>
                    {investor.company && (
                      <p className="text-xs text-muted-foreground">{investor.company}</p>
                    )}
                    {investor.email && (
                      <p className="text-xs text-muted-foreground mt-0.5">{investor.email}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Status */}
                    <span className={`badge ${STATUS_COLORS[(link as any).status] ?? ''}`}>
                      {STATUS_LABELS[(link as any).status] ?? (link as any).status}
                    </span>

                    {/* Match Score */}
                    {(link as any).match_score !== null && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#5CB800] rounded-full"
                            style={{ width: `${(link as any).match_score}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[#5CB800]">
                          {(link as any).match_score}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline dots */}
                <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                  {(link as any).teaser_sent_at && (
                    <span>📤 Teaser: {formatDate((link as any).teaser_sent_at)}</span>
                  )}
                  {(link as any).expose_sent_at && (
                    <span>📋 Exposé: {formatDate((link as any).expose_sent_at)}</span>
                  )}
                  {(link as any).dd_started_at && (
                    <span>🔍 DD: {formatDate((link as any).dd_started_at)}</span>
                  )}
                  {(link as any).loi_received_at && (
                    <span>✅ LOI: {formatDate((link as any).loi_received_at)}</span>
                  )}
                </div>

                {(link as any).notes && (
                  <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
                    {(link as any).notes}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
