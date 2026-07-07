/**
 * EMA Intelligence – Exposé PDF Generator
 * --------------------------------------------------------------------------
 * Erzeugt ein professionelles, Investment-Memorandum-artiges PDF-Exposé für
 * PV-, BESS-, Hybrid- und Wind-Projekte.
 *
 * Abhängigkeit: jsPDF
 *   Falls nicht installiert:
 *     npm install jspdf
 *
 * Hinweis zu Typen:
 * Die Projektdatenstruktur in EMA Intelligence ist an dieser Stelle nicht
 * bekannt (kein DB-Schema verfügbar). Aus diesem Grund wird defensiv mit
 * `any` gearbeitet und jedes Feld einzeln mit Fallback gegen `undefined`/
 * `null` abgesichert. Sobald ein echtes `Project`-Interface existiert,
 * sollte `ExposeProjectInput` dadurch ersetzt werden (siehe TODO unten).
 */

import jsPDF from "jspdf";
import { EMA_BANNER_BASE64, EMA_BANNER_ASPECT_RATIO } from "./emaBannerAsset";
import {
  PROJECT_STATUS_LABELS,
  PRIORITY_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/types/constants";

// ---------------------------------------------------------------------------
// TODO: Sobald ein echtes Projekt-Interface existiert (z.B. aus Prisma/DB-
// Schema generiert), diesen Typ durch das echte Interface ersetzen oder
// erweitern. Bis dahin bewusst defensiv mit `any` gehalten.
// ---------------------------------------------------------------------------
export type ExposeProjectInput = any;

interface NormalizedProjectData {
  projectName: string;
  projectNumber: string;
  projectType: string;
  location: string;
  pvPowerKWp: string | null;
  bessCapacityMWh: string | null;
  status: string;
  priority: string;
  aiScore: string | null;
  netProfit: string | null;
}

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------
const EMA_GREEN: [number, number, number] = [92, 184, 0]; // #5CB800
const EMA_NAVY: [number, number, number] = [27, 44, 78]; // #1B2C4E
const EMA_GREY_TEXT: [number, number, number] = [70, 70, 70];
const EMA_LIGHT_GREY: [number, number, number] = [245, 246, 247];
const EMA_BORDER_GREY: [number, number, number] = [220, 222, 226];

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297; // A4 mm
const MARGIN_X = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

// ---------------------------------------------------------------------------
// Hilfsfunktionen: Datenaufbereitung
// ---------------------------------------------------------------------------

function safeString(value: unknown, fallback = "k. A."): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  return fallback;
}

