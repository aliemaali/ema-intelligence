"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MailMessageBody } from "./MailMessageBody";
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
  type Message as BaseMessage,
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
import { combinedInboxPage, type MailboxPage } from "@/lib/mail/combined-inbox";
type Message = BaseMessage & { sourceMailbox?: string };
const messageKey = (m: Message) => `${m.sourceMailbox || ""}:${m.id}`;
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
  const [allMailboxes, setAllMailboxes] = useState(true);
  const combinedPages = useRef<MailboxPage<Message>[]>([]);
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
      if (!next) { setMessages([]); setCursor(null); }
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
            setDrafts(data.drafts.filter((d: DraftRecord) => (allMailboxes || d.payload.mailbox === mailbox) && ["draft", "approved"].includes(d.status)));
            setMessages([]);
          }
          return;
        }
        if (allMailboxes) {
          const sources = next ? combinedPages.current : accounts.filter(a => a.can_read).map(a => ({ mailbox: a.mailbox, items: [], cursor: null, started: false }));
          const data = await combinedInboxPage(sources, (box, page) => api(`messages?${new URLSearchParams({ mailbox: box, folder, q, ...(page ? { cursor: page } : {}) })}`));
          if (version === requestVersion.current) {
            combinedPages.current = data.sources;
            setMessages(old => next ? [...old, ...data.messages] : data.messages);
            setCursor(data.hasMore ? "combined" : null);
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
    [demo, folder, mailbox, q, allMailboxes, accounts],
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
    const source = message.sourceMailbox || mailbox;
    if (message.sourceMailbox) setMailbox(source);
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
        api(`message?${new URLSearchParams({ mailbox: source, id: message.id })}`),
        api(`attachments?${new URLSearchParams({ mailbox: source, id: message.id })}`),
      ]);
      if (version === detailVersion.current) {
        setSelected({ ...detail.message, sourceMailbox: message.sourceMailbox });
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
          ? `\n\n--- Weitergeleitete Nachricht ---\nVon: ${selected.from.emailAddress.address}\nBetreff: ${selected.subject}\n\n${(selected.body?.contentType.toLowerCase() === "html" ? new DOMParser().parseFromString(sanitizeRichHtml(selected.body.content), "text/html").body.textContent : selected.body?.content) || selected.bodyPreview}`
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
        await api("message-action", { mailbox: target.sourceMailbox || mailbox, id: target.id, operation });
      if (listVersion !== requestVersion.current) return;
      if (["archive", "trash"].includes(operation)) {
        setMessages((old) => old.filter((m) => messageKey(m) !== messageKey(target)));
        if (
          selected && messageKey(selected) === messageKey(target) &&
          selectionVersion === detailVersion.current
        ) {
          detailVersion.current++;
          setSelected(null);
          setAnalysis(null);
          setReading(false);
        }
      } else {
        const update = (m: Message) =>
          messageKey(m) !== messageKey(target)
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
      setOverviewRevision(v => v + 1);
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
      setOverviewRevision(v => v + 1);
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
  const dashboardMailbox = allMailboxes && accounts.length > 1 ? "all" : mailbox;
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
      {view === "home" ? <MailDashboard key={dashboardMailbox}
        theme={theme} onToggleTheme={toggleTheme} demo={demo} mailbox={dashboardMailbox} accounts={accounts} canSend={!!account?.can_send} canWrite={!!account?.can_write}
        onMailbox={(value) => { detailVersion.current++; setAllMailboxes(value === "all"); if (value !== "all") setMailbox(value); setSelected(null); setReading(false); setQ(""); setFolder("inbox"); }}
        onNavigate={navigate} onOpen={(message) => { setQ(""); setFolder("inbox"); void openMessage(message); }}
        onCompose={() => newCompose()}
        onFolder={(id) => { setQ(""); changeFolder(id); }}
        onSearch={(query) => { navigate("mail"); setQ(query.trim().slice(0,180)); }}
        demoDraftCount={drafts.filter(d => (allMailboxes || d.payload.mailbox === mailbox) && ["draft", "approved"].includes(d.status)).length}
        onTrash={(message) => messageAction("trash", message)} revision={overviewRevision} demoRecords={demoPim.calendar} notice={notice}
      /> : <>
      <header className={s.topbar}>
        <Link href="/apps" className={s.brand}>
          <span className={s.brandLogo}>
            <Image
              src={theme === "dark" ? "/brand/ema-mark-white.png" : "/brand/ema-logo.png"}
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
                navigate(item.id);
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
              {accounts.length > 1 && <button className={allMailboxes ? s.accountActive : ""} onClick={() => { detailVersion.current++; setAllMailboxes(true); setView("mail"); setSelected(null); setReading(false); setNavOpen(false); }}><Mail size={14} />Alle Postfächer</button>}
              {accounts.map((a) => (
                <button
                  key={a.mailbox}
                  className={!allMailboxes && a.mailbox === mailbox ? s.accountActive : ""}
                  onClick={() => {
                    detailVersion.current++;
                    setAllMailboxes(false);
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
                    navigate(item.id);
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
                <label className={s.mailboxPicker}>
                  <span>Postfach</span>
                  <select aria-label="Postfachansicht" value={allMailboxes ? "all" : mailbox} onChange={e => { detailVersion.current++; setSelected(null); setReading(false); setMessages([]); setCursor(null); setAllMailboxes(e.target.value === "all"); if (e.target.value !== "all") setMailbox(e.target.value); }}>
                    {accounts.length > 1 && <option value="all">Alle Postfächer</option>}
                    {accounts.map(a => <option key={a.mailbox} value={a.mailbox}>{a.name || a.address || a.mailbox}</option>)}
                  </select>
                </label>
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
                        key={`${m.sourceMailbox || mailbox}:${folder}:${m.id}`}
                        subject={m.subject || "Nachricht"}
                        disabled={
                          busy ||
                          !accounts.find(a => a.mailbox === (m.sourceMailbox || mailbox))?.can_write ||
                          folder === "deleteditems"
                        }
                        open={swipedId === messageKey(m)}
                        onOpenChange={(open) => setSwipedId(open ? messageKey(m) : null)}
                        onDelete={() => messageAction("trash", m)}
                      >
                        <button
                          className={`${s.message} ${selected && messageKey(selected) === messageKey(m) ? s.selected : ""}`}
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
                          {allMailboxes && <span className={s.badge}>{accounts.find(a => a.mailbox === m.sourceMailbox)?.address || m.sourceMailbox}</span>}
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
                    <MailMessageBody key={`${mailbox}:${selected.id}`} message={selected} attachments={attachments} mailbox={mailbox} />
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
          className={`${s.composeBackdrop} ${composeExpanded || review ? s.composeExpanded : ""} ${composeMinimized…6001 tokens truncated…ut:not([type="checkbox"]) {
  border: 1px solid #2a4250;
  background: #0c1923;
  color: #d5e4ec;
  padding: 9px;
  border-radius: 6px;
  max-width: 100%;
}
@media (max-width: 560px) {
  .workspace input,
  .workspace textarea,
  .workspace select {
    font-size: 16px;
  }
  .toolbar button {
    min-width: 32px;
    min-height: 44px;
  }
  .modal .iconButton {
    min-height: 40px;
    min-width: 40px;
  }
  .toolbar {
    gap: 11px;
  }
}

/* Outlook-style workspace: app rail, compact folders, command ribbon. */
.topbar {
  height: 54px;
  padding-inline: 18px;
  background: #102b30;
  gap: 35px;
}
.brand {
  min-width: 242px;
}
.mark {
  width: 29px;
  height: 29px;
  border-radius: 5px;
  font-size: 12px;
}
.brand strong {
  font-size: 18px;
}
.search {
  max-width: 660px;
  padding: 7px 13px;
  border-radius: 5px;
  background: #e0f4f311;
  border-color: #ffffff19;
}
.demoBanner {
  padding: 6px 20px;
  font-size: 10px;
  background: #102421;
}
.ribbon {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 55px;
  padding: 8px 20px 8px 75px;
  border-bottom: 1px solid #ffffff14;
  background: #14212b;
}
.ribbon button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #d4e0e6;
  background: transparent;
  border: 0;
  border-radius: 4px;
  padding: 9px 12px;
  white-space: nowrap;
}
.ribbon button:hover,
.textTools button:hover,
.composeCommands button:hover {
  background: #ffffff10;
}
.ribbon .ribbonNew {
  background: #65d7b7;
  color: #092b22;
  font-weight: 650;
}
.ribbonDivider {
  width: 1px;
  height: 25px;
  background: #ffffff18;
  margin: 0 8px;
}
.ribbon .ribbonRefresh {
  margin-left: auto;
}
.body {
  grid-template-columns: 54px 210px 340px minmax(300px, 1fr);
  min-height: calc(100dvh - 136px);
}
.appRail {
  background: #0c1721;
  border-right: 1px solid #ffffff10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding-top: 16px;
}
.appRail button {
  border: 0;
  background: transparent;
  color: #96a9b8;
  width: 43px;
  height: 43px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  position: relative;
}
.appRail button[aria-current="page"] {
  color: #6ce3c3;
  background: #263c43;
}
.appRail button[aria-current="page"]::before {
  content: "";
  position: absolute;
  left: 0;
  height: 22px;
  width: 3px;
  background: #6ce3c3;
  border-radius: 2px;
}
.appRail button:last-child {
  margin-top: auto;
  margin-bottom: 15px;
}
.sidebar {
  padding: 18px 10px;
  gap: 24px;
  background: #101b25;
}
.sidebar > .composeButton {
  display: none;
}
.nav {
  gap: 1px;
}
.nav button {
  border-radius: 4px;
  padding: 9px 12px;
  color: #c2cdd6;
}
.nav .active {
  background: #26423f;
  color: #d6fff0;
  font-weight: 600;
}
.label {
  font-size: 11px;
  letter-spacing: 0.2px;
  text-transform: none;
  font-weight: 600;
  color: #99aebd;
}
.sidebar section:nth-of-type(2) {
  display: none;
}
.listHeader {
  padding: 18px 18px 0;
}
.titleRow h1 {
  font-size: 19px;
  margin-right: auto;
}
.titleRow > button:first-child {
  display: none;
}
.tabs {
  gap: 20px;
  margin-top: 20px;
}
.tabs button {
  font-size: 12px;
}
.listMeta {
  padding: 10px 18px;
}
.message {
  padding: 13px 18px;
  border-bottom-color: #ffffff0b;
}
.message.selected {
  background: #203a43;
}
.senderRow {
  margin-bottom: 5px;
}
.senderRow strong {
  font-size: 13px;
}
.subject {
  margin-bottom: 3px;
  font-weight: 500;
}
.preview {
  -webkit-line-clamp: 1;
  font-size: 12px;
}
.reader {
  background: #111c27;
}
.toolbar {
  height: 52px;
  background: #14212b;
  gap: 20px;
  padding-inline: 23px;
}
.mailContent {
  padding: 24px 30px;
}
.mailContent h2 {
  font-size: 23px;
}
.aiCard {
  border-radius: 6px;
}
.aux {
  grid-column: 3/-1;
}
.composeBackdrop {
  position: fixed;
  z-index: 100;
  bottom: 0;
  right: 26px;
  width: min(750px, calc(100vw - 40px));
  pointer-events: none;
}
.composeWindow {
  pointer-events: auto;
  width: 100%;
  max-height: min(800px, calc(100dvh - 80px));
  height: min(760px, calc(100dvh - 80px));
  border-radius: 8px 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background: #15222e;
  border: 1px solid #42605f;
  box-shadow:
    0 0 0 1px #0004,
    0 15px 75px #0009;
}
.composeWindow > header {
  min-height: 47px;
  padding: 4px 13px 4px 20px;
  background: #223942;
  flex-shrink: 0;
  border-bottom: 1px solid #ffffff10;
}
.composeWindow > header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.windowControls {
  display: flex;
  margin-left: 20px;
}
.composeCommands {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  flex-wrap: wrap;
  border-bottom: 1px solid #ffffff0e;
}
.composeCommands button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 4px;
  padding: 8px 10px;
  background: none;
  color: #c1d1dd;
  font-size: 12px;
}
.composeCommands .primary {
  background: #65d7b7;
  color: #092b22;
  padding: 8px 16px;
}
.addressFields {
  padding: 0 22px;
}
.composeWindow .addressRow {
  display: flex;
  align-items: center;
  min-height: 44px;
  border-bottom: 1px solid #ffffff15;
  margin: 0;
  gap: 12px;
  color: #a6bac9;
  font-size: 12px;
}
.addressRow > label,
.addressRow > span {
  flex: 0 0 48px;
  margin: 0;
  font-size: 12px;
}
.composeWindow .addressRow input,
.composeWindow .addressRow select {
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 8px 0;
  margin: 0;
  min-width: 0;
  flex: 1;
  width: 0;
  box-shadow: none;
}
.addressRow select option {
  background: #15222e;
}
.recipientToggles {
  display: flex;
  gap: 8px;
}
.recipientToggles button {
  border: 0;
  background: transparent;
  color: #8edec9;
  padding: 6px;
}
.composeEditor {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 200px;
  overflow: auto;
}
.composeWindow .composeEditor textarea {
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 20px 23px;
  margin: 0;
  flex: 1;
  min-height: 200px;
  resize: none;
  line-height: 1.7;
  font-size: 14px;
}
.composeFiles {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 22px 16px;
}
.composeFiles > div {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #203643;
  border: 1px solid #ffffff17;
  border-radius: 4px;
  max-width: 100%;
}
.composeFiles span {
  overflow-wrap: anywhere;
}
.composeFiles small {
  display: block;
  color: #92a8b7;
  font-size: 10px;
}
.textTools {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: #192a37;
  border-top: 1px solid #ffffff13;
}
.textTools > span {
  color: #b7cad6;
  margin-right: 8px;
  font-size: 12px;
}
.textTools button {
  background: none;
  color: #b4c6d3;
  border: 0;
  padding: 6px;
  border-radius: 3px;
}
.textTools i {
  height: 18px;
  width: 1px;
  background: #ffffff20;
  margin: 0 6px;
}
.composeStatus {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #91aaa9;
  font-size: 10px;
  line-height: 1.6;
  padding: 9px 20px;
  background: #11251f;
}
.composeWindow > p,
.composeWindow > .review {
  margin: 18px 22px;
}
.composeWindow > footer {
  padding: 12px 22px 20px;
  margin-top: auto;
}
.composeNotice {
  padding: 9px 20px;
  background: #3b321e;
  color: #eedba9;
  font-size: 12px;
}
.composeExpanded {
  inset: 0;
  width: auto;
  padding: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #02070d99;
  pointer-events: auto;
}
.composeExpanded .composeWindow {
  max-width: 1100px;
  height: calc(100dvh - 60px);
  max-height: none;
  border-radius: 8px;
}
.composeMinimized .composeWindow {
  height: 47px;
  overflow: hidden;
}
.composeMinimized .composeWindow > :not(header) {
  display: none;
}
@media (min-width: 1600px) {
  .body {
    grid-template-columns: 54px 230px 390px minmax(400px, 1fr);
  }
}
@media (max-width: 1100px) {
  .body {
    grid-template-columns: 48px 180px 300px minmax(280px, 1fr);
  }
  .brand {
    min-width: 195px;
  }
  .ribbon {
    padding-left: 60px;
  }
  .ribbon button {
    padding-inline: 8px;
  }
}
@media (max-width: 950px) {
  .body {
    grid-template-columns: 48px 180px minmax(0, 1fr);
  }
  .reader {
    display: none;
  }
  .reading .reader {
    display: block;
    grid-column: 3;
  }
  .reading .list {
    display: none;
  }
  .aux {
    grid-column: 3;
  }
  .mobileBack {
    display: flex !important;
  }
  .ribbon {
    gap: 2px;
  }
  .ribbonDivider {
    margin-inline: 3px;
  }
  .ribbon button {
    font-size: 11px;
  }
}
@media (max-width: 650px) {
  .appRail {
    display: none;
  }
  .body {
    grid-template-columns: 1fr;
  }
  .sidebar {
    display: none;
  }
  .sidebar.open {
    inset: 142px 50px 0 0;
  }
  .sidebar section:nth-of-type(2),
  .sidebar > .composeButton {
    display: flex;
  }
  .sidebar section:nth-of-type(2) {
    display: block;
  }
  .reading .reader,
  .aux {
    grid-column: 1;
  }
  .titleRow > button:first-child {
    display: inline-flex;
  }
  .topbar {
    height: 58px;
    padding-inline: 14px;
    gap: 14px;
  }
  .brand {
    min-width: 0;
  }
  .search {
    min-width: 0;
  }
  .ribbon {
    padding: 6px 12px;
    min-height: 49px;
  }
  .ribbon > button:not(.ribbonNew):not(.ribbonRefresh),
  .ribbonDivider {
    display: none;
  }
  .ribbon .ribbonNew {
    font-size: 12px;
    padding: 8px 12px;
  }
  .body {
    min-height: calc(100dvh - 136px);
  }
  .composeBackdrop {
    inset: 0;
    padding: 0;
    width: 100%;
    pointer-events: auto;
  }
  .composeWindow,
  .composeExpanded .composeWindow {
    width: 100%;
    max-width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border: 0;
    border-radius: 0;
  }
  .composeCommands {
    gap: 4px;
    padding: 9px 12px;
  }
  .composeCommands button {
    font-size: 11px;
    padding-inline: 8px;
  }
  .addressFields {
    padding-inline: 16px;
  }
  .composeWindow .addressRow input,
  .composeWindow .addressRow select,
  .composeWindow .composeEditor textarea {
    font-size: 16px;
  }
  .composeWindow .composeEditor textarea {
    padding-inline: 16px;
  }
  .composeStatus {
    padding-bottom: max(10px, env(safe-area-inset-bottom));
  }
  .composeMinimized {
    top: auto;
  }
  .composeMinimized .composeWindow {
    height: 47px;
  }
  .windowControls button {
    min-width: 35px;
    min-height: 38px;
  }
}

/* A mail-local theme, independent of the other EMA modules. */
.workspace {
  color-scheme: dark;
}
.workspace[data-theme="light"] {
  --mint: #087e66;
  --muted: #526575;
  color-scheme: light;
  background: #fff;
  color: #182c3b;
}
.themeToggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 7px;
  color: #d9eee8;
  background: #ffffff0d;
  border: 1px solid #ffffff26;
  border-radius: 5px;
  min-height: 36px;
  padding: 6px 10px;
  margin-left: auto;
}
.profile {
  margin-left: 0;
}
.workspace[data-theme="light"] .topbar {
  background: #fff;
  border-bottom-color: #dbe3e8;
}
.workspace[data-theme="light"] .brand {
  color: #173746;
}
.workspace[data-theme="light"] .brand em {
  color: #087e66;
}
.workspace[data-theme="light"] .search {
  background: #f2f5f7;
  color: #526575;
  border-color: #d7e0e7;
}
.workspace[data-theme="light"] .search input {
  color: #182c3b;
}
.workspace[data-theme="light"] input::placeholder,
.workspace[data-theme="light"] textarea::placeholder {
  color: #657987;
  opacity: 1;
}
.workspace[data-theme="light"] .profile {
  color: #526575;
}
.workspace[data-theme="light"] .avatar {
  background: #dcefe9;
  color: #176951;
}
.workspace[data-theme="light"] .themeToggle {
  color: #244354;
  background: #f4f7f8;
  border-color: #d5e0e6;
}
.workspace[data-theme="light"] .demoBanner {
  color: #23654f;
  background: #edf8f3;
  border-bottom: 1px solid #dbece4;
}
.workspace[data-theme="light"] .ribbon {
  background: #f8fafb;
  border-bottom-color: #dce3e9;
}
.workspace[data-theme="light"] .ribbon button {
  color: #354e5e;
}
.workspace[data-theme="light"] .ribbon .ribbonNew,
.workspace[data-theme="light"] .composeCommands .primary,
.workspace[data-theme="light"] .primary {
  background: #087e66;
  color: #fff;
}
.workspace[data-theme="light"] .ribbon button:hover,
.workspace[data-theme="light"] .textTools button:hover,
.workspace[data-theme="light"] .composeCommands button:hover {
  background: #e3efe9;
}
.workspace[data-theme="light"] .ribbon .ribbonNew:hover,
.workspace[data-theme="light"] .composeCommands .primary:hover {
  background: #066551;
}
.workspace[data-theme="light"] .ribbonDivider,
.workspace[data-theme="light"] .textTools i {
  background: #cdd8df;
}
.workspace[data-theme="light"] .appRail {
  background: #f1f5f7;
  border-right-color: #dbe3e8;
}
.workspace[data-theme="light"] .appRail button {
  color: #526575;
}
.workspace[data-theme="light"] .appRail button[aria-current="page"] {
  background: #dceee7;
  color: #06694f;
}
.workspace[data-theme="light"] .appRail button[aria-current="page"]::before {
  background: #087e66;
}
.workspace[data-theme="light"] .sidebar {
  background: #f9fbfc;
  border-right-color: #dbe3e8;
}
.workspace[data-theme="light"] .nav button {
  color: #3c5363;
}
.workspace[data-theme="light"] .nav .active {
  color: #075a46;
  background: #dcefe7;
}
.workspace[data-theme="light"] .label {
  color: #526575;
}
.workspace[data-theme="light"] .accounts button {
  color: #4b6170;
}
.workspace[data-theme="light"] .accounts .accountActive {
  background: #eaf0f3;
  color: #243f50;
}
.workspace[data-theme="light"] .dot {
  background: #087e66;
}
.workspace[data-theme="light"] .sideFooter {
  border-top-color: #dbe3e8;
}
.workspace[data-theme="light"] .sideFooter a,
.workspace[data-theme="light"] .iconButton,
.workspace[data-theme="light"] .titleRow button {
  color: #526575;
}
.workspace[data-theme="light"] .list {
  background: #fff;
  border-right-color: #dbe3e8;
}
.workspace[data-theme="light"] .listHeader {
  border-bottom-color: #e4eaef;
}
.workspace[data-theme="light"] .tabs button {
  color: #526575;
}
.workspace[data-theme="light"] .tabs .tabActive {
  color: #06694f;
  border-bottom-color: #087e66;
}
.workspace[data-theme="light"] .listMeta {
  color: #607584;
}
.workspace[data-theme="light"] .message {
  color: #243c4d;
  border-bottom-color: #e4eaef;
}
.workspace[data-theme="light"] .message:hover {
  background: #f1f7f5;
}
.workspace[data-theme="light"] .message.selected {
  background: #e5f3ec;
  border-left-color: #087e66;
}
.workspace[data-theme="light"] .senderRow time,
.workspace[data-theme="light"] .preview {
  color: #586e7c;
}
.workspace[data-theme="light"] .badge {
  background: #deeee5;
  color: #226549;
}
.workspace[data-theme="light"] .badge.amber {
  background: #fff0cd;
  color: #80540e;
}
.workspace[data-theme="light"] .badge.purple {
  background: #eee8f9;
  color: #66528a;
}
.workspace[data-theme="light"] .reader {
  background: #fff;
}
.workspace[data-theme="light"] .toolbar {
  background: #fafcfd;
  border-bottom-color: #e1e8ed;
}
.workspace[data-theme="light"] .toolbar button {
  color: #526575;
}
.workspace[data-theme="light"] .senderDetail .avatar {
  background: #e2edf5;
  color: #345671;
}
.workspace[data-theme="light"] .senderDetail small,
.workspace[data-theme="light"] .senderDetail time {
  color: #607584;
}
.workspace[data-theme="light"] .mailBody {
  color: #314b5d;
}
.workspace[data-theme="light"] .attachment {
  border-color: #dbe3e8;
  background: #f9fbfc;
}
.workspace[data-theme="light"] .attachment small {
  color: #607584;
}
.workspace[data-theme="light"] .fileIcon {
  color: #a24451;
  background: #f6e6ea;
}
.workspace[data-theme="light"] .aiCard {
  background: #f0f8f4;
  border-color: #cce4d7;
}
.workspace[data-theme="light"] .aiHeader {
  color: #1e654d;
}
.workspace[data-theme="light"] .aiHeader span {
  color: #547569;
}
.workspace[data-theme="light"] .aiCard p {
  color: #49665c;
}
.workspace[data-theme="light"] .aiActions button,
.workspace[data-theme="light"] .subtle {
  background: #e5f2eb;
  color: #235b45;
  border-color: #c8dfd2;
}
.workspace[data-theme="light"] .replyActions button {
  background: #f4f7f9;
  color: #415c6e;
  border-color: #d6e1e7;
}
.workspace[data-theme="light"] .replyActions button:first-child {
  background: #e1f0e7;
  color: #235b45;
  border-color: #c8dfd2;
}
.workspace[data-theme="light"] .notice,
.workspace[data-theme="light"] .composeNotice {
  background: #fff6df;
  color: #77531b;
  border-color: #e7d9b7;
}
.workspace[data-theme="light"] .empty,
.workspace[data-theme="light"] .aux p {
  color: #526b7d;
}
.workspace[data-theme="light"] .aux {
  background: #fff;
}
.workspace[data-theme="light"] .auxItem,
.workspace[data-theme="light"] .settingsGrid article {
  background: #f7fafb;
  border-color: #dce5eb;
}
.workspace[data-theme="light"] .auxItem small {
  color: #607584;
}
.workspace[data-theme="light"] .settingsGrid h3 {
  color: #245c49;
}
.workspace[data-theme="light"] .checkLabel {
  color: #355264;
}
.workspace[data-theme="light"] .checkLabel input {
  accent-color: #087e66;
}
.workspace[data-theme="light"] .modal {
  background: #fff;
  color: #182c3b;
  border-color: #c3d2dc;
  box-shadow: 0 16px 70px #233d4d33;
}
.workspace[data-theme="light"] .modal label {
  color: #526575;
}
.workspace[data-theme="light"] .modal input,
.workspace[data-theme="light"] .modal textarea,
.workspace[data-theme="light"] .modal select,
.workspace[data-theme="light"] .auxItem > label > select,
.workspace[data-theme="light"] .auxItem > label > input:not([type="checkbox"]) {
  background: #fff;
  color: #203e50;
  border-color: #cddae3;
}
.workspace[data-theme="light"] .modal p {
  color: #526575;
}
.workspace[data-theme="light"] .review {
  background: #f6faf8;
  border-color: #cddfd5;
}
.workspace[data-theme="light"] .composeWindow > header {
  background: #edf4f6;
  border-bottom-color: #dbe3e8;
}
.workspace[data-theme="light"] .composeCommands {
  border-bottom-color: #e0e7ec;
}
.workspace[data-theme="light"] .composeCommands button {
  color: #415b6c;
}
.workspace[data-theme="light"] .composeWindow .addressRow {
  color: #526575;
  border-bottom-color: #dce5eb;
}
.workspace[data-theme="light"] .composeWindow .addressRow input,
.workspace[data-theme="light"] .composeWindow .addressRow select,
.workspace[data-theme="light"] .composeWindow .composeEditor textarea {
  background: transparent;
}
.workspace[data-theme="light"] .addressRow select option {
  background: #fff;
}
.workspace[data-theme="light"] .recipientToggles button {
  color: #087e66;
}
.workspace[data-theme="light"] .composeFiles > div {
  background: #f0f5f8;
  border-color: #d2e0e8;
}
.workspace[data-theme="light"] .composeFiles small {
  color: #607584;
}
.workspace[data-theme="light"] .textTools {
  background: #f6f9fb;
  border-top-color: #dce5eb;
}
.workspace[data-theme="light"] .textTools > span,
.workspace[data-theme="light"] .textTools button {
  color: #526575;
}
.workspace[data-theme="light"] .composeStatus {
  background: #eef7f2;
  color: #416957;
}
@media (max-width: 850px) {
  .themeToggle > span {
    display: none;
  }
  .themeToggle {
    padding: 8px;
    min-width: 36px;
  }
}
@media (max-width: 650px) {
  .topbar {
    gap: 9px;
  }
  .brand strong {
    font-size: 15px;
  }
  .brand {
    gap: 7px;
  }
  .themeToggle {
    margin-left: 0;
  }
}
/* Keep platform heading/form tokens scoped to the selected mail theme. */
.workspace[data-theme="light"] {
  --ema-text: #182c3b;
  --ema-muted: #526575;
  --ema-input: #fff;
  --ema-border: #dce3e9;
  --ema-accent: #087e66;
  --ema-color-scheme: light;
  --ema-inset: none;
  --ema-shadow: none;
  --intel-glass-muted: #526575;
}
.workspace :is(h1, h2, h3, h4) {
  color: inherit !important;
}
.workspace input,
.workspace textarea,
.workspace select {
  color-scheme: inherit;
}
.brandLogo {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 4px;
  padding: 2px 5px;
  flex-shrink: 0;
}
.brandLogo img {
  width: 86px;
  height: 40px;
  object-fit: contain;
}
.attachmentOpen {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  color: inherit;
  background: transparent;
  border: 0;
  padding: 0;
  min-width: 0;
  flex: 1;
}
.attachmentOpen > span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.attachmentOpen:hover strong {
  text-decoration: underline;
}
.attachmentPreview {
  width: min(1150px, 96vw);
  height: 92dvh;
  max-height: 94dvh;
  display: flex;
  flex-direction: column;
  padding: 18px;
  gap: 12px;
}
.attachmentPreview > header {
  flex-shrink: 0;
  gap: 12px;
}
.attachmentPreview h2 {
  margin: 0;
  overflow-wrap: anywhere;
  min-width: 0;
}
.previewCommands {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #9bb4c5;
}
.previewCommands > span {
  margin-right: auto;
}
.previewCommands a {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  color: #9ee5ce;
  padding: 8px 0;
}
.previewDocument {
  min-height: 200px;
  flex: 1;
  overflow: auto;
  background: #e7ecf0;
  border-radius: 5px;
}
.previewDocument iframe {
  border: 0;
  width: 100%;
  height: 100%;
  min-height: 350px;
  background: #fff;
}
.previewDocument img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  margin: auto;
}
.previewPlaceholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
  padding: 25px;
}
.attachmentPreview .previewHint {
  font-size: 11px;
  margin: 0;
}
.workspace[data-theme="light"] .previewCommands {
  color: #526575;
}
.workspace[data-theme="light"] .previewCommands a {
  color: #087e66;
}
@media (max-width: 650px) {
  .brandLogo img {
    width: 65px;
    height: 33px;
  }
  .brandLogo {
    padding: 2px 3px;
  }
  .attachmentPreview {
    padding: 14px;
    width: 100%;
    height: 96dvh;
  }
  .attachmentPreview h2 {
    font-size: 16px;
  }
  .previewCommands {
    gap: 10px;
  }
  .previewCommands > span {
    width: 100%;
  }
}
.previewDocument {
  position: relative;
}
.mailSignature {
  padding: 12px 22px 18px;
  flex-shrink: 0;
}
.mailSignature img {
  display: block;
  width: min(100%, 320px);
  height: auto;
  border-radius: 5px;
}
.mailSignature small {
  display: block;
  font-size: 10px;
  color: #93b1bf;
  margin-top: 7px;
  line-height: 1.5;
}
.review .mailSignature {
  padding: 12px 0;
  white-space: normal;
}
.receiptOptions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
  padding: 10px 20px;
  border-top: 1px solid #ffffff15;
  flex-shrink: 0;
}
.composeWindow .receiptOptions label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 11px;
}
.composeWindow .receiptOptions input {
  width: 16px;
  height: 16px;
  margin: 0;
  padding: 0;
  accent-color: #087e66;
}
.receiptOptions small {
  width: 100%;
  font-size: 10px;
  color: #91aaa9;
}
.workspace[data-theme="light"] .receiptOptions {
  border-top-color: #dce3e9;
}
.workspace[data-theme="light"] .mailSignature small,
.workspace[data-theme="light"] .receiptOptions small {
  color: #526575;
}
.richEditor {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-height: 220px;
}
.richToolbar,
.linkTools,
.templateTools,
.scheduleControls,
.toolRow {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.richToolbar,
.linkTools,
.templateTools {
  padding: 8px 15px;
  border-bottom: 1px solid #ffffff15;
}
.richToolbar button,
.linkTools button,
.templateTools button,
.messageTools button,
.queueItem button {
  border: 1px solid #6c929750;
  background: #1c333c;
  color: #d5e6e9;
  padding: 7px 10px;
  border-radius: 4px;
}
.composeWindow .richToolbar select,
.composeWindow .richToolbar input,
.composeWindow .linkTools input,
.composeWindow .templateTools input,
.composeWindow .templateTools select {
  width: auto;
  max-width: 100%;
  padding: 5px;
  margin: 0;
}
.composeWindow .richToolbar input[type="color"] {
  width: 32px;
  height: 29px;
  padding: 1px;
}
.linkTools input {
  flex: 1;
  min-width: 100px;
}
.richBody {
  min-height: 170px;
  flex: 0 0 auto;
  padding: 18px 22px;
  line-height: 1.7;
  outline-offset: -2px;
  overflow-wrap: anywhere;
}
.richBody table,
.richReview table {
  border-collapse: collapse;
}
.richBody td,
.richBody th,
.richReview td,
.richReview th {
  border: 1px solid #8b9ca7;
  padding: 6px 10px;
  min-width: 70px;
}
.richBody a,
.richReview a {
  text-decoration: underline;
  color: #149d85;
}
.richReview {
  white-space: normal;
}
.richBody p,
.richReview p {
  margin: 4px 0 10px;
  color: inherit;
}
.dropHint {
  padding: 8px 22px;
  color: #8aafae;
  font-size: 10px;
}
.attachmentName {
  border: 0;
  background: none;
  color: inherit;
  text-decoration: underline;
  padding: 0;
}
.textSignature {
  padding: 12px 22px;
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 12px;
}
.scheduleControls {
  padding: 8px 20px;
}
.composeWindow .scheduleControls label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}
.composeWindow .scheduleControls input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
}
.composeWindow .scheduleControls input[type="datetime-local"] {
  width: auto;
  margin: 0;
}
.messageTools {
  border: 1px solid #56787444;
  border-radius: 6px;
  padding: 16px;
  margin: 25px 0;
  background: #172931;
}
.messageTools h3 {
  margin: 0 0 12px;
  font-size: 13px;
}
.messageTools input,
.messageTools select {
  max-width: 100%;
  min-width: 0;
  background: #10212c;
  color: #d5e6e9;
  border: 1px solid #43626c;
  padding: 7px;
  border-radius: 4px;
}
.messageTools small {
  display: block;
  color: #9bb1be;
  font-size: 10px;
  line-height: 1.6;
  margin: 8px 0;
}
.toolRow {
  margin: 9px 0;
}
.thread details {
  border-top: 1px solid #7f999940;
  padding: 12px 0;
}
.thread summary {
  cursor: pointer;
  line-height: 1.6;
}
.thread p {
  white-space: pre-wrap;
  line-height: 1.8;
}
.queueItem {
  display: grid;
  gap: 7px;
  padding: 12px 0;
  border-top: 1px solid #78929440;
}
.queueItem button {
  justify-self: start;
}
.queueItem span {
  color: #9bb4c5;
}
.auxItem textarea {
  width: 100%;
  min-height: 130px;
  display: block;
  margin: 10px 0;
  background: #0c1923;
  color: #d5e4ec;
  border: 1px solid #2a4250;
  padding: 10px;
}
.workspace[data-theme="light"] .richToolbar,
.workspace[data-theme="light"] .linkTools,
.workspace[data-theme="light"] .templateTools {
  border-bottom-color: #dce3e9;
}
.workspace[data-theme="light"] .messageTools {
  background: #f6faf8;
  border-color: #d2e3da;
}
.workspace[data-theme="light"] .richToolbar button,
.workspace[data-theme="light"] .linkTools button,
.workspace[data-theme="light"] .templateTools button,
.workspace[data-theme="light"] .messageTools button,
.workspace[data-theme="light"] .queueItem button {
  color: #255744;
  background: #e8f1ec;
  border-color: #cadbd1;
}
.workspace[data-theme="light"] .messageTools input,
.workspace[data-theme="light"] .messageTools select,
.workspace[data-theme="light"] .auxItem textarea {
  background: #fff;
  color: #244051;
  border-color: #cfdae1;
}
.workspace[data-theme="light"] .queueItem span,
.workspace[data-theme="light"] .dropHint,
.workspace[data-theme="light"] .messageTools small {
  color: #526575;
}
@media (max-width: 650px) {
  .richToolbar,
  .linkTools,
  .templateTools {
    padding-inline: 12px;
    gap: 5px;
  }
  .richBody {
    padding: 14px 16px;
    min-height: 130px;
  }
  .richToolbar button {
    padding: 7px;
  }
  .composeWindow .richToolbar select {
    max-width: 95px;
  }
  .messageTools {
    padding: 12px;
  }
  .messageTools input {
    font-size: 16px;
  }
  .scheduleControls {
    padding-inline: 12px;
  }
  .composeWindow .scheduleControls label {
    flex-wrap: wrap;
  }
}

/* Fit installed iPhone Mail to the viewport; scroll content, keep controls reachable. */
@media (max-width: 650px) {
  .workspace {
    box-sizing: border-box;
    height: 100dvh;
    min-height: 0;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
  }
  .topbar { height: 48px; flex: 0 0 48px; padding-inline: 10px; gap: 9px; }
  .brand { gap: 5px; flex-shrink: 0; }
  .brand strong { font-size: 14px; }
  .brandLogo img { width: 54px; height: 29px; }
  .search { flex: 1; width: 0; min-width: 0; padding: 6px 8px; gap: 5px; }
  .search input { min-width: 0; width: 100%; font-size: 16px; }
  .themeToggle { flex-shrink: 0; padding: 7px; }
  .ribbon { flex: 0 0 auto; min-height: 42px; padding: 4px 10px; }
  .ribbon .ribbonNew { padding: 7px 10px; }
  .body { flex: 1; min-height: 0; overflow: hidden; }
  .list { min-height: 0; overflow: hidden; }
  .listHeader { flex-shrink: 0; padding: 9px 14px 0; }
  .titleRow h1 { font-size: 18px; letter-spacing: -.3px; }
  .titleRow button { min-height: 34px; min-width: 34px; }
  .tabs { margin-top: 7px; gap: 19px; }
  .tabs button { padding-bottom: 8px; }
  .listMeta { flex-shrink: 0; padding: 7px 14px; font-size: 10px; }
  .messages { min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; }
  .message { padding: 10px 14px; }
  .senderRow { margin-bottom: 3px; }
  .senderRow strong { font-size: 13px; }
  .subject { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-bottom: 2px; font-size: 12px; }
  .preview { font-size: 11px; line-height: 1.4; }
  .listMore { flex-shrink: 0; padding: 6px 12px; }
  .reader, .aux { min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; }
  .sidebar.open { top: calc(90px + env(safe-area-inset-top, 0px)); bottom: env(safe-area-inset-bottom, 0px); }
  .composeWindow, .composeExpanded .composeWindow { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
}
@media (max-width: 360px) {
  .brand strong { display: none; }
  .tabs { gap: 14px; }
}

/* Separate branding from search on phones so neither is compressed. */
@media (max-width: 650px) {
  .topbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 40px;
    grid-template-rows: 38px 40px;
    height: auto;
    flex: 0 0 auto;
    padding: 16px 14px 12px;
    gap: 8px 12px;
    overflow: visible;
    background: #0a111a;
  }
  .workspace[data-theme="light"] .topbar { background: #ffffff; }
  .brand { grid-column: 1; grid-row: 1; justify-self: start; gap: 9px; }
  .brand strong { display: block; font-size: 16px; }
  .brandLogo img { width: 67px; height: 32px; }
  .themeToggle { grid-column: 2; grid-row: 1; width: 38px; height: 38px; margin: 0; justify-self: end; }
  .search { grid-column: 1 / -1; grid-row: 2; box-sizing: border-box; width: 100%; max-width: none; height: 40px; padding: 8px 11px; gap: 8px; }
  .search input { font-size: 16px; }
  .body { position: relative; }
  .sidebar.open { position: absolute; inset: 0 50px 0 0; }
}


/* Give writing the available space; optional tools stay above the message. */
.composeWindow {
  overflow: hidden;
}
.composeCommands,
.addressFields,
.composeStatus,
.composeNotice {
  flex-shrink: 0;
}
.composeEditor {
  min-height: 0;
}
.richEditor {
  flex: 1 0 auto;
  min-height: 390px;
}
.richToolbar {
  flex-shrink: 0;
}
.richBody {
  flex: 1;
  min-height: 300px;
}
.composeWindow .receiptOptions {
  gap: 4px 18px;
  padding: 5px 15px;
  border-top: 0;
  border-bottom: 1px solid #ffffff15;
}
.composeWindow .receiptOptions label {
  min-height: 30px;
  font-size: 12px;
}
.composeStatus {
  padding: 6px 15px;
}
.workspace[data-theme="light"] .composeWindow .receiptOptions {
  border-bottom-color: #dce3e9;
}
@media (max-width: 650px) {
  .composeCommands {
    flex-wrap: nowrap;
    gap: 2px;
    padding: 6px 10px;
  }
  .composeCommands button {
    min-height: 36px;
    gap: 5px;
    padding-inline: 7px;
    white-space: nowrap;
  }
  .composeCommands .primary {
    padding-inline: 10px;
  }
  .richEditor {
    min-height: max(380px, calc(100dvh - 280px));
  }
  .richToolbar {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding: 6px 12px;
  }
  .richToolbar > * {
    flex-shrink: 0;
  }
  .composeWindow .richToolbar select {
    font-size: 16px;
  }
  .composeWindow .receiptOptions {
    gap: 4px 12px;
    padding: 3px 12px;
  }
  .composeWindow .receiptOptions label {
    font-size: 11px;
    gap: 6px;
  }
  .richBody {
    font-size: 16px;
    min-height: 300px;
    padding: 14px 16px;
  }
  .composeStatus {
    padding: 6px 12px max(6px, env(safe-area-inset-bottom));
  }
}

.swipeRow { position:relative; overflow:hidden; background:#c33039; }
.swipeContent { position:relative; z-index:1; width:100%; background:#111c27; touch-action:pan-y pinch-zoom; transition:transform 180ms ease-out; }
.swipeDelete { position:absolute; inset:0 0 0 auto; width:88px; border:0; background:#c33039; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; font-weight:600; }
.workspace[data-theme="light"] .swipeContent { background:#fff; }
@media(prefers-reduced-motion:reduce) { .swipeContent { transition:none; } }

/* Mail start page: executive agenda, matching the approved concept. */
.withDashboardNav { padding-bottom:calc(54px + env(safe-area-inset-bottom,0px)); }
.homeWorkspace { background:#0e1213; color:#f4f6f5; }
.dashboard { --dash-muted:#adb6b4; background:#0e1213; color:#f4f6f5; min-width:0; flex:1; display:flex; flex-direction:column; min-height:calc(100dvh - 54px); }
.dashboardScroll { box-sizing:border-box; width:100%; max-width:1150px; margin:0 auto; padding:26px 32px 20px; flex:1; min-height:0; }
.dashboardHeader { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:30px; }
.dashboardHeader > div { display:flex; gap:6px; }
.dashboardHeader button,.dashboardSectionTitle button { border:0; background:transparent; color:#becac6; display:grid; place-items:center; min-width:42px; min-height:42px; border-radius:50%; }
.dashboardHeader button:hover { background:#ffffff10; }
.dashboardBrand { display:flex; align-items:center; gap:17px; color:#f5f7f6; text-decoration:none; font-size:24px; }
.dashboardDemo { color:#7ee1bb; font-size:12px; }
.dashboardTitle p { text-transform:uppercase; color:#b5bfba; font-size:12px; letter-spacing:1.4px; margin:0 0 8px; }
.dashboardTitle h1 { font-size:36px; letter-spacing:-1px; margin:0 0 23px; line-height:1.15; }
.dashboardMailbox { display:flex; align-items:center; gap:12px; margin:16px 0; color:#a8b7b0; font-size:12px; }
.dashboardMailbox select { flex:1; max-width:420px; min-width:0; padding:9px 12px; background:#1b2220; color:#dee9e3; border:1px solid #344139; border-radius:10px; }
.dashboardTabs { display:flex; gap:3px; background:linear-gradient(120deg,#252a28,#1b201e); border:1px solid #343b37; border-radius:14px; padding:3px; margin:17px 0 23px; }
.dashboardTabs button { flex:1; border:0; border-radius:11px; background:transparent; color:#d2d9d6; padding:12px 6px; font-size:14px; }
.dashboardTabs button[aria-pressed="true"] { background:linear-gradient(120deg,#0d9b6b,#096345); color:white; box-shadow:inset 0 1px 0 #ffffff22; }
.dashboardColumns { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(0,1fr); gap:32px; }
.dashboardSectionTitle { display:flex; justify-content:space-between; align-items:center; margin:0 0 10px; }
.dashboardSectionTitle h2 { margin:0; font-size:23px; font-weight:650; letter-spacing:-.4px; }
.dashboardMailWrap { border:1px solid #343b37; background:linear-gradient(120deg,#242a27,#1a201d); border-radius:17px; overflow:hidden; margin-bottom:12px; }
.dashboardMailWrap .swipeContent { background:linear-gradient(120deg,#242a27,#1a201d); }
.dashboardMail { width:100%; display:flex; align-items:flex-start; text-align:left; gap:14px; padding:18px; border:0; background:transparent; color:#f1f4f2; }
.dashboardAvatar { display:grid; place-items:center; flex:0 0 43px; height:43px; border-radius:50%; background:#245340; color:#d0f4e0; font-size:20px; }
.dashboardAvatar[data-color="1"] { background:#324a43; }
.dashboardAvatar[data-color="2"] { background:#314c54; }
.dashboardMailContent { min-width:0; flex:1; display:grid; gap:5px; }
.dashboardSender { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:15px; }
.dashboardSender time { font-size:12px; color:#bdc8c1; flex-shrink:0; }
.dashboardMailContent strong { display:block; font-size:15px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; line-height:1.4; }
.dashboardPreview { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; color:#b0beb5; line-height:1.45; font-size:13px; }
.dashboardTag { display:flex; align-items:center; gap:5px; width:fit-content; padding:4px 10px; border-radius:20px; background:#12573c99; color:#a4e9c7; font-size:11px; margin-top:4px; }
.dashboardEvent { position:relative; display:flex; align-items:flex-start; gap:14px; padding:13px 0 18px 22px; min-width:0; }
.dashboardEvent:not(:last-child)::before { content:""; position:absolute; top:26px; bottom:-15px; left:5px; width:1px; background:#1b7252; }
.dashboardDot { position:absolute; left:0; top:17px; width:11px; height:11px; border-radius:50%; background:#14ba7b; }
.dashboardEvent time { font-size:14px; font-weight:600; min-width:42px; }
.dashboardEvent > div { min-width:0; flex:1; }
.dashboardEvent button { padding:0; background:transparent; border:0; color:#f2f5f3; font-size:14px; text-align:left; font-weight:600; line-height:1.4; }
.dashboardEvent p { color:#a7b7ad; font-size:12px; margin:5px 0 0; }
.dashboardEvent a { background:#08734d; border:1px solid #188b61; color:#f3fff8; text-decoration:none; font-size:11px; padding:7px 10px; border-radius:20px; flex-shrink:0; }
.dashboardFootnote { color:#9cafa2; font-size:11px; line-height:1.5; margin:3px 0 12px; }
.dashboardEmpty { color:#aab9af; padding:18px 0; line-height:1.5; }
.dashboardErrors { border:1px solid #b29a5466; border-radius:12px; padding:12px; color:#ecdba7; font-size:12px; }
.dashboardErrors p { margin:4px 0; }
.dashboardErrors button { border:0; padding:8px 0; background:transparent; color:#86dfb6; }
.dashboardActions { box-sizing:border-box; flex-shrink:0; width:100%; max-width:1150px; margin:0 auto; display:flex; justify-content:flex-end; gap:10px; padding:8px 32px; background:#0e1213; border-top:1px solid #ffffff0a; }
.dashboardActions button { display:grid; place-items:center; flex:0 0 44px; width:44px; height:44px; padding:0; border-radius:50%; border:1px solid #299e72; background:linear-gradient(130deg,#14b97f,#05734e); color:white; }

.dashboardNav { box-sizing:border-box; height:calc(54px + env(safe-area-inset-bottom,0px)); position:fixed; bottom:0; left:0; right:0; display:flex; justify-content:center; gap:16px; border-top:1px solid #384039; background:#131916f5; padding:3px 12px calc(3px + env(safe-area-inset-bottom,0px)); z-index:20; backdrop-filter:blur(16px); }
.dashboardNav button { position:relative; border:0; background:transparent; color:#c6cfca; display:flex; flex-direction:column; align-items:center; gap:3px; padding:2px 12px 4px; flex:1; max-width:150px; min-height:44px; font-size:10px; }
.dashboardNav button[aria-current="page"] { color:#25d694; }
.dashboardNav button[aria-current="page"]::after { content:""; position:absolute; bottom:0; width:40px; height:3px; border-radius:3px; background:#37d99b; }
@media(max-width:850px) {
  .dashboardColumns { grid-template-columns:minmax(0,1fr); gap:22px; }
}
@media(max-width:650px) {
  .withDashboardNav { padding-bottom:calc(54px + env(safe-area-inset-bottom,0px)); }
  .homeWorkspace { display:flex; }
  .dashboard { overflow:hidden; display:flex; min-height:0; }
  .dashboardScroll { width:100%; min-width:0; overflow-y:auto; overscroll-behavior-y:contain; padding:21px 20px 16px; }
  .dashboardHeader { margin-bottom:23px; }
  .dashboardBrand { font-size:20px; gap:12px; }
  .dashboardTitle h1 { font-size:32px; margin-bottom:20px; }
  .dashboardTitle p { font-size:11px; letter-spacing:1px; }
  .dashboardSectionTitle h2 { font-size:22px; }
  .dashboardTabs { margin:14px 0 20px; }
  .dashboardTabs button { font-size:13px; }
  .dashboardMail { padding:16px 14px; gap:12px; }
  .dashboardSender { font-size:14px; }
  .dashboardMailContent strong { font-size:14px; }
  .dashboardEvent { gap:10px; }
  .dashboardEvent a { padding:6px 8px; }
  .dashboardNav { gap:0; }
  .dashboardNav button { font-size:11px; padding-inline:5px; }
  .dashboardActions { padding:7px 20px; }
  .withDashboardNav .sidebar.open { bottom:calc(54px + env(safe-area-inset-bottom,0px)); }
}


/* Dashboard follows the same saved appearance as the mailbox. */
.dashboardLogo { display:flex; align-items:center; justify-content:center; flex-shrink:0; background:#fff; padding:4px 6px; border-radius:8px; }
.dashboardLogo img { display:block; width:96px; height:45px; object-fit:contain; }
.dashboardBrand strong { font-size:20px; font-weight:650; }
.workspace[data-theme="light"].homeWorkspace,
.workspace[data-theme="light"] .dashboard { background:#f6f8fa; color:#182c3b; }
.workspace[data-theme="light"] .dashboardBrand { color:#182c3b; }
.workspace[data-theme="light"] .dashboardHeader button,
.workspace[data-theme="light"] .dashboardSectionTitle button { color:#526a77; }
.workspace[data-theme="light"] .dashboardHeader button:hover { background:#e6edf0; }
.workspace[data-theme="light"] .dashboardDemo { color:#087653; }
.workspace[data-theme="light"] .dashboardTitle p,
.workspace[data-theme="light"] .dashboardMailbox { color:#536b78; }
.workspace[data-theme="light"] .dashboardMailbox select { background:#fff; color:#182c3b; border-color:#d3dfe4; }
.workspace[data-theme="light"] .dashboardTabs { background:#e9eff2; border-color:#d3dfe4; }
.workspace[data-theme="light"] .dashboardTabs button { color:#435d6b; }
.workspace[data-theme="light"] .dashboardTabs button[aria-pressed="true"] { color:#fff; }
.workspace[data-theme="light"] .dashboardMailWrap { border-color:#d9e3e8; background:#fff; box-shadow:0 2px 8px #17304406; }
.workspace[data-theme="light"] .dashboardMailWrap .swipeContent { background:#fff; }
.workspace[data-theme="light"] .dashboardMail { color:#182c3b; }
.workspace[data-theme="light"] .dashboardAvatar { background:#d8f1e6; color:#126443; }
.workspace[data-theme="light"] .dashboardAvatar[data-color="1"] { background:#dfece8; color:#3a6556; }
.workspace[data-theme="light"] .dashboardAvatar[data-color="2"] { background:#deedf3; color:#365f72; }
.workspace[data-theme="light"] .dashboardSender time,
.workspace[data-theme="light"] .dashboardPreview,
.workspace[data-theme="light"] .dashboardEvent p,
.workspace[data-theme="light"] .dashboardFootnote,
.workspace[data-theme="light"] .dashboardEmpty { color:#526a77; }
.workspace[data-theme="light"] .dashboardTag { background:#e1f3e9; color:#176444; }
.workspace[data-theme="light"] .dashboardEvent button { color:#182c3b; }
.workspace[data-theme="light"] .dashboardEvent:not(:last-child)::before { background:#99cfb8; }
.workspace[data-theme="light"] .dashboardErrors { background:#fff8e6; color:#785b16; border-color:#e8d79e; }
.workspace[data-theme="light"] .dashboardErrors button { color:#087653; }
.workspace[data-theme="light"] .dashboardActions { background:#f6f8fa; border-color:#dfe7eb; }
.workspace[data-theme="light"] .dashboardNav { background:#fffffff5; border-color:#d9e3e8; }
.workspace[data-theme="light"] .dashboardNav button { color:#586d79; }
.workspace[data-theme="light"] .dashboardNav button[aria-current="page"] { color:#087653; }
.workspace[data-theme="light"] .dashboardNav button[aria-current="page"]::after { background:#0b996a; }
@media(max-width:650px) {
  .dashboardBrand { gap:9px; }
  .dashboardLogo img { width:82px; height:38px; }
  .dashboardBrand strong { font-size:18px; }
  .dashboardHeader { gap:10px; }
  .dashboardHeader > div { gap:2px; }
  .dashboardHeader button { min-width:36px; min-height:40px; }
}

/* Compact inbox dashboard, with transparent original branding. */
.inboxDashboard {
  --inbox-bg:#0f1720; --inbox-card:#17232e; --inbox-text:#eaf2f7;
  --inbox-muted:#a4b5c2; --inbox-line:#2a3c49; --inbox-soft:#20333c;
  --inbox-accent:#69d9b0; --inbox-mint:#173f36;
  background:var(--inbox-bg); color:var(--inbox-text);
}
.workspace[data-theme="light"] .inboxDashboard {
  --inbox-bg:#f5f8fc; --inbox-card:#fff; --inbox-text:#142b40;
  --inbox-muted:#5c7183; --inbox-line:#dfe7ee; --inbox-soft:#eaf0f6;
  --inbox-accent:#07856c; --inbox-mint:#dcf7ed;
  background:var(--inbox-bg); color:var(--inbox-text);
}
.inboxDashboard .dashboardScroll { max-width:1000px; padding:24px 28px 16px; }
.inboxDashboard .dashboardHeader { margin-bottom:20px; }
.inboxDashboard .dashboardBrand { gap:9px; color:var(--inbox-text); min-width:0; }
.inboxDashboard .dashboardLogo { padding:0; border:0; border-radius:0; background:transparent; }
.inboxDashboard .dashboardLogo img { width:76px; height:37px; }
.inboxDashboard .dashboardBrand small { font-size:12px; font-weight:750; letter-spacing:.5px; }
.inboxDashboard .dashboardBrand strong { border-left:1px solid var(--inbox-line); padding-left:13px; margin-left:3px; font-size:24px; }
.inboxDashboard .dashboardHeader button { color:var(--inbox-muted); }
.inboxHeading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:5px; }
.inboxHeading h1 { font-size:30px; font-weight:750; letter-spacing:-.8px; line-height:1.25; margin:0; color:var(--inbox-text); }
.syncPill { display:flex; align-items:center; flex-shrink:0; gap:5px; border:0; border-radius:20px; padding:7px 10px; background:var(--inbox-mint); color:var(--inbox-accent); font-size:11px !important; font-weight:650 !important; }
.syncWarning { background:#fff0c7; color:#715214; }
.inboxAddress { color:var(--inbox-muted); font-size:11px; margin:0 0 13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.inboxMailbox { display:block; margin:0 0 12px; }
.inboxMailbox select { max-width:100%; padding:5px 0; border:0; background:transparent; color:var(--inbox-muted); font-size:12px; }
.inboxMailbox select option { background:var(--inbox-card); color:var(--inbox-text); }
.inboxSearch { display:flex; align-items:center; gap:10px; min-height:44px; padding:0 14px; border:1px solid var(--inbox-line); background:var(--inbox-soft); color:var(--inbox-muted); border-radius:13px; margin-bottom:14px; }
.inboxSearch input { min-width:0; width:100%; background:transparent; border:0; color:var(--inbox-text); padding:10px 0; outline:none; font-size:16px; }
.inboxSearch input::placeholder { color:var(--inbox-muted); }
.inboxSearch:focus-within { outline:2px solid var(--inbox-accent); outline-offset:1px; }
.inboxSearch button { border:0; color:var(--inbox-accent); background:transparent; display:grid; place-items:center; min-width:28px; min-height:34px; }
.inboxStats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
.inboxStats > button { display:flex; align-items:center; gap:12px; min-width:0; text-align:left; border:1px solid var(--inbox-line); border-radius:14px; padding:13px; background:var(--inbox-card); color:var(--inbox-text); box-shadow:0 3px 10px #13304a05; }
.inboxStats > button > span { display:grid; place-items:center; width:38px; height:38px; flex-shrink:0; border-radius:10px; background:var(--inbox-mint); color:var(--inbox-accent); }
.inboxStats > button > div { min-width:0; display:grid; gap:1px; }
.inboxStats strong { font-size:22px; font-weight:750; line-height:1.15; }
.inboxStats small { color:var(--inbox-muted); font-size:12px; }
.inboxNext { background:var(--inbox-card); border:1px solid var(--inbox-line); padding:13px 15px; border-radius:15px; margin-bottom:20px; box-shadow:0 3px 10px #13304a05; }
.inboxEyebrow { margin:0 0 8px; text-transform:uppercase; font-size:10px; letter-spacing:1.2px; font-weight:650; color:var(--inbox-muted); }
.inboxNextBody { display:flex; align-items:center; gap:13px; }
.inboxNextBody > time { flex-shrink:0; background:var(--inbox-mint); color:var(--inbox-accent); padding:9px 10px; border-radius:8px; font-size:16px; font-weight:750; }
.inboxNextTitle { flex:1; min-width:0; text-align:left; border:0; border-left:1px solid var(--inbox-line); padding:0 0 0 12px; background:transparent; display:grid; gap:3px; color:var(--inbox-text); }
.inboxNextTitle strong { font-size:14px; line-height:1.3; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.inboxNextTitle small { color:var(--inbox-muted); font-size:12px; }
.inboxNextBody > a { flex-shrink:0; background:#07856c; color:white; text-decoration:none; font-size:11px; font-weight:650; border-radius:9px; padding:8px 10px; }
.inboxNextEmpty { display:flex; gap:10px; align-items:center; color:var(--inbox-muted); min-height:37px; }
.inboxNextEmpty > svg { color:var(--inbox-accent); flex-shrink:0; }
.inboxNextEmpty p { margin:0; font-size:13px; flex:1; }
.inboxNextEmpty button { background:transparent; color:var(--inbox-accent); border:0; padding:6px 0 6px 6px; font-size:11px; }
.inboxSectionHeading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
.inboxSectionHeading h2 { font-size:23px; letter-spacing:-.5px; color:var(--inbox-text); margin:0; line-height:1.3; }
.inboxSectionHeading > button { color:var(--inbox-accent); background:transparent; border:0; padding:6px 0 6px 8px; font-size:12px; white-space:nowrap; }
.inboxFilters { display:flex; gap:8px; margin-bottom:12px; }
.inboxFilters button { border:1px solid var(--inbox-line); background:var(--inbox-soft); color:var(--inbox-muted); border-radius:20px; padding:6px 17px; font-size:12px; }
.inboxFilters button[aria-pressed="true"] { background:linear-gradient(110deg,#0bb390,#07856c); color:white; border-color:transparent; }
.inboxMessageList { border:1px solid var(--inbox-line); border-radius:15px; overflow:hidden; background:var(--inbox-card); box-shadow:0 3px 12px #13304a07; }
.inboxMessageList .swipeContent { background:var(--inbox-card); }
.workspace[data-theme="light"] .inboxMessageList .swipeContent { background:var(--inbox-card); }
.inboxMessageList .swipeRow + .swipeRow { border-top:1px solid var(--inbox-line); }
.inboxMessage { width:100%; min-width:0; display:flex; gap:12px; align-items:center; padding:14px 16px; border:0; border-left:3px solid transparent; background:var(--inbox-card); color:var(--inbox-text); text-align:left; }
.inboxMessage[data-unread="true"] { border-left-color:#0ac59c; }
.inboxMessage:hover { background:var(--inbox-soft); }
.inboxAvatar { display:grid; place-items:center; width:42px; height:42px; flex-shrink:0; border-radius:50%; font-size:16px; font-weight:650; color:#174b46; background:#b9f0dd; }
.inboxAvatar[data-color="1"] { background:#c9eafa; color:#1b466a; }
.inboxAvatar[data-color="2"] { background:#e2d8fa; color:#43346b; }
.inboxAvatar[data-color="3"] { background:#ffe9bd; color:#674820; }
.inboxAvatar[data-color="4"] { background:#cde6ed; color:#264c63; }
.inboxMessageBody { display:grid; gap:3px; min-width:0; flex:1; }
.inboxSender { display:flex; align-items:center; gap:8px; min-width:0; }
.inboxSender > strong { flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:14px; font-weight:650; }
.inboxSender > time { flex-shrink:0; font-size:12px; color:var(--inbox-muted); }
.inboxSender > i { width:7px; height:7px; flex-shrink:0; background:var(--inbox-accent); border-radius:50%; }
.inboxSubject { font-size:13px; font-weight:650; }
.inboxPreview { color:var(--inbox-muted); font-size:12px; }
.inboxSubject,.inboxPreview { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; line-height:1.35; }
.inboxMessageList .dashboardEmpty { margin:0; padding:18px; }
.inboxMore { margin:10px 0 0; font-size:11px; color:var(--inbox-muted); }
.inboxMore button { background:transparent; border:0; color:var(--inbox-accent); padding:2px; }
.inboxDashboard .dashboardActions { max-width:1000px; padding:10px 28px; background:var(--inbox-bg); border-color:var(--inbox-line); }
.inboxDashboard .dashboardActions > button { display:flex; gap:10px; align-items:center; justify-content:center; flex:1; width:100%; max-width:none; height:45px; border-radius:12px; font-size:15px; font-weight:650; background:linear-gradient(110deg,#0bb390,#007e67); border-color:transparent; }
@media(max-width:650px) {
  .inboxDashboard .dashboardScroll { padding:16px 16px 12px; }
  .inboxDashboard .dashboardHeader { margin-bottom:13px; }
  .inboxDashboard .dashboardBrand { gap:7px; }
  .inboxDashboard .dashboardLogo img { width:66px; height:33px; }
  .inboxDashboard .dashboardBrand small { font-size:11px; }
  .inboxDashboard .dashboardBrand strong { font-size:23px; padding-left:11px; margin-left:3px; }
  .inboxHeading h1 { font-size:27px; }
  .syncPill { padding:6px 8px; font-size:10px !important; }
  .inboxSearch { margin-bottom:11px; }
  .inboxStats { gap:8px; margin-bottom:12px; }
  .inboxStats > button { gap:7px; padding:10px 8px; border-radius:12px; }
  .inboxStats > button > span { width:30px; height:32px; border-radius:8px; }
  .inboxStats > button > span > svg { width:19px; height:19px; }
  .inboxStats strong { font-size:20px; }
  .inboxStats small { font-size:10px; }
  .inboxNext { padding:11px 12px; margin-bottom:16px; }
  .inboxEyebrow { margin-bottom:7px; }
  .inboxNextBody { gap:9px; }
  .inboxNextBody > time { font-size:14px; padding:8px; }
  .inboxNextTitle { padding-left:9px; }
  .inboxNextTitle strong { font-size:12px; }
  .inboxNextTitle small { font-size:10px; }
  .inboxNextBody > a { padding:7px 8px; font-size:10px; }
  .inboxNextEmpty { gap:8px; }
  .inboxNextEmpty p { font-size:11px; }
  .inboxNextEmpty button { font-size:10px; }
  .inboxSectionHeading { margin-bottom:8px; }
  .inboxSectionHeading h2 { font-size:21px; }
  .inboxSectionHeading > button { font-size:11px; }
  .inboxFilters { margin-bottom:10px; }
  .inboxFilters button { padding:5px 15px; font-size:11px; }
  .inboxMessage { gap:10px; padding:9px 11px; }
  .inboxAvatar { width:35px; height:35px; font-size:13px; }
  .inboxMessageBody { gap:2px; }
  .inboxSender > strong { font-size:12px; }
  .inboxSender > time { font-size:10px; }
  .inboxSubject,.inboxPreview { font-size:11px; }
  .inboxDashboard .dashboardActions { padding:8px 16px; }
  .inboxDashboard .dashboardActions > button { height:43px; font-size:14px; }
}
@media(max-width:360px) {
  .inboxHeading h1 { font-size:24px; }
  .inboxStats > button { gap:5px; padding:9px 6px; }
  .inboxStats > button > span { width:25px; }
  .inboxNextBody { flex-wrap:wrap; }
}

.brandLogo { background:transparent; padding:0; }
.workspace[data-theme="light"] .inboxDashboard .dashboardActions { background:var(--inbox-bg); border-color:var(--inbox-line); }

.inboxSectionHeading h2 { font-weight:700; }
@media(max-width:650px) {
  .inboxDashboard .dashboardScroll { padding-top:14px; }
  .inboxDashboard .dashboardHeader { margin-bottom:8px; }
  .inboxHeading { margin-bottom:10px; }
  .inboxHeading h1 { line-height:1.15; }
  .inboxAddress { display:none; }
  .inboxSearch { min-height:42px; margin-bottom:9px; }
  .inboxSearch input { line-height:20px; padding:8px 0; }
  .inboxStats > button { padding-top:9px; padding-bottom:9px; }
  .inboxNext { padding-top:10px; padding-bottom:10px; margin-bottom:12px; }
  .inboxEyebrow { line-height:1.2; margin-bottom:5px; }
  .inboxSectionHeading { margin-bottom:6px; }
  .inboxFilters { margin-bottom:8px; }
  .inboxFilters button { line-height:1.2; }
  .inboxMessage { padding-top:8px; padding-bottom:8px; }
  .inboxSender > strong { line-height:1.3; }
  .inboxDashboard .dashboardActions > button { height:44px; }
}

.mailboxPicker { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 12px; color: var(--muted); }
.mailboxPicker select { min-width: 0; width: 100%; padding: 8px 10px; border: 1px solid #71839755; border-radius: 8px; background: #101e2b; color: inherit; font: inherit; }

.workspace[data-theme="light"] .mailboxPicker select { background: #fff; }
.inboxSource { display: block; color: #008c78; font-size: 10px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace[data-theme="dark"] .inboxSource { color: #5de5c0; }
.receivedMail { margin: 22px 0; min-width: 0; }
.receivedFrame { display: block; width: 100%; min-height: 120px; border: 0; background: #fff; border-radius: 8px; }
.receivedMail small { display: block; color: var(--muted); font-size: 11px; margin-top: 8px; }
