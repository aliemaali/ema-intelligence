"use client";
import type { ReplyQuote } from "@/lib/mail/model";
import { replyQuoteHeaders } from "@/lib/mail/reply-quote";
import s from "./mail.module.css";

export function MailReplyQuote({ quote }: { quote: ReplyQuote }) {
  return <section className={s.replyQuote} aria-label="Ursprüngliche Nachricht">
    {replyQuoteHeaders(quote).map(([label, value]) => <div key={label}><b>{label}:</b> {value}</div>)}
    <div className={s.replyQuoteBody}>{quote.body}</div>
  </section>;
}
