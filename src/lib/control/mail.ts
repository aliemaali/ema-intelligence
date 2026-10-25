export const EMA_MAILBOXES = ['info@ema-enterprise.de', 'unluer@ema-enterprise.de'] as const
export type ControlMail = { id: string; mailbox: string; subject: string; sender: string; preview: string; receivedAt: string; unread: boolean; invoice: boolean; priority: number; reason: string; url: string | null }
export function prioritizeMail(mail: { id: string; subject?: string; bodyPreview?: string; receivedDateTime?: string; isRead?: boolean; importance?: string; hasAttachments?: boolean; flag?: { flagStatus?: string }; webLink?: string; from?: { emailAddress?: { name?: string; address?: string } } }, mailbox: string): ControlMail {
  const text = `${mail.subject || ''} ${mail.bodyPreview || ''}`
  const invoice = Boolean(mail.hasAttachments && /rechnung|invoice|zahlungsbeleg|gutschrift/i.test(text))
  const flagged = mail.flag?.flagStatus === 'flagged'
  const urgent = /frist|dringend|rückmeldung|rueckmeldung|mahnung|fällig|faellig|unterschrift|freigabe/i.test(text)
  const important = mail.importance === 'high'
  let url: string | null = null
  try { const parsed = new URL(mail.webLink || ''); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && ['outlook.office.com', 'outlook.office365.com', 'outlook.live.com'].includes(parsed.hostname)) url = parsed.href } catch {}
  return { id: mail.id, mailbox, subject: mail.subject || '(Ohne Betreff)', sender: mail.from?.emailAddress?.name || mail.from?.emailAddress?.address || 'Unbekannt', preview: (mail.bodyPreview || '').slice(0, 300), receivedAt: mail.receivedDateTime && Number.isFinite(Date.parse(mail.receivedDateTime)) ? mail.receivedDateTime : '', unread: mail.isRead === false, invoice,
    priority: (important ? 8 : 0) + (flagged ? 6 : 0) + (urgent ? 4 : 0) + (invoice ? 3 : 0) + (mail.isRead === false ? 1 : 0),
    reason: invoice ? 'Mögliche Rechnung mit Anhang' : flagged ? 'In Outlook zur Nachverfolgung markiert' : important ? 'In Outlook als wichtig markiert' : urgent ? 'Hinweis auf Frist oder Rückmeldung' : mail.isRead === false ? 'Ungelesen' : 'Neuester Posteingang', url }
}
export function rankMail(messages: ControlMail[]) {
  return [...messages].sort((a,b) => b.priority - a.priority || (Date.parse(b.receivedAt)||0) - (Date.parse(a.receivedAt)||0))
}
