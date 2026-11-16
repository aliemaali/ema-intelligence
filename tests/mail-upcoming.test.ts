import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardCalendarMailboxes, loadUpcomingCalendar, upcomingDay, upcomingEvents, upcomingRange } from '../src/lib/mail/upcoming';
const now = new Date('2026-11-16T17:22:00Z');
const event = (id: string, start: string, extra = {}) => ({ id, start: {dateTime:start}, end:{dateTime:new Date(Date.parse(start) + 1800000).toISOString()}, ...extra });
test('next appointment includes tomorrow and later, excludes ended, declined and cancelled events', () => {
  const tomorrow = event('reonic','2026-11-17T14:30:00Z', {responseStatus:{response:'accepted'}});
  const result = upcomingEvents([event('later','2026-11-20T09:00:00Z'),event('past','2026-11-16T09:00:00Z'),event('cancelled','2026-11-16T18:00:00Z',{isCancelled:true}),event('declined','2026-11-16T19:00:00Z',{responseStatus:{response:'declined'}}),tomorrow],now);
  assert.deepEqual(result.map(e=>e.id),['reonic','later']);
  assert.equal(upcomingDay(tomorrow.start.dateTime, now),'Morgen');
});
test('upcoming dates use Berlin days across midnight, month boundaries and daylight saving', () => {
  assert.equal(upcomingDay('2026-11-16T23:30:00Z', now),'Morgen');
  assert.equal(upcomingDay('2026-11-16T18:00:00Z', now),'Heute');
  assert.equal(upcomingDay('2026-11-20T09:00:00Z', now),'20.11.');
  assert.equal(upcomingDay('2026-04-01T08:00:00Z',new Date('2026-03-31T19:00:00Z')),'Morgen');
  assert.equal(upcomingDay('2026-03-29T08:00:00Z',new Date('2026-03-28T19:00:00Z')),'Morgen');
});
test('dashboard calendar range covers 30 days instead of only today', () => {
  const range=upcomingRange(now);
  assert.equal(range.start,'2026-11-15T23:00:00.000Z');
  assert.equal(range.end,'2026-12-16T17:22:00.000Z');
});
test('all-mailbox upcoming load follows pages and preserves each mailbox and time range', async () => {
  const seen: URLSearchParams[]=[];
  const result=await loadUpcomingCalendar(async path=>{
    const query=new URLSearchParams(path.split('?')[1]);seen.push(query);
    return query.get('mailbox')==='me' && !query.get('cursor') ? {value:[{id:'first'}],'@odata.nextLink':'next-page'} : {value:[{id:query.get('mailbox')}]};
  },['me','team@example.com'],new AbortController().signal,now);
  assert.equal(result.value.length,3);
  assert.equal(result.warning,undefined);
  assert.equal(seen.length,3);
  assert.ok(seen.every(query=>query.get('end')===upcomingRange(now).end));
  assert.equal(seen.find(query=>query.get('cursor'))?.get('mailbox'),'me');
});
test('unavailable shared calendar retains available appointments and reports partial failure', async () => {
  const result=await loadUpcomingCalendar(async path=>{
    if(path.includes('team%40'))throw new Error('no calendar permission');
    return {value:[{id:'own-event'}]};
  },['me','team@example.com'],new AbortController().signal,now);
  assert.deepEqual(result.value,[{id:'own-event'}]);assert.ok(result.warning);
  await assert.rejects(loadUpcomingCalendar(async()=>{throw new Error('offline');},['me'],new AbortController().signal,now),/offline/);
});

test('combined inbox loads only the personal calendar; individual mailbox selection stays explicit', async () => {
  assert.deepEqual(dashboardCalendarMailboxes('all'), ['me']);
  assert.deepEqual(dashboardCalendarMailboxes('team@example.com'), ['team@example.com']);
  const called: string[] = [];
  const result = await loadUpcomingCalendar(async path => {
    const mailbox = new URLSearchParams(path.split('?')[1]).get('mailbox')!;
    called.push(mailbox);
    if (mailbox !== 'me') throw Object.assign(new Error('calendar not shared'), { status: 403 });
    return { value: [event('reonic', '2026-11-17T14:30:00Z', { responseStatus: { response: 'accepted' } })] };
  }, dashboardCalendarMailboxes('all'), new AbortController().signal, now);
  assert.deepEqual(called, ['me']);
  assert.equal(result.warning, undefined);
  assert.equal(upcomingEvents(result.value as ReturnType<typeof event>[], now)[0].id, 'reonic');
});

test('personal event titles do not mutate the organizer subject or other properties', async()=>{
  const {personalEventTitle,EVENT_TITLE_PROPERTY}=await import('../src/lib/mail/event-title');
  const original={subject:'Original',isOrganizer:false,singleValueExtendedProperties:[{id:EVENT_TITLE_PROPERTY,value:'Mein Titel'}]};
  const display=personalEventTitle(original);
  assert.equal(display.subject,'Mein Titel');assert.equal(display.originalSubject,'Original');
  assert.equal(original.subject,'Original');assert.equal(display.isOrganizer,false);
  assert.equal(personalEventTitle({subject:'Original'}).subject,'Original');
  assert.equal(personalEventTitle({...original,singleValueExtendedProperties:[{id:EVENT_TITLE_PROPERTY,value:''}]}).subject,'Original');
});
