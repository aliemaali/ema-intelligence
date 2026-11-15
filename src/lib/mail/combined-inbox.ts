/** Merge independently paginated mailboxes without skipping newer messages. */
export type MailboxPage<T> = { mailbox: string; items: T[]; cursor: string | null; started: boolean };
export async function combinedInboxPage<T extends { id: string; receivedDateTime: string }>(
  previous: MailboxPage<T>[],
  fetchPage: (mailbox: string, cursor?: string) => Promise<{ messages: T[]; cursor: string | null }>,
  limit = 30,
) {
  const sources = previous.map(s => ({ ...s, items: [...s.items] }));
  const messages: (T & { sourceMailbox: string })[] = [];
  async function refill(s: MailboxPage<T>) {
    if (s.items.length || (s.started && !s.cursor)) return;
    const page = await fetchPage(s.mailbox, s.cursor || undefined);
    // The folder sync cache owns this array. Consuming a combined page must not drain it.
    s.items = [...page.messages];
    s.cursor = page.cursor;
    s.started = true;
    // Avoid cursor loops from a malformed provider response.
    if (!s.items.length) s.cursor = null;
  }
  for (let i = 0; i < limit; i++) {
    await Promise.all(sources.map(refill));
    const next = sources.filter(s => s.items.length).sort((a,b) =>
      Date.parse(b.items[0].receivedDateTime) - Date.parse(a.items[0].receivedDateTime) || a.mailbox.localeCompare(b.mailbox),
    )[0];
    if (!next) break;
    messages.push({ ...next.items.shift()!, sourceMailbox: next.mailbox });
  }
  return { messages, sources, hasMore: sources.some(s => s.items.length || s.cursor) };
}

/** Counters must be complete and nonnegative; never turn unavailable data into zero. */
export function sumMailboxStats(rows: { unread: number; drafts: number }[]) {
  return rows.reduce((total, row) => {
    if (![row.unread, row.drafts].every(value => Number.isSafeInteger(value) && value >= 0))
      throw new Error('Postfachzähler derzeit nicht verfügbar.');
    const next = { unread: total.unread + row.unread, drafts: total.drafts + row.drafts };
    if (!Object.values(next).every(Number.isSafeInteger)) throw new Error('Postfachzähler derzeit nicht verfügbar.');
    return next;
  }, { unread: 0, drafts: 0 });
}
