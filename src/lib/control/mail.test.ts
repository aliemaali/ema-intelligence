import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EMA_MAILBOXES, prioritizeMail, rankMail } from './mail'

test('only the two explicitly requested mailboxes are configured',()=>assert.deepEqual(EMA_MAILBOXES,['info@ema-enterprise.de','unluer@ema-enterprise.de']))
test('invoice hint requires an attachment, not just a matching word',()=>{
  assert.equal(prioritizeMail({id:'1',subject:'Neue Rechnung',hasAttachments:false},EMA_MAILBOXES[0]).invoice,false)
  assert.equal(prioritizeMail({id:'1',subject:'Neue Rechnung',hasAttachments:true},EMA_MAILBOXES[0]).invoice,true)
})
test('important and flagged messages rank above ordinary unread newsletters',()=>{
 const rows=[prioritizeMail({id:'news',subject:'Newsletter',isRead:false},'info'),prioritizeMail({id:'flag',flag:{flagStatus:'flagged'}},'unluer'),prioritizeMail({id:'high',importance:'high'},'info')]
 assert.deepEqual(rankMail(rows).map(row=>row.id),['high','flag','news'])
 assert.equal(rows[0].id,'news')
})
test('mail source and preview bounds survive prioritization',()=>{
 const mail=prioritizeMail({id:'1',bodyPreview:'x'.repeat(1000)},EMA_MAILBOXES[1])
 assert.equal(mail.mailbox,EMA_MAILBOXES[1]);assert.equal(mail.preview.length,300)
})
test('mail links cannot navigate to an arbitrary or executable URL',()=>{
 for(const webLink of ['javascript:alert(1)','https://attacker.example','https://outlook.office.com.attacker.example','http://outlook.office.com']) assert.equal(prioritizeMail({id:'1',webLink},'info').url,null)
 assert.ok(prioritizeMail({id:'1',webLink:'https://outlook.office.com/mail/id/test'},'info').url)
})
test('newest-first tie break is deterministic and tolerates missing dates',()=>{
 const rows=['2026-10-24T00:00:00Z','','2026-10-25T00:00:00Z'].map((receivedDateTime,index)=>prioritizeMail({id:String(index),receivedDateTime},'info'))
 assert.deepEqual(rankMail(rows).map(mail=>mail.id),['2','0','1'])
})
