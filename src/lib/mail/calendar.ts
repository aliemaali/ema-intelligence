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
    graphDate(event.start.dateTime).getTime() < next.getTime() &&
    graphDate(event.end.dateTime).getTime() > calendarDay(day).getTime()
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
