"use client";
import { useEffect, useState } from "react";
import s from "./mail.module.css";
type Person = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
};
type Membership = {
  user_id: string;
  mailbox: string;
  can_read: boolean;
  can_write: boolean;
  can_send: boolean;
};
export function MailTeam() {
  const [people, setPeople] = useState<Person[]>([]),
    [memberships, setMemberships] = useState<Membership[]>([]),
    [userId, setUserId] = useState(""),
    [mailbox, setMailbox] = useState(""),
    [canWrite, setCanWrite] = useState(false),
    [canSend, setCanSend] = useState(false),
    [status, setStatus] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/mail/team", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return;
        const result = await r.json();
        if (active) {
          setPeople(
            result.people.filter(
              (p: Person) =>
                !["partner", "sales_partner", "vertriebspartner"].includes(
                  p.role,
                ),
            ),
          );
          setMemberships(result.memberships);
          setReady(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function save(canRead: boolean) {
    setBusy(true);
    try {
      const response = await fetch("/api/mail/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          mailbox,
          canRead,
          canWrite: canRead && canWrite,
          canSend: canRead && canSend,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMemberships((old) => [
        ...old.filter((m) => m.user_id !== userId || m.mailbox !== mailbox),
        {
          user_id: userId,
          mailbox,
          can_read: canRead,
          can_write: canRead && canWrite,
          can_send: canRead && canSend,
        },
      ]);
      setStatus(
        "EMA-Rechte gespeichert. Microsoft Exchange-Rechte müssen zusätzlich bestehen.",
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return null;
  return (
    <section className={s.auxItem}>
      <h2>Gemeinsame Postfächer verwalten</h2>
      <p>
        EMA-Rechte vergeben keine Microsoft-Rechte. Jeder Mitarbeiter verbindet
        sein eigenes Microsoft-Konto.
      </p>
      <label>
        Mitarbeiter{" "}
        <select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Bitte auswählen</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name || p.email}
            </option>
          ))}
        </select>
      </label>
      <label>
        {" "}
        Postfach{" "}
        <input
          type="email"
          value={mailbox}
          onChange={(e) => setMailbox(e.target.value.toLowerCase())}
          placeholder="team@firma.de"
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={canWrite}
          onChange={(e) => setCanWrite(e.target.checked)}
        />{" "}
        Bearbeiten
      </label>
      <label>
        <input
          type="checkbox"
          checked={canSend}
          onChange={(e) => setCanSend(e.target.checked)}
        />{" "}
        Senden nach Freigabe
      </label>
      <div className={s.aiActions}>
        <button
          disabled={busy || !userId || !mailbox}
          onClick={() => void save(true)}
        >
          Lesen und gewählte Rechte erlauben
        </button>
        <button
          disabled={busy || !userId || !mailbox}
          onClick={() => void save(false)}
        >
          Zugriff entziehen
        </button>
      </div>
      {status ? <p role="status">{status}</p> : null}
      {memberships.map((m) => (
        <p key={`${m.user_id}:${m.mailbox}`}>
          {people.find((p) => p.id === m.user_id)?.full_name || m.user_id} ·{" "}
          {m.mailbox} · {m.can_read ? "Lesen" : "Gesperrt"}{" "}
          {m.can_write ? "· Bearbeiten" : ""} {m.can_send ? "· Senden" : ""}
        </p>
      ))}
    </section>
  );
}
