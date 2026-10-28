import { createHash } from 'node:crypto'
import { EMA_MAILBOXES } from './mail'
import type { MailReference } from './mail-selection'
import { mailSelectionKey } from './mail-selection'
export const mailFingerprint = (mail: MailReference) => createHash('sha256').update(mailSelectionKey(mail)).digest('hex')
export function parseMailDismissal(value: unknown): { action: 'hide' | 'restore'; messages: MailReference[] } {
  if (!value || typeof value !== 'object') throw Error('Ungültige Auswahl.')
  const body = value as { action?: unknown; messages?: unknown }
  if ((body.action !== 'hide' && body.action !== 'restore') || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 100) throw Error('Bitte 1 bis 100 Nachrichten auswählen.')
  const messages = new Map<string, MailReference>()
  for (const entry of body.messages) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 2048 || /[\u0000-\u001f]/.test(entry.id) || typeof entry.mailbox !== 'string' || !EMA_MAILBOXES.includes(entry.mailbox)) throw Error('Ungültige Nachricht.')
    const mail = { mailbox: entry.mailbox, id: entry.id }
    messages.set(mailSelectionKey(mail), mail)
  }
  return { action: body.action, messages: [...messages.values()] }
}
