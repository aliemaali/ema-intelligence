"use client";
import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Paperclip, Save, Send, ShieldCheck, X } from "lucide-react";
import type { MailDraft } from "@/lib/mail/model";
import { MailRichEditor } from "./MailRichEditor";
import { MailSignature } from "./MailSignature";
import { MailRecipientInput } from "./MailRecipientInput";
import type { ContactNames } from "@/lib/mail/contact-names";
import s from "./mail.module.css";
type Account = { mailbox: string; name?: string; can_send: boolean };
export function MailComposeFields({
  draft,
  accounts,
  contactNames,
  busy,
  update,
  addFiles,
  save,
  review,
  onPreview,
}: {
  draft: MailDraft;
  accounts: Account[];
  contactNames: ContactNames;
  busy: boolean;
  update: (value: Partial<MailDraft>) => void;
  addFiles: (files: FileList | null) => void;
  save: () => void;
  review: () => void;
  onPreview: (index: number) => void;
}) {
  const [recipientsExpanded, setRecipientsExpanded] = useState(() =>
    [...draft.cc,...draft.bcc].some(value => Boolean(value.trim())),
  );
  const file = useRef<HTMLInputElement>(null);
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
            !draft.to.some(value=>Boolean(value.trim())) ||
            [...draft.to,...draft.cc,...draft.bcc].some(value=>value.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) ||
            !draft.subject.trim() ||
            !draft.body.trim()
          }
          onClick={review}
        >
          <Send size={16} />
          Senden
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
          .filter(f => f === 'to' || recipientsExpanded)
          .map((f) => (
            <div className={s.addressRow} key={f} id={f === 'to' ? undefined : `compose-${f}-row`}>
              <label htmlFor={`compose-${f}`}>
                {f === "to" ? "An" : f === "cc" ? "Cc" : "Bcc"}
              </label>
              <MailRecipientInput
                id={`compose-${f}`}
                label={f === 'to' ? 'An' : f === 'cc' ? 'Cc' : 'Bcc'}
                disabled={busy}
                values={draft[f]}
                contacts={contactNames}
                onChange={addresses => update({ [f]: addresses })}
              />
              {f === "to" && (
                <div className={s.recipientToggles}>
                  <button type="button" className={s.recipientExpand} disabled={busy}
                    aria-expanded={recipientsExpanded}
                    aria-controls={recipientsExpanded ? 'compose-cc-row compose-bcc-row' : undefined}
                    aria-label={recipientsExpanded ? 'Cc und Bcc zuklappen' : 'Cc und Bcc aufklappen'}
                    title={recipientsExpanded ? 'Cc und Bcc zuklappen' : 'Cc und Bcc aufklappen'}
                    onClick={() => setRecipientsExpanded(value => !value)}>
                    {recipientsExpanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
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
        <MailRichEditor
          body={draft.body}
          html={draft.bodyHtml}
          disabled={busy}
          options={
            <div className={s.receiptOptions} aria-label="Bestätigungen">
              <label title="Lesebestätigung anfordern – abhängig vom Empfänger und dessen Mailsystem">
                <input
                  type="checkbox"
                  disabled={busy}
                  aria-label="Lesebestätigung anfordern"
                  checked={draft.isReadReceiptRequested === true}
                  onChange={(e) =>
                    update({ isReadReceiptRequested: e.target.checked })
                  }
                />
                Lesebestätigung
              </label>
              <label title="Empfangsbestätigung anfordern – abhängig vom Empfänger und dessen Mailsystem">
                <input
                  type="checkbox"
                  disabled={busy}
                  aria-label="Empfangsbestätigung anfordern"
                  checked={draft.isDeliveryReceiptRequested === true}
                  onChange={(e) =>
                    update({ isDeliveryReceiptRequested: e.target.checked })
                  }
                />
                Empfangsbestätigung
              </label>
            </div>
          }
          onChange={(body, bodyHtml) => update({ body, bodyHtml })}
        />
        {draft.signatureText && (
          <div className={s.textSignature}>{draft.signatureText}</div>
        )}
        {draft.signatureId && <MailSignature signatureId={draft.signatureId} />}
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
        <span>Versand erst nach Freigabe · Anhänge zusammen max. 2,25 MB.</span>
      </div>
    </>
  );
}
