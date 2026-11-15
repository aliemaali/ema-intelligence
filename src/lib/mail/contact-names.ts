export type NameContact = {
  id?: string;
  displayName?: string | null;
  emailAddresses?: { address?: string | null }[] | null;
};
export type ContactNames = ReadonlyMap<string, string>;
const normalize = (address?: string | null) => address?.trim().toLowerCase() || '';

export function contactNameIndex(contacts: NameContact[]): ContactNames {
  const names = new Map<string,string>();
  // Stable choice for duplicate addresses; never mutate the contact list supplied by the caller.
  const ordered = [...contacts].sort((a,b) => `${a.id || ''}:${a.displayName || ''}`.localeCompare(`${b.id || ''}:${b.displayName || ''}`));
  for (const contact of ordered) {
    const name = contact.displayName?.trim();
    if (!name) continue;
    for (const email of contact.emailAddresses || []) {
      const address = normalize(email.address);
      if (address && !names.has(address)) names.set(address, name);
    }
  }
  return names;
}
export function mailSenderName(names: ContactNames, sender: { address?: string; name?: string }) {
  return names.get(normalize(sender.address)) || sender.name?.trim() || sender.address?.trim() || '';
}

export async function loadNameContacts(
  get: (path: string) => Promise<{value?: NameContact[]; '@odata.nextLink'?: string | null}>,
) {
  const contacts: NameContact[] = [];
  const visited = new Set<string>();
  let cursor: string | null | undefined;
  do {
    if (cursor && visited.has(cursor)) throw new Error('Kontaktseiten wiederholen sich.');
    if (cursor) visited.add(cursor);
    const result = await get(`contacts${cursor ? '?' + new URLSearchParams({cursor}) : ''}`);
    contacts.push(...(result.value || []));
    cursor = result['@odata.nextLink'];
  } while (cursor);
  return contacts;
}
