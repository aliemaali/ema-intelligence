import { redirect } from 'next/navigation'

interface Props { params: { id: string } }

export default function ProjectRootPage({ params }: Props) {
  redirect(`/projects/${params.id}/overview`)
}
