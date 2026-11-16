"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { listenForEmaChanges } from "@/lib/ema/updates";
import { officeDirectory, mergedDirectory, type DirectoryContact } from "@/lib/ema/office-directory";
import { LegacyCalendarImport } from "./LegacyCalendarImport";
import { MailDialog } from "./MailDialog";
import s from "./mail.module.css";
import { MailCalendarMonth } from "./MailCalendarMonth";
import { monthDays, teamsJoinUrl, berlinCalendarDate, berlinDateInput, berlinInputToIso, dayKey } from "@/lib/mail/calendar";
type Item = {
  id: string;
  readOnly?: boolean;
  canDelete?: boolean;
  sharedBy?: string;
  officeHref?: string;
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
  isCancelled?: boolean;
  responseStatus?: { response: string };
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
const dateInput = (s?:string)=>s ? berlinDateInput(s) : '';
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
  cacheUser,
  demoRecords,
  onDemoChange,
  onContactsChanged,
  onCalendarChanged,
}: {
  mode: Mode;
  cacheUser?: string;
  demo: boolean;
  demoRecords?: Item[];
  onDemoChange?: (items: Item[]) => void;
  onContactsChanged?: () => void;
  onCalendarChanged?: () => void;
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
  const [officeContacts,setOfficeContacts]=useState<DirectoryContact[]>([]);
  const [officeNotice,setOfficeNotice]=useState('');
  useEffect(()=>{
    if(mode!=='contacts'||demo)return;
    const controller=new AbortController();
    void officeDirectory(controller.signal).then(items=>{if(!controller.signal.aborted){setOfficeContacts(items);setOfficeNotice('');}}).catch(()=>{if(!controller.signal.aborted)setOfficeNotice('Office-Kontakte sind derzeit nicht verbunden.');});
    return()=>controller.abort();
  },[mode,demo]);
  const directory = mode==='contacts' ? mergedDirectory(items,officeContacts) as Item[] : items;
  const [month, setMonth] = useState(
    () => new Date(berlinCalendarDate().getFullYear(), berlinCalendarDate().getMonth(), 1),
  );
  const [selectedDay, setSelectedDay] = useState(() => berlinCalendarDate());
  const titleOnly = mode === "calendar" && Boolean(editor?.id) && editor?.isOrganizer === false;
  const [teamsMeeting, setTeamsMeeting] = useState(false);
  const [teamsAvailable, setTeamsAvailable] = useState<boolean | null>(null);
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
  useEffect(()=>{
    if(mode!=='calendar')return;
    const date=new URLSearchParams(window.location.search).get('date');
    if(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))){const selected=berlinCalendarDate(date);setMonth(new Date(selected.getFullYear(),selected.getMonth(),1));setSelectedDay(selected);}
  },[mode]);
  const loadGeneration = useRef(0);
  const days = monthDays(month);
  const rangeStart = berlinInputToIso(`${dayKey(days[0])}T00:00`);
  const lastDay = days[days.length - 1];
  const rangeEnd = berlinInputToIso(`${dayKey(new Date(lastDay.getFullYear(),lastDay.getMonth(),lastDay.getDate()+1))}T00:00`);
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
  useEffect(()=>{
    if(demo)return;
    return listenForEmaChanges(()=>{
      if(busy||editor)return;
      void load();
      if(mode==='contacts'){const controller=new AbortController();void officeDirectory(controller.signal).then(setOfficeContacts).catch(()=>undefined);}
    });
  },[demo,mode,busy,editor,load]);
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
    setFields(
      mode === "contacts"
        ? {
            displayName: item?.displayName || "",
            email: item?.emailAddresses?.[0]?.address || "",
            companyName: item?.companyName || "",
            phone: item?.businessPhones?.[0] || "",
          }
        : mode === "calendar" && item?.isOrganizer === false
          ? { subject: item.subject || "" }
          : mode === "calendar"
          ? {
              subject: item?.subject || "",
              start: dateInput(
                item?.start?.dateTime || berlinInputToIso(`${dayKey(selectedDay)}T09:00`),
              ),
              end: dateInput(item?.end?.dateTime || berlinInputToIso(`${dayKey(selectedDay)}T10:00`)),
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
          start: berlinInputToIso(fields.start),
          end: berlinInputToIso(fields.end),
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
      if (titleOnly) {
        if (demo) updateItems(items.map(item => item.id === editor?.id ? { ...item, subject: fields.subject.trim() } : item));
        else {
          await request("event-title", { id: editor?.id, title: fields.subject, confirmed: true });
          await load();
        }
        setEditor(null); onCalendarChanged?.(); return;
      }
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
                    start: { dateTime: berlinInputToIso(fields.start) },
                    end: { dateTime: berlinInputToIso(fields.end) },
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
      if(mode === 'contacts') onContactsChanged?.();
      if(mode === 'calendar') onCalendarChanged?.();
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
      if(mode === 'contacts') onContactsChanged?.();
      if(mode === 'calendar') onCalendarChanged?.();
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
      {mode === "calendar" && !demo && cacheUser && <LegacyCalendarImport userId={cacheUser} onImported={() => { void load(); onCalendarChanged?.(); }}/>}
      {mode === "calendar" ? (
        <MailCalendarMonth
          live={!demo}
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
              ? "Deine Microsoft-Kontakte und für dich freigegebene Kontakte"
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
      {mode==='contacts' && officeNotice && <p role="status">{officeNotice} <a href="/office/kontakte">Office öffnen</a></p>}
      {(mode === "calendar" ? [] : directory)
        .filter((i) => mode !== "tasks" || completed || !i.completed_at)
        .map((item) => (
          <article className={s.auxItem} key={item.id}>
            <strong>{item.subject || item.displayName || item.title}</strong>
            <small>
              {item.start
                ? new Date(utc(item.start.dateTime)).toLocaleString("de-DE", {timeZone:"Europe/Berlin"})
                : item.emailAddresses?.map((a) => a.address).join(", ") ||
                  (item.due_at &&
                    new Date(item.due_at).toLocaleString("de-DE", {timeZone:"Europe/Berlin"}))}
            </small>
            {item.sharedBy ? <small>Geteilt von {item.sharedBy}</small> : null}
            <div className={s.aiActions}>
              {item.officeHref && <a className={s.subtle} href={item.officeHref}>Geschäftsdaten in Office</a>}
              {mode === "tasks" ? (
                <button disabled={busy} onClick={() => void toggleTask(item)}>
                  {item.completed_at ? "Wieder öffnen" : "Erledigen"}
                </button>
              ) : item.id.startsWith('office:') ? null : (
                <>
                  <button
                    disabled={
                      busy || item.readOnly === true ||
                      (mode === "calendar" && item.isOrganizer === false)
                    }
                    onClick={() => void edit(item)}
                  >
                    Bearbeiten
                  </button>
                  <button disabled={busy || item.readOnly === true || item.canDelete === false} onClick={() => setDeleting(item)}>
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
                ? titleOnly ? "Titel ändern" : "Termin bearbeiten"
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
                {titleOnly ? "Der Titel gilt für deine Ansicht in EMA. Der Originaltitel beim Organisator bleibt unverändert." : mode === "calendar"
                  ? "Einladungen und Aktualisierungen können E-Mails an Teilnehmer auslösen. Prüfe die Angaben vor deiner Freigabe."
                  : "Bitte die Angaben prüfen."}
                {demo
                  ? " In dieser Demo werden keine Nachrichten versendet."
                  : ""}
              </p>
              {mode === "calendar" && !titleOnly ? (
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
                  mode === "calendar" && !titleOnly &&
                  new Date(fields.end).getTime() <=
                    new Date(fields.start).getTime()
                ) {
                  setError("Das Ende muss nach dem Beginn liegen.");
                  return;
                }
                if (titleOnly) { void save(); return; }
                setReview(true);
              }}
            >
              {titleOnly && <p>Dieser Titel wird für deine Ansicht in EMA gespeichert. Der Originaltermin bleibt unverändert.</p>}
              {mode === "calendar" && !titleOnly ? (
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
              {editor?.isOnlineMeeting && !titleOnly ? (
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
                <button className={s.primary} type="submit" disabled={busy}>
                  {titleOnly ? "Titel speichern" : "Angaben prüfen"}
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
