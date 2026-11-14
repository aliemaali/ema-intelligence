"use client";
import { useRef, useState } from "react";
import {
  IndentIncrease,
  List,
  ListOrdered,
  Paperclip,
  Save,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import type { MailDraft } from "@/lib/mail/model";
import { MailSignature } from "./MailSignature";
import s from "./mail.module.css";

type Account = { mailbox: string; name?: string; can_send: boolean };
export function MailComposeFields({
  draft,
  accounts,
  busy,
  update,
  addFiles,
  save,
  review,
}: {
  draft: MailDraft;
  accounts: Account[];
  busy: boolean;
  update: (value: Partial<MailDraft>) => void;
  addFiles: (files: FileList | null) => void;
  save: () => void;
  review: () => void;
}) {
  const [cc, setCc] = useState(draft.cc.some(Boolean));
  const [bcc, setBcc] = useState(draft.bcc.some(Boolean));
  const editor = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  function prefixLines(kind: "bullet" | "number" | "indent") {
    const el = editor.current;
    if (!el) return;
    const start =
      el.selectionStart === 0
        ? 0
        : draft.body.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const next = draft.body.indexOf("\n", el.selectionEnd);
    const end = next < 0 ? draft.body.length : next;
    const value = draft.body
      .slice(start, end)
      .split("\n")
      .map(
        (line, i) =>
          `${kind === "bullet" ? "• " : kind === "number" ? `${i + 1}. ` : "    "}${line}`,
      )
      .join("\n");
    update({
      body: draft.body.slice(0, start) + value + draft.body.slice(end),
    });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + value.length);
    });
  }
  return (
    <>
      <div
        className={s.composeCommands}
        role="toolbar"
        aria-label="Nachrichtenaktionen"
      >
        <button
          className={s.primary}
          disabled={
            busy ||
            !draft.to.some(Boolean) ||
            !draft.subject.trim() ||
            !draft.body.trim()
          }
          onClick={review}
        >
          <Send size={16} /> Senden <ShieldCheck size={13} />
        </button>
        <button disabled={busy} onClick={() => file.current?.click()}>
          <Paperclip size={17} /> Datei anfügen
        </button>
        <button disabled={busy} onClick={save}>
          <Save size={16} /> Entwurf speichern
        </button>
      </div>
      <div className={s.addressFields}>
        <label className={s.addressRow}>
          <span>Von</span>
          <select
            aria-label="Absender"
            disabled={busy}
            value={draft.mailbox}
            onChange={(e) => update({ mailbox: e.target.value })}
          >
            {accounts
              .filter((a) => a.can_send)
              .map((a) => (
                <option key={a.mailbox} value={a.mailbox}>
                  {a.name || a.mailbox}
                </option>
              ))}
          </select>
        </label>
        {(["to", "cc", "bcc"] as const)
          .filter(
            (field) =>
              field === "to" ||
              (field === "cc"
                ? cc || draft.cc.some(Boolean)
                : bcc || draft.bcc.some(Boolean)),
          )
          .map((field) => (
            <div className={s.addressRow} key={field}>
              <label htmlFor={`compose-${field}`}>
                {field === "to" ? "An" : field === "cc" ? "Cc" : "Bcc"}
              </label>
              <input
                id={`compose-${field}`}
                disabled={busy}
                value={draft[field].join("; ")}
                onChange={(e) =>
                  update({
                    [field]: e.target.value.split(/[;,]/).map((v) => v.trim()),
                  })
                }
                placeholder="E-Mail-Adresse hinzufügen"
                autoComplete="off"
              />
              {field === "to" && (
                <div className={s.recipientToggles}>
                  <button aria-pressed={cc} onClick={() => setCc((v) => !v)}>
                    Cc
                  </button>
                  <button aria-pressed={bcc} onClick={() => setBcc((v) => !v)}>
                    Bcc
                  </button>
                </div>
              )}
            </div>
          ))}
        <label className={s.addressRow}>
          <span>Betreff</span>
          <input
            disabled={busy}
            value={draft.subject}
            placeholder="Betreff hinzufügen"
            onChange={(e) => update({ subject: e.target.value })}
          />
        </label>
      </div>
      <div className={s.composeEditor}>
        <label className={s.srOnly} htmlFor="compose-message">
          Nachricht
        </label>
        <textarea
          id="compose-message"
          ref={editor}
          disabled={busy}
          value={draft.body}
          placeholder="Schreibe deine Nachricht …"
          onChange={(e) => update({ body: e.target.value })}
        />
        {draft.signatureId && <MailSignature />}
        {draft.attachments.length > 0 && (
          <div className={s.composeFiles}>
            {draft.attachments.map((a, i) => (
              <div key={i}>
                <Paperclip size={15} />
                <span>
                  {a.name}
                  <small>
                    {Math.ceil((a.contentBytes.length * 0.75) / 1024)} KB
                  </small>
                </span>
                <button
                  disabled={busy}
                  className={s.iconButton}
                  aria-label={`${a.name} entfernen`}
                  onClick={() =>
                    update({
                      attachments: draft.attachments.filter((_, j) => j !== i),
                    })
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={s.receiptOptions}>
        <label>
          <input
            type="checkbox"
            disabled={busy}
            checked={draft.isReadReceiptRequested === true}
            onChange={(e) =>
              update({ isReadReceiptRequested: e.target.checked })
            }
          />{" "}
          Lesebestätigung anfordern
        </label>
        <label>
          <input
            type="checkbox"
            disabled={busy}
            checked={draft.isDeliveryReceiptRequested === true}
            onChange={(e) =>
              update({ isDeliveryReceiptRequested: e.target.checked })
            }
          />{" "}
          Empfangsbestätigung anfordern
        </label>
        <small>
          Bestätigungen hängen vom Empfänger und dessen Mailsystem ab.
        </small>
      </div>
      <div className={s.textTools} role="toolbar" aria-label="Textwerkzeuge">
        <span>Nur Text</span>
        <i />
        <button
          disabled={busy}
          title="Aufzählung"
          aria-label="Aufzählung einfügen"
          onClick={() => prefixLines("bullet")}
        >
          <List size={18} />
        </button>
        <button
          disabled={busy}
          title="Nummerierung"
          aria-label="Nummerierung einfügen"
          onClick={() => prefixLines("number")}
        >
          <ListOrdered size={18} />
        </button>
        <button
          disabled={busy}
          title="Einrücken"
          aria-label="Text einrücken"
          onClick={() => prefixLines("indent")}
        >
          <IndentIncrease size={18} />
        </button>
        <i />
        <button
          disabled={busy}
          aria-label="Datei anfügen"
          onClick={() => file.current?.click()}
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={file}
          className={s.srOnly}
          type="file"
          multiple
          aria-label="Anhänge auswählen"
          disabled={busy}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <div className={s.composeStatus}>
        <ShieldCheck size={13} />
        <span>
          „Senden“ öffnet die Versandfreigabe.{" "}
          {draft.attachments.length
            ? `${draft.attachments.length} Anhang/Anhänge · `
            : ""}
          Anhänge zusammen max. 2,25 MB.
        </span>
      </div>
    </>
  );
}
