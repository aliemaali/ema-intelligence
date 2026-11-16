import { mailboxRoot, type Message } from "./model";
import { mailGraph, messagePath } from "./graph";
import { isInvitation } from "./invitations";

// Expand only meeting messages. A deleted event or missing calendar permission
// must never prevent the email itself from appearing in the inbox.
export async function withInvitation<T extends Partial<Message> & { id: string }>(token: string, mailbox: string, message: T): Promise<T> {
  if (!isInvitation(message) || message.event) return message;
  try {
    const detail = await mailGraph<Message>(token,
      `${messagePath(mailbox, message.id)}?$expand=microsoft.graph.eventMessage/event($select=id,subject,start,end,location,isAllDay,isCancelled,isOrganizer,responseStatus,onlineMeeting)&$select=id`, { signal: AbortSignal.timeout(5000) }, mailboxRoot(mailbox), 'html');
    return { ...message, event: detail.event };
  } catch {
    return message;
  }
}

