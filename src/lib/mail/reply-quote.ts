import { replyQuoteSchema, type Message, type ReplyQuote } from "./model";
import { textHtml } from "./rich-text";

const address = (recipient: { emailAddress: { address: string; name?: string } }) =>
  recipient.emailAddress.name?.trim()
    ? `${recipient.emailAddress.name.trim()} <${recipient.emailAddress.address}>`
    : recipient.emailAddress.address;
export function makeReplyQuote(message: Message, body: string): ReplyQuote {
  return replyQuoteSchema.parse({ from: address(message.from), to: (message.toRecipients || []).map(address),
    cc: (message.ccRecipients || []).map(address), date: message.sentDateTime || message.receivedDateTime,
    subject: message.subject || "", body });
}
export function replyQuoteHeaders(quote: ReplyQuote) {
  const date = new Date(quote.date);
  return [
    ["Von", quote.from],
    ["Gesendet", Number.isNaN(date.getTime()) ? quote.date : date.toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "long", timeStyle: "short" })],
    ["An", quote.to.join("; ")],
    ...(quote.cc.length ? [["Cc", quote.cc.join("; ")]] : []),
    ["Betreff", quote.subject],
  ];
}
export function replyQuoteHtml(quote: ReplyQuote) {
  return `<hr><div>${replyQuoteHeaders(quote).map(([label, value]) => `<b>${label}:</b> ${textHtml(value)}`).join("<br>")}<br><br>${textHtml(quote.body)}</div>`;
}
