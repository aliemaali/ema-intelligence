import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mailFingerprint, parseMailDismissal } from '@/lib/control/mail-dismissals'
const headers = { 'Cache-Control': 'private, no-store' }
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({error:'Ungültige Anfrage.'},{status:403,headers})
  const supabase = await createClient(), { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({error:'Bitte erneut anmelden.'},{status:401,headers})
  let body: ReturnType<typeof parseMailDismissal>
  try { const raw=await request.text(); if(raw.length>250000)throw Error(); body=parseMailDismissal(JSON.parse(raw)) }
  catch { return NextResponse.json({error:'Bitte eine gültige Nachrichtenauswahl übergeben.'},{status:400,headers}) }
  const rows=body.messages.map(mail=>({user_id:user.id,mailbox:mail.mailbox,message_key:mailFingerprint(mail)}))
  const result = body.action === 'hide'
    ? await supabase.from('control_mail_dismissals').upsert(rows,{onConflict:'user_id,mailbox,message_key',ignoreDuplicates:true})
    : await supabase.from('control_mail_dismissals').delete().eq('user_id',user.id).in('message_key',rows.map(row=>row.message_key))
  if(result.error) { console.error('Mail overview preference failed',{code:result.error.code}); return NextResponse.json({error:'Die Auswahl konnte nicht gespeichert werden. Bitte erneut versuchen.'},{status:503,headers}) }
  return NextResponse.json({ok:true},{headers})
}
