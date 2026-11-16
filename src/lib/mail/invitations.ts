import type { Message } from './model';

export function isInvitation(message: Partial<Message>) {
  return /^#microsoft\.graph\.eventMessage(?:Request|Response)?$/.test(message['@odata.type'] || '');
}

export function invitationLabel(message: Partial<Message>) {
  if (message.event?.isCancelled || message.meetingMessageType === 'meetingCancelled') return 'Termin abgesagt';
  if (message['@odata.type'] === '#microsoft.graph.eventMessageResponse') return 'Terminantwort';
  return 'Termineinladung';
}
