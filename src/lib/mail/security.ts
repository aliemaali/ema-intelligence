import { createHash, randomBytes } from "node:crypto";
import type { MailDraft } from "./model";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  SIGNATURE_CID,
  SIGNATURE_IMAGE,
  SIGNATURE_SHA256,
  SIGNATURE_ALT,
  signatureForAddress,
} from "./signature";
import { MailError } from "./graph";
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
  if (draft.signatureId) {
    const bytes = readFileSync(
      path.join(process.cwd(), "public", SIGNATURE_IMAGE),
    );
    if (createHash("sha256").update(bytes).digest("hex") !== SIGNATURE_SHA256)
      throw new MailError(
        503,
        "Signaturdatei wurde verändert. Bitte Entwurf erneut prüfen.",
      );
    signatureAttachments.push({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: "EMA-Signatur-Ali-Unluer.jpeg",
      contentType: "image/jpeg",
      contentId: SIGNATURE_CID,
      isInline: true,
      contentBytes: bytes.toString("base64"),
    });
  }
  return {
    subject: draft.subject,
    body: draft.signatureId
      ? {
          contentType: "HTML",
          content: `<div>${escapeHtml(draft.body).replace(/\r?\n/g, "<br>")}</div><br><img src="cid:${SIGNATURE_CID}" width="320" style="max-width:100%;height:auto" alt="${escapeHtml(SIGNATURE_ALT)}">`,
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
