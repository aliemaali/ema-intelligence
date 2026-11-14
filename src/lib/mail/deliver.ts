import { mailGraph, messagePath, MailError } from "./graph";
import { mailboxRoot, type MailDraft } from "./model";
import type { graphMessage } from "./security";
// Used by immediate and explicitly approved scheduled delivery. Never retries.
export async function deliverMessage(
  draft: MailDraft,
  message: unknown,
  token: string,
  recordReply: (id: string) => Promise<void>,
  assertAccess: () => Promise<unknown>,
  deadline = Date.now() + 50000,
) {
  const root = mailboxRoot(draft.mailbox);
  const call = <T>(url: string, init: RequestInit = {}) => {
    const ms = Math.min(15000, deadline - Date.now() - 2000);
    if (ms < 1000)
      throw new MailError(503, "Versandlauf hat sein Zeitbudget erreicht.");
    return mailGraph<T>(
      token,
      url,
      { ...init, signal: AbortSignal.timeout(ms) },
      root,
    );
  };
  await assertAccess();
  if (draft.replyToMessageId) {
    const reply = await call<{ id: string }>(
      `${messagePath(draft.mailbox, draft.replyToMessageId)}/createReply`,
      { method: "POST", body: "{}" },
    );
    if (!reply?.id)
      throw new MailError(502, "Microsoft lieferte keinen Antwortentwurf.");
    await recordReply(reply.id);
    const { attachments, internetMessageHeaders, ...values } =
      message as ReturnType<typeof graphMessage>;
    await call(messagePath(draft.mailbox, reply.id), {
      method: "PATCH",
      body: JSON.stringify(values),
    });
    for (const attachment of attachments)
      await call(`${messagePath(draft.mailbox, reply.id)}/attachments`, {
        method: "POST",
        body: JSON.stringify(attachment),
      });
    await assertAccess();
    await call(`${messagePath(draft.mailbox, reply.id)}/send`, {
      method: "POST",
    });
  } else {
    await assertAccess();
    await call(`${root}/sendMail`, {
      method: "POST",
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
  }
}
