import test from 'node:test'
import assert from 'node:assert/strict'
import { draftSchema, mailboxRoot, canUseMail, isMailEnabled, invoiceHint } from '../src/lib/mail/model'
import { safeGraphUrl, mailGraph } from '../src/lib/mail/graph'
import { assertOrigin,digest,newApproval,tokenHash,graphMessage,submitApprovedDraft } from '../src/lib/mail/security'
const draft=()=>draftSchema.parse({to:['customer@example.com'],subject:'Prüfung',body:'Bitte prüfen.'})
test('mail opt-in fails closed; Vercel preview stays disabled even with live flag',()=>{
  for(const env of [{},{EMA_MAIL_ENABLED:'false'},{EMA_MAIL_ENABLED:'true',VERCEL_ENV:'preview'}]) assert.equal(isMailEnabled(env),false)
  assert.equal(isMailEnabled({EMA_MAIL_ENABLED:'true',VERCEL_ENV:'production'}),true)
})
test('only active internal roles may enter; partner, missing, disabled denied',()=>{
  for(const p of [null,{role:'partner',is_active:true},{role:'admin',is_active:false},{role:'admin'},{role:'unknown',is_active:true}])assert.equal(canUseMail(p),false)
  assert.equal(canUseMail({role:'employee',is_active:true}),true)
})
test('mailbox path cannot inject path or URL',()=>{
  assert.equal(mailboxRoot('me'),'/me')
  assert.equal(mailboxRoot('team@example.com'),'/users/team%40example.com')
  for(const s of ['../me','https://evil.example','me/messages','foo'])assert.throws(()=>mailboxRoot(s))
})
test('rejects foreign host, userinfo, protocol, prefix tricks, other mailbox pagination',()=>{
  for(const path of ['https://evil.example/v1.0/me/messages','https://graph.microsoft.com.evil.example/v1.0/me/messages','http://graph.microsoft.com/v1.0/me/messages','https://x@graph.microsoft.com/v1.0/me/messages','https://graph.microsoft.com/beta/me/messages','https://graph.microsoft.com/v1.0/users/other/messages','https://graph.microsoft.com/v1.0/me2/messages'])assert.throws(()=>safeGraphUrl(path,'/me'))
  assert.equal(safeGraphUrl('/me/messages?$skiptoken=abc','/me'),'https://graph.microsoft.com/v1.0/me/messages?$skiptoken=abc')
})
test('same-origin JSON required; cross-site and missing origin denied',()=>{
  for(const headers of [{},{origin:'https://evil.example','content-type':'application/json'},{origin:'https://ema.example','content-type':'text/plain'},{origin:'https://ema.example','content-type':'application/json','sec-fetch-site':'cross-site'}])assert.throws(()=>assertOrigin(new Request('https://ema.example/api/mail/send',{headers:headers as Record<string,string>})))
  assert.doesNotThrow(()=>assertOrigin(new Request('https://ema.example/api/mail/send',{headers:{origin:'https://ema.example','content-type':'application/json'}})))
})
test('draft validation rejects header injection, invalid recipients, extra sender, large attachment',()=>{
  for(const patch of [{to:['x']},{subject:'x\r\nBcc:evil@example.com'},{sender:'admin@example.com'},{body:''},{attachments:[{name:'../evil',contentType:'application/pdf',contentBytes:'YQ=='}]},{attachments:[{name:'a',contentType:'text/plain',contentBytes:'a'.repeat(2_800_004)}]}]) assert.equal(draftSchema.safeParse({...draft(),...patch}).success,false)
})
test('approval hash covers sender mailbox, all recipient types, text and attachment bytes',()=>{
  const d=draft(),hash=digest(d)
  for(const patch of [{mailbox:'team@example.com'},{to:['other@example.com']},{cc:['copy@example.com']},{bcc:['hidden@example.com']},{subject:'changed'},{body:'changed'},{attachments:[{name:'a.pdf',contentType:'application/pdf',contentBytes:'YQ=='}]}])assert.notEqual(digest({...d,...patch}),hash)
})
test('approval tokens are unpredictable; only hash persisted; short TTL',()=>{
  const a=newApproval(),b=newApproval()
  assert.notEqual(a.token,b.token);assert.equal(a.hash,tokenHash(a.token));assert.notEqual(a.hash,a.token)
  assert.ok(Date.parse(a.expires)>Date.now()+290000 && Date.parse(a.expires)<=Date.now()+300000)
})
test('outgoing message is plain text, keeps BCC and attachments, includes reconciliation ID',()=>{
  const m=graphMessage({...draft(),bcc:['hidden@example.com']},'draft-id')
  assert.equal(m.body.contentType,'Text');assert.equal(m.bccRecipients[0].emailAddress.address,'hidden@example.com');assert.equal(m.internetMessageHeaders[0].value,'draft-id')
})
test('successful submission reports accepted, not delivered',async()=>{
  const states:string[]=[];let calls=0
  const result=await submitApprovedDraft(draft(),'id',async()=>{calls++},async status=>{states.push(status)})
  assert.equal(calls,1);assert.deepEqual(states,['submitted']);assert.equal(result.status,'submitted');assert.match(result.message,/nicht bestätigt/)
})
test('ambiguous failure is marked uncertain without retry',async()=>{
  const states:string[]=[];let calls=0
  await assert.rejects(()=>submitApprovedDraft(draft(),'id',async()=>{calls++;throw new Error('timeout after acceptance')},async status=>{states.push(status)}),/Versandstatus unklar/)
  assert.equal(calls,1);assert.deepEqual(states,['uncertain'])
})
test('Graph client sends no token off-host, disallows redirects, handles empty 202',async()=>{
  const original=globalThis.fetch;let calls=0
  globalThis.fetch=async(url,init)=>{calls++;assert.equal(new URL(String(url)).hostname,'graph.microsoft.com');assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');assert.match((init?.headers as Record<string,string>).Prefer,/content-type="text"/);return new Response(null,{status:202})}
  try{await assert.rejects(()=>mailGraph('secret','https://evil.example/path'));assert.equal(calls,0);assert.equal(await mailGraph('secret','/me/sendMail',{method:'POST'}),undefined);assert.equal(calls,1)}finally{globalThis.fetch=original}
})
test('invoice candidate is a hint and requires attachments',()=>{assert.equal(invoiceHint({subject:'Rechnung',bodyPreview:'',hasAttachments:false}),false);assert.equal(invoiceHint({subject:'Invoice',bodyPreview:'',hasAttachments:true}),true)})
