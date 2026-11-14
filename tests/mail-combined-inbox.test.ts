import test from 'node:test';
import assert from 'node:assert/strict';
import { combinedInboxPage } from '../src/lib/mail/combined-inbox';
const msg = (id: string, n: number) => ({ id, receivedDateTime: new Date(n * 1000).toISOString() });
const initial = () => ['me', 'team@example.com'].map(mailbox => ({ mailbox, items: [] as ReturnType<typeof msg>[], cursor: null, started: false }));
test('combined pages refill an exhausted source before emitting older mail; same IDs remain distinct', async () => {
  const fetchPage = async (box: string, cursor?: string) => box === 'me'
    ? cursor ? { messages: [msg('second', 9)], cursor: null } : { messages: [msg('same', 10)], cursor: 'page2' }
    : { messages: [msg('same', 1)], cursor: null };
  const previous = initial();
  const first = await combinedInboxPage(previous, fetchPage, 2);
  assert.deepEqual(first.messages.map(m => [m.id, m.sourceMailbox]), [['same', 'me'], ['second', 'me']]);
  assert.equal(first.hasMore, true);
  const last = await combinedInboxPage(first.sources, fetchPage, 2);
  assert.deepEqual(last.messages.map(m => [m.id, m.sourceMailbox]), [['same', 'team@example.com']]);
  assert.equal(last.hasMore, false);
  assert.deepEqual(previous, initial(), 'input must remain intact for retries');
});
test('a failed mailbox rejects the combined load instead of silently omitting mail', async () => {
  const previous = initial();
  await assert.rejects(combinedInboxPage(previous, async box => {
    if (box === 'team@example.com') throw new Error('No access');
    return { messages: [msg('a', 5)], cursor: null };
  }), /No access/);
  assert.deepEqual(previous, initial());
});
test('empty mailboxes do not prevent other messages or cause empty cursor loops', async () => {
  let calls = 0;
  const result = await combinedInboxPage(initial(), async box => {
    calls++;
    return box === 'me' ? { messages: [], cursor: 'bad-next' } : { messages: [msg('a', 5)], cursor: null };
  });
  assert.equal(result.messages.length, 1);
  assert.equal(result.hasMore, false);
  assert.equal(calls, 2);
});
