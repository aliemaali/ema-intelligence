import { z } from "zod";
import { MailError } from "./graph";
export const resourceId = z.string().min(1).max(1500);
const address = z.string().trim().email().max(254);
export const contactSchema = z
  .object({
    displayName: z.string().trim().min(1).max(200),
    email: address.or(z.literal("")),
    companyName: z.string().trim().max(200).default(""),
    phone: z.string().trim().max(60).default(""),
  })
  .strict();
export const eventSchema = z
  .object({
    subject: z.string().trim().min(1).max(250),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    location: z.string().max(300).default(""),
    notes: z.string().max(10000).default(""),
    attendees: z.array(address).max(50).default([]),
    teamsMeeting: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, c) => {
    if (Date.parse(v.end) <= Date.parse(v.start))
      c.addIssue({ code: "custom", message: "Ende muss nach Beginn liegen." });
    if (Date.parse(v.end) - Date.parse(v.start) > 366 * 86400000)
      c.addIssue({ code: "custom", message: "Termin ist zu lang." });
  });
export function graphEvent(
  value: z.infer<typeof eventSchema>,
  transactionId?: string,
) {
  return {
    subject: value.subject,
    start: { dateTime: value.start, timeZone: "UTC" },
    end: { dateTime: value.end, timeZone: "UTC" },
    location: { displayName: value.location },
    body: { contentType: "Text", content: value.notes },
    attendees: value.attendees.map((address) => ({
      emailAddress: { address },
      type: "required",
    })),
    ...(value.teamsMeeting
      ? { isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" }
      : {}),
    ...(transactionId ? { transactionId } : {}),
  };
}
export function graphContact(v: z.infer<typeof contactSchema>) {
  return {
    displayName: v.displayName,
    emailAddresses: v.email ? [{ address: v.email }] : [],
    companyName: v.companyName,
    businessPhones: v.phone ? [v.phone] : [],
  };
}
export function assertPimConfirmation(value: unknown) {
  if (value !== true)
    throw new MailError(
      409,
      "Bitte die Änderung ausdrücklich bestätigen. Termineinladungen und Absagen können E-Mails auslösen.",
    );
}
