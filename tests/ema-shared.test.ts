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
