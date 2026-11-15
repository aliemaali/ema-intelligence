import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestRecipientContacts, recipientSegment, applyRecipientContact } from '../src/lib/mail/recipient-contacts';
const contacts=new Map([['ali@example.com','Ali Ünlüer'],['office@example.com','Ali Ünlüer'],['tuba@example.com','Tuba Ünlüer'],['koray@example.com','Koray Gruppe']]);
test('typing a name, surname, email prefix or accent-insensitive text finds saved contacts',()=>{
  assert.equal(suggestRecipientContacts(contacts,'Koray')[0].address,'koray@example.com');
  assert.deepEqual(suggestRecipientContacts(contacts,'ali unluer').map(c=>c.address),['ali@example.com','office@example.com']);
  assert.equal(suggestRecipientContacts(contacts,'TUBA')[0].address,'tuba@example.com');
  assert.equal(suggestRecipientContacts(contacts,'office@')[0].name,'Ali Ünlüer');
});
test('ambiguous names keep all distinct email choices instead of silently choosing a recipient',()=>{
  const choices=suggestRecipientContacts(contacts,'Ünlüer');
  assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>c.address)).size,3);
  assert.deepEqual(suggestRecipientContacts(contacts,''),[]);
  assert.deepEqual(suggestRecipientContacts(contacts,'not a saved person'),[]);
});
test('adding another recipient preserves already entered To, Cc or Bcc addresses',()=>{
  const values=['existing@example.com','Kor'];
  assert.deepEqual(applyRecipientContact(values,1,'koray@example.com'),['existing@example.com','koray@example.com']);
  assert.deepEqual(values,['existing@example.com','Kor']);
  assert.equal(recipientSegment('existing@example.com; Kor',null),1);
});
test('editing a recipient in the middle replaces that segment, not the last address',()=>{
  const text='first@example.com; Tuba; last@example.com';
  const segment=recipientSegment(text,text.indexOf('Tuba')+2);
  assert.equal(segment,1);
  assert.deepEqual(applyRecipientContact(['first@example.com','Tuba','last@example.com'],segment,'tuba@example.com'),['first@example.com','tuba@example.com','last@example.com']);
  assert.equal(recipientSegment('first@example.com, Kor',null),1);
});
test('existing addresses are excluded from suggestions and repeated selection does not add duplicates',()=>{
  assert.deepEqual(suggestRecipientContacts(contacts,'Ali',['ALI@example.com']).map(c=>c.address),['office@example.com']);
  assert.deepEqual(applyRecipientContact(['ALI@example.com','Ali'],1,'ali@example.com'),['ALI@example.com']);
});
test('empty fields and bounded results support multiple addresses on a small screen',()=>{
  assert.deepEqual(applyRecipientContact([],0,' tuba@example.com '),['tuba@example.com']);
  assert.equal(suggestRecipientContacts(contacts,'@',[],2).length,2);
});
