import test from 'node:test';
import assert from 'node:assert/strict';
import { MailSessionCache, mailAccountScope } from '../src/lib/mail/session-cache';
test('returning to a recent folder reuses mail without extending freshness forever', () => {
  let now=1000;
  const cache = new MailSessionCache<{ids:string[]}>(3,()=>now);
  cache.set('inbox',{ids:['new','older']});
  now+=30000;
  assert.deepEqual(cache.get('inbox',55000),{ids:['new','older']});
  now+=30000;
  assert.equal(cache.get('inbox',55000),undefined);
  assert.deepEqual(cache.get('inbox'),{ids:['new','older']},'stale mail remains available while revalidating');
});
test('mailbox, folder and query snapshots do not replace each other and remain bounded', () => {
  const cache = new MailSessionCache<string>(2);
  cache.set('ali:inbox','ali'); cache.set('tuba:inbox','tuba');
  cache.get('ali:inbox'); cache.set('ali:sentitems','sent');
  assert.equal(cache.get('tuba:inbox'),undefined);
  assert.equal(cache.get('ali:inbox'),'ali');
  assert.equal(cache.get('ali:sentitems'),'sent');
});
test('mutations and loss of authorization invalidate cached mail; a new session starts empty', () => {
  const cache = new MailSessionCache<string>(); cache.set('inbox','mail');
  cache.clear(); assert.equal(cache.get('inbox'),undefined);
  cache.set('inbox','mail'); assert.equal(new MailSessionCache<string>().get('inbox'),undefined);
});
test('cached scope changes when account identity or access rights change, not when order changes', () => {
  const a={mailbox:'me',address:'ali@example.com',can_read:true,can_write:true};
  const b={mailbox:'info@example.com',can_read:true,can_write:false};
  assert.equal(mailAccountScope([a,b]),mailAccountScope([b,a]));
  assert.notEqual(mailAccountScope([a,b]),mailAccountScope([a]));
  assert.notEqual(mailAccountScope([a,b]),mailAccountScope([a,{...b,can_read:false}]));
  assert.notEqual(mailAccountScope([a]),mailAccountScope([{...a,address:'tuba@example.com'}]));
});
test('persistent snapshots survive restart without renewing freshness and disappear on clear',()=>{
  const data = new Map<string,string>(); const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};
  let now=1000; const a=new MailSessionCache<string>(2,()=>now); a.bindStorage(storage,'ali'); a.set('inbox','mail');
  now+=60000; const b=new MailSessionCache<string>(2,()=>now); b.bindStorage(storage,'ali');
  assert.equal(b.get('inbox'),'mail'); assert.equal(b.get('inbox',55000),undefined);
  const other=new MailSessionCache<string>(); other.bindStorage(storage,'tuba'); assert.equal(other.get('inbox'),undefined);
  b.clear(); const c=new MailSessionCache<string>(); c.bindStorage(storage,'ali'); assert.equal(c.get('inbox'),undefined);
});
test('corrupt or disabled storage never blocks in-memory mail',()=>{
  const cache=new MailSessionCache<string>(); cache.bindStorage({getItem:()=>'{bad',setItem:()=>{throw new Error('quota');},removeItem:()=>{}},'key');
  cache.set('inbox','mail'); assert.equal(cache.get('inbox'),'mail');
});

