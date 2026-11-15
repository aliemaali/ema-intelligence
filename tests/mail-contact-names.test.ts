import test from 'node:test';
import assert from 'node:assert/strict';
import { contactNameIndex, mailSenderName, loadNameContacts } from '../src/lib/mail/contact-names';

test('saved contact name wins for every email address regardless of case without modifying the sender',()=>{
  const names=contactNameIndex([{id:'ali',displayName:' Ali Ünlüer ',emailAddresses:[{address:' ali@example.com '},{address:'office@example.com'}]}]);
  const sender={name:'Extern angezeigter Name',address:'ALI@EXAMPLE.COM'};
  assert.equal(mailSenderName(names,sender),'Ali Ünlüer');
  assert.equal(mailSenderName(names,{address:'OFFICE@example.com'}),'Ali Ünlüer');
  assert.deepEqual(sender,{name:'Extern angezeigter Name',address:'ALI@EXAMPLE.COM'});
});
test('unknown senders fall back to the original name or address and distinct plus-addresses stay distinct',()=>{
  const names=contactNameIndex([{displayName:'Ali',emailAddresses:[{address:'ali@example.com'}]}]);
  assert.equal(mailSenderName(names,{address:'ali+other@example.com',name:'Other'}),'Other');
  assert.equal(mailSenderName(names,{address:' unknown@example.com ',name:' '}),'unknown@example.com');
  assert.equal(mailSenderName(names,{address:'unknown@example.com',name:' Original Name '}),'Original Name');
});
test('duplicate contacts are stable, blank names are ignored and contact arrays are not reordered',()=>{
  const contacts=[{id:'b',displayName:'Second',emailAddresses:[{address:'same@example.com'}]},{id:'a',displayName:'First',emailAddresses:[{address:'same@example.com'}]},{id:'0',displayName:' ',emailAddresses:[{address:'same@example.com'}]}];
  assert.equal(contactNameIndex(contacts).get('same@example.com'),'First');
  assert.equal(contactNameIndex([...contacts].reverse()).get('same@example.com'),'First');
  assert.deepEqual(contacts.map(c=>c.id),['b','a','0']);
});
test('renamed or deleted contacts update the display while original message metadata stays unchanged',()=>{
  const sender={address:'person@example.com',name:'Provider Name'};
  assert.equal(mailSenderName(contactNameIndex([{displayName:'Old Name',emailAddresses:[{address:sender.address}]}]),sender),'Old Name');
  assert.equal(mailSenderName(contactNameIndex([{displayName:'New Name',emailAddresses:[{address:sender.address}]}]),sender),'New Name');
  assert.equal(mailSenderName(contactNameIndex([]),sender),'Provider Name');
});
test('contacts beyond the first provider page are included in sender-name lookup',async()=>{
  const calls:string[]=[];
  const contacts=await loadNameContacts(async path=>{
    calls.push(path);
    return path==='contacts' ? {value:[{id:'1',displayName:'First',emailAddresses:[{address:'first@example.com'}]}],'@odata.nextLink':'signed-page'}
      : {value:[{id:'101',displayName:'Last Page Contact',emailAddresses:[{address:'last@example.com'}]}]};
  });
  assert.deepEqual(calls,['contacts','contacts?cursor=signed-page']);
  assert.equal(mailSenderName(contactNameIndex(contacts),{address:'last@example.com'}),'Last Page Contact');
});
test('repeated contact cursors are stopped instead of looping or publishing a partial directory',async()=>{
  let calls=0;
  await assert.rejects(loadNameContacts(async()=>{calls++;return {value:[],'@odata.nextLink':'repeat'};}));
  assert.equal(calls,2);
});
