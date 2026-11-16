"use client";
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Message } from '@/lib/mail/model';
import { invitationLabel, isInvitation } from '@/lib/mail/invitations';
import { graphDate, teamsJoinUrl } from '@/lib/mail/calendar';
import s from './mail.module.css';

export function MailInvitation({ message, mailbox, compact = false, canRespond = false, onResponded }: {
  message: Message; mailbox?: string; compact?: boolean; canRespond?: boolean; onResponded?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [answered, setAnswered] = useState('');
  if (!isInvitation(message)) return null;
  const event = message.event;
  const start = event?.start?.dateTime ? graphDate(event.start.dateTime) : null;
  const end = event?.end?.dateTime ? graphDate(event.end.dateTime) : null;
  const valid = start && Number.isFinite(start.getTime());
  const date = valid ? start.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const time = (d: Date) => d.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
  const when = valid ? `${date} · ${event?.isAllDay ? 'Ganztägig' : time(start) + (end && Number.isFinite(end.getTime()) ? ` – ${time(end)} Uhr` : ' Uhr')}` : 'Terminangaben beim Öffnen prüfen';
  const join = teamsJoinUrl(event?.onlineMeeting?.joinUrl);
  const response = answered || ({ accepted: 'Zugesagt', tentativelyAccepted: 'Mit Vorbehalt', declined: 'Abgelehnt' } as Record<string, string>)[event?.responseStatus?.response || ''];
  async function respond(value: string, label: string) {
    if (!window.confirm(`${label}? Der Organisator erhält deine Antwort.`)) return;
    setBusy(true); setNotice('');
    try {
      const res = await fetch('/api/mail/invitation-response', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mailbox, id: message.id, response: value, confirmed: true }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Terminantwort konnte nicht gesendet werden.');
      setAnswered(label === 'Zusagen' ? 'Zugesagt' : label === 'Absagen' ? 'Abgelehnt' : 'Mit Vorbehalt');
      onResponded?.();
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }
  if (compact) return <span className={s.invitationCompact}><CalendarDays size={15} aria-hidden="true" /><span>{invitationLabel(message)}{valid ? ` · ${when}` : ''}</span></span>;
  return <section className={s.invitationCard} aria-label="Termineinladung">
    <strong><CalendarDays size={18} aria-hidden="true" /> {invitationLabel(message)}</strong>
    <p>{when}</p>
    {event?.location?.displayName && <p>{event.location.displayName}</p>}
    {response && <p role="status">{response}</p>}
    {canRespond && event?.id && !event.isCancelled && !event.isOrganizer && message['@odata.type'] !== '#microsoft.graph.eventMessageResponse' && <div className={s.invitationActions}>
      {([['accept', 'Zusagen'], ['tentativelyAccept', 'Mit Vorbehalt'], ['decline', 'Absagen']] as const).map(([value, label]) => <button key={value} type="button" disabled={busy} onClick={() => void respond(value, label)}>{label}</button>)}
    </div>}
    {join && !event?.isCancelled && <a href={join} target="_blank" rel="noopener noreferrer">An Teams-Besprechung teilnehmen</a>}
    {notice && <p role="alert">{notice}</p>}
  </section>;
}
