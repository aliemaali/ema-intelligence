"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CalendarDays, Home, Mail, PenLine, RefreshCw, Search, Settings, Sun, Moon, Users } from "lucide-react";
import { demoMessages } from "@/lib/mail/demo";
import type { Message } from "@/lib/mail/model";
import { berlinDay, graphDate, teamsJoinUrl, todayRange } from "@/lib/mail/calendar";
import { fromZonedTime } from "date-fns-tz";
import type { MailPimItem } from "./MailPim";
import { MailSwipeRow } from "./MailSwipeRow";
import s from "./mail.module.css";

export type MailView = "home" | "mail" | "calendar" | "contacts" | "tasks" | "settings";
export function MailBottomNav({ view, onNavigate }: { view: MailView; onNavigate: (view: MailView) => void }) {
  return <nav className={s.dashboardNav} aria-label="Mail Hauptnavigation">
    {([
      { id: "home", label: "Start", icon: Home },
      { id: "mail", label: "Postfach", icon: Mail },
      { id: "calendar", label: "Kalender", icon: CalendarDays },
      { id: "contacts", label: "Kontakte", icon: Users },
    ] as const).map(item => <button key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => onNavigate(item.id)}><item.icon size={21} /><span>{item.label}</span></button>)}
  </nav>;
}
// Also used by the existing mailbox priority filter.
export function priorityMail(m: Message) {
  return m.importance === "high" || m.flag?.flagStatus === "flagged" || m.emaAnalysis?.priority === "high";
}
async function get(path: string, signal: AbortSignal) {
  const response = await fetch("/api/mail/" + path, { cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Daten konnten nicht geladen werden.");
  return data;
}
type Props = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  demo: boolean;
  mailbox: string;
  accounts: { mailbox: string; name?: string; address?: string }[];
  canSend: boolean;
  canWrite: boolean;
  onMailbox: (mailbox: string) => void;
  onNavigate: (view: MailView) => void;
  onOpen: (message: Message) => void;
  onCompose: () => void;
  onFolder: (folder: string) => void;
  onSearch: (query: string) => void;
  onTrash: (message: Message) => Promise<void>;
  revision: unknown;
  demoRecords?: MailPimItem[];
  demoDraftCount: number;
  notice?: string;
};
const clock = (value: string) => graphDate(value).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
export function MailDashboard({ demo, mailbox, accounts, canSend, canWrite, onMailbox, onNavigate, onOpen, onCompose, onFolder, onSearch, onTrash, revision, demoRecords, demoDraftCount, notice, theme, onToggleTheme }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<MailPimItem[]>([]);
  const [stats, setStats] = useState<{ unread: number; drafts: number } | null>(null);
  const [busy, setBusy] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [partial, setPartial] = useState(false);
  const [calendarPartial, setCalendarPartial] = useState(false);
  const [swiped, setSwiped] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => new Date());
  const version = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const demoDeleted = useRef(new Set<string>());
  const listRef = useRef<HTMLElement>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const current = ++version.current;
    setBusy(true);
    setErrors([]);
    setNow(new Date());
    if (demo) {
      const day = fromZonedTime(`${berlinDay()}T14:00:00`, "Europe/Berlin");
      const list = demoMessages.filter(m => !demoDeleted.current.has(m.id));
      setMessages(list);
      setStats({ unread: list.filter(m => !m.isRead).length, drafts: demoDraftCount });
      setEvents(demoRecords ?? [{ id: "demo-overview", subject: "Projektbesprechung Chemnitz", start: { dateTime: day.toISOString() }, end: { dateTime: new Date(day.getTime() + 1800000).toISOString() }, location: { displayName: "Microsoft Teams" } }]);
      setBusy(false);
      return;
    }
    const results = await Promise.allSettled([
      get(`messages?${new URLSearchParams({ mailbox, folder: "inbox" })}`, request.signal),
      get(`calendar?${new URLSearchParams(todayRange())}`, request.signal),
      get(`dashboard-stats?${new URLSearchParams({ mailbox })}`, request.signal),
    ]);
    if (request.signal.aborted || version.current !== current) return;
    const problems: string[] = [];
    if (results[0].status === "fulfilled") {
      setMessages(results[0].value.messages);
      setPartial(Boolean(results[0].value.cursor));
    } else problems.push("Posteingang: " + results[0].reason.message);
    if (results[1].status === "fulfilled") {
      setEvents(results[1].value.value || []);
      setCalendarPartial(Boolean(results[1].value["@odata.nextLink"]));
    } else problems.push("Kalender: " + results[1].reason.message);
    if (results[2].status === "fulfilled") setStats(results[2].value);
    else problems.push("Übersicht: " + results[2].reason.message);
    setErrors(problems);
    setBusy(false);
  }, [demo, mailbox, demoRecords, demoDraftCount]);
  useEffect(() => {
    void refresh();
    const update = () => { if (!document.hidden) void refresh(); };
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      controller.current?.abort();
      version.current++;
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh, revision]);
  const list = unreadOnly ? messages.filter(m => !m.isRead) : messages;
  const hasCalendarError = errors.some(error => error.startsWith("Kalender:"));
  const hasStatsError = errors.some(error => error.startsWith("Übersicht:"));
  const upcoming = events.filter(event => demo || (event.end && graphDate(event.end.dateTime).getTime() > now.getTime()))
    .sort((a, b) => (a.start ? graphDate(a.start.dateTime).getTime() : 0) - (b.start ? graphDate(b.start.dateTime).getTime() : 0));
  const next = upcoming[0];
  const join = teamsJoinUrl(next?.onlineMeeting?.joinUrl);
  const nextMinutes = next?.start && next.end ? Math.round((graphDate(next.end.dateTime).getTime() - graphDate(next.start.dateTime).getTime()) / 60000) : null;
  const box = accounts.find(account => account.mailbox === mailbox);
  const count = (value: number | undefined, failed: boolean) => failed || value === undefined ? "–" : value;
  return <div className={`${s.dashboard} ${s.inboxDashboard}`}>
    <div className={s.dashboardScroll}>
      <header className={s.dashboardHeader}>
        <a href="/apps" className={s.dashboardBrand}>
          <span className={s.dashboardLogo}><Image src={theme === "dark" ? "/brand/ema-mark-white.png" : "/brand/ema-mark.png"} alt="EMA Enterprise GmbH" width={76} height={37} priority /></span>
          <small>EMA</small><strong>Mail</strong>
        </a>
        <div>
          <button onClick={onToggleTheme} aria-label={theme === "light" ? "Dunkle Ansicht aktivieren" : "Helle Ansicht aktivieren"}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button>
          <button onClick={() => onNavigate("settings")} aria-label="Einstellungen"><Settings size={19} /></button>
        </div>
      </header>
      {demo && <p className={s.dashboardDemo}>Designvorschau · Beispieldaten</p>}
      <div className={s.inboxHeading}>
        <h1>Dein Postfach</h1>
        <button className={`${s.syncPill} ${errors.length ? s.syncWarning : ""}`} disabled={busy} onClick={() => void refresh()} aria-label="Dashboard aktualisieren"><RefreshCw size={12} />{busy ? "Wird geladen" : errors.length ? "Bitte prüfen" : "Alles aktuell"}</button>
      </div>
      {accounts.length > 1 && <label className={s.inboxMailbox}><span className={s.srOnly}>Postfach auswählen</span><select value={mailbox} onChange={event => onMailbox(event.target.value)} aria-label="Postfach auswählen">{accounts.map(account => <option key={account.mailbox} value={account.mailbox}>{account.name || account.address || account.mailbox}</option>)}</select></label>}
      {accounts.length <= 1 && box && <p className={s.inboxAddress}>{box.address || box.name || "Mein Postfach"}</p>}
      <form className={s.inboxSearch} onSubmit={event => { event.preventDefault(); if (query.trim()) onSearch(query); }}>
        <Search size={19} aria-hidden="true" /><input aria-label="E-Mails durchsuchen" placeholder="E-Mails durchsuchen" maxLength={180} value={query} onChange={event => setQuery(event.target.value)} />
        {query.trim() && <button type="submit" aria-label="Suche starten"><Search size={17} /></button>}
      </form>
      <section className={s.inboxStats} aria-label="Postfachübersicht">
        <button onClick={() => { setUnreadOnly(true); listRef.current?.scrollIntoView({ block: "nearest" }); }}><span><Mail size={21} /></span><div><strong>{count(stats?.unread, hasStatsError)}</strong><small>Ungelesen</small></div></button>
        <button onClick={() => onFolder("drafts")} title="Gespeicherte Entwürfe"><span><PenLine size={21} /></span><div><strong>{count(stats?.drafts, hasStatsError)}</strong><small>Entwürfe</small></div></button>
        <button onClick={() => onNavigate("calendar")} title="Termine heute im persönlichen Kalender"><span><CalendarDays size={21} /></span><div><strong>{busy && !events.length ? "–" : hasCalendarError ? "–" : `${events.length}${calendarPartial ? "+" : ""}`}</strong><small>Termine</small></div></button>
      </section>
      {notice && <p className={s.dashboardFootnote} role="status">{notice}</p>}
      {errors.length > 0 && <div className={s.dashboardErrors} role="status">{errors.map(error => <p key={error}>{error}</p>)}<button onClick={() => void refresh()}>Erneut laden</button></div>}
      <section className={s.inboxNext} aria-label="Nächster Termin">
        <p className={s.inboxEyebrow}>Als Nächstes</p>
        {next ? <div className={s.inboxNextBody}>
          <time>{next.isAllDay ? "Heute" : next.start ? clock(next.start.dateTime) : "–"}</time>
          <button className={s.inboxNextTitle} onClick={() => onNavigate("calendar")}><strong>{next.subject || "Termin"}</strong><small>{next.isOnlineMeeting ? "Microsoft Teams" : next.location?.displayName || "Kalendertermin"}{!next.isAllDay && nextMinutes && nextMinutes > 0 ? ` · ${nextMinutes} Min.` : ""}</small></button>
          {join && <a href={join} target="_blank" rel="noopener noreferrer">Beitreten</a>}
        </div> : <div className={s.inboxNextEmpty}><CalendarDays size={22} /><p>{busy ? "Termine werden geladen …" : hasCalendarError ? "Kalender derzeit nicht verfügbar" : "Heute keine weiteren Termine"}</p><button onClick={() => onNavigate("calendar")}>Kalender öffnen</button></div>}
      </section>
      <section ref={listRef} className={s.inboxMailSection} aria-label="Neueste E-Mails">
        <div className={s.inboxSectionHeading}><h2>Neueste E-Mails</h2><button onClick={() => onNavigate("mail")}>Alle ansehen</button></div>
        <div className={s.inboxFilters} role="group" aria-label="E-Mails filtern"><button aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>Alle</button><button aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Ungelesen</button></div>
        <div className={s.inboxMessageList}>
          {!busy && !list.length && <p className={s.dashboardEmpty}>{errors.some(error => error.startsWith("Posteingang:")) ? "Posteingang konnte nicht geladen werden." : unreadOnly ? "Keine ungelesenen E-Mails unter den neuesten Nachrichten." : "Dein Posteingang ist leer."}</p>}
          {busy && !messages.length && <p className={s.dashboardEmpty}>E-Mails werden geladen …</p>}
          {list.slice(0, 6).map((message, index) => <MailSwipeRow key={message.id} open={swiped === message.id} disabled={!canWrite || busy} subject={message.subject} onOpenChange={open => setSwiped(open ? message.id : null)} onDelete={async () => {
            if (demo) demoDeleted.current.add(message.id);
            await onTrash(message);
            setSwiped(null);
            if (demo) setMessages(old => old.filter(item => item.id !== message.id));
            void refresh();
          }}>
            <button className={s.inboxMessage} data-unread={!message.isRead} onClick={() => onOpen(message)}>
              <span className={s.inboxAvatar} data-color={index % 5}>{(message.from.emailAddress.name || message.from.emailAddress.address).split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}</span>
              <span className={s.inboxMessageBody}><span className={s.inboxSender}><strong>{message.from.emailAddress.name || message.from.emailAddress.address}</strong><time>{berlinDay(new Date(message.receivedDateTime)) === berlinDay(now) ? clock(message.receivedDateTime) : new Date(message.receivedDateTime).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" })}</time>{!message.isRead && <i aria-label="Ungelesen" />}</span><strong className={s.inboxSubject}>{message.subject || "(Kein Betreff)"}</strong><span className={s.inboxPreview}>{message.bodyPreview}</span></span>
            </button>
          </MailSwipeRow>)}
        </div>
        {(partial || list.length > 6) && <p className={s.inboxMore}>Weitere Nachrichten findest du im <button onClick={() => onNavigate("mail")}>Postfach</button>.</p>}
      </section>
    </div>
    <div className={s.dashboardActions}><button disabled={!canSend} onClick={onCompose} aria-label="Neue E-Mail verfassen"><PenLine size={21} /><span>Neue E-Mail</span></button></div>
  </div>;
}
