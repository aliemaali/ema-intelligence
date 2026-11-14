import { mailAdmin } from "./server";
import { getMicrosoftAccessToken } from "@/lib/microsoft/session";
import { canUseMail, isMailEnabled, draftSchema, mailboxRoot } from "./model";
import { assertSignatureSender, digest, graphMessage } from "./security";
import { deliverMessage } from "./deliver";
import { MailError, mailGraph } from "./graph";
async function access(userId: string, mailbox: string, sending: boolean) {
  const db = mailAdmin();
  const { data: profile, error } = await db
    .from("profiles")
    .select("role,is_active")
    .eq("id", userId)
    .maybeSingle();
  if (error || !canUseMail(profile))
    throw new MailError(403, "Mitarbeiterzugriff entzogen.");
  if (mailbox !== "me") {
    const { data: rights, error } = await db
      .from("ema_mail_memberships")
      .select("can_read,can_write,can_send")
      .eq("user_id", userId)
      .eq("mailbox", mailbox)
      .maybeSingle();
    if (error || !rights?.can_read || (sending && !rights?.can_send))
      throw new MailError(403, "Postfachrecht entzogen.");
  }
  const { data: connection, error: connectionError } = await db
    .from("microsoft_connections")
    .select("microsoft_email")
    .eq("user_id", userId)
    .maybeSingle();
  if (connectionError || !connection?.microsoft_email)
    throw new MailError(409, "Microsoft-Verbindung fehlt.");
  const token = await getMicrosoftAccessToken(userId);
  if (!token) throw new MailError(409, "Microsoft-Verbindung fehlt.");
  return {
    token,
    address:
      mailbox === "me" ? connection.microsoft_email.toLowerCase() : mailbox,
  };
}
async function checked(query: PromiseLike<{ error: unknown }>) {
  const r = await query;
  if (r.error) throw new MailError(503, "Auftragsstatus nicht gespeichert.");
}
export async function runApprovedDispatch() {
  if (
    !isMailEnabled() ||
    process.env.EMA_MAIL_SCHEDULED_SEND_ENABLED !== "true"
  )
    throw new MailError(503, "Geplanter Versand ist nicht aktiviert.");
  const db = mailAdmin(),
    deadline = Date.now() + 50000;
  let scheduled = 0,
    followups = 0;
  // Claimed work is never automatically retried after a crash.
  await checked(
    db
      .from("ema_mail_scheduled")
      .update({
        state: "uncertain",
        last_error:
          "Abgebrochener Versandlauf. Gesendet-Ordner manuell prüfen.",
      })
      .eq("state", "sending")
      .lt("claimed_at", new Date(Date.now() - 10 * 60000).toISOString()),
  );
  await checked(
    db
      .from("ema_mail_followups")
      .update({
        state: "blocked",
        last_error: "Antwortprüfung unterbrochen. Bitte manuell prüfen.",
      })
      .eq("state", "checking")
      .lt("claimed_at", new Date(Date.now() - 10 * 60000).toISOString()),
  );
  const claimed = await db.rpc("ema_mail_claim_scheduled");
  if (claimed.error)
    throw new MailError(503, "Versandwarteschlange nicht verfügbar.");
  const job = claimed.data?.[0];
  if (job) {
    let started = false;
    let finalState = "blocked";
    try {
      const payload = draftSchema.parse(job.payload);
      if (
        payload.mailbox !== job.mailbox ||
        digest(payload) !== job.content_hash ||
        payload.scheduledAt !== new Date(job.run_at).toISOString()
      )
        throw new MailError(409, "Freigegebener Inhalt oder Termin verändert.");
      if (
        Date.parse(job.run_at) > Date.now() ||
        Date.now() - Date.parse(job.run_at) > 86400000
      )
        throw new MailError(
          409,
          "Versandtermin nicht gültig oder länger als 24 Stunden überschritten.",
        );
      const connection = await access(job.user_id, job.mailbox, true);
      assertSignatureSender(payload, connection.address);
      const message = graphMessage(payload, job.draft_id); // Validate image bytes before crossing the send boundary.
      const { data: draft, error } = await db
        .from("ema_mail_drafts")
        .update({ status: "sending" })
        .eq("id", job.draft_id)
        .eq("user_id", job.user_id)
        .eq("status", "scheduled")
        .eq("content_hash", job.content_hash)
        .select("id")
        .maybeSingle();
      if (error || !draft)
        throw new MailError(409, "Entwurf nicht mehr zum Versand freigegeben.");
      started = true;
      await deliverMessage(
        payload,
        message,
        connection.token,
        async (providerId) => {
          await checked(
            db
              .from("ema_mail_drafts")
              .update({ provider_draft_id: providerId })
              .eq("id", job.draft_id)
              .eq("user_id", job.user_id)
              .eq("status", "sending"),
          );
        },
        async () => {
          const current = await access(job.user_id, job.mailbox, true);
          assertSignatureSender(payload, current.address);
          if (payload.replyToMessageId && job.mailbox !== "me") {
            const { data } = await db
              .from("ema_mail_memberships")
              .select("can_write")
              .eq("user_id", job.user_id)
              .eq("mailbox", job.mailbox)
              .maybeSingle();
            if (!data?.can_write)
              throw new MailError(403, "Antwortrecht entzogen.");
          }
        },
        deadline,
      );
      finalState = "submitted";
      scheduled++;
    } catch (e) {
      finalState = started ? "uncertain" : "blocked";
      await checked(
        db
          .from("ema_mail_scheduled")
          .update({
            last_error:
              e instanceof MailError ? e.message : "Versandstatus prüfen.",
          })
          .eq("id", job.id)
          .eq("state", "sending"),
      );
    }
    await checked(
      db
        .from("ema_mail_scheduled")
        .update({ state: finalState })
        .eq("id", job.id)
        .eq("state", "sending"),
    );
    if (started)
      await checked(
        db
          .from("ema_mail_drafts")
          .update({ status: finalState })
          .eq("id", job.draft_id)
          .eq("user_id", job.user_id)
          .eq("status", "sending"),
      );
  }
  if (Date.now() < deadline - 18000) {
    const result = await db.rpc("ema_mail_claim_followup");
    if (result.error)
      throw new MailError(503, "Wiedervorlagen nicht verfügbar.");
    const watch = result.data?.[0];
    if (watch) {
      try {
        const connection = await access(watch.user_id, watch.mailbox, false),
          root = mailboxRoot(watch.mailbox);
        const filter = `conversationId eq '${String(watch.conversation_id).replace(/'/g, "''")}' and receivedDateTime gt ${new Date(watch.reference_at).toISOString()}`;
        const page = await mailGraph<{
          value: { id: string; from?: { emailAddress: { address: string } } }[];
          "@odata.nextLink"?: string;
        }>(
          connection.token,
          `${root}/messages?${new URLSearchParams({ $filter: filter, $select: "id,from", $top: "100" })}`,
          {
            signal: AbortSignal.timeout(
              Math.min(15000, deadline - Date.now() - 2000),
            ),
          },
          root,
        );
        await access(watch.user_id, watch.mailbox, false);
        const answered = page.value.some(
          (m) =>
            m.id !== watch.message_id &&
            watch.expected_repliers.includes(
              m.from?.emailAddress.address.toLowerCase(),
            ),
        );
        if (!answered && page["@odata.nextLink"])
          throw new MailError(
            409,
            "Großer Gesprächsverlauf. Antwortstatus manuell prüfen.",
          );
        let reminderId = null;
        if (!answered) {
          const { data, error } = await db
            .from("ema_reminders")
            .insert({
              user_id: watch.user_id,
              title: watch.title,
              notes: `Keine passende Antwort im Gespräch erkannt. /mail?${new URLSearchParams({ mailbox: watch.mailbox, message: watch.message_id })}`,
              due_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (error || !data)
            throw new MailError(503, "Erinnerung nicht gespeichert.");
          reminderId = data.id;
        }
        await checked(
          db
            .from("ema_mail_followups")
            .update({
              state: answered ? "answered" : "reminded",
              reminder_id: reminderId,
            })
            .eq("id", watch.id)
            .eq("state", "checking"),
        );
        followups++;
      } catch (e) {
        await checked(
          db
            .from("ema_mail_followups")
            .update({
              state: "blocked",
              last_error:
                e instanceof MailError
                  ? e.message
                  : "Antwortstatus bitte manuell prüfen.",
            })
            .eq("id", watch.id)
            .eq("state", "checking"),
        );
      }
    }
  }
  return { scheduled, followups };
}
