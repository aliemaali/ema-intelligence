"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Message } from "@/lib/mail/model";
import type { MailTranslationResult, TranslationLanguage } from "@/lib/mail/translation";
import s from "./mail.module.css";

const demoEnglish: Record<string, MailTranslationResult> = {
  "demo-1": { subject: "Approval for the next project step", body: "Good morning,\n\nPlease find attached the updated overview for our joint project. Please review the documents and send us brief feedback by Monday.\n\nCould we discuss the next steps on Tuesday at 10:00?\n\nThank you and best regards,\nLena Berger" },
  "demo-2": { subject: "Invoice RE-2026-0148 · Planning", body: "Dear Sir or Madam,\n\nPlease find attached our invoice for the completed preliminary planning. Please review the invoice before approval.\n\nKind regards,\nYour Nordlicht team" },
  "demo-3": { subject: "Scheduling · Project discussion", body: "Hello everyone, would next Wednesday work for a brief project discussion? I look forward to your feedback.\n\nBest regards,\nDavid" },
  "demo-4": { subject: "Updated documents are ready", body: "The new planning documents are ready for review. We have summarized the changes in the overview." },
  "demo-5": { subject: "Weekly update · Everything at a glance", body: "Good morning, here is the weekly update. All open items and responsibilities are included in the overview." },
  "demo-6": { subject: "Thank you for the conversation", body: "Thank you for the pleasant conversation yesterday. We look forward to working together." },
};

export function MailTranslation({ message, mailbox, demo, children }: {
  message: Message; mailbox: string; demo: boolean; children: ReactNode;
}) {
  const [translations, setTranslations] = useState<Partial<Record<TranslationLanguage, MailTranslationResult>>>({});
  const [view, setView] = useState<TranslationLanguage | "original">("original");
  const [busy, setBusy] = useState<TranslationLanguage | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const wanted = useRef<TranslationLanguage | "original">("original");
  useEffect(() => () => controller.current?.abort(), []);

  async function translate(target: TranslationLanguage) {
    if (controller.current) return;
    wanted.current = target; setError("");
    if (translations[target]) { setView(target); return; }
    const request = new AbortController(); controller.current = request; setBusy(target);
    try {
      let translation: MailTranslationResult;
      if (demo) {
        if (target === "de") translation = { subject: message.subject, body: message.body?.content || message.bodyPreview || "" };
        else {
          if (!demoEnglish[message.id]) throw new Error("Für diese Beispielnachricht ist keine Demo-Übersetzung hinterlegt.");
          translation = demoEnglish[message.id];
        }
      } else {
        const response = await fetch("/api/mail/translate", {
          method: "POST", signal: request.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mailbox, id: message.id, target }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Übersetzung fehlgeschlagen.");
        translation = data.translation;
      }
      if (request.signal.aborted) return;
      setTranslations(old => ({ ...old, [target]: translation }));
      if (wanted.current === target) setView(target);
    } catch (e) { if (!request.signal.aborted) setError((e as Error).message); }
    finally { if (!request.signal.aborted) setBusy(null); controller.current = null; }
  }
  const translated = view === "original" ? undefined : translations[view];
  return <>
    <div className={s.translationControls} role="group" aria-label="E-Mail übersetzen">
      <button type="button" aria-label="Auf Deutsch übersetzen" aria-pressed={view === "de"} disabled={!!busy} onClick={() => void translate("de")}><span aria-hidden="true">🇩🇪</span> Deutsch</button>
      <button type="button" aria-label="Auf Englisch übersetzen" aria-pressed={view === "en"} disabled={!!busy} onClick={() => void translate("en")}><span aria-hidden="true">🇬🇧</span> English</button>
      {(translated || busy) && <button type="button" aria-pressed={view === "original"} onClick={() => { wanted.current = "original"; setView("original"); }}>Original</button>}
      {busy && <span role="status">Wird übersetzt …</span>}
    </div>
    {error && <p role="alert" className={s.translationHint}>{error}</p>}
    {translated && <section aria-label={view === "de" ? "Deutsche Übersetzung" : "Englische Übersetzung"}>
      <p className={s.translationHint}>{demo ? "Beispielübersetzung" : "KI-Übersetzung"} · {view === "de" ? "Deutsch" : "English"} · Anhänge bleiben unverändert.</p>
      <h3 className={s.translationSubject}>{translated.subject}</h3>
      <div className={`${s.mailBody} ${s.translationText}`} lang={view}>{translated.body}</div>
    </section>}
    <div hidden={!!translated}>{children}</div>
  </>;
}
