import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'

export default async function DataCenterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?redirectTo=/data-center')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, company, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <AppShell user={{
      name: profile?.full_name ?? 'Ali Ünlü',
      email: profile?.email ?? user.email ?? '',
      company: profile?.company ?? 'EMA Enterprise GmbH',
      avatarUrl: profile?.avatar_url ?? null,
    }}>
      {children}
    </AppShell>
  )
}
