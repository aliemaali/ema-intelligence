import { notFound } from 'next/navigation'
import { getProject } from '@/lib/actions/project.actions'
import { getDealForProject } from '@/lib/actions/deal.actions'
import { DealForm } from '@/components/deals/DealForm'

interface DealTabProps {
  params: { id: string }
}

export default async function DealTab({ params }: DealTabProps) {
  let project: any

  try {
    project = await getProject(params.id)
  } catch {
    notFound()
  }

  if (!project) notFound()

  const { deal, expenses } = await getDealForProject(params.id)

  return (
    <div className="py-4 max-w-lg">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-foreground">
          Deal Economics
        </h2>

        <p className="text-xs text-muted-foreground mt-0.5">
          {project.project_number} ·{' '}
          {deal
            ? `Deal ${(deal as any).deal_number}`
            : 'Noch kein Deal angelegt'}
        </p>
      </div>

      <DealForm
        projectId={params.id}
        project={{
          pv_mwp: project.pv_mwp,
          bess_mwh: project.bess_mwh,
          project_type: project.project_type,
          project_number: project.project_number,
        }}
        deal={deal as any}
        expenses={expenses as any}
      />
    </div>
  )
}