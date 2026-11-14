import { mailboxRoot, type Message } from "./model";
import { MailError, safeGraphUrl } from "./graph";
export type SyncState = {
  user_id: string;
  mailbox: string;
  enabled: boolean;
  analyze: boolean;
  push: boolean;
  enabled_since: string;
  cursor: string | null;
  folder_id?: string;
  lease_id: string;
};
export type MailJob = {
  id: string;
  user_id: string;
  mailbox: string;
  message_id: string;
  attempts: number;
  lease_id: string;
  analysis_done: boolean;
  push_state: string;
};
export type DeltaPage = {
  value: (Partial<Message> & { id: string; "@removed"?: unknown })[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};
export function deltaPath(state: SyncState) {
  const base = `${mailboxRoot(state.mailbox)}/mailFolders/${encodeURIComponent(state.folder_id || "inbox")}/messages/delta`;
  if (state.cursor)
    return checkedDeltaLink(state.cursor, state.mailbox, state.folder_id);
  return `${base}?${new URLSearchParams({ changeType: "created", $select: "id,receivedDateTime,isDraft", $top: "10", $filter: `receivedDateTime ge ${state.enabled_since}` })}`;
}
export function checkedDeltaLink(
  link: string,
  mailbox: string,
  folderId = "inbox",
) {
  const url = new URL(safeGraphUrl(link, mailboxRoot(mailbox)));
  const path = decodeURIComponent(url.pathname).replace(
    /\/mailfolders(?=\/|\()/i,
    "/mailFolders",
  );
  const root = decodeURIComponent(mailboxRoot(mailbox));
  if (
    path !== `/v1.0${root}/mailFolders/${folderId}/messages/delta` &&
    path !==
      `/v1.0${root}/mailFolders('${folderId.replace(/'/g, "''")}')/messages/delta`
  )
    throw new MailError(
      400,
      "Delta-Seite gehört nicht zum freigegebenen Posteingang.",
    );
  return url.href;
}
export function newMessageIds(page: DeltaPage, since: string) {
  return [
    ...new Set(
      page.value
        .filter(
          (m) =>
            m.id &&
            !m["@removed"] &&
            !(m as { isDraft?: boolean }).isDraft &&
            Number.isFinite(Date.parse(m.receivedDateTime || "")) &&
            Date.parse(m.receivedDateTime!) >= Date.parse(since),
        )
        .map((m) => m.id),
    ),
  ];
}
export function retryAt(attempt: number, now = Date.now(), seconds?: number) {
  return new Date(
    now +
      Math.max(seconds ?? 0, Math.min(3600, 30 * 2 ** Math.min(attempt, 7))) *
        1000,
  ).toISOString();
}
export async function synchronizeInbox(
  state: SyncState,
  deps: {
    authorized: () => Promise<boolean>;
    read: (path: string) => Promise<DeltaPage>;
    enqueue: (id: string) => Promise<void>;
    checkpoint: (cursor: string, more: boolean) => Promise<void>;
  },
) {
  if (!(await deps.authorized()))
    throw new MailError(403, "Postfachzugriff wurde entzogen.");
  const page = await deps.read(deltaPath(state));
  const next = page["@odata.nextLink"] || page["@odata.deltaLink"];
  if (!next) throw new MailError(502, "Unvollständige Delta-Antwort.");
  const cursor = checkedDeltaLink(next, state.mailbox, state.folder_id);
  // Persistent enqueue is idempotent. Never advance the cursor after a partial write.
  for (const id of newMessageIds(page, state.enabled_since)) {
    if (!(await deps.authorized()))
      throw new MailError(403, "Postfachzugriff wurde entzogen.");
    await deps.enqueue(id);
  }
  if (!(await deps.authorized()))
    throw new MailError(403, "Postfachzugriff wurde entzogen.");
  await deps.checkpoint(cursor, Boolean(page["@odata.nextLink"]));
  return {
    enqueued: newMessageIds(page, state.enabled_since).length,
    more: Boolean(page["@odata.nextLink"]),
  };
}
// The worker's capability surface deliberately contains no sendMail/reply/send.
export async function processMailJob(
  job: MailJob,
  deps: {
    authorized: () => Promise<boolean>;
    read: () => Promise<Message>;
    analyze: (m: Message) => Promise<void>;
    analysisDone: () => Promise<void>;
    push: () => Promise<void>;
    complete: () => Promise<void>;
    cancel: () => Promise<void>;
  },
) {
  if (!(await deps.authorized())) {
    await deps.cancel();
    return "cancelled";
  }
  let pushError: unknown;
  try {
    await deps.push();
  } catch (error) {
    pushError = error;
  }
  if (!job.analysis_done) {
    const message = await deps.read();
    if (!(await deps.authorized())) {
      await deps.cancel();
      return "cancelled";
    }
    await deps.analyze(message);
    await deps.analysisDone();
  }
  if (!(await deps.authorized())) {
    await deps.cancel();
    return "cancelled";
  }
  if (pushError) throw pushError;
  await deps.complete();
  return "done";
}
