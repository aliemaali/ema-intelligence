"use client";
import { useEffect, useState } from "react";
import type { Message } from "@/lib/mail/model";
import { mailPost } from "./useMailProductivity";
import s from "./mail.module.css";
export function MailMessageTools({
  demo,
  message,
  mailbox,
  projects,
  onProject,
}: {
  demo: boolean;
  message: Message;
  mailbox: string;
  projects: { id: string; project_name: string }[];
  onProject: (id: string) => void;
}) {
  const [project, setProject] = useState(""),
    [linked, setLinked] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [thread, setThread] = useState<Message[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [threadOpen, setThreadOpen] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setProject("");
    setLinked([]);
    onProject("");
    if (!demo)
      fetch(
        `/api/mail/project-link?${new URLSearchParams({ mailbox, messageId: message.id })}`,
        { cache: "no-store" },
      )
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error);
          if (active) {
            const ids = (j.links || []).map(
              (l: { project_id: string }) => l.project_id,
            );
            setLinked(ids);
            setProject(ids[0] || "");
            onProject(ids[0] || "");
          }
        })
        .catch((e) => {
          if (active) setNotice(e.message);
        });
    return () => {
      active = false;
    };
  }, [demo, mailbox, message.id, onProject]);
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
  async function loadThread(next?: string) {
    await run(async () => {
      if (demo) {
        setThread([
          {
            ...message,
            id: "demo-thread-previous",
            subject: "Vorherige Abstimmung · Demo",
            body: {
              contentType: "text",
              content:
                "Vielen Dank für die Abstimmung. Die nächsten Schritte halten wir hier im Gespräch fest.",
            },
          },
        ]);
        setThreadOpen(true);
        return;
      }
      const r = await fetch(
          `/api/mail/thread?${new URLSearchParams({ mailbox, messageId: message.id, ...(next ? { cursor: next } : {}) })}`,
          { cache: "no-store" },
        ),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setThread((old) =>
        next
          ? [
              ...old,
              ...j.messages.filter(
                (m: Message) => !old.some((o) => o.id === m.id),
              ),
            ]
          : j.messages,
      );
      setCursor(j.cursor);
      setThreadOpen(true);
    });
  }
  return (
    <section className={s.messageTools} aria-label="Projekt und Gesprächsverlauf">
      <h3>Projekt & Gesprächsverlauf</h3>
      <div className={s.toolRow}>
        <select
          aria-label="Projekt für diese Mail"
          value={project}
          onChange={(e) => {
            setProject(e.target.value);
            onProject(e.target.value);
          }}
        >
          <option value="">Projekt auswählen</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_name}
            </option>
          ))}
        </select>
        <button
          disabled={busy || !project}
          onClick={() =>
            void run(async () => {
              if (!demo)
                await mailPost("project-link", {
                  mailbox,
                  messageId: message.id,
                  projectId: project,
                });
              setLinked((old) => [...new Set([...old, project])]);
              setNotice(
                demo
                  ? "Demo-Zuordnung gespeichert."
                  : "Mail dem Projekt zugeordnet. DMS-Ablage verwendet dieses Projekt.",
              );
            })
          }
        >
          Zuordnen
        </button>
        {linked.includes(project) && (
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (!demo)
                  await mailPost("project-link", {
                    mailbox,
                    messageId: message.id,
                    projectId: project,
                    operation: "remove",
                  });
                setLinked((old) => old.filter((id) => id !== project));
                setNotice("Zuordnung entfernt.");
              })
            }
          >
            Zuordnung lösen
          </button>
        )}
      </div>
      <div className={s.toolRow}>
        <button
          disabled={busy}
          onClick={() =>
            threadOpen ? setThreadOpen(false) : void loadThread()
          }
        >
          {threadOpen ? "Gespräch schließen" : "Gesprächsverlauf öffnen"}
        </button>
      </div>
      {threadOpen && (
        <div className={s.thread}>
          {thread
            .filter((m) => m.id !== message.id)
            .sort(
              (a, b) =>
                Date.parse(a.receivedDateTime) - Date.parse(b.receivedDateTime),
            )
            .map((m) => (
              <details key={m.id}>
                <summary>
                  {m.from.emailAddress.name || m.from.emailAddress.address} ·{" "}
                  {m.subject} ·{" "}
                  {new Date(m.receivedDateTime).toLocaleString("de-DE")}
                </summary>
                <p>
                  {m.body?.contentType?.toLowerCase() === "html"
                    ? m.bodyPreview
                    : m.body?.content || m.bodyPreview}
                </p>
              </details>
            ))}
          {!thread.filter((m) => m.id !== message.id).length && (
            <p>Keine weiteren Nachrichten im geladenen Verlauf.</p>
          )}
          {cursor && (
            <button disabled={busy} onClick={() => void loadThread(cursor)}>
              Weitere Gesprächsnachrichten
            </button>
          )}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
