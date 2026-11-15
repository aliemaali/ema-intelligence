import test from 'node:test';
import assert from 'node:assert/strict';
import { MailFolderSync, mergeMailChanges } from '../src/lib/mail/folder-sync';
import { sealDeltaCursor, openDeltaCursor } from '../src/lib/mail/delta-cursor';
import type { Message } from '../src/lib/mail/model';

const message = (id: string, isRead = false): Message => ({ id, subject: id, bodyPreview: 'Preview', receivedDateTime: `2026-11-${id === 'new' ? '15' : '14'}T10:00:00Z`, isRead, hasAttachments: false, from: { emailAddress: { address: 'sender@example.com' } } });
function storage() { const data = new Map<string,string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key,value); }, removeItem: (key: string) => { data.delete(key); } }; }

test('restart restores old mail and then uses only delta, retaining read changes and deletions', async () => {
  const disk = storage();
  const first = new MailFolderSync(); first.cache.bindStorage(disk,'user:inbox');
  let calls: string[] = [];
  await first.page(async path => {
    calls.push(path);
    return path.startsWith('messages?') ? { messages: [message('old'), message('gone')], cursor: 'older-page' }
      : { changes: [message('old'),message('gone')], next: null, delta: 'signed-checkpoint' };
  },'me','inbox');
  assert.equal(calls.length,2);
  const second = new MailFolderSync(); second.cache.bindStorage(disk,'user:inbox');
  assert.equal(second.cache.get(JSON.stringify(['me','inbox']))?.messages.length,2);
  const result = await second.page(async path => {
    assert.ok(path.startsWith('message-delta?')); assert.ok(path.includes('signed-checkpoint'));
    return { changes: [{ id: 'old', isRead: true }, { id: 'gone', '@removed': {} }, message('new')], next: null, delta: 'next-checkpoint' };
  },'me','inbox','',undefined,true);
  assert.deepEqual(result.messages.map(m=>[m.id,m.isRead]),[['new',false],['old',true]]);
  assert.equal(result.messages[1].subject,'old'); assert.equal(result.cursor,'older-page');
});
test('deduplicates concurrent Start/Postfach requests and preserves loaded older pages', async () => {
  const sync = new MailFolderSync(); let calls = 0;
  const get = async (path: string) => { calls++; await Promise.resolve(); return path.startsWith('messages?') ? { messages: [message('old')], cursor: 'older' } : { changes: [message('old')], next: null, delta: 'checkpoint' }; };
  await Promise.all([sync.page(get,'me','inbox'),sync.page(get,'me','inbox')]);
  assert.equal(calls,2);
  await sync.page(async()=>({messages:[message('older')],cursor:null}),'me','inbox','','older');
  const result = await sync.page(async()=>({changes:[message('new')],next:null,delta:'checkpoint2'}),'me','inbox','',undefined,true);
  assert.deepEqual(result.messages.map(m=>m.id),['new','old','older']); assert.equal(result.cursor,null);
});
test('expired delta is reset without erasing visible messages; a fresh baseline reconciles removed mail', async()=>{
  const sync = new MailFolderSync();
  await sync.page(async path=>path.startsWith('messages?') ? {messages:[message('old'),message('gone')],cursor:null} : {changes:[message('old'),message('gone')],next:null,delta:'expired'},'me','inbox');
  const fallback=await sync.page(async()=>{throw Object.assign(new Error('expired'),{status:410});},'me','inbox','',undefined,true);
  assert.ok(fallback.syncWarning); assert.equal(fallback.messages.length,2);
  assert.equal(sync.cache.get(JSON.stringify(['me','inbox']))?.messages.length,2);
  const result=await sync.page(async path=>path.startsWith('messages?') ? {messages:[message('old')],cursor:null} : {changes:[message('old')],next:null,delta:'valid'},'me','inbox','',undefined,true);
  assert.deepEqual(result.messages.map(m=>m.id),['old']);
});
test('logout prevents in-flight synchronization from repopulating persistent storage', async()=>{
  const disk=storage(); const sync=new MailFolderSync(); sync.cache.bindStorage(disk,'account');
  let finish!: (value: any)=>void;
  const pending=sync.page(path=>path.startsWith('messages?') ? new Promise(resolve=>{finish=resolve;}) : Promise.resolve({changes:[message('old')],next:null,delta:'checkpoint'}),'me','inbox');
  sync.clear(); finish({messages:[message('old')],cursor:null}); await pending;
  assert.equal(sync.cache.keys().length,0); assert.equal(disk.getItem('account'),null);
});
test('mutations update cached read flags and invalidate freshness without losing the delta checkpoint',async()=>{
  const sync=new MailFolderSync();
  await sync.page(async path=>path.startsWith('messages?') ? {messages:[message('old')],cursor:null} : {changes:[message('old')],next:null,delta:'checkpoint'},'me','inbox');
  sync.mutate('me','old','read');
  const snapshot=sync.cache.get(JSON.stringify(['me','inbox']))!;
  assert.equal(snapshot.messages[0].isRead,true); assert.equal(snapshot.sync,'checkpoint'); assert.equal(snapshot.checkedAt,0);
});
test('sparse updates do not create broken new messages; tombstones and duplicates are merged by ID',()=>{
  const result=mergeMailChanges([message('old')],[{id:'unknown',isRead:true},{id:'old',isRead:true},{id:'old',importance:'high'}]);
  assert.equal(result.length,1); assert.equal(result[0].isRead,true); assert.equal(result[0].importance,'high');
});
test('signed delta cursors reject another user, folder, mailbox or altered token',()=>{
  const cursor=sealDeltaCursor('https://graph.microsoft.com/v1.0/me/mailFolders/opaque/messages/delta?$deltatoken=x','ali:me:inbox','test-secret');
  assert.ok(openDeltaCursor(cursor,'ali:me:inbox','test-secret').includes('deltatoken=x'));
  for(const scope of ['tuba:me:inbox','ali:me:sentitems','ali:info:inbox']) assert.throws(()=>openDeltaCursor(cursor,scope,'test-secret'));
  assert.throws(()=>openDeltaCursor(cursor+'bad','ali:me:inbox','test-secret'));
});
test('large change rounds retain a continuation checkpoint and stay marked as pending until complete',async()=>{
  const sync=new MailFolderSync();
  await sync.page(async path=>path.startsWith('messages?') ? {messages:[message('old')],cursor:null} : {changes:[message('old')],next:null,delta:'checkpoint'},'me','inbox');
  let calls=0;
  const first=await sync.page(async()=>({changes:[],next:`page-${++calls}`,delta:null}),'me','inbox','',undefined,true);
  assert.equal(calls,3); assert.equal(first.pending,true);
  const last=await sync.page(async path=>{assert.ok(path.includes('page-3'));return {changes:[message('new')],next:null,delta:'complete'};},'me','inbox','',undefined,true);
  assert.equal(last.pending,false); assert.equal(last.messages[0].id,'new');
});
test('first successful folder page remains visible and persists when the delta bootstrap fails',async()=>{
  const disk=storage(); const sync=new MailFolderSync(); sync.cache.bindStorage(disk,'user');
  const result=await sync.page(async path=>{
    if(path.startsWith('messages?'))return {messages:[message('old')],cursor:'older-page'};
    throw Object.assign(new Error('Die Seite gehört nicht zu diesem Postfach.'),{status:400});
  },'me','inbox');
  assert.equal(result.messages[0].id,'old'); assert.ok(result.syncWarning);
  const reopened=new MailFolderSync(); reopened.cache.bindStorage(disk,'user');
  const cached=await reopened.page(async()=>{throw new Error('must reuse cached folder');},'me','inbox');
  assert.equal(cached.messages[0].id,'old'); assert.ok(cached.syncWarning);
});
test('delta access revocation still clears every stored folder and rejects instead of displaying fallback',async()=>{
  const sync=new MailFolderSync();
  await assert.rejects(sync.page(async path=>{
    if(path.startsWith('messages?'))return {messages:[message('old')],cursor:null};
    throw Object.assign(new Error('forbidden'),{status:403});
  },'me','inbox'));
  assert.equal(sync.cache.keys().length,0);
});
