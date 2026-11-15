/** Short-lived, bounded memory belonging to one mounted Mail workspace. Never persisted. */
export class MailSessionCache<T> {
  private entries = new Map<string, { value: T; updated: number }>();
  constructor(private limit = 12, private clock: () => number = Date.now) {}
  get(key: string, maxAge = Infinity): T | undefined {
    const entry = this.entries.get(key);
    if (!entry || this.clock() - entry.updated >= maxAge) return undefined;
    this.entries.delete(key); this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T) {
    this.entries.delete(key); this.entries.set(key, { value, updated: this.clock() });
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
  }
  clear() { this.entries.clear(); }
}
export function mailAccountScope(accounts: { mailbox: string; address?: string; can_read?: boolean; can_write?: boolean; can_send?: boolean }[]) {
  return JSON.stringify(accounts.map(a => [a.mailbox,a.address,a.can_read,a.can_write,a.can_send]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))));
}
