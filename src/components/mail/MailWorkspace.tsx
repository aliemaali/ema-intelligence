"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MailAttachmentPreview } from "./MailAttachmentPreview";
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
  Home,
  ListTodo,
  Mail,
  Menu,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  Sun,
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
import { validateComposeFiles } from "@/lib/mail/attachments";
import { sanitizeRichHtml } from "@/lib/mail/rich-text";
import { replyAllRecipients } from "@/lib/mail/productivity";
import { useMailProductivity } from "./useMailProductivity";
import { MailProductivitySettings } from "./MailProductivitySettings";
import { signatureForAddress } from "@/lib/mail/signature";
import { MailSignature } from "./MailSignature";
import { MailComposeFields } from "./MailComposeFields";
import { MailTeam } from "./MailTeam";
import { MailSwipeRow } from "./MailSwipeRow";
import { MailPim, type MailPimItem } from "./MailPim";
import { MailHomeScreen } from "./MailHomeScreen";
import { MailAutomation } from "./MailAutomation";
type Account = {
  mailbox: string;
  address?: string;
  signatureText?: string;
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
import { MailDashboard, MailBottomNav, type MailView } from "./MailDashboard";
type View = MailView;
const folderIcons = [Inbox, Send, FileText, Archive, Trash2, Folder];
const demoAccounts: Account[] = [
  {
    mailbox: "me",
    name: "unluer@ema-enterprise.de · Demo",
    address: "unluer@ema-enterprise.de",
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      setTheme(localStorage.getItem("ema-mail-theme-v2") === "dark" ? "dark" : "light");
    } catch {
      /* Mail remains usable when browser storage is blocked. */
    }
    function syncTheme(event: StorageEvent) {
      if (event.key === "ema-mail-theme-v2")
        setTheme(event.newValue === "dark" ? "dark" : "light");
    }
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem("ema-mail-theme-v2", next);
    } catch {
      /* Session-only preference. */
    }
    window.dispatchEvent(
      new CustomEvent("ema:mail-theme-change", { detail: next }),
    );
  }
  const [accounts, setAccounts] = useState<Account[]>(demo ? demoAccounts : []);
  const [mailbox, setMailbox] = useState("me"),
    [folder, setFolder] = useState("inbox"),
    [view, setView] = useState<View>("home");
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
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MailAnalysis | null>(null),
    [analysisBusy, setAnalysisBusy] = useState(false);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [composer, setComposer] = useState<MailDraft | null>(null),
    [draftId, setDraftId] = useState<string | undefined>(),
    [review, setReview] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    file: Attachment;
    mailbox: string;
    messageId: string;
  } | null>(null);
  const [overviewRevision, setOverviewRevision] = useState(0);
  const [composeExpanded, setComposeExpanded] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [demoPim, setDemoPim] = useState<
    Partial<Record<"calendar" | "contacts" | "tasks", MailPimItem[]>>
  >({});
  const [taskOpen, setTaskOpen] = useState(false),
    [taskTitle, setTaskTitle] = useState(""),
    [due, setDue] = useState("");
  const requestVersion = useRef(0),
    detailVersion = useRef(0),
    composeVersion = useRef(0);
  const productivity = useMailProductivity(demo, mailbox);
  const account = accounts.find((a) => a.mailbox === mailbox);
  const hasComposer = Boolean(composer);
  const composeRef = useRef<HTMLElement>(null);
  const openedLink = useRef(false);
  useEffect(() => {
    if (!review || !hasComposer) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = composeRef.current;
    dialog?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        setReview(false);
      }
      if (e.key !== "Tab") return;
      const fields = Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
      const first = fields[0],
        last = fields[fields.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.isConnected && previous.focus();
    };
  }, [review, busy, hasComposer]);
  useEffect(() => {
    if (demo || !accounts.length || openedLink.current) return;
    openedLink.current = true;
    const params = new URLSearchParams(window.location.search),
      target = params.get("mailbox") || "me",
      id = params.get("message");
    if (!id || id.length > 1500 || !accounts.some((a) => a.mailbox === target))
      return;
    setMailbox(target);
    setView("mail");
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
            folder === "sentitems"
              ? [
                  {
                    ...demoMessages[0],
                    id: "demo-sent",
                    from: {
                      emailAddress: {
                        address: "unluer@ema-enterprise.de",
                        name: "Ali Ünlüer",
                      },
                    },
                    toRecipients: [demoMessages[0].from],
                    ccRecipients: [],
                    conversationId: "demo-conversation",
                    subject: "Projektunterlagen zur Prüfung",
                    body: {
                      contentType: "text",
                      content: "Guten Tag, bitte prüfe die Unterlagen.",
                    },
                  },
                ]
              : folder === "inbox"
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
    setView("mail");
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
    mode: "new" | "reply" | "replyAll" | "forward" = "new",
    body?: string,
  ) {
    composeVersion.current++;
    setReview(false);
    setNotice("");
    setDraftId(undefined);
    const draft = blank(mailbox);
    draft.signatureId = signatureForAddress(account?.address || mailbox);
    draft.signatureText = draft.signatureId
      ? undefined
      : account?.signatureText || undefined;
    if (selected && mode !== "new") {
      draft.to =
        mode !== "forward"
          ? selected.replyTo?.length
            ? selected.replyTo.map((r) => r.emailAddress.address)
            : [selected.from.emailAddress.address]
          : [];
      if (mode !== "forward") draft.replyToMessageId = selected.id;
      if (mode === "replyAll")
        Object.assign(
          draft,
          replyAllRecipients(selected, account?.address || mailbox),
        );
      draft.subject = `${mode !== "forward" ? "Re:" : "WG:"} ${selected.subject.replace(/^(Re:|WG:)\s*/i, "")}`;
      draft.body =
        body ||
        (mode === "forward"
          ? `\n\n--- Weitergeleitete Nachricht ---\nVon: ${selected.from.emailAddress.address}\nBetreff: ${selected.subject}\n\n${selected.body?.content || selected.bodyPreview}`
          : "");
    }
    setComposeMinimized(false);
    setComposer(draft);
  }
  async function analyze() {
    if (!selected || analysisBusy) return;
    const version = detailVersion.current;
    setNotice("");
    setAnalysisBusy(true);
    try {
      const result: MailAnalysis = demo
        ? {
            summary:
              "Die aktualisierte Übersicht liegt zur Prüfung vor. Eine Rückmeldung wird bis Montag erbeten. Für Dienstag ist ein Projektgespräch vorgeschlagen.",
            priority: "high",
            reason: "Rückmeldung und Terminabstimmung erforderlich.",
            invoiceCandidate: invoiceHint(selected),
            suggestedReply: demoReply,
            tasks: ["Unterlagen prüfen und Rückmeldung vorbereiten"],
          }
        : (await api("analyze", { mailbox, id: selected.id })).analysis;
      if (version === detailVersion.current) setAnalysis(result);
    } catch (e) {
      if (version === detailVersion.current) setNotice((e as Error).message);
    } finally {
      setAnalysisBusy(false);
    }
  }
  async function messageAction(
    operation: string,
    target: Message | null = selected,
  ) {
    if (!target || busy) return;
    const listVersion = requestVersion.current;
    const selectionVersion = detailVersion.current;
    setSwipedId(null);
    setBusy(true);
    try {
      if (!demo)
        await api("message-action", { mailbox, id: target.id, operation });
      if (listVersion !== requestVersion.current) return;
      if (["archive", "trash"].includes(operation)) {
        setMessages((old) => old.filter((m) => m.id !== target.id));
        if (
          selected?.id === target.id &&
          selectionVersion === detailVersion.current
        ) {
          detailVersion.current++;
          setSelected(null);
          setAnalysis(null);
          setReading(false);
        }
      } else {
        const update = (m: Message) =>
          m.id !== target.id
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
        setSelected((old) => (old ? update(old) : old));
      }
      setOverviewRevision((v) => v + 1);
      setNotice(
        demo
          ? "In der Demo geändert. Kein echtes Postfach verändert."
          : operation === "trash"
            ? "Nachricht in den Papierkorb verschoben."
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
    if (update.mailbox && update.mailbox !== composer?.mailbox) {
      update.replyToMessageId = undefined;
      update.signatureId = signatureForAddress(
        accounts.find((a) => a.mailbox === update.mailbox)?.address ||
          update.mailbox,
      );
    }
    if (update.body !== undefined && update.bodyHtml === undefined)
      update.bodyHtml = undefined;
    if (update.mailbox)
      update.signatureText = update.signatureId
        ? undefined
        : accounts.find((a) => a.mailbox === update.mailbox)?.signatureText ||
          undefined;
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
    if (!composer || !files || busy) return;
    const version = composeVersion.current;
    try {
      validateComposeFiles(composer.attachments, Array.from(files));
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
          messageId: selected?.id,
        });
      else
        setDemoPim((old) => ({
          ...old,
          tasks: [
            ...(old.tasks || []),
            {
              id: crypto.randomUUID(),
              title: taskTitle,
              due_at: new Date(due).toISOString(),
            },
          ],
        }));
      setTaskOpen(false);
      setNotice(demo ? "Demo-Aufgabe angelegt." : "Aufgabe angelegt.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function navigate(next: View) {
    setView(next); setNavOpen(false); setReading(false);
    if (next === "mail") { setFolder("inbox"); setFilter("all"); setQ(""); }
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
    <main
      data-theme={theme}
      className={`${s.workspace} ${s.withDashboardNav} ${view === "home" ? s.homeWorkspace : ""} ${reading ? s.reading : ""}`}
    >
      <MailHomeScreen
        demo={demo}
        visible={false}
        background
        revision={messages}
      />
      {view === "home" ? <MailDashboard key={mailbox}
        theme={theme} onToggleTheme={toggleTheme} demo={demo} mailbox={mailbox} accounts={accounts} canSend={!!account?.can_send} canWrite={!!account?.can_write}
        onMailbox={(value) => { setMailbox(value); setSelected(null); setQ(""); setFolder("inbox"); }}
        onNavigate={navigate} onOpen={(message) => { setQ(""); setFolder("inbox"); void openMessage(message); }}
        onCompose={() => newCompose()}
        onTrash={(message) => messageAction("trash", message)} revision={overviewRevision} demoRecords={demoPim.calendar} notice={notice}
      /> : <>
      <header className={s.topbar}>
        <Link href="/apps" className={s.brand}>
          <span className={s.brandLogo}>
            <Image
              src="/brand/ema-logo.png"
              alt="EMA Enterprise GmbH"
              width={96}
              height={45}
              priority
            />
          </span>
          <strong>
            <em>Mail</em>
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
        <button
          className={s.themeToggle}
          onClick={toggleTheme}
          aria-label={
            theme === "light"
              ? "Dunkle Ansicht aktivieren"
              : "Helle Ansicht aktivieren"
          }
          title={
            theme === "light"
              ? "Zur dunklen Ansicht wechseln"
              : "Zur hellen Ansicht wechseln"
          }
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          <span>{theme === "light" ? "Dunkel" : "Hell"}</span>
        </button>
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
      <div className={s.ribbon} aria-label="Start">
        <button
          className={s.ribbonNew}
          disabled={!account?.can_send}
          onClick={() => newCompose()}
        >
          <Plus size={18} /> Neue E-Mail
        </button>
        <span className={s.ribbonDivider} />
        <button
          disabled={!selected || busy || !account?.can_write}
          onClick={() => void messageAction("trash")}
        >
          <Trash2 size={17} /> Löschen
        </button>
        <button
          disabled={!selected || busy || !account?.can_write}
          onClick={() => void messageAction("archive")}
        >
          <Archive size={17} /> Archivieren
        </button>
        <span className={s.ribbonDivider} />
        <button
          disabled={!selected || !account?.can_send}
          onClick={() => newCompose("reply")}
        >
          <Reply size={17} /> Antworten
        </button>
        <button
          disabled={!selected || !account?.can_send}
          onClick={() => newCompose("forward")}
        >
          <ArrowRight size={17} /> Weiterleiten
        </button>
        <button
          className={s.ribbonRefresh}
          disabled={busy}
          onClick={() => void load()}
          aria-label="Alle Ordner aktualisieren"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className={s.body}>
        <nav className={s.appRail} aria-label="Anwendungen">
          {(
            [
              { id: "home", label: "Start", icon: Home },
              { id: "mail", label: "E-Mail", icon: Mail },
              { id: "calendar", label: "Kalender", icon: CalendarDays },
              { id: "contacts", label: "Kontakte", icon: Users },
              { id: "tasks", label: "Aufgaben", icon: ListTodo },
              { id: "settings", label: "Einstellungen", icon: Settings },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              title={item.label}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => {
                setView(item.id);
                setNavOpen(false);
              }}
            >
              <item.icon size={21} />
            </button>
          ))}
        </nav>
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
                          setComposeMinimized(false);
                          setComposer({
                            ...d.payload,
                            scheduledAt: undefined,
                            signatureText:
                              d.payload.signatureText ||
                              accounts.find(
                                (a) => a.mailbox === d.payload.mailbox,
                              )?.signatureText ||
                              undefined,
                            signatureId: signatureForAddress(
                              accounts.find(
                                (a) => a.mailbox === d.payload.mailbox,
                              )?.address || d.payload.mailbox,
                            ),
                          });
                          setNotice(
                            d.payload.scheduledAt
                              ? "Die Versandplanung wurde entfernt. Dieser Entwurf wird erst nach deiner erneuten Freigabe direkt gesendet."
                              : "",
                          );
                          setReview(false);
                        }}
                      >
                        <strong>{d.payload.subject}</strong>
                        <p className={s.preview}>{d.payload.body}</p>
                        <span className={s.badge}>{d.status}</span>
                      </button>
                    ))
                  : visible.map((m) => (
                      <MailSwipeRow
                        key={`${mailbox}:${folder}:${m.id}`}
                        subject={m.subject || "Nachricht"}
                        disabled={
                          busy ||
                          !account?.can_write ||
                          folder === "deleteditems"
                        }
                        open={swipedId === m.id}
                        onOpenChange={(open) => setSwipedId(open ? m.id : null)}
                        onDelete={() => messageAction("trash", m)}
                      >
                        <button
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
                      </MailSwipeRow>
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
                      aria-label="Archivieren"
                      onClick={() => void messageAction("archive")}
                    >
                      <Archive size={15} />
                      <span>Archivieren</span>
                    </button>
                    <button
                      disabled={busy || !account?.can_write}
                      aria-label="In den Papierkorb verschieben"
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
                        <button
                          className={s.attachmentOpen}
                          aria-label={`${a.name} Vorschau öffnen`}
                          onClick={() =>
                            setPreviewFile({
                              file: a,
                              mailbox,
                              messageId: selected.id,
                            })
                          }
                        >
                          <span className={s.fileIcon}>
                            <FileText size={21} />
                          </span>
                          <span>
                            <strong>{a.name}</strong>
                            <small>
                              {Math.round(a.size / 1000)} KB · Vorschau öffnen
                            </small>
                          </span>
                        </button>
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
                        onClick={() => newCompose("replyAll")}
                      >
                        <Reply size={15} /> Allen antworten
                      </button>
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
            {view === "settings" ? <h1>Dein sicherer Arbeitsplatz</h1> : null}
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
                      EMA Mail in Safari öffnen und zum Home-Bildschirm
                      hinzufügen. Mitteilungen und App-Kennzeichen unten für
                      eMail aktivieren. Neue-Mail-Push lässt sich nach
                      Einrichtung des Hintergrundbetriebs pro Postfach
                      einschalten.
                    </p>
                    <a href="#ema-mail-homescreen">
                      eMail auf dem Home-Bildschirm einrichten
                    </a>
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
                <MailHomeScreen demo={demo} visible />
                <MailAutomation demo={demo} mailbox={mailbox} />
                {productivity.error && (
                  <p role="status">{productivity.error}</p>
                )}
                <MailProductivitySettings
                  demo={demo}
                  mailbox={mailbox}
                  address={account?.address || mailbox}
                  data={productivity.data}
                  update={productivity.update}
                  refresh={productivity.refresh}
                  onSignature={(text) =>
                    setAccounts((old) =>
                      old.map((a) =>
                        a.mailbox === mailbox
                          ? { ...a, signatureText: text }
                          : a,
                      ),
                    )
                  }
                />
                {!demo ? <MailTeam /> : null}
              </>
            ) : (
              <MailPim
                key={view}
                mode={view}
                demo={demo}
                demoRecords={demoPim[view]}
                onDemoChange={(items) =>
                  setDemoPim((old) => ({ ...old, [view]: items }))
                }
              />
            )}
          </section>
        )}
      </div>
      </>}
      <MailBottomNav view={view} onNavigate={navigate} />
      {composer ? (
        <div
          className={`${s.composeBackdrop} ${composeExpanded || review ? s.composeExpanded : ""} ${composeMinimized && !review ? s.composeMinimized : ""}`}
        >
          <section
            ref={composeRef}
            className={`${s.modal} ${s.composeWindow}`}
            role="dialog"
            aria-modal={review ? "true" : undefined}
            aria-label={review ? "Versand prüfen" : "E-Mail verfassen"}
          >
            <header>
              <h2>
                {review
                  ? "Prüfen & freigeben"
                  : composer.subject || "Neue Nachricht"}
              </h2>
              <div className={s.windowControls}>
                {!review && (
                  <>
                    <button
                      className={s.iconButton}
                      aria-label={
                        composeMinimized
                          ? "Entwurf wiederherstellen"
                          : "Entwurf minimieren"
                      }
                      onClick={() => setComposeMinimized((v) => !v)}
                    >
                      <Minus size={17} />
                    </button>
                    <button
                      className={s.iconButton}
                      aria-label={
                        composeExpanded
                          ? "Entwurf verkleinern"
                          : "Entwurf vergrößern"
                      }
                      onClick={() => {
                        setComposeExpanded((v) => !v);
                        setComposeMinimized(false);
                      }}
                    >
                      {composeExpanded ? (
                        <Minimize2 size={16} />
                      ) : (
                        <Maximize2 size={16} />
                      )}
                    </button>
                  </>
                )}
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
              </div>
            </header>
            {notice && (
              <div className={s.composeNotice} role="status">
                {notice}
              </div>
            )}
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
                    ? accounts.find((a) => a.mailbox === "me")?.address ||
                      "Mein Microsoft-Postfach"
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
                  {composer.bodyHtml ? (
                    <div
                      className={s.richReview}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichHtml(composer.bodyHtml),
                      }}
                    />
                  ) : (
                    composer.body
                  )}
                  {composer.signatureText && (
                    <div className={s.textSignature}>
                      {composer.signatureText}
                    </div>
                  )}
                  {composer.signatureId && <MailSignature />}
                  <hr />
                  <b>Lesebestätigung:</b>{" "}
                  {composer.isReadReceiptRequested ? "Anfordern" : "Nein"}
                  <br />
                  <b>Empfangsbestätigung:</b>{" "}
                  {composer.isDeliveryReceiptRequested ? "Anfordern" : "Nein"}
                  <br />
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
              <MailComposeFields
                draft={composer}
                onPreview={(index) => {
                  const a = composer.attachments[index];
                  setPreviewFile({
                    file: {
                      ...a,
                      id: `compose-${index}`,
                      size: Math.ceil(a.contentBytes.length * 0.75),
                    },
                    mailbox: composer.mailbox,
                    messageId: "",
                  });
                }}
                accounts={accounts}
                busy={busy}
                update={updateDraft}
                addFiles={(files) => void addFiles(files)}
                save={() => void saveDraft()}
                review={() => {
                  setComposer({
                    ...composer,
                    to: composer.to.filter(Boolean),
                    cc: composer.cc.filter(Boolean),
                    bcc: composer.bcc.filter(Boolean),
                  });
                  setReview(true);
                }}
              />
            )}
          </section>
        </div>
      ) : null}
      {previewFile && (
        <MailAttachmentPreview
          key={`${previewFile.mailbox}:${previewFile.messageId}:${previewFile.file.id}`}
          {...previewFile}
          demo={demo}
          onClose={() => setPreviewFile(null)}
        />
      )}
      {taskOpen ? (
        <div className={s.modalBackdrop}>
          <section
            className={s.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Aufgabe anlegen"
          >
            <header>
              <h2>Aufgabe anlegen</h2>
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
                Aufgabe speichern
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
