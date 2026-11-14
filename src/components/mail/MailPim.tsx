"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MailDialog } from "./MailDialog";
import s from "./mail.module.css";
import { MailCalendarMonth } from "./MailCalendarMonth";
import { monthDays, teamsJoinUrl } from "@/lib/mail/calendar";
import type { CalendarSeed } from "@/lib/mail/voice";
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
  isAllDay?: boolean;
  onlineMeetingProvider?: string;
  onlineMeeting?: { joinUrl?: string };
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
  initialSeed,
  onSeedConsumed,
}: {
  initialSeed?: CalendarSeed | null;
  onSeedConsumed?: () => void;
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
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [teamsMeeting, setTeamsMeeting] = useState(false);
  const [teamsAvailable, setTeamsAvailable] = useState<boolean | null>(null);
  const seedConsumed = useRef(onSeedConsumed);
  seedConsumed.current = onSeedConsumed;
  useEffect(() => {
    if (mode !== "calendar" || !initialSeed) return;
    setEditor({}); setReview(false); setError(""); setRequestId(crypto.randomUUID());
    setTeamsMeeting(initialSeed.teamsMeeting);
    setFields({subject:initialSeed.subject,start:dateInput(initialSeed.start),end:dateInput(initialSeed.end),location:"",notes:"",attendees:""});
    seedConsumed.current?.();
  }, [mode, initialSeed]);

  useEffect(() => {
    if (mode !== "calendar" || demo) return;
    let active = true;
    void request("calendar-options")
      .then((data) => {
        if (active) setTeamsAvailable(data.teamsAvailable === true);
      })
      .catch(() => {
        if (active) setTeamsAvailable(null);
      });
    return () => {
      active = false;
    };
  }, [mode, demo]);
  const loadGeneration = useRef(0);
  const days = monthDays(month);
  const rangeStart = days[0].toISOString();
  const lastDay = days[days.length - 1];
  const rangeEnd = new Date(
    lastDay.getFullYear(),
    lastDay.getMonth(),
    lastDay.getDate() + 1,
  ).toISOString();
  const load = useCallback(
    async (next?: string) => {
      const generation = ++loadGeneration.current;
      setBusy(true);
      setError("");
      if (!next) {
        setItems([]);
        setCursor(null);
      }
      try {
        if (demo) {
          setItems(demoRecords ?? samples[mode]);
          return;
        }
        const params = new URLSearchParams();
        if (mode === "tasks") params.set("includeCompleted", "1");
        if (mode === "calendar") {
          params.set("start", rangeStart);
          params.set("end", rangeEnd);
        }
        if (next) params.set("cursor", next);
        const data = await request(
          `${mode === "tasks" ? "reminders" : mode}?${params}`,
        );
        if (generation !== loadGeneration.current) return;
        setItems((old) =>
          next
            ? Array.from(
                new Map(
                  [...old, ...(data.value ?? data.reminders ?? [])].map(
                    (item: Item) => [item.id, item],
                  ),
                ).values(),
              )
            : (data.value ?? data.reminders ?? []),
        );
        setCursor(data["@odata.nextLink"] ?? null);
      } catch (e) {
        if (generation === loadGeneration.current)
          setError((e as Error).message);
      } finally {
        if (generation === loadGeneration.current) setBusy(false);
      }
    },
    [mode, demo, demoRecords, rangeStart, rangeEnd],
  );
  const invalidateLoad = useCallback(() => {
    loadGeneration.current++;
  }, []);
  useEffect(() => {
    void load();
    return invalidateLoad;
  }, [load, invalidateLoad]);
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
    setTeamsMeeting(item?.onlineMeetingProvider === "teamsForBusiness");
    const initialStart = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      9,
    );
    const initialEnd = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      10,
    );
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
              start: dateInput(
                item?.start?.dateTime || initialStart.toISOString(),
              ),
              end: dateInput(item?.end?.dateTime || initialEnd.toISOString()),
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
          teamsMeeting,
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
                    attendees: fields.attendees
                      .split(/[;,]/)
                      .map((address) => address.trim())
                      .filter(Boolean)
                      .map((address) => ({ emailAddress: { address } })),
                    body: { content: fields.notes },
                    isOnlineMeeting: teamsMeeting || editor?.isOnlineMeeting,
                    onlineMeetingProvider: teamsMeeting
                      ? "teamsForBusiness"
                      : editor?.onlineMeetingProvider,
                    onlineMeeting: editor?.onlineMeeting,
                    isAllDay: editor?.isAllDay,
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
      {mode === "calendar" ? (
        <MailCalendarMonth
          month={month}
          selected={selectedDay}
          items={items}
          busy={busy}
          onMonth={(date) => {
            setMonth(date);
            setSelectedDay(date);
          }}
          onSelect={setSelectedDay}
          onNew={() => void edit()}
          onEdit={(item) => void edit(item)}
          onRemove={setDeleting}
        />
      ) : (
        <>
          <h1>
            {mode === "contacts" ? "Deine Kontakte" : "Aufgaben & Erinnerungen"}
          </h1>
          <p>
            {mode === "contacts"
              ? "Deine Microsoft-Kontakte"
              : "Persönliche Erinnerungen mit EMA-Push-Anbindung"}
          </p>
          <button
            className={s.primary}
            disabled={busy}
            onClick={() => void edit()}
          >
            {mode === "contacts" ? "Neuer Kontakt" : "Neue Erinnerung"}
          </button>
        </>
      )}
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
      {(mode === "calendar" ? [] : items)
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
          {mode === "calendar"
            ? "Weitere Termine im Monat laden"
            : "Weitere laden"}
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
              {mode === "calendar" ? (
                <p>
                  <b>Microsoft Teams:</b>{" "}
                  {teamsMeeting
                    ? "Ja – Besprechungslink in der Einladung"
                    : editor.isOnlineMeeting
                      ? "Bestehende Online-Besprechung bleibt erhalten"
                      : "Nein"}
                </p>
              ) : null}
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
                setError("");
                if (
                  mode === "calendar" &&
                  new Date(fields.end).getTime() <=
                    new Date(fields.start).getTime()
                ) {
                  setError("Das Ende muss nach dem Beginn liegen.");
                  return;
                }
                setReview(true);
              }}
            >
              {mode === "calendar" ? (
                <>
                  <label className={s.checkLabel}>
                    <input
                      type="checkbox"
                      checked={teamsMeeting}
                      disabled={
                        editor.isOnlineMeeting === true ||
                        teamsAvailable === false
                      }
                      onChange={(e) => setTeamsMeeting(e.target.checked)}
                    />
                    Microsoft Teams-Besprechung
                  </label>
                  {teamsAvailable === false && !editor.isOnlineMeeting ? (
                    <p>
                      Teams ist für deinen Microsoft-365-Kalender noch nicht
                      freigeschaltet. Bitte Teams-Lizenz und
                      Besprechungsrichtlinie prüfen.
                    </p>
                  ) : null}
                  <p>
                    {editor.isOnlineMeeting
                      ? "Der Onlineanbieter einer bestehenden Besprechung bleibt unverändert."
                      : "Teams-Link automatisch erstellen. Für eine Einladung unten die E-Mail-Adressen der Teilnehmer eintragen."}
                  </p>
                  {teamsJoinUrl(editor.onlineMeeting?.joinUrl) ? (
                    <a
                      href={teamsJoinUrl(editor.onlineMeeting?.joinUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Teams-Besprechung öffnen
                    </a>
                  ) : null}
                  {editor.isAllDay ? (
                    <p>
                      Ganztägiger Termin: Der Zeitraum bleibt beim Bearbeiten
                      erhalten. Teilnehmer und Teams kannst du hier ändern.
                    </p>
                  ) : null}
                </>
              ) : null}
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
                      (key === "notes" && editor?.isOnlineMeeting === true) ||
                      (["start", "end"].includes(key) &&
                        editor?.isAllDay === true)
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
