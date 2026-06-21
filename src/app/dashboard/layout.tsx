import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

/**
 * Layout for all authenticated routes.
 * Server-side auth check – redirects to /login if no session.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Fetch profile for sidebar display
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, company, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <AppShell
      user={{
        name:      'Ali Ünlü',
        email:     user.email ?? '',
        company:   'EMA Enterprise GmbH',
        avatarUrl: null,
      }}
    >
      {children}
    </AppShell>
  )
}
