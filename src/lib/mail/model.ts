import { z } from "zod";
import { sanitizeRichHtml } from "./rich-text";

export const mailboxSchema = z.union([
  z.literal("me"),
  z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
]);
export const attachmentSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^\x00-\x1f/\\]+$/),
    contentType: z.string().max(120),
    contentBytes: z
      .string()
      .max(2_800_000)
      .regex(
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
      ),
  })
  .strict();
export const draftSchema = z
  .object({
    mailbox: mailboxSchema.default("me"),
    to: z.array(z.string().email().max(254)).min(1).max(50),
    cc: z.array(z.string().email().max(254)).max(50).default([]),
    bcc: z.array(z.string().email().max(254)).max(50).default([]),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .regex(/^[^\r\n]+$/),
    body: z.string().trim().min(1).max(100_000),
    bodyHtml: z.string().max(200_000).transform(sanitizeRichHtml).optional(),
    signatureText: z.string().trim().max(4000).optional(),
    scheduledAt: z
      .string()
      .datetime({ offset: true })
      .transform((v) => new Date(v).toISOString())
      .optional(),
    signatureId: z.enum(["ali-unluer-v1", "tuba-unluer-v1"]).optional(),
    isReadReceiptRequested: z.boolean().optional(),
    isDeliveryReceiptRequested: z.boolean().optional(),
    replyToMessageId: z.string().min(1).max(1500).optional(),
    attachments: z.array(attachmentSchema).max(10).default([]),
  })
  .strict()
  .superRefine((draft, ctx) => {
    if (
      draft.attachments.reduce((sum, a) => sum + a.contentBytes.length, 0) >
      3_000_000
    )
      ctx.addIssue({
        code: "custom",
        message: "Anhänge zusammen maximal 2,25 MB.",
      });
  });
export type MailDraft = z.infer<typeof draftSchema>;
export type Address = { emailAddress: { address: string; name?: string } };
export type Message = {
  emaAnalysis?: import("./analysis").MailAnalysis | null;
  id: string;
  subject: string;
  bodyPreview: string;
  body?: { contentType: string; content: string };
  receivedDateTime: string;
  isRead: boolean;
  importance?: string;
  hasAttachments: boolean;
  from: Address;
  toRecipients?: Address[];
  ccRecipients?: Address[];
  replyTo?: Address[];
  conversationId?: string;
  flag?: { flagStatus: string };
};
export type Attachment = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string;
  isInline?: boolean;
  contentId?: string;
  "@odata.type"?: string;
};
export const folders = [
  { id: "inbox", name: "Posteingang" },
  { id: "sentitems", name: "Gesendet" },
  { id: "drafts", name: "Entwürfe" },
  { id: "archive", name: "Archiv" },
  { id: "deleteditems", name: "Papierkorb" },
  { id: "junkemail", name: "Junk-E-Mail" },
];
export function mailboxRoot(mailbox: string) {
  return mailbox === "me"
    ? "/me"
    : `/users/${encodeURIComponent(mailboxSchema.parse(mailbox))}`;
}
export function isMailEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.EMA_MAIL_ENABLED === "true" && env.VERCEL_ENV !== "preview";
}
export function canUseMail(
  profile: { role?: string; is_active?: boolean } | null,
) {
  return Boolean(
    profile &&
      profile.is_active === true &&
      ["owner", "admin", "manager", "employee", "user", "staff"].includes(
        String(profile.role).toLowerCase(),
      ),
  );
}
export function invoiceHint(
  mail: Pick<Message, "subject" | "bodyPreview" | "hasAttachments"> & {
    emaAnalysis?: import("./analysis").MailAnalysis | null;
  },
) {
  return (
    mail.hasAttachments &&
    (mail.emaAnalysis?.invoiceCandidate ||
      /rechnung|invoice|mahnung|gutschrift/i.test(
        `${mail.subject} ${mail.bodyPreview}`,
      ))
  );
}
