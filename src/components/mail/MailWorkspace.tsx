"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Flag,
  Folder,
  Inbox,
  ListTodo,
  Mail,
  Menu,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  folders,
  invoiceHint,
  type Attachment,
  type MailDraft,
  type Message,
} from "@/lib/mail/model";
import { demoMessages, demoReply } from "@/lib/mail/demo";
import type { MailAnalysis } from "@/lib/mail/analysis";
import s from "./mail.module.css";
import { MailTeam } from "./MailTeam";
import { MailPim } from "./MailPim";
import { MailAutomation } from "./MailAutomation";
type Account = {
  mailbox: string;
  name?: string;
  can_read: boolean;
  can_write: boolean;
  can_send: boolean;
};
type DraftRecord = {
  id: string;
  payload: MailDraft;
  content_hash: string;
  status: string;
};
type View = "mail" | "calendar" | "contacts" | "tasks" | "settings";
const folderIcons = [Inbox, Send, FileText, Archive, Trash2, Folder];
const demoAccounts: Account[] = [
  {
    mailbox: "me",
    name: "Mein Postfach",
    can_read: true,
    can_write: true,
    can_send: true,
  },
  {
    mailbox: "team@example.com",
    name: "Team · Gemeinsam",
    can_read: true,
    can_write: true,
    can_send: true,
  },
];
const blank = (mailbox: string): MailDraft => ({
  mailbox,
  to: [],
  cc: [],
  bcc: [],
  subject: "",
  body: "",
  attachments: [],
});
async function api(path: string, body?: unknown) {
  const response = await fetch(`/api/mail/${path}`, {
    cache: "no-store",
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Anfrage fehlgeschlagen.");
  return result;
}
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "short",
  });
