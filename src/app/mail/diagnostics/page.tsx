"use client";
import { useState } from "react";
import Link from "next/link";
import type { MailAnalysis } from "@/lib/mail/analysis";
import s from "@/components/mail/mail.module.css";
export default function MailDiagnostics() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [analysis, setAnalysis] = useState<MailAnalysis | null>(null);
  async function run() {
    setBusy(true);
    setError("");
    setAnalysis(null);
    try {
      const response = await fetch("/api/mail/analyze-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Der Verbindungstest ist fehlgeschlagen.",
        );
      setAnalysis(data.analysis);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.workspace} data-theme="light">
      <section
        className={s.aux}
        style={{ maxWidth: 760, margin: "0 auto", padding: 28 }}
      >
        <Link href="/mail">← Zurück zu EMA Mail</Link>
        <h1 style={{ marginTop: 24 }}>KI-Verbindung prüfen</h1>
        <p>
          Dieser Test analysiert eine fest hinterlegte, fiktive Nachricht. Er
          liest keine Nachricht aus deinem Postfach und verschickt keine E-Mail.
          Der Test zählt zum normalen Analyse-Limit.
        </p>
        <button
          className={s.primary}
          disabled={busy}
          onClick={() => void run()}
        >
          {busy
            ? "KI-Verbindung wird geprüft …"
            : "KI-Test mit Beispieldaten starten"}
        </button>
        {error ? <p role="alert">{error}</p> : null}
        {analysis ? (
          <article className={s.auxItem}>
            <h2 role="status">KI-Verbindung funktioniert</h2>
            <h3>Zusammenfassung der Testnachricht</h3>
            <p>{analysis.summary}</p>
            <h3>Priorität</h3>
            <p>
              {analysis.priority === "high" ? "Hoch" : "Normal"} ·{" "}
              {analysis.reason}
            </p>
            <h3>Aufgabenvorschläge</h3>
            <ul>
              {analysis.tasks.map((task, index) => (
                <li key={index}>{task}</li>
              ))}
            </ul>
            <h3>Antwortentwurf zur Testnachricht</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{analysis.suggestedReply}</p>
            <small>Test abgeschlossen. Keine E-Mail versendet.</small>
          </article>
        ) : null}
      </section>
    </main>
  );
}
