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
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefing, setBriefing] = useState("");
  const [preview, setPreview] = useState<{ source: DraftText; result: MailTranslationResult } | null>(null);
  const [undo, setUndo] = useState<{ before: DraftText; after: DraftText } | null>(null);
  const request = useRef<AbortController | null>(null);
  const latest = useRef(draft); latest.current = draft;
  useEffect(() => () => request.current?.abort(), []);

  async function run(mode: Mode) {
    if (busy || request.current || (mode === "formulate" ? !briefing.trim() : !draft.body.trim())) return;
    const source = mode === "formulate" && preview ? preview.source : draftText(draft);
    const currentText = mode === "formulate" && preview ? preview.result : source;
    const controller = new AbortController(); request.current = controller;
    setWorking(mode); setError("");
    if (mode !== "formulate") setPreview(null);
    try {
      let result: MailTranslationResult;
      if (demo) {
        result = mode === "en"
          ? { subject: "Request for project documents", body: "Hello,\n\nCould you please send us the project documents? Thank you for your support.\n\nKind regards" }
          : { subject: "Anfrage zu den Projektunterlagen", body: "Guten Tag,\n\nbitte senden Sie uns die Projektunterlagen zu. Vielen Dank für Ihre Unterstützung.\n\nFreundliche Grüße" };
      } else {
        const response = await fetch("/api/mail/draft-assist", {
          method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mailbox: source.mailbox, subject: currentText.subject, body: currentText.body, mode,
            ...(mode === "formulate" ? { instructions: briefing.trim() } : {}) }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "KI-Textbearbeitung fehlgeschlagen.");
        result = data.suggestion;
      }
      if (controller.signal.aborted) return;
      if (!sameDraftText(source, latest.current)) throw new Error("Dein Entwurf wurde inzwischen geändert. Bitte die KI-Aktion erneut starten.");
      setPreview({ source, result });
      if (mode === "formulate") setBriefing("");
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setWorking(null); request.current = null; }
  }
  function apply() {
    if (!preview || busy || !sameDraftText(preview.source, latest.current)) return;
    const patch = { subject: preview.result.subject, body: preview.result.body, bodyHtml: textHtml(preview.result.body) };
    setUndo({ before: preview.source, after: { ...preview.source, ...patch } });
    update(patch); setPreview(null); setBriefingOpen(false);
  }
  function openBriefing() {
    setError(""); setBriefing("");
    setPreview({ source: draftText(draft), result: { subject: draft.subject, body: draft.body } });
    setBriefingOpen(true);
  }
  function closeBriefing() { setBriefingOpen(false); setPreview(null); setError(""); }
  return <div className={s.composeAi}>
    <div className={s.translationControls} role="group" aria-label="KI für deinen Entwurf">
      <button type="button" disabled={busy || !!working} onClick={openBriefing}><Sparkles size={14} /> E-Mail formulieren</button>
      <button type="button" disabled={busy || !!working || !draft.body.trim()} onClick={() => void run("improve")}><Sparkles size={14} /> Text verbessern</button>
      <button type="button" aria-label="Entwurf ins Deutsche übersetzen" disabled={busy || !!working || !draft.body.trim()} onClick={() => void run("de")}><span aria-hidden="true">🇩🇪</span> Deutsch</button>
      <button type="button" aria-label="Entwurf ins Englische übersetzen" disabled={busy || !!working || !draft.body.trim()} onClick={() => void run("en")}><span aria-hidden="true">🇬🇧</span> English</button>
      {undo && <button type="button" disabled={busy || !!working || !sameDraftText(undo.after, draft)} onClick={() => {
        if (!sameDraftText(undo.after, latest.current)) return;
        update({ subject: undo.before.subject, body: undo.before.body, bodyHtml: undo.before.bodyHtml }); setUndo(null);
      }}><Undo2 size={13} /> Rückgängig</button>}
      {working && <span role="status">{working === "formulate" ? "E-Mail wird formuliert …" : working === "improve" ? "Text wird verbessert …" : "Wird übersetzt …"}</span>}
    </div>
    {error && !briefingOpen && <p role="alert" className={s.translationHint}>{error}</p>}
    {briefingOpen && preview && <MailDialog title="Was soll die E-Mail sagen?" busy={!!working} onClose={closeBriefing} className={s.aiWorkshop}>
      <form autoComplete="off" onSubmit={event => { event.preventDefault(); void run("formulate"); }}>
      <section className={s.aiInstructions} aria-label="Anweisungen an die KI">
      <label>Anweisung oder Stichpunkte
        <textarea className={s.briefingInput} name="briefing" autoComplete="off" inputMode="text" autoCapitalize="sentences"
          rows={3} maxLength={4000} disabled={!!working} value={briefing} onChange={event => setBriefing(event.target.value)} />
      </label>
      <button type="submit" className={s.primary} disabled={busy || !!working || !briefing.trim() || !sameDraftText(preview.source, draft)}>
        {working ? "Wird bearbeitet …" : preview.result.body.trim() ? "Änderungen umsetzen" : "Text erstellen"}
      </button>
      </section>
      <section className={s.aiResult} aria-label="E-Mail-Entwurf">
        <h3>E-Mail-Entwurf</h3>
        {demo && <p>Demo mit Beispieltext, ohne echte KI-Bearbeitung.</p>}
        <label>Betreff des Entwurfs
          <input name="draft-subject" autoComplete="off" maxLength={500} disabled={!!working} value={preview.result.subject}
            onChange={event => setPreview({ ...preview, result: { ...preview.result, subject: event.target.value } })} />
        </label>
        <label>Nachricht des Entwurfs
          <textarea name="draft-text" autoComplete="off" inputMode="text" rows={8} maxLength={24000} disabled={!!working} value={preview.result.body}
            onChange={event => setPreview({ ...preview, result: { ...preview.result, body: event.target.value } })} />
        </label>
      </section>
      {working && <p role="status">Die KI überarbeitet deinen Entwurf …</p>}
      {error && <p role="alert">{error}</p>}
      {!sameDraftText(preview.source, draft) && <p role="alert">Der ursprüngliche Entwurf wurde geändert. Bitte dieses Fenster schließen und erneut öffnen.</p>}
      <footer>
        <button type="button" className={s.subtle} disabled={!!working} onClick={closeBriefing}>Abbrechen</button>
        <button type="button" className={s.primary} disabled={busy || !!working || !preview.result.body.trim() || !sameDraftText(preview.source, draft)} onClick={apply}>Übernehmen</button>
      </footer>
      </form>
    </MailDialog>}
    {preview && !briefingOpen && <MailDialog title="KI-Vorschlag prüfen" onClose={() => setPreview(null)}>
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