const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  });
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
export function MailWorkspace({ demo }: { demo: boolean }) {
  const [accounts, setAccounts] = useState<Account[]>(demo ? demoAccounts : []);
  const [mailbox, setMailbox] = useState("me"),
    [folder, setFolder] = useState("inbox"),
    [view, setView] = useState<View>("mail");
  const [messages, setMessages] = useState<Message[]>(demo ? demoMessages : []),
    [selected, setSelected] = useState<Message | null>(
      demo ? demoMessages[0] : null,
    );
  const [attachments, setAttachments] = useState<Attachment[]>(
    demo
      ? [
          {
            id: "demo-a",
            name: "Projektuebersicht.pdf",
            size: 248000,
            contentType: "application/pdf",
          },
        ]
      : [],
  );
  const [q, setQ] = useState(""),
    [filter, setFilter] = useState("all"),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false),
    [navOpen, setNavOpen] = useState(false);
  const [analysis, setAnalysis] = useState<MailAnalysis | null>(null),
    [analysisBusy, setAnalysisBusy] = useState(false);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [composer, setComposer] = useState<MailDraft | null>(null),
    [draftId, setDraftId] = useState<string | undefined>(),
    [review, setReview] = useState(false);
  const [aux, setAux] = useState<Record<string, any>[]>([]),
    [taskOpen, setTaskOpen] = useState(false),
    [taskTitle, setTaskTitle] = useState(""),
    [due, setDue] = useState("");
  const requestVersion = useRef(0),
    detailVersion = useRef(0),
    composeVersion = useRef(0);
  const account = accounts.find((a) => a.mailbox === mailbox);
  const openedLink = useRef(false);
  useEffect(() => {
    if (demo || !accounts.length || openedLink.current) return;
    openedLink.current = true;
    const params = new URLSearchParams(window.location.search),
      target = params.get("mailbox") || "me",
      id = params.get("message");
    if (!id || id.length > 1500 || !accounts.some((a) => a.mailbox === target))
      return;
    setMailbox(target);
    const version = ++detailVersion.current;
    void Promise.all([
      api(`message?${new URLSearchParams({ mailbox: target, id })}`),
      api(`attachments?${new URLSearchParams({ mailbox: target, id })}`),
    ])
      .then(([detail, files]) => {
        if (version !== detailVersion.current) return;
        setSelected(detail.message);
        setAttachments(files.attachments);
        setAnalysis(detail.analysis ?? null);
        setReading(true);
      })
      .catch((e) => setNotice(e.message));
  }, [demo, accounts]);

  const load = useCallback(
    async (next?: string) => {
      const version = ++requestVersion.current;
      setBusy(true);
      try {
        if (demo) {
          setMessages(
            folder === "inbox"
              ? demoMessages.filter((m) =>
                  `${m.subject} ${m.bodyPreview} ${m.from.emailAddress.name}`
                    .toLowerCase()
                    .includes(q.toLowerCase()),
                )
              : [],
          );
          setCursor(null);
          return;
        }
        if (folder === "drafts") {
          const data = await api("drafts");
          if (version === requestVersion.current) {
            setDrafts(data.drafts);
            setMessages([]);
          }
          return;
        }
        const data = await api(
          `messages?${new URLSearchParams({ mailbox, folder, q, ...(next ? { cursor: next } : {}) })}`,
        );
        if (version === requestVersion.current) {
          setMessages((old) =>
            next ? [...old, ...data.messages] : data.messages,
          );
          setCursor(data.cursor);
        }
      } catch (e) {
        if (version === requestVersion.current) setNotice((e as Error).message);
      } finally {
        if (version === requestVersion.current) setBusy(false);
      }
    },
    [demo, folder, mailbox, q],
  );
  useEffect(() => {
    if (!demo)
      api("mailboxes")
        .then((d) => setAccounts(d.mailboxes))
        .catch((e) => setNotice(e.message));
  }, [demo]);
  useEffect(() => {
    const versionRef = requestVersion;
    const timer = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(timer);
      versionRef.current++;
    };
  }, [load]);
  async function openMessage(message: Message) {
    const version = ++detailVersion.current;
    setSelected(message);
    setAnalysis(message.emaAnalysis ?? null);
    setReading(true);
    setAttachments([]);
    if (demo) {
      if (message.hasAttachments)
        setAttachments([
          {
            id: "demo-a",
            name: invoiceHint(message)
              ? "Rechnung_RE-2026-0148.pdf"
              : "Projektuebersicht.pdf",
            size: 248000,
            contentType: "application/pdf",
          },
        ]);
      return;
    }
    try {
      const [detail, files] = await Promise.all([
        api(`message?${new URLSearchParams({ mailbox, id: message.id })}`),
        message.hasAttachments
          ? api(
              `attachments?${new URLSearchParams({ mailbox, id: message.id })}`,
            )
          : Promise.resolve({ attachments: [] }),
      ]);
      if (version === detailVersion.current) {
        setSelected(detail.message);
        setAnalysis(detail.analysis ?? null);
        setAttachments(files.attachments);
      }
    } catch (e) {
      if (version === detailVersion.current) setNotice((e as Error).message);
    }
  }
  function changeFolder(id: string) {
    detailVersion.current++;
    setFolder(id);
    setView("mail");
    setSelected(null);
    setMessages([]);
    setAnalysis(null);
    setReading(false);
    setNavOpen(false);
    setFilter("all");
  }
  function newCompose(
    mode: "new" | "reply" | "forward" = "new",
    body?: string,
  ) {
    composeVersion.current++;
    setReview(false);
    setDraftId(undefined);
    const draft = blank(mailbox);
    if (selected && mode !== "new") {
      draft.to =
        mode === "reply"
          ? selected.replyTo?.length
            ? selected.replyTo.map((r) => r.emailAddress.address)
            : [selected.from.emailAddress.address]
          : [];
      if (mode === "reply") draft.replyToMessageId = selected.id;
      draft.subject = `${mode === "reply" ? "Re:" : "WG:"} ${selected.subject.replace(/^(Re:|WG:)\s*/i, "")}`;
      draft.body =
        body ||
        (mode === "forward"
          ? `\n\n--- Weitergeleitete Nachricht ---\nVon: ${selected.from.emailAddress.address}\nBetreff: ${selected.subject}\n\n${selected.body?.content || selected.bodyPreview}`
          : "");
    }
    setComposer(draft);
  }
  async function analyze() {
    if (!selected) return;
    setAnalysisBusy(true);
    try {
      if (demo)
        setAnalysis({
          summary:
            "Die aktualisierte Übersicht liegt zur Prüfung vor. Eine Rückmeldung wird bis Montag erbeten. Für Dienstag ist ein Projektgespräch vorgeschlagen.",
          priority: "high",
          reason: "Rückmeldung und Terminabstimmung erforderlich.",
          invoiceCandidate: invoiceHint(selected),
          suggestedReply: demoReply,
          tasks: ["Unterlagen prüfen und Rückmeldung vorbereiten"],
        });
      else
        setAnalysis(
          (await api("analyze", { mailbox, id: selected.id })).analysis,
        );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setAnalysisBusy(false);
    }
  }
  async function messageAction(operation: string) {
    if (!selected) return;
    setBusy(true);
    try {
      if (!demo)
        await api("message-action", { mailbox, id: selected.id, operation });
      if (["archive", "trash"].includes(operation)) {
        setMessages((old) => old.filter((m) => m.id !== selected.id));
        setSelected(null);
        setReading(false);
      } else {
        const update = (m: Message) =>
          m.id !== selected.id
            ? m
            : {
                ...m,
                ...(["read", "unread"].includes(operation)
                  ? { isRead: operation === "read" }
                  : {
                      flag: {
                        flagStatus:
                          operation === "flag" ? "flagged" : "notFlagged",
                      },
                    }),
              };
        setMessages((old) => old.map(update));
        setSelected(update(selected));
      }
      setNotice(
        demo
          ? "In der Demo geändert. Kein echtes Postfach verändert."
          : "Nachricht aktualisiert.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function fileAction(file: Attachment, mode: "download" | "dms") {
    if (!selected) return;
    if (demo) {
      setNotice(
        "Demo-Anhang: Download und DMS-Ablage werden erst mit einem verbundenen Testpostfach geprüft.",
      );
      return;
    }
    setBusy(true);
    try {
      if (mode === "dms") {
        const result = await api("dms", {
          mailbox,
          id: selected.id,
          attachmentId: file.id,
        });
        setNotice(
          result.duplicate
            ? "Dokument liegt bereits im DMS."
            : "Originalanhang im DMS gespeichert.",
        );
        return;
      }
      const { attachment } = await api(
        `attachment?${new URLSearchParams({ mailbox, id: selected.id, attachmentId: file.id })}`,
      );
      const bytes = Uint8Array.from(atob(attachment.contentBytes), (c) =>
          c.charCodeAt(0),
        ),
        url = URL.createObjectURL(
          new Blob([bytes], { type: "application/octet-stream" }),
        );
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/[\/\\\x00-\x1f]/g, "_");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function updateDraft(update: Partial<MailDraft>) {
    if (update.mailbox && update.mailbox !== composer?.mailbox)
      update.replyToMessageId = undefined;
    composeVersion.current++;
    setComposer((old) => (old ? { ...old, ...update } : null));
    setReview(false);
  }
  async function saveDraft() {
    if (!composer) return;
    const version = composeVersion.current;
    setBusy(true);
    try {
      if (demo) {
        const id = draftId || `demo-draft-${Date.now()}`;
        setDrafts((old) => [
          { id, payload: composer, content_hash: "demo", status: "draft" },
          ...old.filter((d) => d.id !== id),
        ]);
        setDraftId(id);
        setNotice("Demo-Entwurf für diese Sitzung gespeichert.");
        return;
      }
      const result = await api("drafts", {
        id: draftId,
        payload: {
          ...composer,
          to: composer.to.filter(Boolean),
          cc: composer.cc.filter(Boolean),
          bcc: composer.bcc.filter(Boolean),
        },
      });
      if (version === composeVersion.current) setDraftId(result.id);
      setNotice("Entwurf gespeichert.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function approveAndSend() {
    if (!composer) return;
    setBusy(true);
    try {
      if (demo) {
        setNotice(
          "Freigabe in der Demo geprüft. Es wurde keine E-Mail versendet.",
        );
        setComposer(null);
        setReview(false);
        return;
      }
      const saved = await api("drafts", { id: draftId, payload: composer });
      const approval = await api("approve", {
        id: saved.id,
        contentHash: saved.content_hash,
        confirmed: true,
      });
      const result = await api("send", {
        id: saved.id,
        approvalToken: approval.approvalToken,
      });
      setComposer(null);
      setReview(false);
      setNotice(result.message);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addFiles(files: FileList | null) {
    if (!composer || !files) return;
    const version = composeVersion.current;
    try {
      const additions = [];
      for (const file of Array.from(files)) {
        if (file.size > 2_000_000)
          throw new Error(
            "Einzelne Anhänge maximal 2 MB; zusammen maximal 2,25 MB.",
          );
        const buffer = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (const b of buffer) binary += String.fromCharCode(b);
        additions.push({
          name: file.name,
          contentType: file.type || "application/octet-stream",
          contentBytes: btoa(binary),
        });
      }
      if (version === composeVersion.current)
        updateDraft({ attachments: [...composer.attachments, ...additions] });
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  async function officeSync() {
    if (demo) {
      setNotice(
        "Demo: Rechnungen würden über den bestehenden Office-Import geprüft. Keine Rechnung angelegt.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/office/api/intelligence/invoice-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Office-Abgleich fehlgeschlagen.");
      setNotice(
        result.partial || result.failed
          ? "Office meldet einen unvollständigen Import. Bitte dort prüfen."
          : `Office-Abgleich abgeschlossen: ${result.created || 0} neue Belege, ${result.duplicate || 0} Dubletten.`,
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function createTask() {
    if (!taskTitle.trim() || !due) {
      setNotice("Bitte Titel und Fälligkeit eingeben.");
      return;
    }
    setBusy(true);
    try {
      if (!demo)
        await api("reminders", {
          title: taskTitle,
          dueAt: new Date(due).toISOString(),
          mailbox,
        });
      else
        setAux((old) => [
          ...old,
          { title: taskTitle, due_at: new Date(due).toISOString() },
        ]);
      setTaskOpen(false);
      setNotice(
        demo
          ? "Demo-Erinnerung angelegt. Es wird kein Push versendet."
          : "Erinnerung angelegt. Push folgt über deine eingerichtete EMA-Benachrichtigung.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = messages.filter((m) =>
    filter === "unread"
      ? !m.isRead
      : filter === "priority"
        ? m.importance === "high" ||
          m.flag?.flagStatus === "flagged" ||
          m.emaAnalysis?.priority === "high"
        : true,
  );
  return (
    <main className={`${s.workspace} ${reading ? s.reading : ""}`}>
      <header className={s.topbar}>
        <Link href="/apps" className={s.brand}>
          <span className={s.mark}>EMA</span>
          <strong>
            EMA <em>Mail</em>
          </strong>
        </Link>
        <label className={s.search}>
          <Search size={15} />
          <span className={s.srOnly}>E-Mails durchsuchen</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="E-Mails durchsuchen …"
          />
        </label>
        <div className={s.profile}>
          <ShieldCheck size={17} />
          <span>{demo ? "Demo-Arbeitsplatz" : "Microsoft 365"}</span>
          <div className={s.avatar}>{demo ? "DE" : "EM"}</div>
        </div>
      </header>
      {demo ? (
        <div className={s.demoBanner}>
          <span>
            <b>Vorschau mit erfundenen Beispieldaten</b> · Kein echter Versand
          </span>
          <span>
            <ShieldCheck
              size={12}
              style={{ display: "inline", marginRight: 5 }}
            />
            Deine Live-Umgebung bleibt unverändert
          </span>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className={s.notice}>
          {notice}
          <button
            aria-label="Hinweis schließen"
            className={s.iconButton}
            onClick={() => setNotice("")}
          >
            <X size={13} />
          </button>
        </div>
      ) : null}
      <div className={s.body}>
        <aside
          className={`${s.sidebar} ${navOpen ? s.open : ""}`}
          aria-label="Postfach-Navigation"
        >
          <button
            className={s.composeButton}
            onClick={() => {
              newCompose();
              setNavOpen(false);
            }}
            disabled={!account?.can_send}
          >
            <Plus size={17} />
            Neue E-Mail
          </button>
          <nav className={s.nav}>
            {folders.map((f, i) => {
              const Icon = folderIcons[i];
              return (
                <button
                  key={f.id}
                  className={view === "mail" && folder === f.id ? s.active : ""}
                  onClick={() => changeFolder(f.id)}
                >
                  <Icon size={16} />
                  {f.name}
                  {f.id === "inbox" ? (
                    <b>
                      {demo ? demoMessages.filter((m) => !m.isRead).length : ""}
                    </b>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <section>
            <p className={s.label}>Deine Postfächer</p>
            <div className={s.accounts}>
              {accounts.map((a) => (
                <button
                  key={a.mailbox}
                  className={a.mailbox === mailbox ? s.accountActive : ""}
                  onClick={() => {
                    detailVersion.current++;
                    setMailbox(a.mailbox);
                    setSelected(null);
                    setReading(false);
                    setNavOpen(false);
                    setView("mail");
                  }}
                >
                  <span className={s.dot} />
                  {a.name || a.mailbox}
                </button>
              ))}
            </div>
          </section>
          <section>
            <p className={s.label}>Dein Arbeitsplatz</p>
            <nav className={s.nav}>
              {(
                [
                  { id: "calendar", label: "Kalender", icon: CalendarDays },
                  { id: "contacts", label: "Kontakte", icon: Users },
                  { id: "tasks", label: "Aufgaben", icon: ListTodo },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  className={view === item.id ? s.active : ""}
                  onClick={() => {
                    setView(item.id);
                    setNavOpen(false);
                  }}
                >
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </nav>
          </section>
          <div className={s.sideFooter}>
            <button
              className={s.iconButton}
              onClick={() => {
                setView("settings");
                setNavOpen(false);
              }}
            >
              <Settings size={14} />
              Einstellungen & Sicherheit
            </button>
            <Link href="/apps">
              <ArrowLeft size={14} />
              Zur EMA-Plattform
            </Link>
          </div>
        </aside>
        {view === "mail" ? (
          <>
            <section className={s.list} aria-label="E-Mail-Liste">
              <div className={s.listHeader}>
                <div className={s.titleRow}>
                  <button
                    className={s.iconButton}
                    onClick={() => setNavOpen((v) => !v)}
                    aria-label="Navigation öffnen"
                  >
                    <Menu size={17} />
                  </button>
                  <h1>{folders.find((f) => f.id === folder)?.name}</h1>
                  <button
                    onClick={() => void load()}
                    disabled={busy}
                    aria-label="Postfach aktualisieren"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
                <div className={s.tabs}>
                  {[
                    ["all", "Alle Nachrichten"],
                    ["unread", "Ungelesen"],
                    ["priority", "Priorität"],
                  ].map(([id, name]) => (
                    <button
                      key={id}
                      className={filter === id ? s.tabActive : ""}
                      onClick={() => setFilter(id)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div className={s.listMeta}>
                <span>
                  {busy
                    ? "Wird geladen …"
                    : `${visible.length} Nachrichten geladen`}
                </span>
                <span>
                  Neueste zuerst{" "}
                  <ChevronDown size={10} style={{ display: "inline" }} />
                </span>
              </div>
              <div className={s.messages}>
                {folder === "drafts"
                  ? drafts.map((d) => (
                      <button
                        key={d.id}
                        className={s.message}
                        disabled={!["draft", "approved"].includes(d.status)}
                        onClick={() => {
                          composeVersion.current++;
                          setDraftId(d.id);
                          setComposer(d.payload);
                          setReview(false);
                        }}
                      >
                        <strong>{d.payload.subject}</strong>
                        <p className={s.preview}>{d.payload.body}</p>
                        <span className={s.badge}>{d.status}</span>
                      </button>
                    ))
                  : visible.map((m) => (
                      <button
                        key={m.id}
                        className={`${s.message} ${selected?.id === m.id ? s.selected : ""}`}
                        onClick={() => void openMessage(m)}
                      >
                        <div className={s.senderRow}>
                          <strong>
                            {m.from.emailAddress.name ||
                              m.from.emailAddress.address}
                          </strong>
                          <time>{formatTime(m.receivedDateTime)}</time>
                        </div>
                        <div className={s.subject}>
                          {!m.isRead ? <span className={s.dot} /> : null}
                          {m.subject}
                        </div>
                        <div className={s.preview}>{m.bodyPreview}</div>
                        {m.hasAttachments ||
                        m.importance === "high" ||
                        m.emaAnalysis?.priority === "high" ? (
                          <div className={s.badges}>
                            {m.importance === "high" ||
                            m.emaAnalysis?.priority === "high" ? (
                              <span className={`${s.badge} ${s.amber}`}>
                                <Flag size={9} />
                                Hohe Priorität
                              </span>
                            ) : null}
                            {invoiceHint(m) ? (
                              <span className={s.badge}>
                                <FileText size={9} />
                                Rechnung prüfen
                              </span>
                            ) : m.hasAttachments ? (
                              <span className={`${s.badge} ${s.purple}`}>
                                <Paperclip size={9} />
                                Anhang
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                    ))}
                {!busy && !visible.length && folder !== "drafts" ? (
                  <p className={s.empty}>Hier sind keine Nachrichten.</p>
                ) : null}
              </div>
              <div className={s.listMore}>
                <button
                  className={s.subtle}
                  onClick={() => newCompose()}
                  disabled={!account?.can_send}
                >
                  <PenLine size={13} />
                  Neue E-Mail
                </button>
                {cursor ? (
                  <button
                    className={s.subtle}
                    disabled={busy}
                    onClick={() => void load(cursor)}
                  >
                    Weitere laden
                  </button>
                ) : null}
              </div>
            </section>
            <section className={s.reader} aria-label="Nachricht lesen">
              {selected ? (
                <>
                  <div className={s.toolbar}>
                    <button
                      className={s.mobileBack}
                      onClick={() => setReading(false)}
                      aria-label="Zur Nachrichtenliste"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <button
                      disabled={busy || !account?.can_write}
                      onClick={() => void messageAction("archive")}
                    >
                      <Archive size={15} />
                      <span>Archivieren</span>
                    </button>
                    <button
                      disabled={busy || !account?.can_write}
                      onClick={() => void messageAction("trash")}
                    >
                      <Trash2 size={15} />
                      <span>Papierkorb</span>
                    </button>
                    <button
                      disabled={busy || !account?.can_write}
                      onClick={() =>
                        void messageAction(selected.isRead ? "unread" : "read")
                      }
                      aria-label={
                        selected.isRead
                          ? "Als ungelesen markieren"
                          : "Als gelesen markieren"
                      }
                    >
                      <Mail size={15} />
                    </button>
                    <button
                      disabled={busy || !account?.can_write}
                      onClick={() =>
                        void messageAction(
                          selected.flag?.flagStatus === "flagged"
                            ? "unflag"
                            : "flag",
                        )
                      }
                      aria-label="Nachverfolgung umschalten"
                    >
                      <Flag size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setTaskTitle(selected.subject);
                        setTaskOpen(true);
                      }}
                    >
                      <Bell size={15} />
                      <span>Erinnern</span>
                    </button>
                    <button
                      onClick={() => setView("settings")}
                      aria-label="Postfacheinstellungen"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                  <article className={s.mailContent}>
                    <div className={s.badges}>
                      {selected.importance === "high" ? (
                        <span className={`${s.badge} ${s.amber}`}>
                          <Flag size={10} />
                          Hohe Priorität
                        </span>
                      ) : (
                        <span className={s.badge}>Nachricht</span>
                      )}
                      {selected.hasAttachments ? (
                        <span className={`${s.badge} ${s.purple}`}>
                          <Paperclip size={10} />
                          Mit Anhang
                        </span>
                      ) : null}
                    </div>
                    <h2>{selected.subject}</h2>
                    <div className={s.senderDetail}>
                      <div className={s.avatar}>
                        {initials(
                          selected.from.emailAddress.name ||
                            selected.from.emailAddress.address,
                        )}
                      </div>
                      <div>
                        <strong>
                          {selected.from.emailAddress.name ||
                            selected.from.emailAddress.address}
                        </strong>
                        <small>
                          {selected.from.emailAddress.address}
                          <br />
                          An:{" "}
                          {selected.toRecipients
                            ?.map((a) => a.emailAddress.address)
                            .join(", ")}
                        </small>
                      </div>
                      <time>
                        {formatDate(selected.receivedDateTime)}
                        <br />
                        {formatTime(selected.receivedDateTime)}
                      </time>
                    </div>
                    <div className={s.mailBody}>
                      {selected.body?.contentType.toLowerCase() === "html"
                        ? "Diese Nachricht liegt als HTML vor. Aktive Inhalte werden nicht dargestellt. Bitte Textansicht erneut laden."
                        : selected.body?.content || selected.bodyPreview}
                    </div>
                    {attachments.map((a) => (
                      <div key={a.id} className={s.attachment}>
                        <div className={s.fileIcon}>
                          <FileText size={21} />
                        </div>
                        <div>
                          <strong>{a.name}</strong>
                          <small>
                            {Math.round(a.size / 1000)} KB · Originalanhang
                          </small>
                        </div>
                        <button
                          className={s.iconButton}
                          disabled={busy}
                          aria-label={`${a.name} im DMS ablegen`}
                          onClick={() => void fileAction(a, "dms")}
                        >
                          <Folder size={16} />
                        </button>
                        <button
                          className={s.iconButton}
                          disabled={busy}
                          aria-label={`${a.name} herunterladen`}
                          onClick={() => void fileAction(a, "download")}
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    ))}
                    <section className={s.aiCard}>
                      <div className={s.aiHeader}>
                        <Sparkles size={16} />
                        EMA Intelligence
                        <span>{analysis ? "Analyse" : "Dein Assistent"}</span>
                      </div>
                      <p>
                        {analysis?.summary ||
                          "Lass EMA diese Nachricht zusammenfassen, offene Punkte erkennen und eine passende Antwort vorbereiten."}
                      </p>
                      {analysis ? (
                        <p>
                          {analysis.reason}{" "}
                          {analysis.invoiceCandidate
                            ? "Mögliche Rechnung – vor Buchung prüfen."
                            : ""}
                        </p>
                      ) : null}
                      <div className={s.aiActions}>
                        <button
                          disabled={analysisBusy}
                          onClick={() => void analyze()}
                        >
                          <Sparkles size={12} />
                          {analysisBusy
                            ? "Wird analysiert …"
                            : analysis
                              ? "Neu anzeigen"
                              : "E-Mail analysieren"}
                        </button>
                        {analysis ? (
                          <button
                            disabled={!account?.can_send}
                            onClick={() =>
                              newCompose("reply", analysis.suggestedReply)
                            }
                          >
                            <PenLine size={12} />
                            Antwortentwurf öffnen
                          </button>
                        ) : null}
                        <button
                          onClick={() => {
                            setTaskTitle(
                              analysis?.tasks[0] || selected.subject,
                            );
                            setTaskOpen(true);
                          }}
                        >
                          <ListTodo size={12} />
                          Aufgabe anlegen
                        </button>
                        {invoiceHint(selected) ? (
                          <button
                            disabled={busy}
                            onClick={() => void officeSync()}
                          >
                            <FileText size={12} />
                            In Office abgleichen
                          </button>
                        ) : null}
                      </div>
                    </section>
                    <div className={s.replyActions}>
                      <button
                        disabled={!account?.can_send}
                        onClick={() => newCompose("reply")}
                      >
                        <Reply size={14} />
                        Antworten
                      </button>
                      <button
                        disabled={!account?.can_send}
                        onClick={() => newCompose("forward")}
                      >
                        <ArrowRight size={14} />
                        Weiterleiten
                      </button>
                    </div>
                  </article>
                </>
              ) : (
                <div className={s.empty}>
                  <Mail size={30} />
                  <p>Wähle eine Nachricht aus.</p>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className={s.aux}>
            <button
              className={s.iconButton}
              onClick={() => setNavOpen((v) => !v)}
            >
              <Menu size={16} />
              Navigation
            </button>
            <h1>
              {view === "calendar"
                ? "Dein Kalender"
                : view === "contacts"
                  ? "Deine Kontakte"
                  : view === "tasks"
                    ? "Aufgaben & Erinnerungen"
                    : "Dein sicherer Arbeitsplatz"}
            </h1>
            {view === "settings" ? (
              <>
                <p>
                  {demo
                    ? "Diese Vorschau arbeitet ausschließlich mit erfundenen Beispielen."
                    : "EMA Mail verwendet deine persönliche Microsoft-Verbindung und die freigegebenen Team-Postfächer."}
                </p>
                <div className={s.settingsGrid}>
                  <article>
                    <ShieldCheck size={22} />
                    <h3>Versand nur mit Freigabe</h3>
                    <p>
                      Du prüfst Empfänger, Inhalt und Anhänge. Jede Freigabe
                      gilt einmalig für genau diesen Entwurf.
                    </p>
                  </article>
                  <article>
                    <Users size={22} />
                    <h3>Deine Zugriffsrechte</h3>
                    <p>
                      Jeder Mitarbeiter nutzt seinen eigenen Zugang. Gemeinsame
                      Postfächer benötigen zusätzlich eine Exchange-Freigabe.
                    </p>
                    {!demo ? (
                      <Link prefetch={false} href="/api/mail/connect">
                        Microsoft-Mailrechte verbinden
                      </Link>
                    ) : null}
                  </article>
                  <article>
                    <Bell size={22} />
                    <h3>Auf deinem iPhone</h3>
                    <p>
                      EMA in Safari öffnen und zum Home-Bildschirm hinzufügen.
                      Push-Erlaubnis in der bestehenden Assistenz aktivieren.
                      Neue-Mail-Push lässt sich nach Einrichtung des
                      Hintergrundbetriebs pro Postfach einschalten.
                    </p>
                    <Link href="/assistant">Benachrichtigungen einrichten</Link>
                  </article>
                  <article>
                    <Sparkles size={22} />
                    <h3>KI bleibt Assistenz</h3>
                    <p>
                      Antworten sind Entwürfe. Keine eigenständigen Zusagen,
                      Zahlungen oder Sendungen. Analysen können Fehler
                      enthalten.
                    </p>
                  </article>
                </div>
                <MailAutomation demo={demo} mailbox={mailbox} />
                {!demo ? <MailTeam /> : null}
              </>
            ) : (
              <MailPim key={view} mode={view} demo={demo} />
            )}
          </section>
        )}
      </div>
      {composer ? (
        <div className={s.modalBackdrop}>
          <section
            className={s.modal}
            role="dialog"
            aria-modal="true"
            aria-label={review ? "Versand prüfen" : "E-Mail verfassen"}
          >
            <header>
              <h2>{review ? "Prüfen & freigeben" : "Neue E-Mail"}</h2>
              <button
                className={s.iconButton}
                disabled={busy}
                aria-label="Entwurf schließen"
                onClick={() => {
                  composeVersion.current++;
                  setComposer(null);
                }}
              >
                <X size={20} />
              </button>
            </header>
            {review ? (
              <>
                <p>
                  Prüfe alle Angaben. Mit deiner Freigabe wird genau dieser
                  Inhalt einmalig an Microsoft übergeben.
                  {demo ? " In der Demo findet kein Versand statt." : ""}
                </p>
                <div className={s.review}>
                  <b>Von:</b>{" "}
                  {composer.mailbox === "me"
                    ? "Mein Microsoft-Postfach"
                    : composer.mailbox}
                  <br />
                  <b>An:</b> {composer.to.join(", ")}
                  <br />
                  <b>CC:</b> {composer.cc.join(", ") || "–"}
                  <br />
                  <b>BCC:</b> {composer.bcc.join(", ") || "–"}
                  <br />
                  <b>Betreff:</b> {composer.subject}
                  <hr />
                  {composer.body}
                  <hr />
                  <b>Anhänge:</b>{" "}
                  {composer.attachments.map((a) => a.name).join(", ") ||
                    "Keine"}
                </div>
                <footer>
                  <button
                    disabled={busy}
                    className={s.subtle}
                    onClick={() => setReview(false)}
                  >
                    Zurück zum Entwurf
                  </button>
                  <button
                    disabled={busy}
                    className={s.primary}
                    onClick={() => void approveAndSend()}
                  >
                    {busy
                      ? "Wird verarbeitet …"
                      : demo
                        ? "Freigabe demonstrieren"
                        : "Freigeben und senden"}
                  </button>
                </footer>
              </>
            ) : (
              <>
                <label>
                  Absender
                  <select
                    disabled={busy}
                    value={composer.mailbox}
                    onChange={(e) => updateDraft({ mailbox: e.target.value })}
                  >
                    {accounts
                      .filter((a) => a.can_send)
                      .map((a) => (
                        <option key={a.mailbox} value={a.mailbox}>
                          {a.name || a.mailbox}
                        </option>
                      ))}
                  </select>
                </label>
                {(["to", "cc", "bcc"] as const).map((field) => (
                  <label key={field}>
                    {field === "to" ? "An" : field.toUpperCase()}
                    <input
                      disabled={busy}
                      value={composer[field].join("; ")}
                      onChange={(e) =>
                        updateDraft({
                          [field]: e.target.value
                            .split(/[;,]/)
                            .map((v) => v.trim()),
                        })
                      }
                      placeholder="name@firma.de"
                    />
                  </label>
                ))}
                <label>
                  Betreff
                  <input
                    disabled={busy}
                    value={composer.subject}
                    onChange={(e) => updateDraft({ subject: e.target.value })}
                  />
                </label>
                <label>
                  Nachricht
                  <textarea
                    disabled={busy}
                    value={composer.body}
                    onChange={(e) => updateDraft({ body: e.target.value })}
                  />
                </label>
                <label>
                  Anhänge hinzufügen (zusammen max. 2,25 MB)
                  <input
                    type="file"
                    multiple
                    disabled={busy}
                    onChange={(e) => void addFiles(e.target.files)}
                  />
                </label>
                {composer.attachments.map((a, i) => (
                  <p key={i}>
                    {a.name}
                    <button
                      className={s.iconButton}
                      aria-label={`${a.name} entfernen`}
                      onClick={() =>
                        updateDraft({
                          attachments: composer.attachments.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                    >
                      <X size={13} />
                    </button>
                  </p>
                ))}
                <p>
                  KI-Antworten bitte inhaltlich prüfen. E-Mail-Inhalte werden
                  erst nach deiner Freigabe versendet.
                </p>
                <footer>
                  <button
                    className={s.subtle}
                    disabled={busy}
                    onClick={() => void saveDraft()}
                  >
                    Entwurf speichern
                  </button>
                  <button
                    className={s.primary}
                    disabled={
                      busy ||
                      !composer.to.some(Boolean) ||
                      !composer.subject.trim() ||
                      !composer.body.trim()
                    }
                    onClick={() => {
                      setComposer({
                        ...composer,
                        to: composer.to.filter(Boolean),
                        cc: composer.cc.filter(Boolean),
                        bcc: composer.bcc.filter(Boolean),
                      });
                      setReview(true);
                    }}
                  >
                    <ShieldCheck
                      size={14}
                      style={{ display: "inline", marginRight: 8 }}
                    />
                    Versand prüfen
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      ) : null}
      {taskOpen ? (
        <div className={s.modalBackdrop}>
          <section
            className={s.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Erinnerung anlegen"
          >
            <header>
              <h2>Erinnerung anlegen</h2>
              <button
                className={s.iconButton}
                onClick={() => setTaskOpen(false)}
                aria-label="Schließen"
              >
                <X size={20} />
              </button>
            </header>
            <label>
              Titel
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </label>
            <label>
              Fällig (deine Gerätezeitzone)
              <input
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <footer>
              <button
                className={s.primary}
                disabled={busy}
                onClick={() => void createTask()}
              >
                Erinnerung speichern
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
