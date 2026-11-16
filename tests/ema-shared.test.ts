import test from 'node:test';
import assert from 'node:assert/strict';
import {EMA_ROUTES,mailInitialView} from '../src/lib/ema/routes';
import {mergedDirectory} from '../src/lib/ema/office-directory';
import {readLegacyCalendar,legacyEventTimes} from '../src/lib/ema/legacy-calendar';
test('all module entry points point to the same contacts/calendar/task views',()=>{
  assert.equal(EMA_ROUTES.calendar,'/mail?view=calendar');assert.equal(EMA_ROUTES.contacts,'/mail?view=contacts');
  for(const view of ['contacts','calendar','tasks','settings'])assert.equal(mailInitialView(view),view);
  for(const invalid of ['https://evil.test','../login',null,['calendar']])assert.equal(mailInitialView(invalid),'home');
});
test('Office directory reuses source links and merges emails without copying business fields into personal contacts',()=>{
  const graph=[{id:'graph',displayName:'Julius',emailAddresses:[{address:'Julius@example.com'}]}];
  const office=[{id:'office:org',displayName:'Reonic',emailAddresses:[{address:'julius@example.com'}],officeHref:'/office/kontakte/org',readOnly:true},
    {id:'office:other',displayName:'Firma',emailAddresses:[{address:'info@other.test'}],officeHref:'/office/kontakte/other',readOnly:true}];
  const directory=mergedDirectory(graph,office);
  assert.equal(directory.length,2);assert.equal(directory[0].id,'graph');assert.equal(directory[0].displayName,'Julius');
  assert.equal(directory[0].officeHref,'/office/kontakte/org');assert.equal(directory[1].id,'office:other');
  assert.equal(graph[0].id,'graph');assert.equal('officeHref' in graph[0],false,'never mutate the Microsoft source record');
});
test('legacy device calendar only imports valid local records and keeps the original JSON intact',()=>{
  const original=[{id:'12345678-1234-4234-8234-123456789abc',title:'Besprechung',date:'2026-11-17',time:'15:30',endTime:'16:00',source:'local'},
    {id:'12345678-1234-4234-8234-123456789abd',title:'Outlook',date:'2026-11-17',time:'15:30',source:'outlook'},
    {id:'bad',title:'Defekt',date:'2026-11-17',time:'15:30'}];
  const raw=JSON.stringify(original),items=readLegacyCalendar(raw);
  assert.equal(items.length,1);assert.deepEqual(legacyEventTimes(items[0]),{start:'2026-11-17T14:30:00.000Z',end:'2026-11-17T15:00:00.000Z'});
  assert.equal(JSON.stringify(original),raw);assert.deepEqual(readLegacyCalendar('bad'),[]);
  assert.throws(()=>legacyEventTimes({...items[0],date:'2026-02-30'}));
  assert.throws(()=>legacyEventTimes({...items[0],date:'2026-03-29',time:'02:30',endTime:'03:30'}));
});

test('merged directory preserves secondary email addresses on existing source records',()=>{
  const rows=mergedDirectory([{id:'one',displayName:'Person',emailAddresses:[{address:'one@test.de'}]},
    {id:'two',displayName:'Person',emailAddresses:[{address:'one@test.de'},{address:'two@test.de'}]}],[]);
  assert.equal(rows.length,1);assert.equal(rows[0].emailAddresses?.length,2);
});
test('Office directory follows authorized pages and accepts only links into the owning Office contact area',async()=>{
  const {officeDirectory}=await import('../src/lib/ema/office-directory');const old=globalThis.fetch;
  const calls:string[]=[];
  try{
    globalThis.fetch=async input=>{calls.push(String(input));return Response.json(calls.length===1?{contacts:[{id:'office:a',displayName:'Firma',emailAddresses:[{address:'firma@test.de'}],officeHref:'/office/kontakte/a'}],next:'b'}:{contacts:[{id:'office:b',officeHref:'https://evil.test'}],next:null});};
    const result=await officeDirectory(new AbortController().signal);assert.equal(result.length,1);assert.equal(calls.length,2);
    assert.ok(calls[1].includes('cursor=b'));
  }finally{globalThis.fetch=old;}
});


import {documentDuplicates,contactDuplicates,type ReviewDocument} from '../src/lib/ema/duplicates';
import {berlinTime,berlinDateInput,berlinInputToIso,eventOnDay,berlinCalendarDate} from '../src/lib/mail/calendar';
test('calendar agenda and editor use Berlin time even on a UTC or American device',()=>{
  const previous=process.env.TZ;
  try{for(const zone of ['UTC','America/Los_Angeles','Europe/Berlin']){
    process.env.TZ=zone;
    assert.equal(berlinTime('2026-11-17T14:30:00'),'15:30');
    assert.equal(berlinDateInput('2026-07-17T13:30:00Z'),'2026-07-17T15:30');
    assert.equal(berlinInputToIso('2026-11-17T15:30'),'2026-11-17T14:30:00.000Z');
    assert.equal(eventOnDay({start:{dateTime:'2026-11-16T23:30:00Z'},end:{dateTime:'2026-11-17T00:30:00Z'}},berlinCalendarDate('2026-11-17')),true);
  }}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
  assert.throws(()=>berlinInputToIso('2026-03-29T02:30'));
});
const reviewDoc=(id:string,sha256:string|null,name='file.pdf'):ReviewDocument=>({id,sha256,file_name:name,display_name:name,file_size_bytes:42,source_app:'ema_intelligence',created_at:'2026-11-17'});
test('duplicate review separates exact hashes from unverified legacy names and never conflates known different contents',()=>{
  const original=[reviewDoc('1','a'.repeat(64)),reviewDoc('2','a'.repeat(64),'copy.pdf'),reviewDoc('3',null,'legacy.pdf'),reviewDoc('4',null,'legacy.pdf'),reviewDoc('5','b'.repeat(64),'other.pdf'),reviewDoc('6','c'.repeat(64),'other.pdf')];
  const before=JSON.stringify(original),groups=documentDuplicates(original);
  assert.equal(groups.length,2);assert.equal(groups[0].exact,true);assert.equal(groups[1].exact,false);assert.equal(JSON.stringify(original),before);
});
test('contact duplicate review checks within each source, not legitimate Mail and Office references',()=>{
  const contact=(id:string)=>({id,emailAddresses:[{address:' Same@example.com '}]});
  assert.equal(contactDuplicates([contact('graph'),contact('office:company')]).length,0);
  const groups=contactDuplicates([contact('graph'),contact('graph2'),contact('office:company')]);assert.equal(groups.length,1);assert.equal(groups[0].items.length,2);
  assert.equal(contactDuplicates([contact('graph'),contact('graph')]).length,0);
});
