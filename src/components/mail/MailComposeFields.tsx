"use client";
import { useRef, useState } from "react";
import { Paperclip, Save, Send, ShieldCheck, X } from "lucide-react";
import type { MailDraft } from "@/lib/mail/model";
import { builtInTemplates } from "@/lib/mail/productivity";
import { MailRichEditor } from "./MailRichEditor";
import { MailSignature } from "./MailSignature";
import { localDateTime, type Template } from "./useMailProductivity";
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
  templates,
  onSaveTemplate,
  onPreview,
}: {
  draft: MailDraft;
  accounts: Account[];
  busy: boolean;
  update: (value: Partial<MailDraft>) => void;
  addFiles: (files: FileList | null) => void;
  save: () => void;
  review: () => void;
  templates: Template[];
  onSaveTemplate: (title: string) => void;
  onPreview: (index: number) => void;
}) {
  const [cc, setCc] = useState(draft.cc.some(Boolean)),
    [bcc, setBcc] = useState(draft.bcc.some(Boolean)),
    [title, setTitle] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const options: Template[] = [...builtInTemplates, ...templates];
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
          <Send size={16} />
          {draft.scheduledAt ? "Versand planen" : "Senden"}
          <ShieldCheck size={13} />
        </button>
        <button disabled={busy} onClick={() => file.current?.click()}>
          <Paperclip size={17} />
          Datei anfügen
        </button>
        <button disabled={busy} onClick={save}>
          <Save size={16} />
          Entwurf speichern
        </button>
      </div>
      <div className={s.templateTools}>
        <select
          aria-label="Textvorlage auswählen"
          defaultValue=""
          disabled={busy}
          onChange={(e) => {
            const t = options.find((t) => t.id === e.target.value);
            if (t)
              update({
                subject: t.subject,
                body: t.body,
                bodyHtml: t.body_html || undefined,
              });
            e.target.value = "";
          }}
        >
          <option value="">Vorlage einsetzen …</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <input
          aria-label="Name der neuen Vorlage"
          maxLength={100}
          placeholder="Vorlagenname"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          disabled={busy || !title.trim() || !draft.body.trim()}
          onClick={() => {
            onSaveTemplate(title.trim());
            setTitle("");
          }}
        >
          Als Vorlage speichern
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
            (f) =>
              f === "to" ||
              (f === "cc"
                ? cc || draft.cc.some(Boolean)
                : bcc || draft.bcc.some(Boolean)),
          )
          .map((f) => (
            <div className={s.addressRow} key={f}>
              <label htmlFor={`compose-${f}`}>
                {f === "to" ? "An" : f === "cc" ? "Cc" : "Bcc"}
              </label>
              <input
                id={`compose-${f}`}
                disabled={busy}
                value={draft[f].join("; ")}
                onChange={(e) =>
                  update({
                    [f]: e.target.value.split(/[;,]/).map((v) => v.trim()),
                  })
                }
                placeholder="E-Mail-Adresse hinzufügen"
                autoComplete="off"
              />
              {f === "to" && (
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
      <div
        className={s.composeEditor}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={(e) => {
          if (e.dataTransfer.files.length) {
            e.preventDefault();
            if (!busy) addFiles(e.dataTransfer.files);
          }
        }}
      >
        <small className={s.dropHint}>
          Dateien hierher ziehen oder „Datei anfügen“ wählen.
        </small>
        <MailRichEditor
          body={draft.body}
          html={draft.bodyHtml}
          disabled={busy}
          onChange={(body, bodyHtml) => update({ body, bodyHtml })}
        />
        {draft.signatureText && (
          <div className={s.textSignature}>{draft.signatureText}</div>
        )}
        {draft.signatureId && <MailSignature />}
        {!!draft.attachments.length && (
          <div className={s.composeFiles}>
            {draft.attachments.map((a, i) => (
              <div key={i}>
                <Paperclip size={15} />
                <span>
                  <button
                    type="button"
                    className={s.attachmentName}
                    onClick={() => onPreview(i)}
                  >
                    {a.name}
                  </button>
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
                      attachments: draft.attachments.filter((_, j) => i !== j),
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
      <div className={s.scheduleControls}>
        <label>
          <input
            type="checkbox"
            disabled={busy}
            checked={!!draft.scheduledAt}
            onChange={(e) =>
              update({
                scheduledAt: e.target.checked
                  ? new Date(Date.now() + 3600000).toISOString()
                  : undefined,
              })
            }
          />
          Später senden
        </label>
        {draft.scheduledAt && (
          <label>
            Versandtermin{" "}
            <input
              aria-label="Geplanter Versandtermin"
              type="datetime-local"
              disabled={busy}
              value={localDateTime(new Date(draft.scheduledAt))}
              onChange={(e) => {
                if (e.target.value)
                  update({
                    scheduledAt: new Date(e.target.value).toISOString(),
                  });
              }}
            />
          </label>
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
          />
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
          />
          Empfangsbestätigung anfordern
        </label>
        <small>
          Bestätigungen hängen vom Empfänger und dessen Mailsystem ab.
        </small>
      </div>
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
      <div className={s.composeStatus}>
        <ShieldCheck size={13} />
        <span>
          „Senden“ und „Versand planen“ öffnen zuerst die Freigabe. Anhänge
          zusammen max. 2,25 MB.
        </span>
      </div>
    </>
  );
}
