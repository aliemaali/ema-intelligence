import { permanentRedirect } from 'next/navigation'

interface ExposePageProps {
  params: { id: string }
}

export const metadata = { title: 'Exposé' }

export default function LegacyExposePage({ params }: ExposePageProps) {
  permanentRedirect(`/expose/${params.id}`)
}
