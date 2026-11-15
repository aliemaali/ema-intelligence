import { safePushEndpoint } from "@/lib/mail/push";
import { sealDeltaCursor, openDeltaCursor } from "@/lib/mail/delta-cursor";
import { productivityEndpoint, visibleProject } from "@/lib/mail/extensions";
import { deliverMessage } from "@/lib/mail/deliver";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import {
  mailAdmin,
  mailSession,
  mailSenderAddress,
  mailboxAccess,
  audit,
} from "@/lib/mail/server";
import {
  draftSchema,
  folders,
  mailboxRoot,
  type Message,
  type Attachment,
} from "@/lib/mail/model";
import {
  MailError,
  mailGraph,
  messagePath,
  safeGraphUrl,
} from "@/lib/mail/graph";
import {
  assertOrigin,
  assertSignatureSender,
  digest,
  newApproval,
  submitApprovedDraft,
  tokenHash,
} from "@/lib/mail/security";
import { validateStoredAttachment } from "@/lib/mail/attachments";
import {
  contactSchema,
  eventSchema,
  graphContact,
  graphEvent,
  assertPimConfirmation,
  resourceId,
} from "@/lib/mail/pim";
import { analyzeMessage } from "@/lib/mail/analysis";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const idSchema = z.string().min(1).max(1500);
const uuid = z.string().uuid();
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
async function handle(request: NextRequest) {
  try {
    const session = await mailSession();
    const action = request.nextUrl.pathname.replace(/^\/api\/mail\//, "");
    const mutating = request.method === "POST";
    if (mutating) assertOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > 4_000_000)
      throw new MailError(413, "Nachricht zu groß.");
    let input: Record<string, unknown> = {};
    if (mutating) {
      const text = await request.text();
      if (text.length > 4_000_000)
        throw new MailError(413, "Nachricht zu groß.");
      input = JSON.parse(text);
    }
    const admin = mailAdmin();
    // Explicit connection test: fixed fictional input only; no mailbox access.
    if (action === "analyze-test") {
      if (!mutating)
        throw new MailError(
          405,
          "Den KI-Test bitte über die Testseite starten.",
        );
      const { data: allowed, error } = await admin.rpc(
        "ema_mail_claim_analysis",
        { p_user_id: session.user.id, p_limit: 20 },
      );
      if (error) throw new MailError(503, "Analyse-Limit nicht verfügbar.");
      if (allowed !== true)
        throw new MailError(
          429,
          "Maximal 20 neue Analysen pro Stunde. Bitte später versuchen.",
        );
      const analysis = await analyzeMessage({
        id: "fictional-connection-test",
        subject: "Fiktiver Test: Projektgespräch abstimmen",
        from: {
          emailAddress: {
            address: "demo@example.com",
            name: "Fiktiver Absender",
          },
        },
        bodyPreview:
          "Guten Tag, können wir am Dienstag um 10:00 Uhr ein Projektgespräch führen? Die Unterlagen sind noch zu prüfen. Viele Grüße. Dies ist eine fiktive Testnachricht.",
        receivedDateTime: "2026-01-01T09:00:00Z",
        isRead: true,
        hasAttachments: false,
      });
      return json({ analysis, test: true });
    }
    const extension = await productivityEndpoint(
      request,
      action,
      input,
      session,
    );
    if (extension) return extension;
    if (action === "badge" && !mutating) {
      const { data, error } = await admin
        .from("ema_mail_memberships")
        .select("mailbox")
        .eq("user_id", session.user.id)
        .eq("can_read", true);
      if (error) throw new MailError(503, "Postfachrechte nicht verfügbar.");
      const own = await mailSenderAddress(session, "me");
      const boxes = [
        "me",
        ...new Set(
          (data || [])
            .map((row) => String(row.mailbox))
            .filter((box) => box !== own),
        ),
      ];
      if (boxes.length > 50)
        throw new MailError(503, "Zu viele Postfächer für den Badge-Abgleich.");
      let count = 0;
      // All-or-nothing: never replace a correct badge with a partial mailbox count.
      for (let i = 0; i < boxes.length; i += 5) {
        const counts = await Promise.all(
          boxes.slice(i, i + 5).map(async (box) => {
            const access = await mailboxAccess(session, box);
            const folder = await mailGraph<{ unreadItemCount: number }>(
              access.token,
              `${mailboxRoot(access.mailbox)}/mailFolders/inbox?$select=unreadItemCount`,
            );
            if (
              !Number.isSafeInteger(folder.unreadItemCount) ||
              folder.unreadItemCount < 0
            )
              throw new MailError(502, "Ungültiger Ungelesen-Zähler.");
            return folder.unreadItemCount;
          }),
        );
        count += counts.reduce((a, b) => a + b, 0);
      }
      return json({ count });
    }
    if (action === "push-subscription" && mutating) {
      const subscription = z
        .object({
          endpoint: z.string().max(2048),
          keys: z
            .object({
              p256dh: z.string().min(1).max(256),
              auth: z.string().min(1).max(256),
            })
            .strict(),
        })
        .strict()
        .parse(input);
      if (!safePushEndpoint(subscription.endpoint))
        throw new MailError(400, "Ungültiger Push-Dienst.");
      const { error } = await admin.from("ema_push_subscriptions").upsert(
        {
          user_id: session.user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
          device_label: "EMA Mail · Home-Bildschirm",
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" },
      );
      if (error)
        throw new MailError(503, "Push-Gerät konnte nicht gespeichert werden.");
      return json({ ok: true });
    }
    if (action === "team" || action === "memberships") {
      const { data: profile } = await session.db
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!profile || !["admin", "owner"].includes(profile.role))
        throw new MailError(
          403,
          "Nur Administratoren verwalten Postfachrechte.",
        );
      if (action === "team" && !mutating) {
        const [people, rights] = await Promise.all([
          admin
            .from("profiles")
            .select("id,full_name,email,role,is_active")
            .eq("is_active", true),
          admin
            .from("ema_mail_memberships")
            .select("user_id,mailbox,can_read,can_write,can_send"),
        ]);
        if (people.error || rights.error)
          throw new MailError(503, "Teamrechte nicht verfügbar.");
        return json({ people: people.data, memberships: rights.data });
      }
      if (action === "memberships" && mutating) {
        const values = z
          .object({
            userId: z.string().uuid(),
            mailbox: z
              .string()
              .email()
              .max(254)
              .transform((v) => v.toLowerCase()),
            canRead: z.boolean(),
            canWrite: z.boolean(),
            canSend: z.boolean(),
          })
          .strict()
          .parse(input);
        const { data: target } = await admin
          .from("profiles")
          .select("role,is_active")
          .eq("id", values.userId)
          .maybeSingle();
        if (
          !target ||
          target.is_active !== true ||
          !["owner", "admin", "manager", "employee", "user", "staff"].includes(
            target.role,
          )
        )
          throw new MailError(400, "Kein aktiver interner Mitarbeiter.");
        if (!values.canRead && (values.canWrite || values.canSend))
          throw new MailError(
            400,
            "Bearbeiten und Senden erfordern Leserechte.",
          );
        await audit(
          session.user.id,
          "mailbox_membership_changed",
          values.userId,
        );
        const { error } = await admin.from("ema_mail_memberships").upsert(
          {
            user_id: values.userId,
            mailbox: values.mailbox,
            can_read: values.canRead,
            can_write: values.canWrite,
            can_send: values.canSend,
          },
          { onConflict: "user_id,mailbox" },
        );
        if (error)
          throw new MailError(
            503,
            "Postfachrechte konnten nicht gespeichert werden.",
          );
        return json({ ok: true });
      }
      throw new MailError(405, "Methode nicht erlaubt.");
    }
    if (action === "mailboxes" && !mutating) {
      const { data, error } = await admin
        .from("ema_mail_memberships")
        .select("mailbox,can_read,can_write,can_send")
        .eq("user_id", session.user.id)
        .eq("can_read", true);
      if (error)
        throw new MailError(
          503,
          "Mail-Datenbankschema noch nicht eingerichtet.",
        );
      const senderAddress = await mailSenderAddress(session, "me");
      const settings = await admin
        .from("ema_mail_user_settings")
        .select("mailbox,signature_text")
        .eq("user_id", session.user.id);
      if (settings.error)
        throw new MailError(503, "Mail-Einstellungen noch nicht eingerichtet.");
      const signature = (box: string) =>
        (settings.data || []).find((s) => s.mailbox === box)?.signature_text ||
        "";
      const displayName = (address: string) => ({
        "tuba.unluer@ema-enterprise.de": "Tuba",
        "unluer@ema-enterprise.de": "Ali",
        "info@ema-enterprise.de": "info",
      } as Record<string, string>)[address.toLowerCase()] || address;
      return json({
        cacheOwner: session.user.id,
        mailboxes: [
          {
            mailbox: "me",
            name: displayName(senderAddress),
            address: senderAddress,
            signatureText: signature("me"),
            can_read: true,
            can_write: true,
            can_send: true,
          },
          ...(data || []).map((a) => ({
            ...a,
            name: displayName(a.mailbox),
            address: a.mailbox,
            signatureText: signature(a.mailbox),
          })),
        ],
      });
    }
    if (action === "automation") {
      if (!mutating) {
        const { data, error } = await admin
          .from("ema_mail_sync")
          .select("mailbox,enabled,analyze,push,last_success_at,last_error")
          .eq("user_id", session.user.id);
        const { data: jobs, error: jobError } = await admin
          .from("ema_mail_jobs")
          .select("id,mailbox,state,push_state,last_error,created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(20);
        if (error || jobError)
          throw new MailError(
            503,
            "Automatisierungsschema noch nicht eingerichtet.",
          );
        return json({
          settings: data,
          jobs,
          workerConfigured: process.env.EMA_MAIL_WORKER_ENABLED === "true",
        });
      }
      const values = z
        .object({
          mailbox: z.string().default("me"),
          enabled: z.boolean(),
          analyze: z.boolean(),
          push: z.boolean(),
        })
        .strict()
        .parse(input);
      const { mailbox } = await mailboxAccess(session, values.mailbox);
      // Invalidate any in-flight lease. A stale worker cannot overwrite this choice.
      const { data: existing } = await admin
        .from("ema_mail_sync")
        .select("enabled")
        .eq("user_id", session.user.id)
        .eq("mailbox", mailbox)
        .maybeSingle();
      const patch = {
        user_id: session.user.id,
        mailbox,
        enabled: values.enabled,
        analyze: values.analyze,
        push: values.push,
        lease_id: null,
        leased_until: null,
        next_run_at: new Date().toISOString(),
        ...(!existing?.enabled && values.enabled
          ? { enabled_since: new Date().toISOString(), cursor: null }
          : {}),
      };
      await audit(session.user.id, "automation_settings_changed");
      const { error } = await admin
        .from("ema_mail_sync")
        .upsert(patch, { onConflict: "user_id,mailbox" });
      if (error)
        throw new MailError(
          503,
          "Automatisierung konnte nicht gespeichert werden.",
        );
      if (!values.enabled) {
        const { error: cancelError } = await admin
          .from("ema_mail_jobs")
          .update({ state: "cancelled", lease_id: null, leased_until: null })
          .eq("user_id", session.user.id)
          .eq("mailbox", mailbox)
          .in("state", ["pending", "processing"]);
        if (cancelError)
          throw new MailError(
            503,
            "Abgeschaltet; Warteschlangenstatus bitte prüfen.",
          );
      }
      return json({ ok: true });
    }
    if (action === "drafts" && !mutating) {
      const { data, error } = await admin
        .from("ema_mail_drafts")
        .select("id,payload,content_hash,status,updated_at")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw new MailError(503, "Entwürfe nicht verfügbar.");
      return json({ drafts: data });
    }
    if (action === "draft-delete" && mutating) {
      const { id } = z.object({ id: uuid }).strict().parse(input);
      // These are the caller's private EMA drafts, not Microsoft mailbox items.
      // The status predicate is also the atomic guard against concurrent sending.
      const { data: draft, error: readError } = await admin.from('ema_mail_drafts')
        .select('id,status').eq('id', id).eq('user_id', session.user.id).maybeSingle();
      if (readError) throw new MailError(503, 'Entwurf konnte nicht geprüft werden.');
      if (!draft) throw new MailError(404, 'Entwurf nicht gefunden.');
      if (!['draft','approved'].includes(draft.status)) throw new MailError(409, 'Dieser Entwurf ist bereits im Versand und kann nicht gelöscht werden.');
      await audit(session.user.id, 'draft_delete_requested', id);
      const { data: deleted, error } = await admin.from('ema_mail_drafts').delete()
        .eq('id', id).eq('user_id', session.user.id).in('status', ['draft','approved'])
        .select('id').maybeSingle();
      if (error) throw new MailError(503, 'Entwurf konnte nicht gelöscht werden.');
      if (!deleted) throw new MailError(409, 'Der Entwurf wurde inzwischen geändert. Bitte die Liste aktualisieren.');
      return json({ ok: true, id });
    }
    if (action === "drafts" && mutating) {
      const payload = draftSchema.parse(input.payload);
      await mailboxAccess(session, payload.mailbox, "send");
      assertSignatureSender(
        payload,
        await mailSenderAddress(session, payload.mailbox),
      );
      const values = {
        payload,
        content_hash: digest(payload),
        status: "draft",
        approval_hash: null,
        approval_expires_at: null,
        updated_at: new Date().toISOString(),
      };
      const query = input.id
        ? admin
            .from("ema_mail_drafts")
            .update(values)
            .eq("id", uuid.parse(input.id))
            .eq("user_id", session.user.id)
            .in("status", ["draft", "approved"])
        : admin
            .from("ema_mail_drafts")
            .insert({ ...values, user_id: session.user.id });
      const { data, error } = await query
        .select("id,content_hash,status")
        .single();
      if (error || !data)
        throw new MailError(
          409,
          "Entwurf konnte nicht gespeichert werden. Möglicherweise wurde er bereits versendet.",
        );
      return json(data, 201);
    }
    if ((action === "approve" || action === "send") && mutating) {
      const id = uuid.parse(input.id);
      const { data: draft, error } = await admin
        .from("ema_mail_drafts")
        .select("*")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .single();
      if (error || !draft) throw new MailError(404, "Entwurf nicht gefunden.");
      const payload = draftSchema.parse(draft.payload);
      const { token } = await mailboxAccess(session, payload.mailbox, "send");
      assertSignatureSender(
        payload,
        await mailSenderAddress(session, payload.mailbox),
      );
      if (draft.content_hash !== digest(payload))
        throw new MailError(409, "Entwurf wurde verändert.");
      if (payload.scheduledAt)
        throw new MailError(
          409,
          "Geplanten Versand bitte ausdrücklich zum Termin freigeben.",
        );
      if (action === "approve") {
        if (
          input.contentHash !== draft.content_hash ||
          input.confirmed !== true ||
          !["draft", "approved"].includes(draft.status)
        )
          throw new MailError(
            409,
            "Bitte exakt diesen Entwurf prüfen und freigeben.",
          );
        const approval = newApproval();
        await audit(session.user.id, "draft_approval_requested", id);
        const { data, error } = await admin
          .from("ema_mail_drafts")
          .update({
            status: "approved",
            approval_hash: approval.hash,
            approval_expires_at: approval.expires,
          })
          .eq("id", id)
          .eq("user_id", session.user.id)
          .eq("content_hash", draft.content_hash)
          .in("status", ["draft", "approved"])
          .select("id")
          .maybeSingle();
        if (error || !data)
          throw new MailError(409, "Entwurf wurde zwischenzeitlich verändert.");
        return json({
          id,
          approvalToken: approval.token,
          expiresAt: approval.expires,
        });
      }
      const approvalToken = z
        .string()
        .regex(/^[A-Za-z0-9_-]{43}$/)
        .parse(input.approvalToken);
      const { data: claimed, error: claimError } = await admin
        .from("ema_mail_drafts")
        .update({
          status: "sending",
          approval_hash: null,
          approval_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", session.user.id)
        .eq("content_hash", draft.content_hash)
        .eq("status", "approved")
        .eq("approval_hash", tokenHash(approvalToken))
        .gt("approval_expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();
      if (claimError || !claimed)
        throw new MailError(
          409,
          "Freigabe abgelaufen, verändert oder bereits verwendet.",
        );
      // Durable claim itself is the audit trail. Any crash from here leaves sending,
      // never draft/approved: reconcile against Sent Items before another attempt.
      const result = await submitApprovedDraft(
        payload,
        id,
        async (message) =>
          deliverMessage(
            payload,
            message,
            token,
            async (providerId) => {
              const { error } = await admin
                .from("ema_mail_drafts")
                .update({ provider_draft_id: providerId })
                .eq("id", id)
                .eq("user_id", session.user.id)
                .eq("status", "sending");
              if (error)
                throw new MailError(503, "Antwortentwurf nicht protokolliert.");
            },
            async () => {
              await mailboxAccess(
                session,
                payload.mailbox,
                payload.replyToMessageId ? "write" : "send",
              );
              await mailboxAccess(session, payload.mailbox, "send");
              assertSignatureSender(
                payload,
                await mailSenderAddress(session, payload.mailbox),
              );
            },
          ),
        async (status) => {
          const { error } = await admin
            .from("ema_mail_drafts")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("user_id", session.user.id)
            .eq("status", "sending");
          if (error)
            throw new MailError(
              409,
              "Versandstatus konnte nicht gespeichert werden. Gesendet-Ordner prüfen; nicht erneut senden.",
            );
        },
      );
      return json(result);
    }
    if (
      ["calendar", "contacts", "reminder-action"].includes(action) &&
      mutating
    ) {
      assertPimConfirmation(input.confirmed);
      if (action === "reminder-action") {
        const id = uuid.parse(input.id),
          complete = z.boolean().parse(input.complete);
        const { data, error } = await session.db
          .from("ema_reminders")
          .update({ completed_at: complete ? new Date().toISOString() : null })
          .eq("id", id)
          .eq("user_id", session.user.id)
          .select("id")
          .maybeSingle();
        if (error || !data) throw new MailError(404, "Aufgabe nicht gefunden.");
        return json({ ok: true });
      }
      // PIM uses the current user's connection; never use a client-supplied Graph URL.
      const { token } = await mailboxAccess(session, "me");
      const operation = z
        .enum(["create", "update", "delete"])
        .parse(input.operation);
      const collection = action === "calendar" ? "events" : "contacts";
      const path =
        operation === "create"
          ? `/me/${collection}`
          : `/me/${collection}/${encodeURIComponent(resourceId.parse(input.id))}`;
      let payload: unknown;
      if (operation !== "delete")
        payload =
          action === "calendar"
            ? graphEvent(
                eventSchema.parse(input.value),
                operation === "create"
                  ? uuid.parse(input.requestId)
                  : undefined,
              )
            : graphContact(contactSchema.parse(input.value));
      if (operation === "update") {
        if (action === "contacts") {
          const existing = await mailGraph<{
            emailAddresses?: { address: string }[];
            businessPhones?: string[];
          }>(token, path, {}, "/me");
          const next = payload as ReturnType<typeof graphContact>;
          next.emailAddresses = [
            ...next.emailAddresses,
            ...(existing.emailAddresses || []).slice(1),
          ];
          next.businessPhones = [
            ...next.businessPhones,
            ...(existing.businessPhones || []).slice(1),
          ];
        } else {
          const event = await mailGraph<{
            isOrganizer?: boolean;
            isOnlineMeeting?: boolean;
            isAllDay?: boolean;
            onlineMeetingProvider?: string;
            attendees?: { emailAddress: { address: string }; type: string }[];
          }>(
            token,
            `${path}?$select=isOrganizer,isOnlineMeeting,isAllDay,onlineMeetingProvider,attendees`,
            {},
            "/me",
          );
          if (event.isOrganizer !== true)
            throw new MailError(
              403,
              "Nur der Organisator kann diesen Termin bearbeiten.",
            );
          const next = payload as ReturnType<typeof graphEvent>;
          // Keep all-day boundaries in their original Exchange time zone.
          if (event.isAllDay) {
            delete (next as Partial<typeof next>).start;
            delete (next as Partial<typeof next>).end;
          }
          if (event.isOnlineMeeting) {
            if (
              next.isOnlineMeeting &&
              event.onlineMeetingProvider &&
              event.onlineMeetingProvider !== "teamsForBusiness"
            )
              throw new MailError(
                409,
                "Der Onlineanbieter eines bestehenden Meetings kann nicht geändert werden.",
              );
            // Graph keeps the original join link/body and cannot disable an online meeting.
            delete (next as Partial<typeof next>).body;
            delete next.isOnlineMeeting;
            delete next.onlineMeetingProvider;
          }
          next.attendees = next.attendees.map((a) => ({
            ...a,
            type:
              event.attendees?.find(
                (old) =>
                  old.emailAddress.address.toLowerCase() ===
                  a.emailAddress.address.toLowerCase(),
              )?.type || a.type,
          }));
        }
      }
      if (
        action === "calendar" &&
        (payload as ReturnType<typeof graphEvent> | undefined)?.isOnlineMeeting
      ) {
        const calendar = await mailGraph<{
          allowedOnlineMeetingProviders?: string[];
        }>(
          token,
          "/me/calendar?$select=allowedOnlineMeetingProviders",
          {},
          "/me",
        );
        if (
          !calendar.allowedOnlineMeetingProviders?.includes("teamsForBusiness")
        )
          throw new MailError(
            409,
            "Microsoft Teams ist für diesen Microsoft-365-Kalender nicht freigeschaltet. Bitte Teams-Lizenz und Besprechungsrichtlinie prüfen.",
          );
      }
      // Do not blindly retry creates or changes which may generate invitations.
      await audit(session.user.id, `${collection}_${operation}_requested`);
      const result = await mailGraph(
        token,
        path,
        {
          method:
            operation === "create"
              ? "POST"
              : operation === "delete"
                ? "DELETE"
                : "PATCH",
          ...(payload ? { body: JSON.stringify(payload) } : {}),
        },
        "/me",
      );
      return json({ ok: true, item: result });
    }
    const permission =
      mutating && action === "message-action" ? "write" : "read";
    const { mailbox, token } = await mailboxAccess(
      session,
      mutating
        ? input.mailbox
        : request.nextUrl.searchParams.get("mailbox") || "me",
      permission,
    );
    const root = mailboxRoot(mailbox);
    if (action === "dashboard-stats" && !mutating) {
      const [inbox, drafts] = await Promise.all([
        mailGraph<{ unreadItemCount: number }>(
          token,
          `${root}/mailFolders/inbox?$select=unreadItemCount`,
        ),
        admin.from("ema_mail_drafts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .eq("payload->>mailbox", mailbox)
          .in("status", ["draft", "approved"]),
      ]);
      if (!Number.isSafeInteger(inbox.unreadItemCount) || inbox.unreadItemCount < 0)
        throw new MailError(502, "Ungelesen-Zähler derzeit nicht verfügbar.");
      if (drafts.error || !Number.isSafeInteger(drafts.count) || (drafts.count ?? -1) < 0)
        throw new MailError(503, "Entwurfszähler derzeit nicht verfügbar.");
      return json({ unread: inbox.unreadItemCount, drafts: drafts.count });
    }
    if (action === "message-delta" && !mutating) {
      const folder = request.nextUrl.searchParams.get("folder") || "inbox";
      if (!folders.some(f => f.id === folder) || folder === 'drafts') throw new MailError(400, "Ungültiger Ordner.");
      const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Server-only; already required by mailAdmin.
      const scope = JSON.stringify([session.user.id, mailbox, folder]);
      const cursor = request.nextUrl.searchParams.get('cursor');
      let path: string;
      if (cursor) {
        try {
          // Microsoft can canonicalize /me or a mailbox address to /users/{id}.
          // Only server-signed URLs from a previous authorized Graph response may use that alias.
          const url = new URL(safeGraphUrl(openDeltaCursor(cursor, scope, secret)));
          if (!/^\/v1\.0\/(?:me|users\/[^/]+)\/mailFolders\/[^/]+\/messages\/delta$/.test(url.pathname)) throw new Error('Invalid delta path');
          path = url.href;
        } catch { throw new MailError(400, 'Ungültiger Abgleichsstand.'); }
      } else {
        const query = new URLSearchParams({
          $top: '100', $orderby: 'receivedDateTime desc',
          $select: 'id,subject,bodyPreview,receivedDateTime,isRead,from,toRecipients,ccRecipients,importance,hasAttachments,flag,conversationId,replyTo',
        });
        path = `${root}/mailFolders/${folder}/messages/delta?${query}`;
      }
      const result = await mailGraph<{ value: (Partial<Message> & { id: string; '@removed'?: { reason?: string } })[]; '@odata.nextLink'?: string; '@odata.deltaLink'?: string }>(token, path);
      const continuation = (link: string | undefined) => {
        if (!link) return null;
        const url = new URL(safeGraphUrl(link));
        if (!/^\/v1\.0\/(?:me|users\/[^/]+)\/mailFolders\/[^/]+\/messages\/delta$/.test(url.pathname)) throw new MailError(502, 'Ungültige Microsoft-Abgleichsseite.');
        return sealDeltaCursor(url.href, scope, secret);
      };
      return json({
        changes: result.value || [],
        next: continuation(result['@odata.nextLink']),
        delta: continuation(result['@odata.deltaLink']),
      });
    }
    if (action === "messages" && !mutating) {
      const folder = request.nextUrl.searchParams.get("folder") || "inbox";
      if (!folders.some((f) => f.id === folder))
        throw new MailError(400, "Ungültiger Ordner.");
      const base = `${root}/mailFolders/${folder}/messages`;
      const cursor = request.nextUrl.searchParams.get("cursor");
      const q = (request.nextUrl.searchParams.get('q') || '').trim();
      if (q.length > 180) throw new MailError(400, 'Suchtext zu lang.');
      const pageScope = JSON.stringify([session.user.id, mailbox, folder, 'messages', q]);
      const pageSecret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      let path: string;
      if (cursor) {
        try {
          if (cursor.startsWith('https://')) {
            // Compatibility for older clients: unsigned links retain the exact mailbox/folder guard.
            const url = new URL(safeGraphUrl(cursor, root));
            if (url.pathname !== `/v1.0${base}`) throw new Error('Invalid legacy page');
            path = url.href;
          } else {
            const url = new URL(safeGraphUrl(openDeltaCursor(cursor, pageScope, pageSecret)));
            if (!/^\/v1\.0\/(?:me|users\/[^/]+)\/mailFolders\/[^/]+\/messages$/.test(url.pathname)) throw new Error('Invalid message page');
            path = url.href;
          }
        } catch { throw new MailError(400, 'Ungültige oder veraltete Postfachseite. Bitte den Posteingang aktualisieren.'); }
      } else {
        const params = new URLSearchParams({
          $top: "30",
          $select:
            "id,subject,bodyPreview,receivedDateTime,isRead,from,toRecipients,ccRecipients,importance,hasAttachments,flag,conversationId,replyTo",
        });
        if (q) {
          if (q.length > 180) throw new MailError(400, "Suchtext zu lang.");
          params.set("$search", `"${q.replace(/["\\\r\n]/g, " ")}"`);
        } else params.set("$orderby", "receivedDateTime desc");
        path = `${base}?${params}`;
      }
      const result = await mailGraph<{
        value: Message[];
        "@odata.nextLink"?: string;
      }>(token, path);
      const ids = (result.value ?? []).map((m) => m.id);
      const { data: insights } = ids.length
        ? await admin
            .from("ema_mail_insights")
            .select("message_id,result")
            .eq("user_id", session.user.id)
            .eq("mailbox", mailbox)
            .in("message_id", ids)
        : { data: [] };
      const mapped = (result.value ?? []).map((m) => ({
        ...m,
        emaAnalysis:
          insights?.find((i) => i.message_id === m.id)?.result ?? null,
      }));
      let nextPage: string | null = null;
      if (result['@odata.nextLink']) {
        const url = new URL(safeGraphUrl(result['@odata.nextLink']!));
        if (!/^\/v1\.0\/(?:me|users\/[^/]+)\/mailFolders\/[^/]+\/messages$/.test(url.pathname)) throw new MailError(502, 'Ungültige Microsoft-Postfachseite.');
        nextPage = sealDeltaCursor(url.href, pageScope, pageSecret);
      }
      return json({
        messages: mapped,
        cursor: nextPage,
      });
    }
    if (action === "message" && !mutating) {
      const id = idSchema.parse(request.nextUrl.searchParams.get("id"));
      const message = await mailGraph<Message>(
        token,
        `${messagePath(mailbox, id)}?$select=id,subject,body,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,importance,hasAttachments,flag,conversationId,replyTo`,
        {},
        root,
        "html",
      );
      const { data: insight } = await admin
        .from("ema_mail_insights")
        .select("result")
        .eq("user_id", session.user.id)
        .eq("mailbox", mailbox)
        .eq("message_id", id)
        .maybeSingle();
      return json({ message, analysis: insight?.result ?? null });
    }
    if (action === "attachments" && !mutating) {
      const id = idSchema.parse(request.nextUrl.searchParams.get("id"));
      const result = await mailGraph<{ value: Attachment[] }>(
        token,
        `${messagePath(mailbox, id)}/attachments?$select=id,name,contentType,size,isInline`,
        {},
        root,
      );
      return json({ attachments: result.value ?? [] });
    }
    if (action === "attachment" && !mutating) {
      const id = idSchema.parse(request.nextUrl.searchParams.get("id")),
        attachmentId = idSchema.parse(
          request.nextUrl.searchParams.get("attachmentId"),
        );
      const attachment = await mailGraph<Attachment>(
        token,
        `${messagePath(mailbox, id)}/attachments/${encodeURIComponent(attachmentId)}`,
        {},
        root,
      );
      if (
        attachment["@odata.type"] !== "#microsoft.graph.fileAttachment" ||
        !attachment.contentBytes ||
        attachment.size > 15_000_000
      )
        throw new MailError(400, "Anhang nicht unterstützt oder zu groß.");
      return json({ attachment });
    }
    if (action === "message-action" && mutating) {
      const id = idSchema.parse(input.id),
        operation = z
          .enum(["read", "unread", "flag", "unflag", "archive", "trash"])
          .parse(input.operation);
      const path = messagePath(mailbox, id);
      if (operation === "archive" || operation === "trash")
        await mailGraph(
          token,
          `${path}/move`,
          {
            method: "POST",
            body: JSON.stringify({
              destinationId:
                operation === "archive" ? "archive" : "deleteditems",
            }),
          },
          root,
        );
      else
        await mailGraph(
          token,
          path,
          {
            method: "PATCH",
            body: JSON.stringify(
              operation === "read" || operation === "unread"
                ? { isRead: operation === "read" }
                : {
                    flag: {
                      flagStatus:
                        operation === "flag" ? "flagged" : "notFlagged",
                    },
                  },
            ),
          },
          root,
        );
      await audit(session.user.id, `message_${operation}`);
      return json({ ok: true });
    }
    if (action === "analyze" && mutating) {
      const id = idSchema.parse(input.id);
      const msg = await mailGraph<Message>(
        token,
        messagePath(mailbox, id),
        {},
        root,
      );
      const key = digest({ mailbox, id, body: msg.body, subject: msg.subject });
      const { data: cached } = await admin
        .from("ema_mail_analysis")
        .select("result")
        .eq("user_id", session.user.id)
        .eq("source_hash", key)
        .maybeSingle();
      if (cached) return json({ analysis: cached.result, cached: true });
      const { data: allowed, error: limitError } = await admin.rpc(
        "ema_mail_claim_analysis",
        { p_user_id: session.user.id, p_limit: 20 },
      );
      if (limitError)
        throw new MailError(503, "Analyse-Limit nicht verfügbar.");
      if (allowed !== true)
        throw new MailError(
          429,
          "Maximal 20 neue Analysen pro Stunde. Bitte später versuchen.",
        );
      const analysis = await analyzeMessage(msg);
      const { error } = await admin
        .from("ema_mail_analysis")
        .upsert(
          { user_id: session.user.id, source_hash: key, result: analysis },
          { onConflict: "user_id,source_hash" },
        );
      if (error)
        throw new MailError(503, "Analyse konnte nicht gespeichert werden.");
      const { error: insightError } = await admin
        .from("ema_mail_insights")
        .upsert(
          {
            user_id: session.user.id,
            mailbox,
            message_id: id,
            result: analysis,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,mailbox,message_id" },
        );
      if (insightError)
        throw new MailError(503, "Analyse konnte nicht zugeordnet werden.");
      return json({ analysis });
    }
    if (action === "dms" && mutating) {
      const id = idSchema.parse(input.id),
        attachmentId = idSchema.parse(input.attachmentId);
      const attachment = await mailGraph<Attachment>(
        token,
        `${messagePath(mailbox, id)}/attachments/${encodeURIComponent(attachmentId)}`,
        {},
        root,
      );
      if (
        attachment["@odata.type"] !== "#microsoft.graph.fileAttachment" ||
        !attachment.contentBytes ||
        !["application/pdf", "image/png", "image/jpeg"].includes(
          attachment.contentType,
        )
      )
        throw new MailError(
          400,
          "Nur PDF-, PNG- und JPEG-Dateianhänge können abgelegt werden.",
        );
      const bytes = Buffer.from(attachment.contentBytes, "base64");
      if (!bytes.length || bytes.length > 15_000_000)
        throw new MailError(413, "Anhang zu groß oder leer.");
      validateStoredAttachment(bytes, attachment.contentType);
      const project = input.projectId
        ? await visibleProject(session, input.projectId)
        : null;
      async function linkDocument(documentId: string) {
        if (!project) return;
        const { error } = await session.db.from("dms_document_links").upsert(
          {
            user_id: session.user.id,
            document_id: documentId,
            entity_type: "project",
            entity_id: project.id,
          },
          { onConflict: "document_id,entity_type,entity_id" },
        );
        if (error)
          throw new MailError(
            503,
            "Datei gespeichert; Projektzuordnung bitte erneut versuchen.",
          );
      }
      const hash = createHash("sha256").update(bytes).digest("hex");
      const { data: duplicate } = await session.db
        .from("documents")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("sha256", hash)
        .eq("is_archived", false)
        .maybeSingle();
      if (duplicate) {
        await linkDocument(duplicate.id);
        return json({ documentId: duplicate.id, duplicate: true });
      }
      const name =
        attachment.name.replace(/[\/\\\x00-\x1f]/g, "_").slice(0, 180) ||
        "Anhang.pdf";
      const path = `${session.user.id}/mail/${randomUUID()}/${name}`;
      const { error: uploadError } = await session.db.storage
        .from("ema-dms")
        .upload(path, bytes, {
          contentType: attachment.contentType,
          upsert: false,
        });
      if (uploadError)
        throw new MailError(502, "Anhang konnte nicht gespeichert werden.");
      const { data, error } = await session.db
        .from("documents")
        .insert({
          user_id: session.user.id,
          project_id: project?.id || null,
          display_name: name,
          file_name: name,
          file_path: path,
          file_size_bytes: bytes.length,
          mime_type: attachment.contentType,
          document_type: "sonstiges",
          storage_bucket: "ema-dms",
          source_app: "ema_intelligence",
          source_kind: "project",
          sha256: hash,
          analysis_status: "not_started",
        })
        .select("id")
        .single();
      if (error) {
        await session.db.storage.from("ema-dms").remove([path]);
        throw new MailError(
          409,
          "DMS-Registrierung fehlgeschlagen; bitte Dubletten prüfen.",
        );
      }
      await linkDocument(data.id);
      return json({ documentId: data.id });
    }
    if (action === "reminders" && !mutating) {
      let query = session.db
        .from("ema_reminders")
        .select("id,title,notes,due_at,completed_at")
        .eq("user_id", session.user.id)
        .order("due_at")
        .limit(100);
      if (request.nextUrl.searchParams.get("includeCompleted") !== "1")
        query = query.is("completed_at", null);
      const { data, error } = await query;
      if (error)
        throw new MailError(502, "Aufgaben konnten nicht geladen werden.");
      return json({ reminders: data });
    }
    if (action === "reminders" && mutating) {
      const title = z.string().trim().min(1).max(200).parse(input.title),
        dueAt = z.string().datetime({ offset: true }).parse(input.dueAt);
      const { data, error } = await session.db
        .from("ema_reminders")
        .insert({
          user_id: session.user.id,
          title,
          due_at: dueAt,
          notes: input.messageId
            ? `Aus EMA Mail: /mail?${new URLSearchParams({ mailbox, message: idSchema.parse(input.messageId) })}`
            : "Aus EMA Mail erstellt.",
        })
        .select("id")
        .single();
      if (error)
        throw new MailError(502, "Erinnerung konnte nicht angelegt werden.");
      return json({ reminder: data }, 201);
    }
    if (action === "calendar-options" && !mutating) {
      const calendar = await mailGraph<{
        allowedOnlineMeetingProviders?: string[];
      }>(
        token,
        "/me/calendar?$select=allowedOnlineMeetingProviders",
        {},
        "/me",
      );
      return json({
        teamsAvailable:
          calendar.allowedOnlineMeetingProviders?.includes(
            "teamsForBusiness",
          ) === true,
      });
    }
    if (action === "event" && !mutating) {
      const id = resourceId.parse(request.nextUrl.searchParams.get("id"));
      return json({
        item: await mailGraph(
          token,
          `/me/events/${encodeURIComponent(id)}?$select=id,subject,start,end,location,attendees,body,isOrganizer,isOnlineMeeting,isAllDay,onlineMeeting,onlineMeetingProvider`,
          {},
          "/me",
        ),
      });
    }
    if (action === "contacts" && !mutating) {
      const cursor = request.nextUrl.searchParams.get("cursor");
      if (
        cursor &&
        new URL(safeGraphUrl(cursor, "/me")).pathname !== "/v1.0/me/contacts"
      )
        throw new MailError(400, "Ungültige Kontaktseite.");
      const result = await mailGraph(
        token,
        cursor ||
          "/me/contacts?$top=100&$select=id,displayName,emailAddresses,businessPhones,companyName",
      );
      return json(result);
    }
    if (action === "calendar" && !mutating) {
      const requestedStart = request.nextUrl.searchParams.get("start");
      const requestedEnd = request.nextUrl.searchParams.get("end");
      if (!!requestedStart !== !!requestedEnd)
        throw new MailError(400, "Kalenderzeitraum unvollständig.");
      const start = requestedStart
        ? new Date(z.string().datetime({ offset: true }).parse(requestedStart))
        : new Date();
      const end = requestedEnd
        ? new Date(z.string().datetime({ offset: true }).parse(requestedEnd))
        : new Date(start.getTime() + 30 * 86400000);
      if (
        end.getTime() <= start.getTime() ||
        end.getTime() - start.getTime() > 45 * 86400000
      )
        throw new MailError(
          400,
          "Kalenderzeitraum muss zwischen einem und 45 Tagen liegen.",
        );
      const params = new URLSearchParams({
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        $top: "100",
        $orderby: "start/dateTime",
        $select:
          "id,subject,start,end,location,attendees,bodyPreview,isOrganizer,isOnlineMeeting,isAllDay,onlineMeeting,onlineMeetingProvider",
      });
      const cursor = request.nextUrl.searchParams.get("cursor");
      if (cursor) {
        const page = new URL(safeGraphUrl(cursor, "/me"));
        if (
          page.pathname !== "/v1.0/me/calendarView" ||
          !requestedStart ||
          Date.parse(page.searchParams.get("startDateTime") || "") !==
            start.getTime() ||
          Date.parse(page.searchParams.get("endDateTime") || "") !==
            end.getTime()
        )
          throw new MailError(
            400,
            "Ungültige Kalenderseite oder abweichender Zeitraum.",
          );
      }
      return json(
        await mailGraph(token, cursor || `/me/calendarView?${params}`),
      );
    }
    throw new MailError(404, "Unbekannte Mail-Funktion.");
  } catch (error) {
    if (error instanceof MailError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: "Ungültige Eingabe. Bitte Felder prüfen." }, 400);
    return json(
      {
        error:
          "Mail-Anfrage fehlgeschlagen. Bitte Verbindung und Konfiguration prüfen.",
      },
      502,
    );
  }
}
