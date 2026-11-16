import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export function berlinDay(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function todayRange(now = new Date()) {
  const day = berlinDay(now);
  const next = new Date(`${day}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  return { start: fromZonedTime(`${day}T00:00:00`, 'Europe/Berlin').toISOString(), end: fromZonedTime(`${next.toISOString().slice(0,10)}T00:00:00`, 'Europe/Berlin').toISOString() };
}

/** Local calendar days are advanced by date, never by 24h (DST). */
export function calendarDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const count =
    Math.ceil(
      (offset +
        new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) /
        7,
    ) * 7;
  return Array.from(
    { length: count },
    (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - offset + i),
  );
}
export function isoWeek(date: Date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil(
    ((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7,
  );
}
export function graphDate(value: string) {
  return new Date(value + (/Z$|[+-]\d\d:\d\d$/.test(value) ? "" : "Z"));
}
export function eventOnDay(
  event: { start?: { dateTime: string }; end?: { dateTime: string } },
  day: Date,
) {
  if (!event.start || !event.end) return false;
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return (
    graphDate(event.start.dateTime).getTime() < fromZonedTime(`${dayKey(next)}T00:00:00`, 'Europe/Berlin').getTime() &&
    graphDate(event.end.dateTime).getTime() > fromZonedTime(`${dayKey(day)}T00:00:00`, 'Europe/Berlin').getTime()
  );
}
export function teamsJoinUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      [
        "teams.microsoft.com",
        "teams.cloud.microsoft",
        "teams.live.com",
      ].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Calendar fields and agenda always use the company's Berlin timezone. */
export function berlinCalendarDate(value = berlinDay()) {
  return new Date(`${value}T12:00:00`);
}
export function berlinDateInput(value: string) {
  return formatInTimeZone(graphDate(value), 'Europe/Berlin', "yyyy-MM-dd'T'HH:mm");
}
export function berlinInputToIso(value: string) {
  const instant = fromZonedTime(value, 'Europe/Berlin');
  if (!Number.isFinite(instant.getTime()) || berlinDateInput(instant.toISOString()) !== value.slice(0,16)) throw new Error('Ungültige Uhrzeit in Europe/Berlin.');
  return instant.toISOString();
}
export function berlinTime(value:string) {
  return graphDate(value).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'});
}
