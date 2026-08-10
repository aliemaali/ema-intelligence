import type { Metadata } from 'next'
import { ProjectChecklistOnlineForm } from '@/components/templates/ProjectChecklistGenerator'

export const metadata: Metadata = {
  title: 'Projekt-Checkliste',
  description: 'PV- und BESS-Projektcheckliste direkt im Browser ausfüllen und als PDF herunterladen.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ProjectChecklistPage() {
  return <ProjectChecklistOnlineForm />
}
