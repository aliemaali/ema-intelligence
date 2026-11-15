import type { MailDraft } from "./model";
export type DraftText = Pick<MailDraft, "mailbox" | "subject" | "body" | "bodyHtml">;
export function draftText(draft: DraftText): DraftText {
  return { mailbox: draft.mailbox, subject: draft.subject, body: draft.body, bodyHtml: draft.bodyHtml };
}
export function sameDraftText(a: DraftText, b: DraftText) {
  return a.mailbox === b.mailbox && a.subject === b.subject && a.body === b.body && a.bodyHtml === b.bodyHtml;
}
