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
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(92,184,0,.12),transparent_34rem),radial-gradient(circle_at_bottom_right,rgba(19,32,96,.10),transparent_38rem),#f8fafc] px-4 py-8">
      <MfaChallenge redirectTo={redirectTo} />
    </main>
  )
}
