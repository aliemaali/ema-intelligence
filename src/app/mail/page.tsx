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
  const {data:profile}=await db.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle()
  if(!canUseMail(profile))redirect('/apps')
  const {data:aal}=await db.auth.mfa.getAuthenticatorAssuranceLevel()
  if(!aal || (aal.nextLevel==='aal2' && aal.currentLevel!=='aal2'))redirect('/mfa?redirectTo=/mail')
  return <MailWorkspace demo={false}/>
}
