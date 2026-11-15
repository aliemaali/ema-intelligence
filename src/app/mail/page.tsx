import { redirect } from 'next/navigation'
import { isMailEnabled, canUseMail } from '@/lib/mail/model'
import { createClient } from '@/lib/supabase/server'
import { MailWorkspace } from '@/components/mail/MailWorkspace'
export const metadata={title:'EMA Mail'}
export const dynamic='force-dynamic'
export default async function MailPage() {
  if(!isMailEnabled()) redirect('/mail/preview')
  const db=await createClient()
  const {data:{user}}=await db.auth.getUser()
  if(!user)redirect('/login?redirectTo=/mail')
  const {data:profile}=await db.from('profiles').select('role,is_active,full_name').eq('id',user.id).maybeSingle()
  if(!canUseMail(profile))redirect('/apps')
  const {data:aal}=await db.auth.mfa.getAuthenticatorAssuranceLevel()
  if(!aal || (aal.nextLevel==='aal2' && aal.currentLevel!=='aal2'))redirect('/mfa?redirectTo=/mail')
  const firstName = ({
    '028abbe8-ddbd-4010-a278-3d5b34b592be': 'Ali',
    '0c62c36b-982d-4830-ac5d-9e6af92c39ae': 'Tuba',
  } as Record<string,string>)[user.id] || String(profile?.full_name || user.user_metadata?.full_name || '').trim().split(/\s+/)[0]
  return <MailWorkspace demo={false} cacheUser={user.id} firstName={firstName}/>
}
