import { createClient } from '@/lib/supabase/server'
import { getInvestors, getInvestorDashboardKpis } from '@/lib/actions/investorActions'
import { InvestorBoard } from '@/components/investors-crm/InvestorBoard'
import { InvestorProfileImportButton } from '@/components/investors-crm/InvestorProfileImportButton'

export const dynamic = 'force-dynamic'

export default async function InvestorsPage() {
  const supabase = await createClient()
  const [investorsResult, kpisResult, projectsResult] = await Promise.all([
    getInvestors({ sortBy: 'company_name', sortDirection: 'asc' }),
    getInvestorDashboardKpis(),
    supabase.from('projects').select('id, name').order('name'),
  ])

  const initialInvestors = investorsResult.success ? investorsResult.data : []
  const initialKpis = kpisResult.success
    ? kpisResult.data
    : {
        totalInvestors: 0,
        activeInvestors: 0,
        totalTicketVolumeEur: 0,
      }
  const projects = projectsResult.data ?? []

  return (
    <div className="min-h-screen w-full" style={{ background: '#F4F6F9' }}>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        {!investorsResult.success && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            Investoren konnten nicht geladen werden: {investorsResult.error}
          </div>
        )}

        <div className="mb-4 md:hidden">
          <InvestorProfileImportButton mobile />
        </div>
        <div className="mb-4 hidden justify-end md:flex">
          <InvestorProfileImportButton />
        </div>

        <InvestorBoard
          initialInvestors={initialInvestors}
          initialKpis={initialKpis}
          projects={projects}
        />
      </div>
    </div>
  )
}
