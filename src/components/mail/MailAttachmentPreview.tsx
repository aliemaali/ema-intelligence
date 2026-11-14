"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { MailDialog } from "./MailDialog";
import { validateStoredAttachment } from "@/lib/mail/attachments";
import type { Attachment } from "@/lib/mail/model";
import s from "./mail.module.css";
const supportedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);
export function MailAttachmentPreview({
  file,
  mailbox,
  messageId,
  demo,
  onClose,
}: {
  file: Attachment;
  mailbox: string;
  messageId: string;
  demo: boolean;
  onClose: () => void;
}) {
  const [source, setSource] = useState<{ url: string; mime: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const supported = supportedTypes.has(file.contentType.toLowerCase());
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        if (!supported) return;
        let bytes: Uint8Array,
          mime = file.contentType.toLowerCase();
        if (demo) {
          const { jsPDF } = await import("jspdf");
          const pdf = new jsPDF();
          pdf.setTextColor(14, 92, 72);
          pdf.setFontSize(22);
          pdf.text("EMA Enterprise", 22, 28);
          pdf.setTextColor(35, 55, 70);
          pdf.setFontSize(16);
          pdf.text(
            file.name.startsWith("Rechnung")
              ? "Beispielrechnung"
              : "Projektuebersicht",
            22,
            49,
          );
          pdf.setFontSize(11);
          pdf.text("DEMO - Keine echten Kunden- oder Rechnungsdaten", 22, 65);
          pdf.text(
            [
              "Dies ist eine Beispieldatei fuer die Anhangvorschau.",
              "",
              "Die Originaldateien aus Microsoft 365 werden nach",
              "der Einrichtung des Testpostfachs hier angezeigt.",
              "",
              "Projekt: EMA Mail",
              "Status: Zur Pruefung",
            ],
            22,
            86,
          );
          bytes = new Uint8Array(pdf.output("arraybuffer"));
          mime = "application/pdf";
        } else {
          const response = await fetch(
            `/api/mail/attachment?${new URLSearchParams({ mailbox, id: messageId, attachmentId: file.id })}`,
            { cache: "no-store", signal: controller.signal },
          );
          const result = await response.json();
          if (!response.ok)
            throw new Error(
              result.error || "Anhang konnte nicht geladen werden.",
            );
          const attachment = result.attachment;
          mime = String(attachment?.contentType || "").toLowerCase();
          if (
            !supportedTypes.has(mime) ||
            typeof attachment?.contentBytes !== "string" ||
            attachment.contentBytes.length > 20_000_000
          )
            throw new Error("Dateityp oder Dateigröße wird nicht unterstützt.");
          bytes = Uint8Array.from(atob(attachment.contentBytes), (c) =>
            c.charCodeAt(0),
          );
        }
        validateStoredAttachment(bytes, mime);
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(
          new Blob([bytes as BlobPart], { type: mime }),
        );
        setSource({ url: objectUrl, mime });
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "Vorschau konnte nicht geladen werden.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    file.id,
    file.contentType,
    file.name,
    mailbox,
    messageId,
    demo,
    supported,
  ]);
  return (
    <MailDialog
      title={file.name}
      onClose={onClose}
      className={s.attachmentPreview}
    >
      <div className={s.previewCommands}>
        <span>
          {demo ? "Beispieldatei · Demo" : "Originalanhang · Private Vorschau"}
        </span>
        {source && (
          <>
            <a
              href={source.url}
              download={file.name.replace(/[\/\\\x00-\x1f]/g, "_")}
            >
              <Download size={15} /> Herunterladen
            </a>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} /> Im Browser öffnen
            </a>
          </>
        )}
      </div>
      {loading && supported ? (
        <div className={s.previewPlaceholder} role="status">
          <Loader2 size={24} /> Vorschau wird geladen …
        </div>
      ) : error ? (
        <div className={s.previewPlaceholder} role="alert">
          {error}
          <p>
            Schließe die Vorschau und versuche es erneut. Der Download bleibt
            über die Nachricht verfügbar.
          </p>
        </div>
      ) : !supported ? (
        <div className={s.previewPlaceholder}>
          <FileText size={32} />
          <p>
            Für diesen Dateityp ist keine Vorschau verfügbar. PDF, PNG und JPEG
            werden unterstützt.
          </p>
          <p>
            Du kannst den Anhang über das Download-Symbol in der Nachricht
            herunterladen.
          </p>
        </div>
      ) : source ? (
        <div className={s.previewDocument}>
          {source.mime === "application/pdf" ? (
            <iframe
              title={`PDF-Vorschau ${file.name}`}
              src={source.url}
              referrerPolicy="no-referrer"
            />
          ) : (
            <Image
              src={source.url}
              alt={`Anhang ${file.name}`}
              fill
              unoptimized
              sizes="100vw"
              style={{ objectFit: "contain" }}
            />
          )}
        </div>
      ) : null}
      <p className={s.previewHint}>
        Falls dein Browser die PDF-Datei nicht direkt anzeigt, wähle „Im Browser
        öffnen“ oder „Herunterladen“.
      </p>
    </MailDialog>
  );
}
