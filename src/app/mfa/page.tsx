import { MfaChallenge } from '@/components/auth/MfaChallenge'

export const dynamic = 'force-dynamic'

interface MfaPageProps {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function MfaPage({ searchParams }: MfaPageProps) {
  const params = await searchParams
  const redirectTo = params.redirectTo?.startsWith('/') && !params.redirectTo.startsWith('//')
    ? params.redirectTo
    : '/apps'

  return (
    <main className="premium-page flex min-h-screen items-center justify-center px-4 py-8">
      <MfaChallenge redirectTo={redirectTo} />
    </main>
  )
}
