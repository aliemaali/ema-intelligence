/** Bounded snapshots. Persistence is enabled only after the server verifies account access. */
export class MailSessionCache<T> {
  private entries = new Map<string, { value: T; updated: number }>();
  private storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  private storageKey?: string;
  constructor(private limit = 12, private clock: () => number = Date.now) {}
  bindStorage(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, key: string) {
    this.entries.clear();
    this.storage = storage; this.storageKey = key;
    try {
      const raw = storage.getItem(key);
      if (!raw || raw.length > 2_000_000) return;
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.entries)) return;
      for (const [k, entry] of data.entries.slice(-this.limit)) {
        if (typeof k === 'string' && entry && Number.isFinite(entry.updated) &&
          entry.updated <= this.clock() && this.clock() - entry.updated < 7 * 86400000 && 'value' in entry)
          this.entries.set(k, entry);
      }
    } catch { this.entries.clear(); /* Corrupt or unavailable storage must not block mail. */ }
  }
  private persist() {
    if (!this.storage || !this.storageKey) return;
    try {
      // Attachments and compose drafts remain server-side; persist list previews only.
      const entries = [...this.entries].filter(([, e]) => !Array.isArray((e.value as { drafts?: unknown[] })?.drafts) || !(e.value as { drafts: unknown[] }).drafts.length);
      let raw = JSON.stringify({ version: 1, entries });
      while (raw.length > 2_000_000 && entries.length) {
        entries.shift(); raw = JSON.stringify({ version: 1, entries });
      }
      this.storage.setItem(this.storageKey, raw);
    } catch { /* Private browsing, quota or blocked storage: retain the in-memory copy. */ }
  }
  keys() { return [...this.entries.keys()]; }
  get(key: string, maxAge = Infinity): T | undefined {
    const entry = this.entries.get(key);
    if (!entry || this.clock() - entry.updated >= maxAge) return undefined;
    this.entries.delete(key); this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T) {
    this.entries.delete(key); this.entries.set(key, { value, updated: this.clock() });
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
    this.persist();
  }
  clear() {
    this.entries.clear();
    try { if (this.storage && this.storageKey) this.storage.removeItem(this.storageKey); } catch { /* Best effort. */ }
  }
}
export function mailAccountScope(accounts: { mailbox: string; address?: string; can_read?: boolean; can_write?: boolean; can_send?: boolean }[]) {
  return JSON.stringify(accounts.map(a => [a.mailbox,a.address,a.can_read,a.can_write,a.can_send]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))));
}

