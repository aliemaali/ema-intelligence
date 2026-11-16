import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  mailAdmin,
  mailboxAccess,
  mailSenderAddress,
  type MailSession,
} from "./server";
import { MailError, mailGraph, messagePath, safeGraphUrl } from "./graph";
import { mailboxRoot, draftSchema, type Message } from "./model";
import { assertSignatureSender, digest } from "./security";
import { checkSchedule } from "./productivity";
import { sanitizeRichHtml } from "./rich-text";
const uuid = z.string().uuid(),
  id = z.string().min(1).max(1500);
const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
export async function visibleProject(session: MailSession, value: unknown) {
  const projectId = uuid.parse(value);
  const { data, error } = await session.db
    .from("projects")
    .select("id,project_name")
    .eq("id", projectId)
    .eq("user_id", session.user.id)
    .eq("is_archived",false)
    .maybeSingle();
  if (error || !data) throw new MailError(403, "Projekt nicht verfügbar.");
  return data;
}
export async function productivityEndpoint(
  request: NextRequest,
  action: string,
  input: Record<string, unknown>,
  session: MailSession,
): Promise<NextResponse | null> {
  if (action === "followup" || action === "cancel-followup")
    throw new MailError(410, "Wiedervorlage wurde entfernt.");
  const actions = [
    "productivity",
    "template",
    "signature",
    "project-link",
    "project-mail",
    "thread",
    "schedule",
    "cancel-schedule",
  ];
  if (!actions.includes(action)) return null;
  const post = request.method === "POST",
    db = mailAdmin(),
    uid = session.user.id;
  const { mailbox, token } = await mailboxAccess(
    session,
    post ? input.mailbox : request.nextUrl.searchParams.get("mailbox") || "me",
    post && ["schedule", "signature"].includes(action) ? "send" : "read",
  );
  const root = mailboxRoot(mailbox);
  if (action === "productivity" && !post) {
    const [templates, settings, projects, schedules] =
      await Promise.all([
        db
          .from("ema_mail_templates")
          .select("id,title,subject,body,body_html")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(100),
        db
          .from("ema_mail_user_settings")
          .select("signature_text")
          .eq("user_id", uid)
          .eq("mailbox", mailbox)
          .maybeSingle(),
        session.db
          .from("projects")
          .select("id,project_name")
          .eq("user_id", uid)
          .order("project_name")
          .limit(100),
        db
          .from("ema_mail_scheduled")
          .select("id,run_at,state,payload,last_error")
          .eq("user_id", uid)
          .eq("mailbox", mailbox)
          .order("run_at", { ascending: false })
          .limit(50),
      ]);
    if (
      [templates, settings, projects, schedules].some((r) => r.error)
    )
      throw new MailError(503, "Mail-Erweiterungen noch nicht eingerichtet.");
    return reply({
      templates: templates.data,
      signatureText: settings.data?.signature_text || "",
      projects: projects.data,
      schedules: (schedules.data || []).map((j) => ({
        id: j.id,
        run_at: j.run_at,
        state: j.state,
        subject: j.payload?.subject,
        last_error: j.last_error,
      })),
      schedulerConfigured:
        process.env.EMA_MAIL_SCHEDULED_SEND_ENABLED === "true",
    });
  }
  if (action === "signature" && post) {
    const text = z.string().trim().max(4000).parse(input.text);
    const { error } = await db.from("ema_mail_user_settings").upsert(
      {
        user_id: uid,
        mailbox,
        signature_text: text,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mailbox" },
    );
    if (error)
      throw new MailError(503, "Signatur konnte nicht gespeichert werden.");
    return reply({ ok: true });
  }
  if (action === "template" && post) {
    if (input.operation === "delete") {
      const { error } = await db
        .from("ema_mail_templates")
        .delete()
        .eq("id", uuid.parse(input.id))
        .eq("user_id", uid);
      if (error) throw new MailError(503, "Vorlage nicht entfernt.");
      return reply({ ok: true });
    }
    const values = z
      .object({
        title: z.string().trim().min(1).max(100),
        subject: z.string().max(500),
        body: z.string().max(100000),
        bodyHtml: z.string().max(200000).optional(),
      })
      .parse(input);
    const { data, error } = await db
      .from("ema_mail_templates")
      .insert({
        user_id: uid,
        title: values.title,
        subject: values.subject,
        body: values.body,
        body_html: values.bodyHtml ? sanitizeRichHtml(values.bodyHtml) : null,
      })
      .select("id")
      .single();
    if (error) throw new MailError(503, "Vorlage nicht gespeichert.");
    return reply(data, 201);
  }
  if (action === "project-mail" && !post) {
    const project = await visibleProject(
      session,
      request.nextUrl.searchParams.get("projectId"),
    );
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(200)
      .parse(request.nextUrl.searchParams.get("page") || 0);
    const { data, error } = await db
      .from("ema_mail_project_links")
      .select("mailbox,message_id,subject,sender,created_at")
      .eq("user_id", uid)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .range(page * 50, page * 50 + 50);
    if (error) throw new MailError(503, "Projekt-Mails nicht verfügbar.");
    const allowed = [];
    for (const link of (data || []).slice(0, 50)) {
      try {
        await mailboxAccess(session, link.mailbox);
        allowed.push(link);
      } catch {}
    }
    return reply({ links: allowed, more: (data || []).length > 50 });
  }
  if (action === "project-link") {
    const messageId = id.parse(
      post ? input.messageId : request.nextUrl.searchParams.get("messageId"),
    );
    if (!post) {
      const { data, error } = await db
        .from("ema_mail_project_links")
        .select("project_id")
        .eq("user_id", uid)
        .eq("mailbox", mailbox)
        .eq("message_id", messageId);
      if (error) throw new MailError(503, "Zuordnung nicht verfügbar.");
      return reply({ links: data });
    }
    const project = await visibleProject(session, input.projectId);
    if (input.operation === "remove") {
      const { error } = await db
        .from("ema_mail_project_links")
        .delete()
        .eq("user_id", uid)
        .eq("mailbox", mailbox)
        .eq("message_id", messageId)
        .eq("project_id", project.id);
      if (error) throw new MailError(503, "Zuordnung nicht entfernt.");
      return reply({ ok: true });
    }
    const message = await mailGraph<Message>(
      token,
      `${messagePath(mailbox, messageId)}?$select=id,subject,from`,
      {},
      root,
    );
    const { error } = await db.from("ema_mail_project_links").upsert(
      {
        user_id: uid,
        mailbox,
        message_id: messageId,
        project_id: project.id,
        subject: message.subject,
        sender: message.from.emailAddress.address,
      },
      { onConflict: "user_id,mailbox,message_id,project_id" },
    );
    if (error) throw new MailError(503, "Zuordnung nicht gespeichert.");
    return reply({ ok: true });
  }
  if (action === "thread" && !post) {
    const messageId = id.parse(request.nextUrl.searchParams.get("messageId")),
      source = await mailGraph<Message>(
        token,
        `${messagePath(mailbox, messageId)}?$select=id,conversationId`,
        {},
        root,
      );
    if (!source.conversationId) return reply({ messages: [], cursor: null });
    const filter = `conversationId eq '${source.conversationId.replace(/'/g, "''")}'`;
    const cursor = request.nextUrl.searchParams.get("cursor");
    let url = `${root}/messages?${new URLSearchParams({ $filter: filter, $select: "id,subject,body,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,conversationId", $top: "25" })}`;
    if (cursor) {
      const checked = new URL(safeGraphUrl(cursor, root));
      if (
        decodeURIComponent(checked.pathname) !==
          decodeURIComponent(`/v1.0${root}/messages`) ||
        checked.searchParams.get("$filter") !== filter
      )
        throw new MailError(400, "Verlauf gehört nicht zur Nachricht.");
      url = checked.href;
    }
    const result = await mailGraph<{
      value: Message[];
      "@odata.nextLink"?: string;
    }>(
      token,
      url,
      { headers: { Prefer: 'outlook.body-content-type="text"' } },
      root,
    );
    return reply({
      messages: result.value,
      cursor: result["@odata.nextLink"] || null,
    });
  }
  if (action === "schedule" && post) {
    if (process.env.EMA_MAIL_SCHEDULED_SEND_ENABLED !== "true")
      throw new MailError(
        503,
        "Geplanter Versand ist noch nicht freigeschaltet.",
      );
    if (input.confirmed !== true)
      throw new MailError(400, "Ausdrückliche Freigabe erforderlich.");
    const draftId = uuid.parse(input.id),
      { data, error } = await db
        .from("ema_mail_drafts")
        .select("payload,content_hash,status")
        .eq("id", draftId)
        .eq("user_id", uid)
        .maybeSingle();
    if (error || !data) throw new MailError(404, "Entwurf nicht gefunden.");
    const payload = draftSchema.parse(data.payload);
    if (
      payload.mailbox !== mailbox ||
      !payload.scheduledAt ||
      data.content_hash !== input.contentHash ||
      digest(payload) !== data.content_hash
    )
      throw new MailError(409, "Entwurf oder Termin verändert.");
    await mailboxAccess(session, mailbox, "send");
    assertSignatureSender(payload, await mailSenderAddress(session, mailbox));
    checkSchedule(payload.scheduledAt);
    const result = await db.rpc("ema_mail_schedule_draft", {
      p_user_id: uid,
      p_draft_id: draftId,
      p_hash: data.content_hash,
    });
    if (result.error)
      throw new MailError(409, "Versand konnte nicht eingeplant werden.");
    return reply({
      id: result.data,
      message: "Geprüfter Inhalt zum freigegebenen Termin eingeplant.",
    });
  }
  if (action === "cancel-schedule" && post) {
    const result = await db.rpc("ema_mail_cancel_schedule", {
      p_user_id: uid,
      p_id: uuid.parse(input.id),
    });
    if (result.error || result.data !== true)
      throw new MailError(
        409,
        "Versand bereits beansprucht oder nicht gefunden. Status prüfen.",
      );
    return reply({ ok: true });
  }
  throw new MailError(405, "Methode nicht erlaubt.");
}
