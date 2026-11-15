"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CalendarDays, Home, Mail, PenLine, RefreshCw, Search, Settings, Sun, Moon, Users } from "lucide-react";
import { demoMessages } from "@/lib/mail/demo";
import type { Message as BaseMessage } from "@/lib/mail/model";
import { berlinDay, graphDate, teamsJoinUrl, todayRange } from "@/lib/mail/calendar";
import { fromZonedTime } from "date-fns-tz";
import type { MailPimItem } from "./MailPim";
import { MailSwipeRow } from "./MailSwipeRow";
import s from "./mail.module.css";
import { MailSessionCache, mailAccountScope } from "@/lib/mail/session-cache";
import { MailFolderSync } from "@/lib/mail/folder-sync";
import { mailSenderName, type ContactNames } from "@/lib/mail/contact-names";
import { MailGreeting } from "./MailGreeting";
import { MailMailboxBadge } from "./MailMailboxBadge";

import { combinedInboxPage, sumMailboxStats } from "@/lib/mail/combined-inbox";
type Message = BaseMessage & { sourceMailbox?: string };
const messageKey = (m: Message) => `${m.sourceMailbox || ""}:${m.id}`;

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
async function get(path: string, signal?: AbortSignal) {
  const response = await fetch("/api/mail/" + path, { cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || "Daten konnten nicht geladen werden."), { status: response.status });
  return data;
}
export type DashboardSnapshot = { messages: Message[]; events: MailPimItem[]; stats: { unread: number; drafts: number }; partial: boolean; calendarPartial: boolean; revision: unknown; syncPending?: boolean; syncWarning?: string };
type Props = {
  firstName?: string;
  cache: MailSessionCache<DashboardSnapshot>;
  folderSync: MailFolderSync;
  contactNames: ContactNames;
  onAccessLost: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  demo: boolean;
  mailbox: string;
  accounts: { mailbox: string; name?: string; address?: string; can_write?: boolean }[];
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
export function MailDashboard({ firstName, cache, folderSync, contactNames, onAccessLost, demo, mailbox, accounts, canSend, canWrite, onMailbox, onNavigate, onOpen, onCompose, onSearch, onTrash, revision, demoRecords, demoDraftCount, notice, theme, onToggleTheme }: Props) {
  const cacheKey = JSON.stringify([demo,mailbox,mailAccountScope(accounts)]);
  const cached = cache.get(cacheKey);
  const [messages, setMessages] = useState<Message[]>(() => cached?.messages || []);
  const [events, setEvents] = useState<MailPimItem[]>(() => cached?.events || []);
  const [, setStats] = useState<{ unread: number; drafts: number } | null>(() => cached?.stats || null);
  const [busy, setBusy] = useState(!cached);
  const [calendarLoading, setCalendarLoading] = useState(!cached);
  const [syncing, setSyncing] = useState(false);
  const [syncPending, setSyncPending] = useState(cached?.syncPending || false);
  const [errors, setErrors] = useState<string[]>(cached?.syncWarning ? [cached.syncWarning] : []);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [partial, setPartial] = useState(cached?.partial || false);
  const [calendarPartial, setCalendarPartial] = useState(cached?.calendarPartial || false);
  const [swiped, setSwiped] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => new Date());
  const version = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const demoDeleted = useRef(new Set<string>());
  const listRef = useRef<HTMLElement>(null);
  useEffect(() => folderSync.subscribe((box, folder) => {
    const boxes = mailbox === 'all' ? accounts.map(account => account.mailbox) : [mailbox];
    if (folder !== 'inbox' || !boxes.includes(box)) return;
    const page = folderSync.cachedFolder(boxes, 'inbox');
    if (!page) return;
    setMessages(page.messages); setPartial(Boolean(page.cursor)); setBusy(false);
    setSyncPending(Boolean(page.pending));
  }), [folderSync, mailbox, accounts]);
  const refresh = useCallback(async (force = false) => {
    if (!demo && !accounts.length) return;
    const fresh = cache.get(cacheKey, 55000);
    if (!demo && !force && fresh && Object.is(fresh.revision, revision)) {
      const shared = folderSync.cachedInbox(mailbox === 'all' ? accounts.map(account => account.mailbox) : [mailbox]);
      if (shared) {
        setMessages(shared.messages); setPartial(Boolean(shared.cursor)); setSyncPending(Boolean(shared.pending));
        setErrors(shared.syncWarning ? [shared.syncWarning] : []);
        setBusy(false); return;
      }
    }
    if (controller.current && !force) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const current = ++version.current;
    setBusy(!cache.get(cacheKey));
    setCalendarLoading(!cache.get(cacheKey));
    setSyncing(true);
    setErrors([]);
    setNow(new Date());
    if (demo) {
      const day = fromZonedTime(`${berlinDay()}T14:00:00`, "Europe/Berlin");
      const list = demoMessages.filter(m => !demoDeleted.current.has(m.id));
      setMessages(list);
      setStats({ unread: list.filter(m => !m.isRead).length, drafts: demoDraftCount });
      setEvents(demoRecords ?? [{ id: "demo-overview", subject: "Projektbesprechung Chemnitz", start: { dateTime: day.toISOString() }, end: { dateTime: new Date(day.getTime() + 1800000).toISOString() }, location: { displayName: "Microsoft Teams" } }]);
      controller.current = null;
      setBusy(false);
      setCalendarLoading(false);
      setSyncing(false);
      return;
    }
    if (mailbox === "all" && !accounts.length) { controller.current = null; return; }
    const boxes = mailbox === "all" ? accounts.map(a => a.mailbox) : [mailbox];
    let combinedPending = false;
    const syncWarnings = new Set<string>();
    const messagesRequest = mailbox === "all"
      ? combinedInboxPage<Message>(boxes.map(box => ({ mailbox: box, items: [], cursor: null, started: false })), async (box, cursor) => {
          const page = await folderSync.page(get, box, 'inbox', '', cursor, force);
          combinedPending ||= Boolean(page.pending);
          if (page.syncWarning) syncWarnings.add(page.syncWarning);
          return page;
        })
          .then(data => ({ messages: data.messages, cursor: data.hasMore, pending: combinedPending, syncWarning: [...syncWarnings].join(' ') || undefined }))
      : folderSync.page(get, mailbox, 'inbox', '', undefined, force);
    const statsRequest = Promise.all(boxes.map(box => get(`dashboard-stats?${new URLSearchParams({ mailbox: box })}`, request.signal))).then(sumMailboxStats);
    const active = () => !request.signal.aborted && version.current === current;
    const checkAccess = (error: { status?: number }) => {
      if (active() && [401,403].includes(error?.status || 0)) {
        request.abort(); cache.clear(); folderSync.clear();
        setMessages([]); setStats(null); setEvents([]);
        controller.current = null; setBusy(false); setCalendarLoading(false); setSyncing(false);
        onAccessLost();
      }
      throw error;
    };
    const results = await Promise.allSettled([
      messagesRequest.then(data => {
        if (active()) {
          setMessages(data.messages); setPartial(Boolean(data.cursor));
          setSyncPending(Boolean(data.pending)); setBusy(false);
        }
        return data;
      }, checkAccess),
      get(`calendar?${new URLSearchParams(todayRange())}`, request.signal).then(data => {
        if (active()) {
          setEvents(data.value || []); setCalendarPartial(Boolean(data['@odata.nextLink'])); setCalendarLoading(false);
        }
        return data;
      }),
      statsRequest.then(data => { if (active()) setStats(data); return data; }, checkAccess),
    ]);
    if (request.signal.aborted || version.current !== current) return;
    const problems: string[] = [];
    if ([results[0],results[2]].some(result => result.status === 'rejected' && [401,403].includes(result.reason?.status))) {
      cache.clear(); folderSync.clear(); setMessages([]); setStats(null); setEvents([]);
      controller.current = null; setBusy(false); setSyncing(false); onAccessLost(); return;
    }
    if (results[0].status === "fulfilled") {
      setMessages(results[0].value.messages);
      setPartial(Boolean(results[0].value.cursor));
      setSyncPending(Boolean(results[0].value.pending));
      if (results[0].value.syncWarning) problems.push(results[0].value.syncWarning);
    } else problems.push("Posteingang: " + results[0].reason.message);
    if (results[1].status === "fulfilled") {
      setEvents(results[1].value.value || []);
      setCalendarPartial(Boolean(results[1].value["@odata.nextLink"]));
    } else {
      if ([401,403].includes(results[1].reason?.status)) {
        setEvents([]);
        cache.update(snapshot => ({ ...snapshot, events: [] }));
      }
      problems.push("Kalender: " + results[1].reason.message);
    }
    if (results[2].status === "fulfilled") setStats(results[2].value);
    else problems.push("Übersicht: " + results[2].reason.message);
    if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled' && results[2].status === 'fulfilled') {
      cache.set(cacheKey, { messages: results[0].value.messages, events: results[1].value.value || [], stats: results[2].value, partial: Boolean(results[0].value.cursor), calendarPartial: Boolean(results[1].value['@odata.nextLink']), revision, syncPending: Boolean(results[0].value.pending), syncWarning: results[0].value.syncWarning });
    }
    controller.current = null;
    setErrors(problems);
    setBusy(false);
    setCalendarLoading(false);
    setSyncing(false);
  }, [demo, mailbox, accounts, demoRecords, demoDraftCount, cache, cacheKey, revision, folderSync, onAccessLost]);
  useEffect(() => {
    void refresh();
    const update = () => { if (!document.hidden) void refresh(); };
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      controller.current?.abort();
      controller.current = null;
      version.current++;
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh, revision]);
  const list = unreadOnly ? messages.filter(m => !m.isRead) : messages;
  const hasCalendarError = errors.some(error => error.startsWith("Kalender:"));
  const upcoming = events.filter(event => demo || (event.end && graphDate(event.end.dateTime).getTime() > now.getTime()))
    .sort((a, b) => (a.start ? graphDate(a.start.dateTime).getTime() : 0) - (b.start ? graphDate(b.start.dateTime).getTime() : 0));
  const next = upcoming[0];
  const join = teamsJoinUrl(next?.onlineMeeting?.joinUrl);
  const nextMinutes = next?.start && next.end ? Math.round((graphDate(next.end.dateTime).getTime() - graphDate(next.start.dateTime).getTime()) / 60000) : null;
  const box = accounts.find(account => account.mailbox === mailbox);
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
        <MailGreeting firstName={firstName} />
        <button className={`${s.syncPill} ${errors.length ? s.syncWarning : ""}`} disabled={busy || syncing} onClick={() => void refresh(true)} aria-label="Dashboard aktualisieren"><RefreshCw size={12} />{busy ? "Wird geladen" : syncing ? "Wird abgeglichen" : errors.length ? "Bitte prüfen" : syncPending ? "Erster Abgleich läuft" : "Alles aktuell"}</button>
      </div>
      {accounts.length > 1 && <label className={s.inboxMailbox}><span className={s.srOnly}>Postfach auswählen</span><select value={mailbox} onChange={event => onMailbox(event.target.value)} aria-label="Postfach auswählen"><option value="all">Alle Postfächer</option>{accounts.map(account => <option key={account.mailbox} value={account.mailbox}>{account.name || account.address || account.mailbox}</option>)}</select></label>}
      {accounts.length <= 1 && box && <p className={s.inboxAddress}>{box.address || box.name || "Mein Postfach"}</p>}
      <form className={s.inboxSearch} onSubmit={event => { event.preventDefault(); if (query.trim()) onSearch(query); }}>
        <Search size={19} aria-hidden="true" /><input aria-label="E-Mails durchsuchen" placeholder="E-Mails durchsuchen" maxLength={180} value={query} onChange={event => setQuery(event.target.value)} />
        {query.trim() && <button type="submit" aria-label="Suche starten"><Search size={17} /></button>}
      </form>
      {notice && <p className={s.dashboardFootnote} role="status">{notice}</p>}
      {errors.length > 0 && <div className={s.dashboardErrors} role="status">{errors.map(error => <p key={error}>{error}</p>)}<button onClick={() => void refresh(true)}>Erneut laden</button></div>}
      <section className={s.inboxNext} aria-label="Nächster Termin">
        <p className={s.inboxEyebrow}>Als Nächstes</p>
        {next ? <div className={s.inboxNextBody}>
          <time>{next.isAllDay ? "Heute" : next.start ? clock(next.start.dateTime) : "–"}</time>
          <button className={s.inboxNextTitle} onClick={() => onNavigate("calendar")}><strong>{next.subject || "Termin"}</strong><small>{next.isOnlineMeeting ? "Microsoft Teams" : next.location?.displayName || "Kalendertermin"}{!next.isAllDay && nextMinutes && nextMinutes > 0 ? ` · ${nextMinutes} Min.` : ""}</small></button>
          {join && <a href={join} target="_blank" rel="noopener noreferrer">Beitreten</a>}
        </div> : <div className={s.inboxNextEmpty}><CalendarDays size={22} /><p>{calendarLoading ? "Termine werden geladen …" : hasCalendarError ? "Kalender derzeit nicht verfügbar" : "Heute keine weiteren Termine"}</p><button onClick={() => onNavigate("calendar")}>Kalender öffnen</button></div>}
      </section>
      <section ref={listRef} className={s.inboxMailSection} aria-label="Neueste E-Mails">
        <div className={s.inboxSectionHeading}><h2>Neueste E-Mails</h2><button onClick={() => onNavigate("mail")}>Alle ansehen</button></div>
        <div className={s.inboxFilters} role="group" aria-label="E-Mails filtern"><button aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>Alle</button><button aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Ungelesen</button></div>
        <div className={s.inboxMessageList}>
          {!busy && !list.length && <p className={s.dashboardEmpty}>{errors.some(error => error.startsWith("Posteingang:")) ? "Posteingang konnte nicht geladen werden." : unreadOnly ? "Keine ungelesenen E-Mails unter den neuesten Nachrichten." : "Dein Posteingang ist leer."}</p>}
          {busy && !messages.length && <p className={s.dashboardEmpty}>E-Mails werden geladen …</p>}
          {list.slice(0, 5).map((message, index) => <MailSwipeRow key={messageKey(message)} open={swiped === messageKey(message)} disabled={!(message.sourceMailbox ? accounts.find(a => a.mailbox === message.sourceMailbox)?.can_write : canWrite) || busy} subject={message.subject} onOpenChange={open => setSwiped(open ? messageKey(message) : null)} onDelete={async () => {
            if (demo) demoDeleted.current.add(message.id);
            await onTrash(message);
            setSwiped(null);
            if (demo) setMessages(old => old.filter(item => item.id !== message.id));
            if (demo) { cache.clear(); void refresh(true); }
          }}>
            <button className={s.inboxMessage} data-unread={!message.isRead} onClick={() => onOpen(message)}>
              <span className={s.inboxAvatar} data-color={index % 5}>{mailSenderName(contactNames,message.from.emailAddress).split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}</span>
              <span className={s.inboxMessageBody}><span className={s.inboxSender}><strong title={message.from.emailAddress.address}>{mailSenderName(contactNames,message.from.emailAddress)}</strong><time dateTime={message.receivedDateTime} title={new Date(message.receivedDateTime).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}>{new Date(message.receivedDateTime).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" })}</time>{!message.isRead && <i aria-label="Ungelesen" />}</span><strong className={s.inboxSubject}>{message.subject || "(Kein Betreff)"}</strong><span className={s.inboxPreview}>{message.bodyPreview}</span>{mailbox === "all" && message.sourceMailbox && <MailMailboxBadge mailbox={message.sourceMailbox} accounts={accounts} />}</span>
            </button>
          </MailSwipeRow>)}
        </div>
        {(partial || list.length > 5) && <p className={s.inboxMore}>Weitere Nachrichten findest du im <button onClick={() => onNavigate("mail")}>Postfach</button>.</p>}
      </section>
    </div>
    <div className={s.dashboardActions}><button disabled={!canSend} onClick={onCompose} aria-label="Neue E-Mail verfassen"><PenLine size={21} /><span>Neue E-Mail</span></button></div>
  </div>;
}
