import { getProjects } from '@/lib/actions/project.actions'
import { getProjectAuditData } from '@/lib/actions/project-audit.actions'
import { ProjectAuditDashboard } from '@/components/projects/ProjectAuditDashboard'

export const metadata = { title: 'Projektprüfung' }
export const dynamic = 'force-dynamic'

function reportDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>
}

export default async function ProjectAuditPage() {
  const projects = await getProjects({})
  const result = await getProjectAuditData(projects.map((project: any) => project.id))
  const now = new Date()
  const parts = reportDateParts(now)
  const createdAt = `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`
  const reportId = `PR-${parts.year}-${parts.month}${parts.day}-${parts.hour}${parts.minute}`

  return <ProjectAuditDashboard
    projects={result.success ? result.data : []}
    createdAt={createdAt}
    reportId={reportId}
    errorMessage={result.success ? undefined : result.error}
  />
}
