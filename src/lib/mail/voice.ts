import { fromZonedTime } from 'date-fns-tz';
export type CalendarSeed = { key: string; subject: string; start: string; end: string; teamsMeeting: boolean };
export type VoiceCommand =
  | { kind: 'navigate'; view: 'home' | 'mail' | 'calendar' | 'contacts' | 'settings' }
  | { kind: 'read' }
  | { kind: 'stop' }
  | { kind: 'search'; query: string }
  | { kind: 'summarize'; query?: string }
  | { kind: 'reply'; body: string }
  | { kind: 'compose' }
  | { kind: 'event'; seed: Omit<CalendarSeed, 'key'> }
  | { kind: 'help'; message: string };
export function berlinDay(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function todayRange(now = new Date()) {
  const day = berlinDay(now);
  const next = new Date(`${day}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  return { start: fromZonedTime(`${day}T00:00:00`, 'Europe/Berlin').toISOString(), end: fromZonedTime(`${next.toISOString().slice(0,10)}T00:00:00`, 'Europe/Berlin').toISOString() };
}
const tidy = (value: string) => value.trim().replace(/[.!?]+$/, '').trim();
export function parseMailVoice(raw: string, now = new Date()): VoiceCommand {
  const text = tidy(raw);
  if (!text || text.length > 2000) return { kind: 'help', message: 'Bitte einen kurzen Befehl eingeben.' };
  if (/^(stopp?|stoppen|abbrechen|vorlesen beenden)$/i.test(text)) return { kind: 'stop' };
  // Free text stays literal draft content; it never becomes another command.
  const reply = text.match(/^(?:antworte(?:n)?(?: darauf)?|schreibe (?:als )?antwort)\s*[:：]?\s+(.+)$/i);
  if (reply) return { kind: 'reply', body: reply[1] };
  if (/^(?:neue (?:(?:e-?)?mail|nachricht)|(?:schreibe|erstelle|verfasse)(?: eine)? neue (?:(?:e-?)?mail|nachricht))$/i.test(text)) return { kind: 'compose' };
  if (/(?:termin|meeting).*(?:erstell|anleg)|(?:erstell|lege|plane).*(?:termin|meeting)/i.test(text)) {
    const clock = text.match(/\bum\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*uhr)?\b/i);
    const relative = text.match(/\b(übermorgen|morgen|heute)\b/i);
    const explicit = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
    if (!clock || (!relative && !explicit)) return { kind: 'help', message: 'Bitte Datum und Uhrzeit nennen, zum Beispiel: Erstelle morgen um 14 Uhr einen Termin mit Teams-Link.' };
    const hour = Number(clock[1]), minute = Number(clock[2] || 0);
    let day = berlinDay(now);
    if (explicit) {
      day = `${explicit[3]}-${explicit[2].padStart(2,'0')}-${explicit[1].padStart(2,'0')}`;
      const calendarDate = new Date(`${day}T12:00:00Z`);
      if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0,10) !== day) return { kind:'help', message:'Bitte ein gültiges Datum nennen.' };
    } else {
      const next = new Date(`${day}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + (relative?.[1].toLowerCase() === 'übermorgen' ? 2 : relative?.[1].toLowerCase() === 'morgen' ? 1 : 0));
      day = next.toISOString().slice(0,10);
    }
    if (hour > 23 || minute > 59) return {kind:'help', message:'Bitte eine gültige Uhrzeit nennen.'};
    const local = `${day}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`;
    const start = fromZonedTime(local, 'Europe/Berlin');
    if (!Number.isFinite(start.getTime()) || start.getTime() <= now.getTime()) return {kind:'help', message:'Bitte einen Termin in der Zukunft nennen.'};
    // DST gaps and ambiguous hours must be reviewed manually.
    const rendered = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(start);
    if (rendered !== local.slice(11,16)) return {kind:'help',message:'Diese Uhrzeit liegt in der Zeitumstellung. Bitte den Termin im Kalender eingeben.'};
    const duration = text.match(/\b(\d{1,3})\s*minuten\b/i);
    const minutes = duration ? Number(duration[1]) : 30;
    if (minutes < 1 || minutes > 480) return {kind:'help',message:'Bitte eine Dauer zwischen 1 und 480 Minuten nennen.'};
    const title = text.match(/(?:titel|betreff|namens)\s*[:：]?\s+(.+)$/i)?.[1] || 'Neuer Termin';
    return {kind:'event',seed:{subject:title,start:start.toISOString(),end:new Date(start.getTime()+minutes*60000).toISOString(),teamsMeeting:/\bteams\b/i.test(text)}};
  }
  const summary = text.match(/^(?:fasse|fass)\s+(?:mir\s+)?(?:die\s+)?(?:(?:e-?)?mail|nachricht)(?:\s+von\s+(.+?))?\s+zusammen$/i);
  if (summary) return {kind:'summarize',query:summary[1] ? tidy(summary[1]) : undefined};
  if (/^(?:lies|lese)\b.*(?:(?:e-?)?mails?|nachrichten).*\bvor$/i.test(text)) return {kind:'read'};
  const search = text.match(/^(?:zeig(?:e)?(?: mir)?|suche|finde)\s+(?:die\s+)?(?:(?:e-?)?mails?|nachrichten)\s+(?:zum (?:projekt|thema)|zu|von|über|mit)\s+(.+)$/i);
  if (search) return {kind:'search',query:tidy(search[1]).slice(0,180)};
  const nav = text.replace(/^(?:öffne|zeige(?: mir)?|gehe (?:zum|zur)|wechsel(?:e)? (?:zum|zur))\s+(?:den |die |das )?/i,'').toLowerCase();
  const views = {start:'home',dashboard:'home',postfach:'mail',posteingang:'mail',kalender:'calendar',termine:'calendar',kontakte:'contacts',einstellungen:'settings'} as const;
  if (nav in views) return {kind:'navigate',view:views[nav as keyof typeof views]};
  return {kind:'help',message:'Das habe ich nicht eindeutig verstanden. Nutze einen der Beispielbefehle. Zum Senden prüfst und bestätigst du den Entwurf im Schreibfenster.'};
}
