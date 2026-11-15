import type { Message } from './model';
import { MailSessionCache } from './session-cache';

export type MessageChange = Partial<Message> & { id: string; '@removed'?: { reason?: string } };
type Page = { messages: Message[]; cursor: string | null; pending?: boolean; syncWarning?: string };
type DeltaPage = { changes: MessageChange[]; next: string | null; delta: string | null };
type Snapshot = Page & { sync: string | null; baseline: boolean; continuing?: boolean; baselineIds: string[]; seen: string[]; checkedAt: number };
type Get = (path: string) => Promise<any>;

export function mergeMailChanges(previous: Message[], changes: MessageChange[], includeOlder = false) {
  const items = new Map(previous.map(m => [m.id, m]));
  const oldest = previous.length ? Math.min(...previous.map(m => Date.parse(m.receivedDateTime))) : -Infinity;
  for (const change of changes) {
    if (change['@removed']) { items.delete(change.id); continue; }
    const old = items.get(change.id);
    if (old) items.set(change.id, { ...old, ...change });
    else if (change.from?.emailAddress && change.receivedDateTime && (includeOlder || Date.parse(change.receivedDateTime) >= oldest))
      items.set(change.id, change as Message);
  }
  return [...items.values()].sort((a,b) => Date.parse(b.receivedDateTime) - Date.parse(a.receivedDateTime) || a.id.localeCompare(b.id));
}

/** The latest normal folder page is authoritative; delta history must never replace the inbox head. */
export function reconcileMailHead(previous: Message[], head: Message[]) {
  if (!head.length) return [];
  const ids = new Set(head.map(message => message.id));
  const oldest = Math.min(...head.map(message => Date.parse(message.receivedDateTime)));
  return mergeMailChanges(previous.filter(message => ids.has(message.id) || Date.parse(message.receivedDateTime) <= oldest), head, true);
}

