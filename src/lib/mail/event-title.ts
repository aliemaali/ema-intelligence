/** Stored only on the current calendar owner's event copy, not in its subject. */
export const EVENT_TITLE_PROPERTY = 'String {f057e11b-f0ac-48af-8fd7-d1efbba98d90} Name EMAEventTitle';
export const EVENT_TITLE_EXPAND = `singleValueExtendedProperties($filter=id eq '${EVENT_TITLE_PROPERTY}')`;
export function personalEventTitle<T extends { subject?: string; singleValueExtendedProperties?: { id: string; value: string }[] }>(event: T): T & { originalSubject?: string } {
  const title = event.singleValueExtendedProperties?.find(property => property.id === EVENT_TITLE_PROPERTY)?.value.trim();
  return title ? { ...event, subject: title, originalSubject: event.subject } : event;
}
