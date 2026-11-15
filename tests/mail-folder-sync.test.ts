import test from 'node:test';
import assert from 'node:assert/strict';
import { MailFolderSync, mergeMailChanges, reconcileMailHead } from '../src/lib/mail/folder-sync';
import { sealDeltaCursor, openDeltaCursor } from '../src/lib/mail/delta-cursor';
import type { Message } from '../src/lib/mail/model';
import { combinedInboxPage } from '../src/lib/mail/combined-inbox';

const message = (id: string, isRead = false): Message => ({ id, subject: id, bodyPreview: 'Preview', receivedDateTime: `2026-11-${id === 'new' ? '15' : '14'}T10:00:00Z`, isRead, hasAttachments: false, from: { emailAddress: { address: 'sender@example.com' } } });
function storage() { const data = new Map<string,string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key,value); }, removeItem: (key: string) => { data.delete(key); } }; }

test('restart restores mail immediately, verifies the small head and merges changes without reloading history', async () => {
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
    if(path.startsWith('messages?')) return { messages:[message('new'),message('old',true)],cursor:'first-page' };
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
  const result = await sync.page(async path=>path.startsWith('messages?') ? {messages:[message('new'),message('old')],cursor:'head-page'} : {changes:[message('new')],next:null,delta:'checkpoint2'},'me','inbox','',undefined,true);
  assert.deepEqual(result.messages.map(m=>m.id),['new','old','older']); assert.equal(result.cursor,null);
});
test('expired delta is reset without erasing visible messages; a fresh baseline reconciles removed mail', async()=>{
  const sync = new MailFolderSync();
  await sync.page(async path=>path.startsWith('messages?') ? {messages:[message('old'),message('gone')],cursor:null} : {changes:[message('old'),message('gone')],next:null,delta:'expired'},'me','inbox');
  const fallback=await sync.page(async path=>{if(path.startsWith('messages?'))return {messages:[message('old'),message('gone')],cursor:null};throw Object.assign(new Error('expired'),{status:410});},'me','inbox','',undefined,true);
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
  const first=await sync.page(async path=>path.startsWith('messages?') ? {messages:[message('old')],cursor:null} : {changes:[],next:`page-${++calls}`,delta:null},'me','inbox','',undefined,true);
  assert.equal(calls,3); assert.equal(first.pending,true);
  const last=await sync.page(async path=>{if(path.startsWith('messages?'))return {messages:[message('new'),message('old')],cursor:null};assert.ok(path.includes('page-3'));return {changes:[message('new')],next:null,delta:'complete'};},'me','inbox','',undefined,true);
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
test('finishing an old delta baseline cannot erase the newest verified messages or make the inbox falsely empty',async()=>{
  const sync=new MailFolderSync(); let rounds=0;
  const get=async(path:string)=>path.startsWith('messages?')
    ? {messages:[message('new'),message('old')],cursor:'older-page'}
    : ++rounds<=3 ? {changes:[],next:`scan-${rounds}`,delta:null} : {changes:[],next:null,delta:'complete'};
  await sync.page(get,'me','inbox');
  const completed=await sync.page(get,'me','inbox','',undefined,true);
  assert.equal(completed.pending,false); assert.deepEqual(completed.messages.map(m=>m.id),['new','old']);
});
test('Start and Postfach share the same current sorted inbox across all accounts without another request',async()=>{
  const sync=new MailFolderSync();
  const ali=message('new'), info={...message('info'),receivedDateTime:'2026-11-14T12:00:00Z'};
  const pages={me:[ali], 'info@example.com':[info]} as Record<string,Message[]>;
  for(const box of Object.keys(pages)) await sync.page(async path=>path.startsWith('messages?') ? {messages:pages[box],cursor:null} : {changes:[],next:null,delta:'checkpoint'},box,'inbox');
  const home=sync.cachedInbox(['me','info@example.com'])!;
  assert.deepEqual(home.messages.map(m=>m.id),['new','info']);
  const inbox=await sync.page(async()=>{throw new Error('fresh shared mail must not be downloaded again');},'me','inbox');
  assert.equal(home.messages[0].id,inbox.messages[0].id);
});
test('old unsigned pagination failure obtains a new scoped page without erasing saved mail',async()=>{
  const sync=new MailFolderSync();
  await sync.page(async path=>path.startsWith('messages?') ? {messages:[message('old')],cursor:'legacy-page'} : {changes:[message('old')],next:null,delta:'checkpoint'},'me','inbox');
  const repaired=await sync.page(async path=>{
    if(path.includes('cursor=legacy-page'))throw Object.assign(new Error('wrong mailbox alias'),{status:400});
    return path.startsWith('messages?') ? {messages:[message('new'),message('old')],cursor:'signed-page'} : {changes:[],next:null,delta:'new-checkpoint'};
  },'me','inbox','','legacy-page');
  assert.deepEqual(repaired.messages.map(m=>m.id),['new','old']);
});
test('head reconciliation removes stale newer ghosts while retaining already loaded historical mail',()=>{
  const ghost={...message('ghost'),receivedDateTime:'2026-11-16T10:00:00Z'};
  const historical={...message('historical'),receivedDateTime:'2026-08-01T10:00:00Z'};
  assert.deepEqual(reconcileMailHead([ghost,historical],[message('new'),message('old')]).map(m=>m.id),['new','old','historical']);
  assert.deepEqual(reconcileMailHead([message('old')],[]),[]);
});
test('three-mailbox flow keeps the same latest mail after pagination, refresh, Start navigation and restart',async()=>{
  const boxes=['me','info@example.com','tuba@example.com'];
  const provider=new Map(boxes.map((box, boxIndex)=>[box,Array.from({length:60},(_,i)=>({...message(`${box}-${i}`),receivedDateTime:new Date(Date.UTC(2026,10,15,9)-(i*3+boxIndex)*3600000).toISOString()}))]));
  const disk=storage(); const sync=new MailFolderSync(); sync.cache.bindStorage(disk,'verified-user-and-rights');
  const get=async(path:string)=>{
    const [action,search]=path.split('?'); const params=new URLSearchParams(search); const box=params.get('mailbox')!;
    if(action==='message-delta')return {changes:[],next:null,delta:'checkpoint'};
    const offset=Number((params.get('cursor')||'page-0').replace('page-',''));
    const rows=provider.get(box)!;
    return {messages:rows.slice(offset,offset+30),cursor:offset+30<rows.length?`page-${offset+30}`:null};
  };
  const sources=()=>boxes.map(mailbox=>({mailbox,items:[] as Message[],cursor:null,started:false}));
  const fetch=(box:string,cursor?:string)=>sync.page(get,box,'inbox','',cursor);
  const first=await combinedInboxPage(sources(),fetch);
  const more=await combinedInboxPage(first.sources,fetch,90);
  assert.equal(first.messages.length+more.messages.length,120);
  const latest={...message('arrived-after-pagination'),receivedDateTime:'2026-11-16T10:00:00Z'};
  provider.get('me')!.unshift(latest);
  for(const box of boxes)await sync.page(get,box,'inbox','',undefined,true);
  const refreshed=await combinedInboxPage(sources(),fetch,120);
  const start=sync.cachedInbox(boxes)!;
  assert.equal(refreshed.messages.length,120);
  assert.equal(start.messages[0].id,latest.id);
  assert.deepEqual(start.messages.slice(0,5).map(m=>m.id),refreshed.messages.slice(0,5).map(m=>m.id));
  assert.ok(sync.cache.get(JSON.stringify(['me','inbox']))!.messages.some(m=>m.id==='me-40'),'loaded history survives refresh');
  const reopened=new MailFolderSync(); reopened.cache.bindStorage(disk,'verified-user-and-rights');
  assert.equal(reopened.cachedInbox(boxes)!.messages[0].id,latest.id);
});
