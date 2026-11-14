"use client";
import { useCallback, useEffect, useState } from "react";
import { MailDialog } from "./MailDialog";
import s from "./mail.module.css";
type Item = {
  id: string;
  subject?: string;
  displayName?: string;
  emailAddresses?: { address: string }[];
  companyName?: string;
  businessPhones?: string[];
  start?: { dateTime: string };
  end?: { dateTime: string };
  location?: { displayName: string };
  bodyPreview?: string;
  body?: { content: string };
  attendees?: { emailAddress: { address: string } }[];
  isOrganizer?: boolean;
  isOnlineMeeting?: boolean;
  title?: string;
  due_at?: string;
  completed_at?: string | null;
};
export type MailPimItem = Item;
const fieldLabels: Record<string, string> = {
  subject: "Titel",
  start: "Beginn",
  end: "Ende",
  location: "Ort",
  notes: "Notizen",
  attendees: "Teilnehmer",
  displayName: "Name",
  email: "E-Mail",
  companyName: "Firma",
  phone: "Telefon",
  title: "Titel",
  due: "Fällig",
};
type Mode = "calendar" | "contacts" | "tasks";
async function request(path: string, value?: unknown) {
  const r = await fetch("/api/mail/" + path, {
    cache: "no-store",
    ...(value
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        }
      : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Anfrage fehlgeschlagen.");
  return data;
}
const utc = (s: string) => s + (/Z$|[+-]\d\d:\d\d$/.test(s) ? "" : "Z");
const dateInput = (s?: string) =>
  s
    ? new Date(
        new Date(utc(s)).getTime() -
          new Date(utc(s)).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
const samples: Record<Mode, Item[]> = {
  calendar: [
    {
      id: "demo-event",
      subject: "Projektgespräch",
      start: { dateTime: "2026-11-17T09:00:00Z" },
      end: { dateTime: "2026-11-17T10:00:00Z" },
      location: { displayName: "Microsoft Teams" },
      attendees: [],
      isOrganizer: true,
    },
  ],
  contacts: [
    {
      id: "demo-contact",
      displayName: "Lena Berger",
      emailAddresses: [{ address: "lena.berger@example.com" }],
      companyName: "Demo-Projektteam",
    },
  ],
  tasks: [
    {
      id: "demo-task",
      title: "Projektunterlagen prüfen",
      due_at: "2026-11-16T09:00:00Z",
      completed_at: null,
    },
  ],
};
export function MailPim({
  mode,
  demo,
  demoRecords,
  onDemoChange,
}: {
  mode: Mode;
  demo: boolean;
  demoRecords?: Item[];
  onDemoChange?: (items: Item[]) => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editor, setEditor] = useState<Partial<Item> | null>(null),
    [review, setReview] = useState(false),
    [deleting, setDeleting] = useState<Item | null>(null),
    [fields, setFields] = useState<Record<string, string>>({}),
    [completed, setCompleted] = useState(false),
    [requestId, setRequestId] = useState("");
  const load = useCallback(
    async (next?: string) => {
      setBusy(true);
      try {
        if (demo) {
          setItems(demoRecords ?? samples[mode]);
          return;
        }
        const data = await request(
          (mode === "tasks" ? "reminders?includeCompleted=1" : mode) +
            (next
              ? `${mode === "tasks" ? "&" : "?"}cursor=${encodeURIComponent(next)}`
              : ""),
        );
        setItems((old) =>
          next
            ? [...old, ...(data.value ?? data.reminders ?? [])]
            : (data.value ?? data.reminders ?? []),
        );
        setCursor(data["@odata.nextLink"] ?? null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [mode, demo, demoRecords],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function edit(item?: Item) {
    if (mode === "calendar" && item?.id && !demo) {
      setBusy(true);
      try {
        item = (await request(`event?id=${encodeURIComponent(item.id)}`)).item;
      } catch (e) {
        setError((e as Error).message);
        return;
      } finally {
        setBusy(false);
      }
    }
    setError("");
    setRequestId(crypto.randomUUID());
    setEditor(item || {});
    setReview(false);
    setFields(
      mode === "contacts"
        ? {
            displayName: item?.displayName || "",
            email: item?.emailAddresses?.[0]?.address || "",
            companyName: item?.companyName || "",
            phone: item?.businessPhones?.[0] || "",
          }
        : mode === "calendar"
          ? {
              subject: item?.subject || "",
              start: dateInput(item?.start?.dateTime),
              end: dateInput(item?.end?.dateTime),
              location: item?.location?.displayName || "",
              notes: item?.body?.content || item?.bodyPreview || "",
              attendees:
                item?.attendees
                  ?.map((a) => a.emailAddress.address)
                  .join("; ") || "",
            }
          : { title: "", due: "" },
    );
  }
  function value() {
    return mode === "calendar"
      ? {
          ...fields,
          start: new Date(fields.start).toISOString(),
          end: new Date(fields.end).toISOString(),
          attendees: fields.attendees
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : fields;
  }
  function updateItems(next: Item[]) {
    setItems(next);
    if (demo) onDemoChange?.(next);
  }
  async function save() {
    setBusy(true);
    try {
      const v = value();
      if (demo) {
        updateItems([
          {
            id: editor?.id || crypto.randomUUID(),
            ...(mode === "contacts"
              ? {
                  displayName: fields.displayName,
                  emailAddresses: [{ address: fields.email }],
                  companyName: fields.companyName,
                  businessPhones: fields.phone ? [fields.phone] : [],
                }
              : mode === "calendar"
                ? {
                    subject: fields.subject,
                    start: { dateTime: new Date(fields.start).toISOString() },
                    end: { dateTime: new Date(fields.end).toISOString() },
                    location: { displayName: fields.location },
                    attendees: [],
                    isOrganizer: true,
                  }
                : {
                    title: fields.title,
                    due_at: new Date(fields.due).toISOString(),
                  }),
          },
          ...items.filter((x) => x.id !== editor?.id),
        ]);
        setError("In der Demo gespeichert. Keine Microsoft-Daten geändert.");
      } else if (mode === "tasks") {
        await request("reminders", {
          title: fields.title,
          dueAt: new Date(fields.due).toISOString(),
        });
        await load();
      } else {
        await request(mode, {
          operation: editor?.id ? "update" : "create",
          id: editor?.id,
          requestId,
          value: v,
          confirmed: true,
        });
        await load();
      }
      setEditor(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      if (!demo)
        await request(mode, {
          operation: "delete",
          id: deleting.id,
          confirmed: true,
        });
      updateItems(items.filter((i) => i.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleTask(item: Item) {
    setBusy(true);
    try {
      if (!demo)
        await request("reminder-action", {
          id: item.id,
          complete: !item.completed_at,
          confirmed: true,
        });
      updateItems(
        items.map((i) =>
          i.id === item.id
            ? {
                ...i,
                completed_at: i.completed_at ? null : new Date().toISOString(),
              }
            : i,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>
        {mode === "calendar"
          ? "Dein Kalender"
          : mode === "contacts"
            ? "Deine Kontakte"
            : "Aufgaben & Erinnerungen"}
      </h1>
      <p>
        {mode === "calendar"
          ? "Termine der nächsten 30 Tage · Anzeige in deiner Gerätezeitzone"
          : mode === "contacts"
            ? "Deine Microsoft-Kontakte"
            : "Persönliche Erinnerungen mit EMA-Push-Anbindung"}
      </p>
      <button className={s.primary} disabled={busy} onClick={() => void edit()}>
        {mode === "calendar"
          ? "Neuer Termin"
          : mode === "contacts"
            ? "Neuer Kontakt"
            : "Neue Erinnerung"}
      </button>
      {mode === "tasks" ? (
        <label className={s.checkLabel}>
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
          />
          Erledigte anzeigen
        </label>
      ) : null}
      {error ? <p role="status">{error}</p> : null}
      {items
        .filter((i) => mode !== "tasks" || completed || !i.completed_at)
        .map((item) => (
          <article className={s.auxItem} key={item.id}>
            <strong>{item.subject || item.displayName || item.title}</strong>
            <small>
              {item.start
                ? new Date(utc(item.start.dateTime)).toLocaleString("de-DE")
                : item.emailAddresses?.map((a) => a.address).join(", ") ||
                  (item.due_at &&
                    new Date(item.due_at).toLocaleString("de-DE"))}
            </small>
            <div className={s.aiActions}>
              {mode === "tasks" ? (
                <button disabled={busy} onClick={() => void toggleTask(item)}>
                  {item.completed_at ? "Wieder öffnen" : "Erledigen"}
                </button>
              ) : (
                <>
                  <button
                    disabled={
                      busy ||
                      (mode === "calendar" && item.isOrganizer === false)
                    }
                    onClick={() => void edit(item)}
                  >
                    Bearbeiten
                  </button>
                  <button disabled={busy} onClick={() => setDeleting(item)}>
                    {mode === "calendar"
                      ? "Termin entfernen"
                      : "Kontakt entfernen"}
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      {cursor ? (
        <button
          disabled={busy}
          className={s.subtle}
          onClick={() => void load(cursor)}
        >
          Weitere laden
        </button>
      ) : null}
      {editor ? (
        <MailDialog
          title={
            review
              ? "Änderung prüfen"
              : mode === "calendar"
                ? "Termin bearbeiten"
                : mode === "contacts"
                  ? "Kontakt bearbeiten"
                  : "Erinnerung anlegen"
          }
          busy={busy}
          onClose={() => setEditor(null)}
        >
          {error ? <p role="alert">{error}</p> : null}
          {review ? (
            <>
              <p>
                {mode === "calendar"
                  ? "Einladungen und Aktualisierungen können E-Mails an Teilnehmer auslösen. Prüfe die Angaben vor deiner Freigabe."
                  : "Bitte die Angaben prüfen."}
                {demo
                  ? " In dieser Demo werden keine Nachrichten versendet."
                  : ""}
              </p>
              <div className={s.review}>
                {Object.entries(fields)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <p key={k}>
                      <b>{fieldLabels[k] || k}</b>: {v}
                    </p>
                  ))}
              </div>
              <footer>
                <button className={s.subtle} onClick={() => setReview(false)}>
                  Zurück
                </button>
                <button
                  className={s.primary}
                  disabled={busy}
                  onClick={() => void save()}
                >
                  Änderung freigeben
                </button>
              </footer>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setReview(true);
              }}
            >
              {editor?.isOnlineMeeting ? (
                <p>
                  Notizen des bestehenden Online-Meetings bleiben erhalten,
                  damit der Einwahllink unverändert bleibt.
                </p>
              ) : null}
              {Object.entries(fields).map(([key, v]) => (
                <label key={key}>
                  {
                    (
                      {
                        subject: "Titel",
                        start: "Beginn",
                        end: "Ende",
                        location: "Ort",
                        notes: "Notizen",
                        attendees: "Teilnehmer (E-Mail, mit Semikolon trennen)",
                        displayName: "Name",
                        email: "E-Mail",
                        companyName: "Firma",
                        phone: "Telefon",
                        title: "Titel",
                        due: "Fällig",
                      } as Record<string, string>
                    )[key]
                  }
                  <input
                    disabled={
                      key === "notes" && editor?.isOnlineMeeting === true
                    }
                    required={[
                      "subject",
                      "start",
                      "end",
                      "displayName",
                      "title",
                      "due",
                    ].includes(key)}
                    type={
                      ["start", "end", "due"].includes(key)
                        ? "datetime-local"
                        : key === "email"
                          ? "email"
                          : "text"
                    }
                    value={v}
                    onChange={(e) =>
                      setFields((old) => ({ ...old, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
              <footer>
                <button className={s.primary} type="submit">
                  Angaben prüfen
                </button>
              </footer>
            </form>
          )}
        </MailDialog>
      ) : null}
      {deleting ? (
        <MailDialog
          title="Entfernen bestätigen"
          busy={busy}
          onClose={() => setDeleting(null)}
        >
          <p>
            {deleting.subject || deleting.displayName} entfernen?{" "}
            {mode === "calendar"
              ? "Als Organisator kann dies Absagen an Teilnehmer auslösen."
              : "Der Kontakt wird aus deinem Microsoft-Adressbuch entfernt."}
          </p>
          <footer>
            <button
              className={s.primary}
              disabled={busy}
              onClick={() => void remove()}
            >
              Entfernen freigeben
            </button>
          </footer>
        </MailDialog>
      ) : null}
    </>
  );
}
