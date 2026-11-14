"use client";
import { useEffect, useState } from "react";
import s from "./mail.module.css";
type Setting = {
  mailbox: string;
  enabled: boolean;
  analyze: boolean;
  push: boolean;
  last_success_at?: string;
  last_error?: string;
};
export function MailAutomation({
  demo,
  mailbox,
}: {
  demo: boolean;
  mailbox: string;
}) {
  const [settings, setSettings] = useState<Setting>({
      mailbox,
      enabled: false,
      analyze: false,
      push: false,
    }),
    [notice, setNotice] = useState(""),
    [jobs, setJobs] = useState<
      { id: string; state: string; push_state: string }[]
    >([]),
    [busy, setBusy] = useState(false),
    [configured, setConfigured] = useState(false);
  useEffect(() => {
    let active = true;
    setSettings({ mailbox, enabled: false, analyze: false, push: false });
    setJobs([]);
    if (!demo)
      fetch("/api/mail/automation", { cache: "no-store" })
        .then(async (r) => {
          const result = await r.json();
          if (!r.ok) throw new Error(result.error);
          if (active) {
            setSettings(
              result.settings.find((s: Setting) => s.mailbox === mailbox) || {
                mailbox,
                enabled: false,
                analyze: false,
                push: false,
              },
            );
            setJobs(result.jobs);
            setConfigured(result.workerConfigured);
          }
        })
        .catch((e) => {
          if (active) setNotice(e.message);
        });
    return () => {
      active = false;
    };
  }, [demo, mailbox]);
  async function save() {
    setBusy(true);
    try {
      if (!demo) {
        const { enabled, analyze, push } = settings;
        const response = await fetch("/api/mail/automation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mailbox, enabled, analyze, push }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
      }
      setNotice(
        demo
          ? "Demo-Einstellung gespeichert. Kein Hintergrundprozess wurde gestartet."
          : "Einstellungen gespeichert. Ein aktivierter Zeitplan verarbeitet neue Nachrichten.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={s.auxItem}>
      <h2>Mail-Automatisierung</h2>
      <p>
        Für {mailbox === "me" ? "dein persönliches Postfach" : mailbox}.
        Automatische Antworten bleiben Entwürfe. Vor dem Einschalten prüfst du
        die verfügbaren Rechte und Push-Geräte.
      </p>
      <label className={s.checkLabel}>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) =>
            setSettings((v) => ({ ...v, enabled: e.target.checked }))
          }
        />
        Neue Nachrichten im Hintergrund verarbeiten
      </label>
      <label className={s.checkLabel}>
        <input
          type="checkbox"
          checked={settings.analyze}
          onChange={(e) =>
            setSettings((v) => ({ ...v, analyze: e.target.checked }))
          }
        />
        KI-Zusammenfassung und Antwortentwurf (maximal 20 neue Analysen/Stunde)
      </label>
      <label className={s.checkLabel}>
        <input
          type="checkbox"
          checked={settings.push}
          onChange={(e) =>
            setSettings((v) => ({ ...v, push: e.target.checked }))
          }
        />
        Neue-Mail-Push ohne Betreff und Absender auf dem Sperrbildschirm
      </label>
      <p>
        {demo
          ? "Demo: Hintergrund und Push sind nicht aktiv."
          : configured
            ? "Worker freigeschaltet; ein Zeitplan muss eingerichtet sein."
            : "Worker noch nicht freigeschaltet."}
      </p>
      <button className={s.primary} disabled={busy} onClick={() => void save()}>
        Einstellungen speichern
      </button>
      {notice ? <p role="status">{notice}</p> : null}
      {settings.last_success_at ? (
        <p>
          Letzter Abgleich:{" "}
          {new Date(settings.last_success_at).toLocaleString("de-DE")}
        </p>
      ) : null}
      {settings.last_error ? <p>{settings.last_error}</p> : null}
      {jobs.length ? (
        <p>
          Letzte Jobs:{" "}
          {jobs.map((j) => `${j.state} / Push: ${j.push_state}`).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
