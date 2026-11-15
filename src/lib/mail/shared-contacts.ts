import { MailError, safeGraphUrl } from './graph';
import { openDeltaCursor, sealDeltaCursor } from './delta-cursor';

// Explicit contact sharing requested by EMA: Ali's address book to Tuba.
// These are verified internal account IDs, never supplied by a browser.
export const SHARED_CONTACT_OWNER = '028abbe8-ddbd-4010-a278-3d5b34b592be';
export const SHARED_CONTACT_READER = '0c62c36b-982d-4830-ac5d-9e6af92c39ae';
export const SHARED_CONTACT_PREFIX = 'ema-shared-contact:';
export function canReadAliContacts(userId: string) {
  return userId === SHARED_CONTACT_READER;
}
export function sharedContactUpdateId(userId: string, id: unknown, operation: string) {
  if (typeof id !== 'string' || !id.startsWith(SHARED_CONTACT_PREFIX)) return undefined;
  if (!canReadAliContacts(userId)) throw new MailError(403, 'Keine Kontaktfreigabe.');
  if (operation !== 'update') throw new MailError(403, 'Geteilte Kontakte können hier nur bearbeitet werden.');
  const contactId = id.slice(SHARED_CONTACT_PREFIX.length);
  if (!contactId.trim() || contactId.length > 1500) throw new MailError(400, 'Ungültiger Kontakt.');
  return contactId;
}
type Contact = { id: string; [key: string]: unknown };
type Page = { value: Contact[]; '@odata.nextLink'?: string };
const first = '/me/contacts?$top=100&$select=id,displayName,emailAddresses,businessPhones,companyName';
function contactPath(path: string) {
  const url = new URL(safeGraphUrl(path));
  if (!/^\/v1\.0\/(?:me|users\/[^/]+)\/contacts$/.test(url.pathname))
    throw new Error('Invalid contact page');
  return url.href;
}
export async function sharedContactsPage(options: {
  userId: string; cursor?: string | null; secret: string;
  getPage: (source: 'shared' | 'personal', path: string) => Promise<Page>;
}) {
  const {userId, cursor, secret, getPage} = options;
  if (!canReadAliContacts(userId)) throw new MailError(403, 'Keine Kontaktfreigabe.');
  const scope = JSON.stringify([userId, SHARED_CONTACT_OWNER, 'shared-contacts-v1']);
  let source: 'shared' | 'personal' = 'shared';
  let path = first;
  if (cursor) {
    try {
      const state = JSON.parse(openDeltaCursor(cursor, scope, secret));
      if (!['shared', 'personal'].includes(state.source) || typeof state.path !== 'string') throw new Error('Invalid source');
      source = state.source;
      path = contactPath(state.path);
    } catch { throw new MailError(400, 'Ungültige Kontaktseite. Bitte Kontakte erneut öffnen.'); }
  }
  const page = await getPage(source, path);
  let next: string | undefined;
  if (page['@odata.nextLink']) {
    let nextPath: string;
    try { nextPath = contactPath(page['@odata.nextLink']); }
    catch { throw new MailError(502, 'Ungültige Microsoft-Kontaktseite.'); }
    next = sealDeltaCursor(JSON.stringify({source, path: nextPath}), scope, secret);
  } else if (source === 'shared') {
    next = sealDeltaCursor(JSON.stringify({source: 'personal', path: first}), scope, secret);
  }
  return {
    value: page.value.map(item => source === 'shared'
      ? {...item, id: SHARED_CONTACT_PREFIX + item.id, readOnly: false, canDelete: false, sharedBy: 'Ali'}
      : item),
    '@odata.nextLink': next,
  };
}
