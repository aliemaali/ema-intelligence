import { permanentRedirect } from 'next/navigation'

interface ExposePageProps {
  params: Promise<{ id: string }>
}

export const metadata = { title: 'Exposé' }

export default async function LegacyExposePage(props: ExposePageProps) {
  const params = await props.params;
  permanentRedirect(`/expose/${params.id}`)
}
