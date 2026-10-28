export type MailReference = { mailbox: string; id: string }
export const mailSelectionKey = (mail: MailReference) => JSON.stringify([mail.mailbox, mail.id])
export function toggleMailSelection(selected: Set<string>, key: string) {
  const next = new Set(selected)
  if (next.has(key)) next.delete(key); else next.add(key)
  return next
}
export function horizontalSwipe(dx: number, dy: number) {
  return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3
}
