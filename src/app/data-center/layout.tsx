import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DataCenterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?redirectTo=/data-center')

  return <main className="min-h-screen min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-[#031126]">{children}</main>
}
