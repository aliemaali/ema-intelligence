import { createHash, randomBytes } from "node:crypto";
import { sanitizeRichHtml, textHtml } from "./rich-text";
import type { MailDraft } from "./model";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  signatureById,
  signatureForAddress,
} from "./signature";
import { MailError } from "./graph";
import { replyQuoteHtml } from "./reply-quote";
export const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function newApproval() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: tokenHash(token),
    expires: new Date(Date.now() + 300000).toISOString(),
  };
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new MailError(403, "Anfrage von fremder Herkunft blockiert.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new MailError(415, "JSON erforderlich.");
}
export function assertSignatureSender(draft: MailDraft, address: string) {
  if (draft.signatureId !== signatureForAddress(address))
    throw new MailError(
      409,
      "Absender und Signatur stimmen nicht überein. Entwurf erneut öffnen und prüfen.",
    );
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function graphMessage(draft: MailDraft, reference: string) {
  const recipients = (addresses: string[]) =>
    addresses.map((address) => ({ emailAddress: { address } }));
  const signatureAttachments = [];
  const signature = signatureById(draft.signatureId);
  if (draft.signatureId && !signature) throw new MailError(400, "Unbekannte Signatur.");
  if (signature) {
    const bytes = readFileSync(
      path.join(process.cwd(), "public", signature.image),
    );
    if (createHash("sha256").update(bytes).digest("hex") !== signature.sha256)
      throw new MailError(
        503,
        "Signaturdatei wurde verändert. Bitte Entwurf erneut prüfen.",
      );
    signatureAttachments.push({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: signature.filename,
      contentType: "image/jpeg",
      contentId: signature.cid,
      isInline: true,
      contentBytes: bytes.toString("base64"),
    });
  }
  return {
    subject: draft.subject,
    body:
      draft.signatureId || draft.bodyHtml || draft.signatureText || draft.replyQuote
        ? {
            contentType: "HTML",
            content: `<div>${draft.bodyHtml ? sanitizeRichHtml(draft.bodyHtml) : textHtml(draft.body)}</div>${draft.signatureText ? `<br><div>${textHtml(draft.signatureText)}</div>` : ""}${signature ? `<br><img src="cid:${signature.cid}" width="320" style="max-width:100%;height:auto" alt="${escapeHtml(signature.alt)}">` : ""}${draft.replyQuote ? replyQuoteHtml(draft.replyQuote) : ""}`,
          }
        : { contentType: "Text", content: draft.body },
    isReadReceiptRequested: draft.isReadReceiptRequested === true,
    isDeliveryReceiptRequested: draft.isDeliveryReceiptRequested === true,
    toRecipients: recipients(draft.to),
    ccRecipients: recipients(draft.cc),
    bccRecipients: recipients(draft.bcc),
    internetMessageHeaders: [{ name: "x-ema-draft-id", value: reference }],
    attachments: [
      ...draft.attachments.map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        ...a,
      })),
      ...signatureAttachments,
    ],
  };
}
// Claim must atomically change approved -> sending before this function is called.
// Never retry this operation: a network timeout can occur after Exchange accepted it.
export async function submitApprovedDraft(
  draft: MailDraft,
  id: string,
  send: (message: unknown) => Promise<void>,
  finish: (state: "submitted" | "uncertain") => Promise<void>,
) {
  try {
    await send(graphMessage(draft, id));
  } catch {
    await finish("uncertain");
    throw new MailError(
      409,
      "Versandstatus unklar. Gesendet-Ordner prüfen; kein automatischer erneuter Versand.",
    );
  }
  await finish("submitted");
  return {
    status: "submitted",
    message:
      "Von Microsoft zum Versand angenommen. Zustellung noch nicht bestätigt.",
  };
}
