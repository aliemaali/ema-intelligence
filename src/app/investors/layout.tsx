import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

export default async function Layout({ children }: { children: React.ReactNode }) {
 
const user = {
  email: ''
}
  return (
    <AppShell user={{
      name:      'Ali Ünlüer',
      email:      user.email ?? '',
      company:   'EMA Enterprise GmbH',
      avatarUrl:  null,
    }}>
      {children}
    </AppShell>
  )
}
