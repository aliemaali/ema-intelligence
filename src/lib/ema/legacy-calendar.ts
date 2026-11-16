import { z } from 'zod';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
export const LEGACY_CALENDAR_KEY = 'ema-calendar-events-v1';
export const LEGACY_CALENDAR_PROPERTY = 'String {f057e11b-f0ac-48af-8fd7-d1efbba98d90} Name EMALegacyCalendarId';
export const legacyCalendarEvent = z.object({
  id:z.string().uuid(), title:z.string().trim().min(1).max(250),
  date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time:z.string().regex(/^\d{2}:\d{2}$/),
  endTime:z.string().regex(/^\d{2}:\d{2}$/).optional(),
  projectId:z.union([z.string().uuid(),z.literal('')]).optional(),
  reminder:z.enum(['none','15m','1h','1d','3d','7d']).default('none'),
});
export type LegacyCalendarEvent = z.infer<typeof legacyCalendarEvent>;
export function readLegacyCalendar(raw: string | null): LegacyCalendarEvent[] {
  try {
    const values=JSON.parse(raw || '[]');
    if(!Array.isArray(values))return [];
    return values.filter(value=>value && (!value.source || value.source==='local')).flatMap(value=>{
      const parsed=legacyCalendarEvent.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    });
  } catch { return []; }
}
export function legacyEventTimes(value: LegacyCalendarEvent) {
  const start=fromZonedTime(`${value.date}T${value.time}:00`,'Europe/Berlin');
  const end=value.endTime ? fromZonedTime(`${value.date}T${value.endTime}:00`,'Europe/Berlin') : new Date(start.getTime()+3600000);
  if(!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end<=start)throw new Error('Ungültiger Zeitraum des früheren Termins.');
  if(formatInTimeZone(start,'Europe/Berlin','yyyy-MM-dd HH:mm')!==`${value.date} ${value.time}`)throw new Error('Datum oder Uhrzeit des früheren Termins ist ungültig.');
  return {start:start.toISOString(),end:end.toISOString()};
}
