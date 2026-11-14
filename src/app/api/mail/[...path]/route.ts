import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash, randomUUID } from 'node:crypto'
import { mailAdmin, mailSession, mailboxAccess, audit } from '@/lib/mail/server'
import { draftSchema, folders, mailboxRoot, type Message, type Attachment } from '@/lib/mail/model'
import { MailError, mailGraph, messagePath, safeGraphUrl } from '@/lib/mail/graph'
import { assertOrigin, digest, newApproval, submitApprovedDraft, tokenHash } from '@/lib/mail/security'
import { analyzeMessage } from '@/lib/mail/analysis'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
const idSchema=z.string().min(1).max(1500)
const uuid=z.string().uuid()
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}})
export async function GET(request:NextRequest) {return handle(request)}
export async function POST(request:NextRequest) {return handle(request)}
async function handle(request:NextRequest) {
  try {
    const session=await mailSession()
    const action=request.nextUrl.pathname.replace(/^\/api\/mail\//,'')
    const mutating=request.method==='POST'
    if(mutating) assertOrigin(request)
    if(Number(request.headers.get('content-length')||0)>4_000_000) throw new MailError(413,'Nachricht zu groß.')
    let input:Record<string,unknown>={}
    if(mutating) {const text=await request.text();if(text.length>4_000_000)throw new MailError(413,'Nachricht zu groß.');input=JSON.parse(text)}
    const admin=mailAdmin()
    if(action==='team' || action==='memberships') {
      const {data:profile}=await session.db.from('profiles').select('role').eq('id',session.user.id).maybeSingle()
      if(!profile || !['admin','owner'].includes(profile.role)) throw new MailError(403,'Nur Administratoren verwalten Postfachrechte.')
      if(action==='team' && !mutating) {
        const [people,rights]=await Promise.all([admin.from('profiles').select('id,full_name,email,role,is_active').eq('is_active',true),admin.from('ema_mail_memberships').select('user_id,mailbox,can_read,can_write,can_send')])
        if(people.error || rights.error) throw new MailError(503,'Teamrechte nicht verfügbar.')
        return json({people:people.data,memberships:rights.data})
      }
      if(action==='memberships' && mutating) {
        const values=z.object({userId:z.string().uuid(),mailbox:z.string().email().max(254).transform(v=>v.toLowerCase()),canRead:z.boolean(),canWrite:z.boolean(),canSend:z.boolean()}).strict().parse(input)
        const {data:target}=await admin.from('profiles').select('role,is_active').eq('id',values.userId).maybeSingle()
        if(!target || target.is_active!==true || !['owner','admin','manager','employee','user','staff'].includes(target.role))throw new MailError(400,'Kein aktiver interner Mitarbeiter.')
        if(!values.canRead && (values.canWrite || values.canSend))throw new MailError(400,'Bearbeiten und Senden erfordern Leserechte.')
        await audit(session.user.id,'mailbox_membership_changed',values.userId)
        const {error}=await admin.from('ema_mail_memberships').upsert({user_id:values.userId,mailbox:values.mailbox,can_read:values.canRead,can_write:values.canWrite,can_send:values.canSend},{onConflict:'user_id,mailbox'})
        if(error)throw new MailError(503,'Postfachrechte konnten nicht gespeichert werden.')
        return json({ok:true})
      }
      throw new MailError(405,'Methode nicht erlaubt.')
    }
    if(action==='mailboxes' && !mutating) {
      const {data,error}=await admin.from('ema_mail_memberships').select('mailbox,can_read,can_write,can_send').eq('user_id',session.user.id).eq('can_read',true)
      if(error) throw new MailError(503,'Mail-Datenbankschema noch nicht eingerichtet.')
      return json({mailboxes:[{mailbox:'me',name:'Mein Postfach',can_read:true,can_write:true,can_send:true},...(data||[])]})
    }
    if(action==='drafts' && !mutating) {
      const {data,error}=await admin.from('ema_mail_drafts').select('id,payload,content_hash,status,updated_at').eq('user_id',session.user.id).order('updated_at',{ascending:false}).limit(50)
      if(error) throw new MailError(503,'Entwürfe nicht verfügbar.')
      return json({drafts:data})
    }
    if(action==='drafts' && mutating) {
      const payload=draftSchema.parse(input.payload)
      await mailboxAccess(session,payload.mailbox,'send')
      const values={payload,content_hash:digest(payload),status:'draft',approval_hash:null,approval_expires_at:null,updated_at:new Date().toISOString()}
      const query=input.id ? admin.from('ema_mail_drafts').update(values).eq('id',uuid.parse(input.id)).eq('user_id',session.user.id).in('status',['draft','approved']) : admin.from('ema_mail_drafts').insert({...values,user_id:session.user.id})
      const {data,error}=await query.select('id,content_hash,status').single()
      if(error || !data) throw new MailError(409,'Entwurf konnte nicht gespeichert werden. Möglicherweise wurde er bereits versendet.')
      return json(data,201)
    }
    if((action==='approve' || action==='send') && mutating) {
      const id=uuid.parse(input.id)
      const {data:draft,error}=await admin.from('ema_mail_drafts').select('*').eq('id',id).eq('user_id',session.user.id).single()
      if(error || !draft) throw new MailError(404,'Entwurf nicht gefunden.')
      const payload=draftSchema.parse(draft.payload)
      const {token}=await mailboxAccess(session,payload.mailbox,'send')
      if(draft.content_hash!==digest(payload)) throw new MailError(409,'Entwurf wurde verändert.')
      if(action==='approve') {
        if(input.contentHash!==draft.content_hash || input.confirmed!==true || !['draft','approved'].includes(draft.status)) throw new MailError(409,'Bitte exakt diesen Entwurf prüfen und freigeben.')
        const approval=newApproval()
        await audit(session.user.id,'draft_approval_requested',id)
        const {data,error}=await admin.from('ema_mail_drafts').update({status:'approved',approval_hash:approval.hash,approval_expires_at:approval.expires}).eq('id',id).eq('user_id',session.user.id).eq('content_hash',draft.content_hash).in('status',['draft','approved']).select('id').maybeSingle()
        if(error || !data) throw new MailError(409,'Entwurf wurde zwischenzeitlich verändert.')
        return json({id,approvalToken:approval.token,expiresAt:approval.expires})
      }
      const approvalToken=z.string().regex(/^[A-Za-z0-9_-]{43}$/).parse(input.approvalToken)
      const {data:claimed,error:claimError}=await admin.from('ema_mail_drafts').update({status:'sending',approval_hash:null,approval_expires_at:null,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',session.user.id).eq('content_hash',draft.content_hash).eq('status','approved').eq('approval_hash',tokenHash(approvalToken)).gt('approval_expires_at',new Date().toISOString()).select('id').maybeSingle()
      if(claimError || !claimed) throw new MailError(409,'Freigabe abgelaufen, verändert oder bereits verwendet.')
      // Durable claim itself is the audit trail. Any crash from here leaves sending,
      // never draft/approved: reconcile against Sent Items before another attempt.
      const result=await submitApprovedDraft(payload,id,async message=>{await mailGraph(token,`${mailboxRoot(payload.mailbox)}/sendMail`,{method:'POST',body:JSON.stringify({message,saveToSentItems:true})})},async status=>{
        const {error}=await admin.from('ema_mail_drafts').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',session.user.id).eq('status','sending')
        if(error) throw new MailError(409,'Versandstatus konnte nicht gespeichert werden. Gesendet-Ordner prüfen; nicht erneut senden.')
      })
      return json(result)
    }
    const permission=mutating && action==='message-action'?'write':'read'
    const {mailbox,token}=await mailboxAccess(session,mutating?input.mailbox:request.nextUrl.searchParams.get('mailbox')||'me',permission)
    const root=mailboxRoot(mailbox)
    if(action==='messages' && !mutating) {
      const folder=request.nextUrl.searchParams.get('folder')||'inbox'
      if(!folders.some(f=>f.id===folder)) throw new MailError(400,'Ungültiger Ordner.')
      const base=`${root}/mailFolders/${folder}/messages`
      const cursor=request.nextUrl.searchParams.get('cursor')
      let path:string
      if(cursor) {
        const url=new URL(safeGraphUrl(cursor,root))
        if(url.pathname!==`/v1.0${base}`) throw new MailError(400,'Ungültige Postfachseite.')
        path=url.href
      } else {
        const params=new URLSearchParams({'$top':'30','$select':'id,subject,bodyPreview,receivedDateTime,isRead,from,toRecipients,importance,hasAttachments,flag'})
        const q=(request.nextUrl.searchParams.get('q')||'').trim()
        if(q) {if(q.length>180)throw new MailError(400,'Suchtext zu lang.');params.set('$search',`"${q.replace(/["\\\r\n]/g,' ')}"`)} else params.set('$orderby','receivedDateTime desc')
        path=`${base}?${params}`
      }
      const result=await mailGraph<{value:Message[];'@odata.nextLink'?:string}>(token,path,{},root)
      return json({messages:result.value ?? [],cursor:result['@odata.nextLink'] ?? null})
    }
    if(action==='message' && !mutating) {
      const id=idSchema.parse(request.nextUrl.searchParams.get('id'))
      const message=await mailGraph<Message>(token,`${messagePath(mailbox,id)}?$select=id,subject,body,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,importance,hasAttachments,flag`,{},root)
      return json({message})
    }
    if(action==='attachments' && !mutating) {
      const id=idSchema.parse(request.nextUrl.searchParams.get('id'))
      const result=await mailGraph<{value:Attachment[]}>(token,`${messagePath(mailbox,id)}/attachments?$select=id,name,contentType,size,isInline`,{},root)
      return json({attachments:result.value ?? []})
    }
    if(action==='attachment' && !mutating) {
      const id=idSchema.parse(request.nextUrl.searchParams.get('id')),attachmentId=idSchema.parse(request.nextUrl.searchParams.get('attachmentId'))
      const attachment=await mailGraph<Attachment>(token,`${messagePath(mailbox,id)}/attachments/${encodeURIComponent(attachmentId)}`,{},root)
      if(attachment['@odata.type']!=='#microsoft.graph.fileAttachment' || !attachment.contentBytes || attachment.size>15_000_000) throw new MailError(400,'Anhang nicht unterstützt oder zu groß.')
      return json({attachment})
    }
    if(action==='message-action' && mutating) {
      const id=idSchema.parse(input.id),operation=z.enum(['read','unread','flag','unflag','archive','trash']).parse(input.operation)
      const path=messagePath(mailbox,id)
      if(operation==='archive'||operation==='trash') await mailGraph(token,`${path}/move`,{method:'POST',body:JSON.stringify({destinationId:operation==='archive'?'archive':'deleteditems'})},root)
      else await mailGraph(token,path,{method:'PATCH',body:JSON.stringify(operation==='read'||operation==='unread'?{isRead:operation==='read'}:{flag:{flagStatus:operation==='flag'?'flagged':'notFlagged'}})},root)
      await audit(session.user.id,`message_${operation}`)
      return json({ok:true})
    }
    if(action==='analyze' && mutating) {
      const id=idSchema.parse(input.id)
      const msg=await mailGraph<Message>(token,messagePath(mailbox,id),{},root)
      const key=digest({mailbox,id,body:msg.body,subject:msg.subject})
      const {data:cached}=await admin.from('ema_mail_analysis').select('result').eq('user_id',session.user.id).eq('source_hash',key).maybeSingle()
      if(cached) return json({analysis:cached.result,cached:true})
      const {data:allowed,error:limitError}=await admin.rpc('ema_mail_claim_analysis',{p_user_id:session.user.id,p_limit:20})
      if(limitError)throw new MailError(503,'Analyse-Limit nicht verfügbar.')
      if(allowed!==true)throw new MailError(429,'Maximal 20 neue Analysen pro Stunde. Bitte später versuchen.')
      const analysis=await analyzeMessage(msg)
      const {error}=await admin.from('ema_mail_analysis').upsert({user_id:session.user.id,source_hash:key,result:analysis},{onConflict:'user_id,source_hash'})
      if(error)throw new MailError(503,'Analyse konnte nicht gespeichert werden.')
      return json({analysis})
    }
    if(action==='dms' && mutating) {
      const id=idSchema.parse(input.id),attachmentId=idSchema.parse(input.attachmentId)
      const attachment=await mailGraph<Attachment>(token,`${messagePath(mailbox,id)}/attachments/${encodeURIComponent(attachmentId)}`,{},root)
      if(attachment['@odata.type']!=='#microsoft.graph.fileAttachment' || !attachment.contentBytes || !['application/pdf','image/png','image/jpeg'].includes(attachment.contentType))throw new MailError(400,'Nur PDF-, PNG- und JPEG-Dateianhänge können abgelegt werden.')
      const bytes=Buffer.from(attachment.contentBytes,'base64')
      if(!bytes.length || bytes.length>15_000_000) throw new MailError(413,'Anhang zu groß oder leer.')
      const hash=createHash('sha256').update(bytes).digest('hex')
      const {data:duplicate}=await session.db.from('documents').select('id').eq('user_id',session.user.id).eq('sha256',hash).eq('is_archived',false).maybeSingle()
      if(duplicate)return json({documentId:duplicate.id,duplicate:true})
      const name=attachment.name.replace(/[\/\\\x00-\x1f]/g,'_').slice(0,180)||'Anhang.pdf'
      const path=`${session.user.id}/mail/${randomUUID()}/${name}`
      const {error:uploadError}=await session.db.storage.from('ema-dms').upload(path,bytes,{contentType:attachment.contentType,upsert:false})
      if(uploadError)throw new MailError(502,'Anhang konnte nicht gespeichert werden.')
      const {data,error}=await session.db.from('documents').insert({user_id:session.user.id,display_name:name,file_name:name,file_path:path,file_size_bytes:bytes.length,mime_type:attachment.contentType,document_type:'sonstiges',storage_bucket:'ema-dms',source_app:'ema_intelligence',source_kind:'project',sha256:hash,analysis_status:'not_started'}).select('id').single()
      if(error) {await session.db.storage.from('ema-dms').remove([path]);throw new MailError(409,'DMS-Registrierung fehlgeschlagen; bitte Dubletten prüfen.')}
      return json({documentId:data.id})
    }
    if(action==='reminders' && !mutating) {
      const {data,error}=await session.db.from('ema_reminders').select('id,title,notes,due_at,completed_at').eq('user_id',session.user.id).is('completed_at',null).order('due_at').limit(50)
      if(error)throw new MailError(502,'Aufgaben konnten nicht geladen werden.')
      return json({reminders:data})
    }
    if(action==='reminders' && mutating) {
      const title=z.string().trim().min(1).max(200).parse(input.title),dueAt=z.string().datetime({offset:true}).parse(input.dueAt)
      const {data,error}=await session.db.from('ema_reminders').insert({user_id:session.user.id,title,due_at:dueAt,notes:'Aus EMA Mail erstellt.'}).select('id').single()
      if(error)throw new MailError(502,'Erinnerung konnte nicht angelegt werden.')
      return json({reminder:data},201)
    }
    if(action==='contacts' && !mutating) {
      const result=await mailGraph(token,'/me/contacts?$top=100&$select=id,displayName,emailAddresses,businessPhones,companyName')
      return json(result)
    }
    if(action==='calendar' && !mutating) {
      const start=new Date(),end=new Date(start.getTime()+30*86400000)
      const params=new URLSearchParams({startDateTime:start.toISOString(),endDateTime:end.toISOString(),'$top':'100','$orderby':'start/dateTime','$select':'id,subject,start,end,location'})
      return json(await mailGraph(token,`/me/calendarView?${params}`))
    }
    throw new MailError(404,'Unbekannte Mail-Funktion.')
  } catch(error) {
    if(error instanceof MailError)return json({error:error.message},error.status)
    if(error instanceof z.ZodError || error instanceof SyntaxError)return json({error:'Ungültige Eingabe. Bitte Felder prüfen.'},400)
    return json({error:'Mail-Anfrage fehlgeschlagen. Bitte Verbindung und Konfiguration prüfen.'},502)
  }
}
