import { safePushEndpoint } from "./push";
import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { mailAdmin } from "./server";
import { getMicrosoftAccessToken } from "@/lib/microsoft/session";
import { canUseMail, draftSchema, mailboxRoot, type Message } from "./model";
import { mailGraph, MailError, messagePath } from "./graph";
import { analyzeMessage } from "./analysis";
import { digest } from "./security";
import {
  operationTimeout,
  processMailJob,
  retryAt,
  synchronizeInbox,
  type MailJob,
  type SyncState,
  type DeltaPage,
} from "./automation";
export function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const left = Buffer.from(actual),
    right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
const checked = async (query: PromiseLike<{ error: unknown }>) => {
  const result = await query;
  if (result.error)
    throw new MailError(
      503,
      "Hintergrundstatus konnte nicht gespeichert werden.",
    );
  return result;
};
async function currentAccess(state: Pick<SyncState, "user_id" | "mailbox">) {
  const db = mailAdmin();
  const { data: profile, error } = await db
    .from("profiles")
    .select("role,is_active")
    .eq("id", state.user_id)
    .maybeSingle();
  if (error || !canUseMail(profile)) return null;
  const { data: settings } = await db
    .from("ema_mail_sync")
    .select("*")
    .eq("user_id", state.user_id)
    .eq("mailbox", state.mailbox)
    .eq("enabled", true)
    .maybeSingle();
  if (!settings) return null;
  if (state.mailbox !== "me") {
    const { data: permission } = await db
      .from("ema_mail_memberships")
      .select("can_read,can_send")
      .eq("user_id", state.user_id)
      .eq("mailbox", state.mailbox)
      .maybeSingle();
    if (!permission?.can_read) return null;
    return { ...settings, can_send: permission.can_send };
  }
  return { ...settings, can_send: true };
}
async function requiredToken(userId: string) {
  const token = await getMicrosoftAccessToken(userId);
  if (!token) throw new MailError(409, "Microsoft-Verbindung fehlt.");
  return token;
}
async function analyzeAndDraft(
  job: MailJob,
  message: Message,
  deadline: number,
) {
  const db = mailAdmin(),
    access = await currentAccess(job);
  if (!access) throw new MailError(403, "Zugriff entzogen.");
  if (!access.analyze) return;
  const key = digest({
    mailbox: job.mailbox,
    id: message.id,
    body: message.body,
    subject: message.subject,
  });
  const { data: cached } = await db
    .from("ema_mail_analysis")
    .select("result")
    .eq("user_id", job.user_id)
    .eq("source_hash", key)
    .maybeSingle();
  let analysis = cached?.result;
  if (!analysis) {
    const { data: allowed, error } = await db.rpc("ema_mail_claim_analysis", {
      p_user_id: job.user_id,
      p_limit: 20,
    });
    if (error) throw new MailError(503, "Analysebudget nicht verfügbar.");
    if (!allowed) throw new MailError(429, "Analysebudget ausgeschöpft.");
    analysis = await analyzeMessage(message, operationTimeout(deadline, 18000));
    if (!(await currentAccess(job))?.analyze) return;
    await checked(
      db
        .from("ema_mail_analysis")
        .upsert(
          { user_id: job.user_id, source_hash: key, result: analysis },
          { onConflict: "user_id,source_hash" },
        ),
    );
  }
  await checked(
    db.from("ema_mail_insights").upsert(
      {
        user_id: job.user_id,
        mailbox: job.mailbox,
        message_id: message.id,
        result: analysis,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mailbox,message_id" },
    ),
  );
  const fresh = await currentAccess(job);
  if (!fresh?.analyze || !fresh.can_send || !analysis.suggestedReply) return;
  const recipients = message.replyTo?.length
    ? message.replyTo.map((r) => r.emailAddress.address)
    : [message.from?.emailAddress?.address];
  const parsed = draftSchema.safeParse({
    mailbox: job.mailbox,
    to: recipients,
    subject: `Re: ${message.subject || "(Ohne Betreff)"}`.slice(0, 500),
    body: analysis.suggestedReply,
    replyToMessageId: message.id,
  });
  if (!parsed.success) return;
  const sourceKey = `job:${job.id}`;
  const { data: existing } = await db
    .from("ema_mail_drafts")
    .select("id")
    .eq("user_id", job.user_id)
    .eq("source_key", sourceKey)
    .maybeSingle();
  if (existing) return;
  if (!(await currentAccess(job)))
    throw new MailError(403, "Zugriff entzogen.");
  const { error } = await db.from("ema_mail_drafts").insert({
    user_id: job.user_id,
    source_key: sourceKey,
    payload: parsed.data,
    content_hash: digest(parsed.data),
    status: "draft",
  });
  if (error && error.code !== "23505")
    throw new MailError(503, "Antwortentwurf konnte nicht gespeichert werden.");
}
async function pushNewMail(job: MailJob, deadline: number) {
  const db = mailAdmin(),
    access = await currentAccess(job);
  if (job.push_state === "claimed") {
    await checked(
      db
        .from("ema_mail_jobs")
        .update({ push_state: "uncertain" })
        .eq("id", job.id)
        .eq("lease_id", job.lease_id),
    );
    return;
  }
  if (!access || !access.push || job.push_state !== "pending") return;
  const pub =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY,
    priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new MailError(503, "Push-Konfiguration fehlt.");
  const { data: devices, error } = await db
    .from("ema_push_subscriptions")
    .select("id,endpoint,p256dh,auth_key")
    .eq("user_id", job.user_id)
    .limit(5);
  if (error) throw new MailError(503, "Geräte konnten nicht geladen werden.");
  const { data: claim, error: claimError } = await db
    .from("ema_mail_jobs")
    .update({ push_state: devices?.length ? "claimed" : "no_devices" })
    .eq("id", job.id)
    .eq("lease_id", job.lease_id)
    .eq("push_state", "pending")
    .select("id")
    .maybeSingle();
  if (claimError || !claim)
    throw new MailError(409, "Push wurde bereits übernommen.");
  if (!devices?.length) return;
  operationTimeout(deadline, 5000);
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info@ema-enterprise.de",
    pub,
    priv,
  );
  let uncertain = false;
  for (const device of devices) {
    if (!safePushEndpoint(device.endpoint)) {
      uncertain = true;
      continue;
    }
    if (!(await currentAccess(job))?.push) {
      uncertain = true;
      break;
    }
    try {
      await webpush.sendNotification(
        {
          endpoint: device.endpoint,
          keys: { p256dh: device.p256dh, auth: device.auth_key },
        },
        JSON.stringify({
          title: "EMA Mail",
          body: "Eine neue Nachricht ist eingegangen.",
          tag: `ema-mail-${job.id}`,
          url: `/mail?${new URLSearchParams({ mailbox: job.mailbox, message: job.message_id })}`,
        }),
        { TTL: 300, timeout: operationTimeout(deadline, 5000) },
      );
    } catch (e) {
      const code = Number((e as { statusCode?: number }).statusCode);
      if ([404, 410].includes(code))
        await checked(
          db
            .from("ema_push_subscriptions")
            .delete()
            .eq("id", device.id)
            .eq("user_id", job.user_id),
        );
      else uncertain = true;
    }
  }
  await checked(
    db
      .from("ema_mail_jobs")
      .update({ push_state: uncertain ? "uncertain" : "sent" })
      .eq("id", job.id)
      .eq("lease_id", job.lease_id),
  );
}
export async function runMailWorker() {
  const db = mailAdmin(),
    started = Date.now(),
    deadline = started + 50000;
  const result = { synced: 0, jobs: 0, errors: 0 };
  const { data: syncs, error } = await db.rpc("ema_mail_claim_sync");
  if (error)
    throw new MailError(503, "Mail-Migration noch nicht eingerichtet.");
  const state = syncs?.[0] as SyncState | undefined;
  if (state) {
    try {
      if (!(await currentAccess(state)))
        throw new MailError(403, "Zugriff entzogen.");
      const token = await requiredToken(state.user_id);
      if (!state.folder_id) {
        const folder = await mailGraph<{ id: string }>(
          token,
          `${mailboxRoot(state.mailbox)}/mailFolders/inbox?$select=id`,
          {},
          mailboxRoot(state.mailbox),
        );
        if (!folder.id) throw new MailError(502, "Posteingang nicht gefunden.");
        state.folder_id = folder.id;
      }
      await synchronizeInbox(state, {
        authorized: async () => Boolean(await currentAccess(state)),
        read: (path) =>
          mailGraph<DeltaPage>(
            token,
            path,
            { signal: AbortSignal.timeout(operationTimeout(deadline)) },
            mailboxRoot(state.mailbox),
          ),
        enqueue: async (id) => {
          await checked(
            db.from("ema_mail_jobs").upsert(
              {
                user_id: state.user_id,
                mailbox: state.mailbox,
                message_id: id,
              },
              {
                onConflict: "user_id,mailbox,message_id",
                ignoreDuplicates: true,
              },
            ),
          );
        },
        checkpoint: async (cursor, more) => {
          const { data, error } = await db
            .from("ema_mail_sync")
            .update({
              cursor,
              folder_id: state.folder_id,
              next_run_at: new Date(
                Date.now() + (more ? 0 : 300000),
              ).toISOString(),
              last_success_at: new Date().toISOString(),
              last_error: null,
              lease_id: null,
              leased_until: null,
            })
            .eq("user_id", state.user_id)
            .eq("mailbox", state.mailbox)
            .eq("lease_id", state.lease_id)
            .eq("enabled", true)
            .select("user_id")
            .maybeSingle();
          if (error || !data)
            throw new MailError(
              409,
              "Sync-Lease abgelaufen oder Konfiguration geändert.",
            );
        },
      });
      result.synced++;
    } catch (e) {
      result.errors++;
      const code = e instanceof MailError ? e.status : 502;
      await checked(
        db
          .from("ema_mail_sync")
          .update({
            last_error:
              code === 403
                ? "Zugriff entzogen."
                : code === 410
                  ? "Delta-Cursor abgelaufen; Neuabgleich folgt."
                  : "Abgleich fehlgeschlagen. Erneuter Versuch geplant.",
            ...(code === 410 ? { cursor: null } : {}),
            ...(code === 403 ? { enabled: false } : {}),
            lease_id: null,
            leased_until: null,
            next_run_at: retryAt(4),
          })
          .eq("user_id", state.user_id)
          .eq("mailbox", state.mailbox)
          .eq("lease_id", state.lease_id),
      );
    }
  }
  // Bounded invocation. Claims are durable; a runtime crash cannot advance a cursor
  // or grant sending rights. Remaining work is picked up by a later invocation.
  if (Date.now() - started < 12000) {
    const { data: jobs, error } = await db.rpc("ema_mail_claim_job");
    if (error) throw new MailError(503, "Job-Warteschlange nicht verfügbar.");
    const job = jobs?.[0] as MailJob | undefined;
    if (job) {
      const update = (patch: Record<string, unknown>) =>
        checked(
          db
            .from("ema_mail_jobs")
            .update(patch)
            .eq("id", job.id)
            .eq("lease_id", job.lease_id),
        );
      try {
        await processMailJob(job, {
          authorized: async () => {
            const { data } = await db
              .from("ema_mail_jobs")
              .select("id")
              .eq("id", job.id)
              .eq("lease_id", job.lease_id)
              .eq("state", "processing")
              .gt("leased_until", new Date().toISOString())
              .maybeSingle();
            return Boolean(data && (await currentAccess(job)));
          },
          read: async () => {
            const access = await currentAccess(job);
            if (!access) throw new MailError(403, "Zugriff entzogen.");
            if (!access.analyze) return {} as Message;
            return mailGraph<Message>(
              await requiredToken(job.user_id),
              messagePath(job.mailbox, job.message_id),
              { signal: AbortSignal.timeout(operationTimeout(deadline)) },
              mailboxRoot(job.mailbox),
            );
          },
          analyze: (msg) => analyzeAndDraft(job, msg, deadline),
          analysisDone: async () => {
            await update({ analysis_done: true });
          },
          push: () => pushNewMail(job, deadline),
          complete: async () => {
            await update({ state: "done", lease_id: null, leased_until: null });
          },
          cancel: async () => {
            await update({
              state: "cancelled",
              lease_id: null,
              leased_until: null,
            });
          },
        });
        result.jobs++;
      } catch (e) {
        result.errors++;
        await update({
          state: job.attempts >= 6 ? "failed" : "pending",
          last_error:
            e instanceof MailError ? e.message : "Verarbeitung fehlgeschlagen.",
          lease_id: null,
          leased_until: null,
          available_at: retryAt(
            job.attempts,
            Date.now(),
            e instanceof MailError && e.status === 429 ? 3600 : undefined,
          ),
        });
      }
    }
  }
  return result;
}
