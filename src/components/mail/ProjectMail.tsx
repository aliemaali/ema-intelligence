"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Row = {
  mailbox: string;
  message_id: string;
  subject: string;
  sender: string;
  created_at: string;
};
export function ProjectMail({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(
      `/api/mail/project-mail?${new URLSearchParams({ projectId, page: String(page) })}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (active) {
          setRows((old) => (page ? [...old, ...j.links] : j.links));
          setMore(j.more);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [projectId, page]);
  return (
    <section className="page-container py-6">
      <h2 className="text-xl font-semibold">Projektkorrespondenz</h2>
      <p className="my-3 text-sm text-muted-foreground">
        Zugeordnete Mails öffnen sich im berechtigten EMA-Postfach. Abgelegte
        Anhänge findest du unter Dokumente.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows.map((r) => (
        <article
          className="my-3 rounded-lg border p-4"
          key={`${r.mailbox}:${r.message_id}`}
        >
          <Link
            href={`/mail?${new URLSearchParams({ mailbox: r.mailbox, message: r.message_id })}`}
            className="font-semibold underline"
          >
            {r.subject}
          </Link>
          <p className="mt-2 text-sm">
            {r.sender} · {new Date(r.created_at).toLocaleDateString("de-DE")}
          </p>
        </article>
      ))}
      {!rows.length && !error && <p>Noch keine Mails zugeordnet.</p>}
      {more && (
        <button className="btn-secondary" onClick={() => setPage((p) => p + 1)}>
          Weitere Mails laden
        </button>
      )}
    </section>
  );
}
