import { redirect } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function ProjectRootPage(props: Props) {
  const params = await props.params;
  redirect(`/projects/${params.id}/overview`)
}
