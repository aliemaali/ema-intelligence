import { berlinDay, graphDate, todayRange } from './calendar';

export type UpcomingEvent = {
  start?: { dateTime: string };
  end?: { dateTime: string };
  isCancelled?: boolean;
  responseStatus?: { response: string };
};
export function upcomingRange(now = new Date()) {
  return { start: todayRange(now).start, end: new Date(now.getTime() + 30 * 86400000).toISOString() };
}
export function upcomingEvents<T extends UpcomingEvent>(events: T[], now = new Date()) {
  return events.filter(event => !event.isCancelled && event.responseStatus?.response !== 'declined' &&
    event.start && event.end && Number.isFinite(graphDate(event.start.dateTime).getTime()) &&
    graphDate(event.end.dateTime).getTime() > now.getTime())
    .sort((a, b) => graphDate(a.start!.dateTime).getTime() - graphDate(b.start!.dateTime).getTime());
}
export function upcomingDay(value: string, now = new Date()) {
  const date = graphDate(value);
  const day = berlinDay(date);
  const today = berlinDay(now);
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (day === today) return 'Heute';
  if (day === tomorrow.toISOString().slice(0, 10)) return 'Morgen';
  return date.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' });
}

/** The combined inbox is a mail filter; the start card remains the user's calendar.
 * Shared mailbox mail permissions do not grant access to its calendar.
 */
export function dashboardCalendarMailboxes(mailbox: string) {
  return mailbox === 'all' ? ['me'] : [mailbox];
}

/** Keep each cursor within the mailbox and range from the original request. */
export async function loadUpcomingCalendar<T>(get: (path: string, signal?: AbortSignal) => Promise<any>, boxes: string[], signal: AbortSignal, now = new Date()) {
  const range = upcomingRange(now);
  const results = await Promise.allSettled(boxes.map(async mailbox => {
    const query = new URLSearchParams({ ...range, mailbox });
    const values: T[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      if (cursor) query.set('cursor', cursor);
      const result = await get(`calendar?${query}`, signal);
      values.push(...(result.value || []));
      cursor = result['@odata.nextLink'];
      if (!cursor) return { value: values, partial: false };
    }
    return { value: values, partial: true };
  }));
  const successful = results.filter(result => result.status === 'fulfilled');
  if (!successful.length) throw (results.find(result => result.status === 'rejected') as PromiseRejectedResult)?.reason || new Error('Kalender nicht verfügbar.');
  return { value: successful.flatMap(result => result.value.value),
    '@odata.nextLink': successful.some(result => result.value.partial),
    warning: results.some(result => result.status === 'rejected') ? 'Kalender: Nicht alle Postfachkalender konnten geladen werden.' : undefined };
}
