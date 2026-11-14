import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getMicrosoftAccessToken } from '@/lib/microsoft/session'
import { canUseMail, isMailEnabled, mailboxSchema } from './model'
import { MailError } from './graph'
export function mailAdmin() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url || !key) throw new MailError(503,'Mail-Konfiguration fehlt.')
  return createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
}
export async function mailSession() {
  if(!isMailEnabled()) throw new MailError(503,'EMA Mail ist noch nicht freigeschaltet. Die Vorschau verwendet Demo-Daten.')
  const db=await createClient()
  const {data:{user},error}=await db.auth.getUser()
  if(error || !user) throw new MailError(401,'Bitte anmelden.')
  const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle()
  if(profileError || !canUseMail(profile)) throw new MailError(403,'Kein aktiver Mitarbeiterzugang.')
  const {data:aal,error:aalError}=await db.auth.mfa.getAuthenticatorAssuranceLevel()
  if(aalError || !aal || (aal.nextLevel==='aal2' && aal.currentLevel!=='aal2')) throw new MailError(403,'Bitte die Zwei-Faktor-Anmeldung abschließen.')
  return {db,user}
}
export type MailSession = Awaited<ReturnType<typeof mailSession>>
export async function mailboxAccess(session:MailSession,mailboxInput:unknown,permission:'read'|'write'|'send'='read') {
  const mailbox=mailboxSchema.parse(mailboxInput ?? 'me')
  if(mailbox!=='me') {
    const {data,error}=await mailAdmin().from('ema_mail_memberships').select('can_read,can_write,can_send').eq('user_id',session.user.id).eq('mailbox',mailbox).maybeSingle()
    if(error || !data || !data.can_read || !data[`can_${permission}`]) throw new MailError(403,'Keine Berechtigung für dieses Postfach.')
  }
  const token=await getMicrosoftAccessToken(session.user.id)
  if(!token) throw new MailError(409,'Bitte Microsoft 365 zuerst verbinden.')
  return {mailbox,token}
}
export async function audit(userId:string,action:string,resourceId?:string) {
  const {error}=await mailAdmin().from('ema_mail_audit').insert({user_id:userId,action,resource_id:resourceId ?? null})
  if(error) throw new MailError(503,'Sicherheitsprotokoll nicht verfügbar.')
}