function formatNumberDe(value: unknown, decimals = 2): string | null {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
      ? Number(value.replace(",", "."))
      : NaN;

  if (!Number.isFinite(num)) return null;

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

function formatCurrencyDe(value: unknown): string | null {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
      ? Number(value.replace(/[^\d,.-]/g, "").replace(",", "."))
      : NaN;

  if (!Number.isFinite(num)) return null;

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function labelFromMap(
  labels: Record<string, string> | undefined,
  value: unknown,
  fallback = "k. A."
): string {
  const key = safeString(value, "");
  if (!key) return fallback;
  return labels?.[key] ?? key;
}

function buildLocationString(project: ExposeProjectInput): string {
  // Versucht verschiedene gängige Feldkombinationen, da die exakte
  // Datenstruktur nicht bekannt ist.
  const direct =
    project?.location ?? project?.standort ?? project?.address ?? null;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  const plz = project?.plz ?? project?.postalCode ?? project?.zip ?? "";
  const city = project?.city ?? project?.ort ?? project?.stadt ?? "";
  const bundesland =
    project?.bundesland ?? project?.state ?? project?.region ?? "";

  const composed = [plz, city].filter(Boolean).join(" ").trim();
  if (composed && bundesland) return `${composed}, ${bundesland}`;
  if (composed) return composed;
  if (bundesland) return String(bundesland);

  return "k. A.";
}

function normalizeProjectData(
  project: ExposeProjectInput
): NormalizedProjectData {
  // Echte Feldnamen aus EMA Intelligence / Supabase werden hier zuerst geprüft.
  // Danach folgen die älteren generischen Fallback-Namen, damit der Generator
  // auch mit anderen Projektobjekten robust bleibt.
  const pvRaw =
    project?.pv_mwp ??
    project?.pvPowerKWp ??
    project?.pvPowerMWp ??
    project?.pvLeistungKWp ??
    project?.pvLeistungMWp ??
    project?.pvPower ??
    project?.leistungKWp ??
    project?.leistungMWp ??
    null;
  const pvFormatted = formatNumberDe(pvRaw, 2);

  const bessRaw =
    project?.bess_mwh ??
    project?.bessCapacityMWh ??
    project?.bessKapazitaetMWh ??
    project?.bessCapacity ??
    project?.speicherkapazitaetMWh ??
    null;
  const bessFormatted = formatNumberDe(bessRaw, 2);

  const aiScoreRaw =
    project?.ai_score ??
    project?.aiScore ??
    project?.score ??
    project?.bewertungScore ??
    null;
  const aiScoreFormatted =
    aiScoreRaw !== null && aiScoreRaw !== undefined
      ? `${formatNumberDe(aiScoreRaw, 0) ?? safeString(aiScoreRaw)} / 100`
      : null;

  const netProfitRaw =
    project?.deal_net_profit ??
    project?.netProfit ??
    project?.nettogewinn ??
    project?.netGewinn ??
    project?.profit ??
    null;
  const netProfitFormatted = formatCurrencyDe(netProfitRaw);

  const projectNumber = safeString(
    project?.project_number ??
      project?.projectNumber ??
      project?.projectId ??
      project?.id ??
      project?.nummer,
    "—"
  );

  const projectName = safeString(
    project?.project_name ??
      project?.projectName ??
      project?.name ??
      project?.title,
    projectNumber !== "—" ? `Projekt ${projectNumber}` : "Unbenanntes Projekt"
  );

  const projectTypeRaw =
    project?.project_type ?? project?.projectType ?? project?.type ?? project?.typ;
  const statusRaw = project?.status;
  const priorityRaw = project?.priority ?? project?.prioritaet;

  return {
    projectName,
    projectNumber,
    projectType: labelFromMap(
      PROJECT_TYPE_LABELS as Record<string, string>,
      projectTypeRaw,
      "k. A."
    ),
    location: buildLocationString(project),
    pvPowerKWp: pvFormatted ? `${pvFormatted} kWp` : null,
    bessCapacityMWh: bessFormatted ? `${bessFormatted} MWh` : null,
    status: labelFromMap(
      PROJECT_STATUS_LABELS as Record<string, string>,
      statusRaw,
      "k. A."
    ),
    priority: labelFromMap(
      PRIORITY_LABELS as Record<string, string>,
      priorityRaw,
      "k. A."
    ),
    aiScore: aiScoreFormatted,
    netProfit: netProfitFormatted,
  };
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen: PDF-Layout
// ---------------------------------------------------------------------------

function addFooter(doc: jsPDF, pageNumber: number, totalPagesPlaceholder = false) {
  const footerY = PAGE_HEIGHT - 12;
  doc.setDrawColor(...EMA_BORDER_GREY);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, footerY - 4, PAGE_WIDTH - MARGIN_X, footerY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...EMA_GREY_TEXT);
  doc.text("EMA Enterprise GmbH · Worms", MARGIN_X, footerY);
  doc.text(
    `Seite ${pageNumber}`,
    PAGE_WIDTH - MARGIN_X,
    footerY,
    { align: "right" }
  );
}

function addSectionHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...EMA_NAVY);
  doc.text(text, MARGIN_X, y);

  doc.setDrawColor(...EMA_GREEN);
  doc.setLineWidth(0.8);
  doc.line(MARGIN_X, y + 2, MARGIN_X + 14, y + 2);

  return y + 10;
}

interface DataRow {
  label: string;
  value: string;
}

/**
 * Zeichnet eine zweispaltige Datentabelle im Memorandum-Stil
 * (Label links grau, Wert rechts navy/fett), mit alternierenden
 * leichten Hintergrundstreifen.
 */
