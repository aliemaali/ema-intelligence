"use client";
import { useEffect, useState } from "react";
import { SIGNATURE_ADDRESS } from "@/lib/mail/signature";
import { mailPost, type ProductivityData } from "./useMailProductivity";
import s from "./mail.module.css";
const labels: Record<string, string> = {
  pending: "Vorgemerkt",
  sending: "Versand läuft",
  submitted: "An Microsoft übergeben",
  uncertain: "Status unklar – Gesendet-Ordner prüfen",
  blocked: "Manuelle Prüfung erforderlich",
  cancelled: "Abgebrochen",
};
export function MailProductivitySettings({
  demo,
  mailbox,
  address,
  data,
  update,
  refresh,
  onSignature,
}: {
  demo: boolean;
  mailbox: string;
  address: string;
  data: ProductivityData;
  update: (fn: (d: ProductivityData) => ProductivityData) => void;
  refresh: () => Promise<void>;
  onSignature: (text: string) => void;
}) {
  const [text, setText] = useState(data.signatureText),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => setText(data.signatureText), [data.signatureText, mailbox]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.auxItem}>
      <h2>Signatur, Vorlagen & geplante Aufträge</h2>
      {address === SIGNATURE_ADDRESS ? (
        <p>
          Für dieses Postfach wird deine kompakte EMA-Bildsignatur automatisch
          eingesetzt.
        </p>
      ) : (
        <>
          <label>
            Persönliche Signatur für dieses Postfach
            <textarea
              aria-label="Persönliche Mitarbeitersignatur"
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button
            className={s.subtle}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (!demo) await mailPost("signature", { mailbox, text });
                update((d) => ({ ...d, signatureText: text }));
                onSignature(text);
                setNotice(
                  "Signatur gespeichert. Neue Entwürfe verwenden diese Signatur.",
                );
              })
            }
          >
            Signatur speichern
          </button>
        </>
      )}
      <h3>Persönliche Vorlagen</h3>
      {data.templates.map((t) => (
        <div className={s.toolRow} key={t.id}>
          <span>{t.title}</span>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (!demo)
                  await mailPost("template", {
                    mailbox,
                    id: t.id,
                    operation: "delete",
                  });
                update((d) => ({
                  ...d,
                  templates: d.templates.filter((v) => v.id !== t.id),
                }));
              })
            }
          >
            Vorlage entfernen
          </button>
        </div>
      ))}
      {!data.templates.length && (
        <p>Im Schreibfenster kannst du eigene Textvorlagen speichern.</p>
      )}
      <h3>Versandaufträge</h3>
      <p>
        {demo
          ? "Demo-Aufträge versenden nichts."
          : data.schedulerConfigured
            ? "Freigabe gilt nur für den gespeicherten Inhalt und Termin. Verarbeitung beim nächsten Scheduler-Lauf."
            : "Der Versand-Scheduler ist noch nicht aktiviert."}
      </p>
      {data.schedules.map((j) => (
        <div className={s.queueItem} key={j.id}>
          <strong>{j.subject}</strong>
          <span>
            {new Date(j.run_at).toLocaleString("de-DE")} ·{" "}
            {labels[j.state] || j.state}
          </span>
          {j.last_error && <small>{j.last_error}</small>}
          {["pending", "blocked"].includes(j.state) && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (!demo) {
                    await mailPost("cancel-schedule", { mailbox, id: j.id });
                    await refresh();
                  } else
                    update((d) => ({
                      ...d,
                      schedules: d.schedules.map((v) =>
                        v.id === j.id ? { ...v, state: "cancelled" } : v,
                      ),
                    }));
                })
              }
            >
              Geplanten Versand abbrechen
            </button>
          )}
        </div>
      ))}
      <button
        className={s.subtle}
        disabled={busy}
        onClick={() => void run(refresh)}
      >
        Aufträge aktualisieren
      </button>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
