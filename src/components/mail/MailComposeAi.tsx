"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Undo2 } from "lucide-react";
import type { MailDraft } from "@/lib/mail/model";
import type { DraftAssistanceInput } from "@/lib/mail/draft-assistance";
import type { MailTranslationResult } from "@/lib/mail/translation";
import { draftText, sameDraftText, type DraftText } from "@/lib/mail/draft-text";
import { textHtml } from "@/lib/mail/rich-text";
import { MailDialog } from "./MailDialog";
import s from "./mail.module.css";

type Mode = DraftAssistanceInput["mode"];
export function MailComposeAi({ draft, demo, busy, update }: {
  draft: MailDraft; demo: boolean; busy: boolean; update: (value: Partial<MailDraft>) => void;
}) {
  const [working, setWorking] = useState<Mode | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ source: DraftText; result: MailTranslationResult } | null>(null);
  const [undo, setUndo] = useState<{ before: DraftText; after: DraftText } | null>(null);
  const request = useRef<AbortController | null>(null);
  const latest = useRef(draft); latest.current = draft;
  useEffect(() => () => request.current?.abort(), []);

  async function run(mode: Mode) {
    if (busy || request.current || !draft.body.trim()) return;
    const source = draftText(draft);
    const controller = new AbortController(); request.current = controller;
    setWorking(mode); setError(""); setPreview(null);
    try {
      let result: MailTranslationResult;
      if (demo) {
        result = mode === "en"
          ? { subject: "Request for project documents", body: "Hello,\n\nCould you please send us the project documents? Thank you for your support.\n\nKind regards" }
          : { subject: "Anfrage zu den Projektunterlagen", body: "Guten Tag,\n\nbitte senden Sie uns die Projektunterlagen zu. Vielen Dank für Ihre Unterstützung.\n\nFreundliche Grüße" };
      } else {
        const response = await fetch("/api/mail/draft-assist", {
          method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mailbox: source.mailbox, subject: source.subject, body: source.body, mode }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "KI-Textbearbeitung fehlgeschlagen.");
        result = data.suggestion;
      }
      if (controller.signal.aborted) return;
      if (!sameDraftText(source, latest.current)) throw new Error("Dein Entwurf wurde inzwischen geändert. Bitte die KI-Aktion erneut starten.");
      setPreview({ source, result });
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setWorking(null); request.current = null; }
  }
  function apply() {
    if (!preview || busy || !sameDraftText(preview.source, latest.current)) return;
    const patch = { subject: preview.result.subject, body: preview.result.body, bodyHtml: textHtml(preview.result.body) };
    setUndo({ before: preview.source, after: { ...preview.source, ...patch } });
    update(patch); setPreview(null);
  }
  return <div className={s.composeAi}>
    <div className={s.translationControls} role="group" aria-label="KI für deinen Entwurf">
      <button type="button" disabled={busy || !!working || !draft.body.trim()} onClick={() => void run("improve")}><Sparkles size={14} /> Text verbessern</button>
      <button type="button" aria-label="Entwurf ins Deutsche übersetzen" disabled={busy || !!working || !draft.body.trim()} onClick={() => void run("de")}><span aria-hidden="true">🇩🇪</span> Deutsch</button>
      <button type="button" aria-label="Entwurf ins Englische übersetzen" disabled={busy || !!working || !draft.body.trim()} onClick={() => void run("en")}><span aria-hidden="true">🇬🇧</span> English</button>
      {undo && <button type="button" disabled={busy || !!working || !sameDraftText(undo.after, draft)} onClick={() => {
        if (!sameDraftText(undo.after, latest.current)) return;
        update({ subject: undo.before.subject, body: undo.before.body, bodyHtml: undo.before.bodyHtml }); setUndo(null);
      }}><Undo2 size={13} /> Rückgängig</button>}
      {working && <span role="status">{working === "improve" ? "Text wird verbessert …" : "Wird übersetzt …"}</span>}
    </div>
    {error && <p role="alert" className={s.translationHint}>{error}</p>}
    {preview && <MailDialog title="KI-Vorschlag prüfen" onClose={() => setPreview(null)}>
      <p>{demo ? "Beispielvorschlag für Projektunterlagen (Demo)." : "Bitte den Vorschlag prüfen. Mit Übernehmen ersetzt du Betreff und Nachrichtentext."}</p>
      <p><b>Betreff:</b> {preview.result.subject}</p>
      <div className={s.aiDraftText}>{preview.result.body}</div>
      {!sameDraftText(preview.source, draft) && <p role="alert">Der Entwurf wurde geändert. Bitte einen neuen Vorschlag erstellen.</p>}
      <footer>
        <button type="button" className={s.subtle} onClick={() => setPreview(null)}>Verwerfen</button>
        <button type="button" className={s.primary} disabled={busy || !sameDraftText(preview.source, draft)} onClick={apply}>Übernehmen</button>
      </footer>
    </MailDialog>}
  </div>;
}