/** Shared by Start and Postfach; cursors and changes survive an app restart. */
export class MailFolderSync {
  readonly cache = new MailSessionCache<Snapshot>(24);
  private pending = new Map<string, Promise<Page>>();
  private generation = 0;
  private listeners = new Set<(mailbox: string, folder: string) => void>();
  subscribe(listener: (mailbox: string, folder: string) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  cachedInbox(mailboxes: string[], limit = 30): Page | undefined {
    return this.cachedFolder(mailboxes, 'inbox', limit, 55000);
  }
  /** A verified head can be painted while the slower delta reconciliation continues. */
  cachedFolder(mailboxes: string[], folder: string, limit = 30, maxAge = Infinity): Page | undefined {
    const pages = mailboxes.map(mailbox => this.cache.get(JSON.stringify([mailbox, folder])));
    if (!pages.length || pages.some(page => !page || Date.now() - page.checkedAt >= maxAge)) return;
    const available = pages as Snapshot[];
    const messages = available.flatMap((page, index) => page.messages.map(message => ({...message, sourceMailbox: mailboxes[index]})))
      .sort((a,b) => Date.parse(b.receivedDateTime) - Date.parse(a.receivedDateTime) || a.sourceMailbox.localeCompare(b.sourceMailbox) || a.id.localeCompare(b.id));
    return { messages: messages.slice(0, limit), cursor: messages.length > limit || available.some(page => page.cursor) ? 'cached' : null,
      pending: available.some(page => page.baseline || page.continuing || page.syncWarning),
      syncWarning: [...new Set(available.map(page => page.syncWarning).filter(Boolean))].join(' ') || undefined };
  }
  clear() { this.generation++; this.pending.clear(); this.cache.clear(); }
  mutate(mailbox: string, id: string, operation: string) {
    this.generation++; this.pending.clear();
    for (const key of this.cache.keys()) {
      if (JSON.parse(key)[0] !== mailbox) continue;
      const entry = this.cache.get(key)!;
      const changes: MessageChange[] = [{ id, ...(['trash','archive'].includes(operation)
        ? { '@removed': {} } : ['read','unread'].includes(operation)
          ? { isRead: operation === 'read' } : { flag: { flagStatus: operation === 'flag' ? 'flagged' : 'notFlagged' } }) }];
      this.cache.set(key, { ...entry, messages: mergeMailChanges(entry.messages, changes), checkedAt: 0 });
    }
  }
  async page(get: Get, mailbox: string, folder: string, q = '', cursor?: string, force = false): Promise<Page> {
    const params = new URLSearchParams({ mailbox, folder, ...(q ? { q } : {}), ...(cursor ? { cursor } : {}) });
    if (q) return get(`messages?${params}`); // Search is independent of folder synchronization.
    const key = JSON.stringify([mailbox, folder]);
    const pendingKey = JSON.stringify([key, cursor || '']);
    const existing = this.pending.get(pendingKey);
    if (existing) return existing;
    const generation = this.generation;
    const request = this.fetchPage(get, key, params, cursor, generation, force);
    this.pending.set(pendingKey, request);
    try { return await request; }
    finally { if (this.pending.get(pendingKey) === request) this.pending.delete(pendingKey); }
  }
  private async fetchPage(get: Get, key: string, params: URLSearchParams, cursor: string | undefined, generation: number, force: boolean, resetCursor = false): Promise<Page> {
    let snapshot = this.cache.get(key);
    const save = (value: Snapshot) => {
      if (generation !== this.generation) return;
      this.cache.set(key, value);
      const [mailbox, folder] = JSON.parse(key);
      for (const listener of this.listeners) listener(mailbox, folder);
    };
    if (cursor) {
      let page: Page;
      try { page = await get(`messages?${params}`); }
      catch (error) {
        if (![400,410].includes((error as {status?: number}).status || 0)) throw error;
        // Discard a legacy continuation, not the saved mail, and obtain a newly scoped cursor.
        const restart = new URLSearchParams(params); restart.delete('cursor');
        return this.fetchPage(get, key, restart, undefined, generation, true, true);
      }
      snapshot = this.cache.get(key);
      if (snapshot) {
        // Preserve already loaded older pages when refreshing the folder later.
        snapshot = { ...snapshot, messages: mergeMailChanges(snapshot.messages, page.messages, true), cursor: page.cursor };
        save(snapshot);
      }
      return page;
    }
    if (!force && snapshot && Date.now() - snapshot.checkedAt < 55000) return { ...snapshot, pending: Boolean(snapshot.baseline || snapshot.continuing || snapshot.syncWarning) };
    try {
      // One small head request checks ordering and repairs a stale/partial delta baseline.
      // Already loaded historical pages remain cached; they are not downloaded again.
      const page: Page = await get(`messages?${params}`);
      const headIds = new Set(page.messages.map(message => message.id));
      snapshot = snapshot
        ? { ...snapshot, cursor: resetCursor ? page.cursor : snapshot.cursor, messages: reconcileMailHead(snapshot.messages, page.messages) }
        : { ...page, sync: null, baseline: true, baselineIds: page.messages.map(m => m.id), seen: [], checkedAt: 0 };
      save(snapshot);
      // A bounded bootstrap avoids a long blocking full-mailbox request. Later rounds use delta only.
      for (let i = 0; i < 3; i++) {
        const query = new URLSearchParams(params);
        if (snapshot.sync) query.set('cursor', snapshot.sync);
        let delta: DeltaPage;
        try { delta = await get(`message-delta?${query}`); }
        catch (error) {
          if ([400,410].includes((error as { status?: number }).status || 0) && snapshot.sync) {
            snapshot = { ...snapshot, sync: null, baseline: true, continuing: false, baselineIds: snapshot.messages.map(m => m.id), seen: [], checkedAt: 0 };
            save(snapshot);
          }
          throw error;
        }
        const seen: Set<string> = new Set(snapshot.seen);
        if (snapshot.baseline) for (const change of delta.changes) if (!change['@removed'] && snapshot.baselineIds.includes(change.id)) seen.add(change.id);
        const latest = this.cache.get(key);
        snapshot = { ...snapshot, syncWarning: undefined, cursor: latest ? latest.cursor : snapshot.cursor, messages: mergeMailChanges(latest?.messages || snapshot.messages, delta.changes), sync: delta.next || delta.delta, continuing: Boolean(delta.next), seen: [...seen] };
        if (!delta.next) {
          if (!delta.delta) throw new Error('Microsoft hat keinen gültigen Abgleichsstand geliefert.');
          if (snapshot.baseline) {
            const baseline = new Set(snapshot.baselineIds);
            snapshot.messages = snapshot.messages.filter(m => !baseline.has(m.id) || seen.has(m.id) || headIds.has(m.id));
          }
          snapshot = { ...snapshot, baseline: false, baselineIds: [], seen: [], checkedAt: Date.now() };
          save(snapshot); return { ...snapshot, pending: false };
        }
        save(snapshot);
      }
      snapshot = { ...snapshot, checkedAt: Date.now() };
      save(snapshot); return { ...snapshot, pending: snapshot.baseline || snapshot.continuing };
    } catch (error) {
      if ([401,403].includes((error as { status?: number }).status || 0)) { this.clear(); throw error; }
      if (!snapshot) throw error;
      // Delta is an enhancement, never a prerequisite for showing an authorized folder page.
      // Persist the warning with the page so a restart also keeps the first successful list.
      snapshot = { ...snapshot, checkedAt: Date.now(), syncWarning: 'Hintergrundabgleich vorübergehend nicht verfügbar. Die geladenen Nachrichten bleiben sichtbar.' };
      save(snapshot);
      return { ...snapshot, pending: true };
    }
  }
}
