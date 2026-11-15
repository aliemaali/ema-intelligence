import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARED_CONTACT_READER, SHARED_CONTACT_OWNER, canReadAliContacts, assertPersonalContactId, sharedContactsPage } from '../src/lib/mail/shared-contacts';
import { sealDeltaCursor } from '../src/lib/mail/delta-cursor';
const secret = 'test-only-contact-cursor-secret';
test('only the explicitly granted reader may access Ali contacts', async () => {
  assert.equal(canReadAliContacts(SHARED_CONTACT_READER), true);
  assert.equal(canReadAliContacts(SHARED_CONTACT_OWNER), false);
  let called = false;
  await assert.rejects(sharedContactsPage({userId:'another-user', secret, getPage:async()=>{called=true;return {value:[]};}}));
  assert.equal(called, false);
});
test('shared pages retain all addresses, are read-only, then continue to personal contacts', async () => {
  const calls: string[] = [];
  const getPage = async (source: 'shared'|'personal', path: string) => {
    calls.push(source);
    if(source === 'personal') return {value:[{id:'same',displayName:'Personal'}]};
    if(path.includes('skiptoken')) return {value:[{id:'second',displayName:'Second'}]};
    return {value:[{id:'same',displayName:'Shared',emailAddresses:[{address:'a@example.com'},{address:'b@example.com'}]}],
      '@odata.nextLink':'https://graph.microsoft.com/v1.0/users/owner-id/contacts?$skiptoken=next'};
  };
  const first = await sharedContactsPage({userId:SHARED_CONTACT_READER, secret,getPage});
  assert.equal(first.value[0].readOnly,true);
  assert.equal(first.value[0].sharedBy,'Ali');
  assert.equal((first.value[0].emailAddresses as unknown[]).length,2);
  assert.throws(()=>assertPersonalContactId(first.value[0].id));
  const second = await sharedContactsPage({userId:SHARED_CONTACT_READER, secret,getPage,cursor:first['@odata.nextLink']});
  const third = await sharedContactsPage({userId:SHARED_CONTACT_READER, secret,getPage,cursor:second['@odata.nextLink']});
  assert.deepEqual(calls,['shared','shared','personal']);
  assert.equal(third.value[0].id,'same');
  assert.notEqual(first.value[0].id,third.value[0].id);
  assert.doesNotThrow(()=>assertPersonalContactId(third.value[0].id));
  assert.equal(third['@odata.nextLink'],undefined);
});
test('tampered, foreign, raw and non-contact cursors never invoke Graph', async () => {
  const scope=JSON.stringify([SHARED_CONTACT_READER, SHARED_CONTACT_OWNER, 'shared-contacts-v1']);
  const bad=[
    'https://graph.microsoft.com/v1.0/me/contacts',
    sealDeltaCursor(JSON.stringify({source:'shared',path:'/me/messages'}),scope,secret),
    sealDeltaCursor(JSON.stringify({source:'shared',path:'/me/contacts'}),'other-reader',secret),
    sealDeltaCursor(JSON.stringify({source:'arbitrary-owner',path:'/me/contacts'}),scope,secret),
    sealDeltaCursor(JSON.stringify({source:'shared',path:'https://evil.example/contacts'}),scope,secret),
  ];
  let called=false;
  for(const cursor of bad) await assert.rejects(sharedContactsPage({userId:SHARED_CONTACT_READER,secret,cursor,getPage:async()=>{called=true;return {value:[]};}}));
  assert.equal(called,false);
});
test('upstream continuation may only stay in the contacts collection', async () => {
  await assert.rejects(sharedContactsPage({userId:SHARED_CONTACT_READER,secret,getPage:async()=>({value:[], '@odata.nextLink':'https://graph.microsoft.com/v1.0/me/messages'})}));
});