function drawDataTable(doc: jsPDF, rows: DataRow[], startY: number): number {
  const rowHeight = 9;
  let y = startY;

  rows.forEach((row, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(...EMA_LIGHT_GREY);
      doc.rect(MARGIN_X, y - 6, CONTENT_WIDTH, rowHeight, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...EMA_GREY_TEXT);
    doc.text(row.label, MARGIN_X + 3, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...EMA_NAVY);
    doc.text(row.value, PAGE_WIDTH - MARGIN_X - 3, y, { align: "right" });

    y += rowHeight;
  });

  return y;
}

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------

/**
 * Generiert ein PDF-Exposé für ein PV-, BESS-, Hybrid- oder Wind-Projekt
 * und löst den Download im Browser aus.
 *
 * @param project Projektdaten (Struktur nicht strikt typisiert, siehe oben)
 */
export function generateExposePdf(project: ExposeProjectInput): void {
  const data = normalizeProjectData(project);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // -------------------------------------------------------------------
  // Deckblatt
  // -------------------------------------------------------------------
  let cursorY = 0;

  // Kopfgrafik (Hero-Banner), ca. 1/3 der Seite hoch
  const bannerWidth = PAGE_WIDTH;
  const bannerHeight = bannerWidth / EMA_BANNER_ASPECT_RATIO;
  try {
    doc.addImage(
      EMA_BANNER_BASE64,
      "JPEG",
      0,
      0,
      bannerWidth,
      bannerHeight,
      undefined,
      "FAST"
    );
  } catch {
    // Fallback: Falls Bildeinbettung aus irgendeinem Grund fehlschlägt,
    // wird ein einfacher Navy-Balken mit Schriftzug gezeichnet, damit das
    // PDF trotzdem nutzbar bleibt.
    doc.setFillColor(...EMA_NAVY);
    doc.rect(0, 0, bannerWidth, 60, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("EMA ENTERPRISE GmbH", PAGE_WIDTH / 2, 35, { align: "center" });
  }

  cursorY = bannerHeight + 18;

  // Dokumenttitel
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...EMA_NAVY);
  doc.text("Projekt-Exposé", PAGE_WIDTH / 2, cursorY, { align: "center" });

  cursorY += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...EMA_GREY_TEXT);
  doc.text(data.projectType, PAGE_WIDTH / 2, cursorY, { align: "center" });

  cursorY += 14;

  // Grüner Trenner
  doc.setDrawColor(...EMA_GREEN);
  doc.setLineWidth(1);
  doc.line(
    PAGE_WIDTH / 2 - 20,
    cursorY,
    PAGE_WIDTH / 2 + 20,
    cursorY
  );

  cursorY += 16;

  // Projektname groß
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...EMA_NAVY);
  const projectNameLines = doc.splitTextToSize(
    data.projectName,
    CONTENT_WIDTH - 20
  );
  doc.text(projectNameLines, PAGE_WIDTH / 2, cursorY, { align: "center" });
  cursorY += projectNameLines.length * 8 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...EMA_GREY_TEXT);
  doc.text(
    `Projektnummer: ${data.projectNumber}`,
    PAGE_WIDTH / 2,
    cursorY,
    { align: "center" }
  );

  cursorY += 6;
  doc.text(data.location, PAGE_WIDTH / 2, cursorY, { align: "center" });

  // Eckdaten-Box mittig auf dem Deckblatt
  cursorY += 18;
  const boxY = cursorY;
  const boxHeight = 30;
  doc.setFillColor(...EMA_LIGHT_GREY);
  doc.roundedRect(
    MARGIN_X,
    boxY,
    CONTENT_WIDTH,
    boxHeight,
    2,
    2,
    "F"
  );

  const coverFacts: { label: string; value: string | null }[] = [
    { label: "PV-Leistung", value: data.pvPowerKWp },
    { label: "BESS-Kapazität", value: data.bessCapacityMWh },
    { label: "Status", value: data.status },
  ];

  const colWidth = CONTENT_WIDTH / coverFacts.length;
  coverFacts.forEach((fact, i) => {
    const colCenterX = MARGIN_X + colWidth * i + colWidth / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...EMA_GREY_TEXT);
    doc.text(fact.label, colCenterX, boxY + 11, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...EMA_NAVY);
    doc.text(fact.value ?? "k. A.", colCenterX, boxY + 22, {
      align: "center",
    });
  });

  // Vertraulichkeitshinweis am unteren Deckblattrand
  const confY = PAGE_HEIGHT - 40;
  doc.setDrawColor(...EMA_BORDER_GREY);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, confY - 6, PAGE_WIDTH - MARGIN_X, confY - 6);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...EMA_GREY_TEXT);
  const disclaimerLines = doc.splitTextToSize(
    "Dieses Exposé dient ausschließlich der vertraulichen Erstinformation. " +
      "Die Weitergabe an Dritte sowie die Vervielfältigung, auch auszugsweise, " +
      "bedürfen der vorherigen schriftlichen Zustimmung der EMA Enterprise GmbH.",
    CONTENT_WIDTH
  );
  doc.text(disclaimerLines, PAGE_WIDTH / 2, confY, { align: "center" });

  const today = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Erstellt am ${today} · EMA Intelligence`,
    PAGE_WIDTH / 2,
    confY + disclaimerLines.length * 4 + 6,
    { align: "center" }
  );

  addFooter(doc, 1);

  // -------------------------------------------------------------------
  // Seite 2: Projektdaten im Detail
  // -------------------------------------------------------------------
  doc.addPage();

  // Schmaler Navy-Kopfbalken statt Foto, für Wiedererkennung ohne erneutes
  // großformatiges Bild auf jeder Seite (Dateigröße, Druckkosten).
  doc.setFillColor(...EMA_NAVY);
  doc.rect(0, 0, PAGE_WIDTH, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("EMA ENTERPRISE GmbH", MARGIN_X, 10.5);
  doc.setFont("helvetica", "normal");
  doc.text(data.projectName, PAGE_WIDTH - MARGIN_X, 10.5, {
    align: "right",
  });

  let y2 = 32;
  y2 = addSectionHeading(doc, "Projektübersicht", y2);

  y2 = drawDataTable(
    doc,
    [
      { label: "Projektname", value: data.projectName },
      { label: "Projektnummer", value: data.projectNumber },
      { label: "Projekttyp", value: data.projectType },
      { label: "Standort", value: data.location },
      { label: "Status", value: data.status },
      { label: "Priorität", value: data.priority },
    ],
    y2 + 4
  );

  y2 += 12;
  y2 = addSectionHeading(doc, "Technische Eckdaten", y2);

  y2 = drawDataTable(
    doc,
    [
      { label: "PV-Leistung", value: data.pvPowerKWp ?? "k. A." },
      {
        label: "BESS-Kapazität",
        value: data.bessCapacityMWh ?? "k. A.",
      },
    ],
    y2 + 4
  );

  y2 += 12;
  y2 = addSectionHeading(doc, "Bewertung & Wirtschaftlichkeit", y2);

  y2 = drawDataTable(
    doc,
    [
      { label: "AI Score", value: data.aiScore ?? "k. A." },
      { label: "Nettogewinn (geschätzt)", value: data.netProfit ?? "k. A." },
    ],
    y2 + 4
  );

  // Hinweisbox: Quelle / Vorläufigkeit der Zahlen
  y2 += 14;
  const noteBoxHeight = 22;
  doc.setFillColor(...EMA_LIGHT_GREY);
  doc.setDrawColor(...EMA_GREEN);
  doc.setLineWidth(0.6);
  doc.rect(MARGIN_X, y2, CONTENT_WIDTH, noteBoxHeight, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...EMA_NAVY);
  doc.text("Hinweis", MARGIN_X + 4, y2 + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...EMA_GREY_TEXT);
  const noteLines = doc.splitTextToSize(
    "Die dargestellten wirtschaftlichen Kennzahlen basieren auf vorläufigen " +
      "Annahmen und dienen der ersten Einschätzung. Eine verbindliche Bewertung " +
      "erfolgt im Rahmen der Due-Diligence-Prüfung.",
    CONTENT_WIDTH - 8
  );
  doc.text(noteLines, MARGIN_X + 4, y2 + 13);

  addFooter(doc, 2);

  // -------------------------------------------------------------------
  // Speichern / Download auslösen
  // -------------------------------------------------------------------
  const safeFileNamePart = data.projectName
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);

  const fileName = `Expose_${safeFileNamePart || "Projekt"}_${data.projectNumber}.pdf`;

  doc.save(fileName);
}
