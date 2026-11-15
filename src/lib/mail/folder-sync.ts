import type { Message } from './model';
import { MailSessionCache } from './session-cache';

export type MessageChange = Partial<Message> & { id: string; '@removed'?: { reason?: string } };
type Page = { messages: Message[]; cursor: string | null; pending?: boolean };
type DeltaPage = { changes: MessageChange[]; next: string | null; delta: string | null };
type Snapshot = Page & { sync: string | null; baseline: boolean; baselineIds: string[]; seen: string[]; checkedAt: number };
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

/** Shared by Start and Postfach; cursors and changes survive an app restart. */
export class MailFolderSync {
  readonly cache = new MailSessionCache<Snapshot>(24);
  private pending = new Map<string, Promise<Page>>();
  private generation = 0;
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
  private async fetchPage(get: Get, key: string, params: URLSearchParams, cursor: string | undefined, generation: number, force: boolean): Promise<Page> {
    let snapshot = this.cache.get(key);
    const save = (value: Snapshot) => { if (generation === this.generation) this.cache.set(key, value); };
    if (cursor) {
      const page: Page = await get(`messages?${params}`);
      snapshot = this.cache.get(key);
      if (snapshot) {
        // Preserve already loaded older pages when refreshing the folder later.
        snapshot = { ...snapshot, messages: mergeMailChanges(snapshot.messages, page.messages, true), cursor: page.cursor };
        save(snapshot);
      }
      return page;
    }
    if (!force && snapshot && Date.now() - snapshot.checkedAt < 55000) return { ...snapshot, pending: snapshot.baseline };
    if (!snapshot || snapshot.baseline) {
      const page: Page = await get(`messages?${params}`);
      snapshot = snapshot
        ? { ...snapshot, messages: mergeMailChanges(snapshot.messages, page.messages, true) }
        : { ...page, sync: null, baseline: true, baselineIds: page.messages.map(m => m.id), seen: [], checkedAt: 0 };
      save(snapshot);
    }
    try {
      // A bounded bootstrap avoids a long blocking full-mailbox request. Later rounds use delta only.
      for (let i = 0; i < 3; i++) {
        const query = new URLSearchParams(params);
        if (snapshot.sync) query.set('cursor', snapshot.sync);
        let delta: DeltaPage;
        try { delta = await get(`message-delta?${query}`); }
        catch (error) {
          if ((error as { status?: number }).status === 410) {
            snapshot = { ...snapshot, sync: null, baseline: true, baselineIds: snapshot.messages.map(m => m.id), seen: [], checkedAt: 0 };
            save(snapshot);
          }
          throw error;
        }
        const seen = new Set(snapshot.seen);
        if (snapshot.baseline) for (const change of delta.changes) if (!change['@removed'] && snapshot.baselineIds.includes(change.id)) seen.add(change.id);
        const latest = this.cache.get(key);
        snapshot = { ...snapshot, cursor: latest ? latest.cursor : snapshot.cursor, messages: mergeMailChanges(latest?.messages || snapshot.messages, delta.changes), sync: delta.next || delta.delta, seen: [...seen] };
        if (!delta.next) {
          if (!delta.delta) throw new Error('Microsoft hat keinen gültigen Abgleichsstand geliefert.');
          if (snapshot.baseline) {
            const baseline = new Set(snapshot.baselineIds);
            snapshot.messages = snapshot.messages.filter(m => !baseline.has(m.id) || seen.has(m.id));
          }
          snapshot = { ...snapshot, baseline: false, baselineIds: [], seen: [], checkedAt: Date.now() };
          save(snapshot); return { ...snapshot, pending: false };
        }
        save(snapshot);
      }
      snapshot = { ...snapshot, checkedAt: Date.now() };
      save(snapshot); return { ...snapshot, pending: snapshot.baseline };
    } catch (error) {
      if ([401,403].includes((error as { status?: number }).status || 0)) { this.clear(); throw error; }
      // Existing UI snapshots stay visible; report the failure instead of claiming everything is current.
      throw error;
    }
  }
}
