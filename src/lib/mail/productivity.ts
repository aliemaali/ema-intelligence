import type { Message } from "./model";
export function replyAllRecipients(message: Message, ownAddress: string) {
  const own = ownAddress.trim().toLowerCase();
  const seen = new Set([own]);
  const clean = (items: { emailAddress: { address: string } }[]) =>
    items
      .map((a) => a.emailAddress.address.trim().toLowerCase())
      .filter((a) => a && !seen.has(a) && !!seen.add(a));
  return {
    to: clean([
      ...(message.replyTo?.length ? message.replyTo : [message.from]),
      ...(message.toRecipients || []),
    ]),
    cc: clean(message.ccRecipients || []),
    bcc: [],
  };
}
export const builtInTemplates = [
  {
    id: "expose",
    title: "Exposé versenden",
    subject: "Projektunterlagen zur Prüfung",
    body: "Guten Tag,\n\nanbei erhältst du die Projektunterlagen zur Prüfung. Bitte gib uns eine kurze Rückmeldung zu deinem Interesse und zu offenen Fragen.\n\nViele Grüße",
  },
  {
    id: "documents",
    title: "Unterlagen anfordern",
    subject: "Fehlende Projektunterlagen",
    body: "Guten Tag,\n\nfür die weitere Prüfung benötigen wir noch folgende Unterlagen:\n\n• \n\nVielen Dank und viele Grüße",
  },
  {
    id: "meeting",
    title: "Termin abstimmen",
    subject: "Terminabstimmung",
    body: "Guten Tag,\n\nwir möchten die nächsten Schritte besprechen. Welche Termine passen dir in den kommenden Tagen?\n\nViele Grüße",
  },
];
export function checkSchedule(value: string, now = Date.now()) {
  const when = Date.parse(value);
  if (
    !Number.isFinite(when) ||
    when < now + 60_000 ||
    when > now + 30 * 86400_000
  )
    throw new Error(
      "Versandtermin muss zwischen einer Minute und 30 Tagen in der Zukunft liegen.",
    );
  return new Date(when).toISOString();
}
