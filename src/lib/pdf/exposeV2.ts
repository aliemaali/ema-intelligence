import jsPDF from "jspdf";
import { EMA_BANNER_BASE64, EMA_BANNER_ASPECT_RATIO } from "./emaBannerAsset";

export type ExposeProjectInput = any;

type RGB = [number, number, number];

const GREEN: RGB = [92, 184, 0];
const NAVY: RGB = [7, 20, 47];
const TEXT: RGB = [88, 99, 118];
const LINE: RGB = [224, 230, 238];
const SOFT: RGB = [247, 249, 252];
const W = 210;
const H = 297;
const M = 18;
const CW = W - M * 2;

function clean(value: unknown, fallback = "–") {
  if (value === null || value === undefined) return fallback;
  const out = String(value).trim();
  return out || fallback;
}

function num(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const out = Number(value.replace(/[^0-9,.-]/g, "").replace(".", "").replace(",", "."));
  return Number.isFinite(out) ? out : null;
}

function eur(value: unknown) {
  const n = num(value);
  if (n === null) return null;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function fmt(doc: jsPDF, color: RGB, style: "normal" | "bold" = "normal", size = 10) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function logo(doc: jsPDF, x: number, y: number) {
  fmt(doc, NAVY, "bold", 26);
  doc.text("EMA", x, y);
  fmt(doc, GREEN, "bold", 8);
  doc.text("ENTERPRISE", x + 1, y + 8);
}

function card(doc: jsPDF, x: number, y: number, w: number, h: number, fill: RGB = [255, 255, 255]) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...LINE);
  doc.roundedRect(x, y, w, h, 5, 5, "FD");
}

function highlight(doc: jsPDF, label: string, value: string, x: number, y: number, w: number) {
  card(doc, x, y, w, 38);
  doc.setFillColor(237, 248, 226);
  doc.circle(x + 10, y + 10, 4, "F");
  fmt(doc, TEXT, "bold", 7.5);
  doc.text(label.toUpperCase(), x + 8, y + 22);
  fmt(doc, NAVY, "bold", 14);
  doc.text(doc.splitTextToSize(value, w - 14), x + 8, y + 31);
}

function row(doc: jsPDF, label: string, value: string, x: number, y: number, w: number, shaded: boolean) {
  if (shaded) {
    doc.setFillColor(...SOFT);
    doc.roundedRect(x, y - 6, w, 10, 2, 2, "F");
  }
  fmt(doc, TEXT, "normal", 9);
  doc.text(label, x + 4, y);
  fmt(doc, NAVY, "bold", 9);
  doc.text(value, x + w - 4, y, { align: "right" });
}

export function generateExposePdf(project: ExposeProjectInput): void {
  const name = clean(project?.project_name ?? project?.projectName ?? project?.name, "Unbenanntes Projekt");
  const number = clean(project?.project_number ?? project?.projectNumber ?? project?.id);
  const location = clean(project?.location_city ?? project?.location ?? project?.standort, "Deutschland");
  const pv = project?.pv_mwp ? `${Number(project.pv_mwp) * 1000} kWp` : clean(project?.pv_kwp, "");
  const price = eur(project?.deal_purchase_price ?? project?.purchase_price);
  const tariff = clean(project?.tariff ?? project?.verguetung ?? project?.vergütung, "");
  const specificYield = clean(project?.specific_yield ?? project?.spezifischer_ertrag, "");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const today = new Intl.DateTimeFormat("de-DE").format(new Date());

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 108, "F");
  try {
    doc.addImage(EMA_BANNER_BASE64, "JPEG", 0, 0, W, W / EMA_BANNER_ASPECT_RATIO, undefined, "FAST");
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 108, "F");
  } catch {}

  logo(doc, M, 24);
  fmt(doc, [255, 255, 255], "bold", 28);
  doc.text(doc.splitTextToSize(name, CW), M, 62);
  fmt(doc, [230, 236, 244], "normal", 11);
  doc.text(location, M, 88);
  doc.text(`Projekt-Nr. ${number} · ${today}`, M, 98);

  card(doc, M, 126, CW, 84);
  fmt(doc, NAVY, "bold", 16);
  doc.text("Investment Highlights", M + 8, 144);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(1.1);
  doc.line(M + 8, 148, M + 28, 148);

  const values = [
    ["Leistung", pv || "–"],
    ["EK-Kaufpreis", price || "–"],
    ["Vergütung", tariff || "–"],
    ["Ertrag", specificYield || "–"],
  ];
  const hw = (CW - 28) / 4;
  values.forEach(([label, value], i) => highlight(doc, label, value, M + 8 + i * (hw + 4), 158, hw));

  card(doc, M, 226, CW, 36, SOFT);
  fmt(doc, NAVY, "bold", 10);
  doc.text("Hinweis", M + 8, 239);
  fmt(doc, TEXT, "normal", 8.5);
  doc.text(doc.splitTextToSize("Dieses Investment Memorandum zeigt nur vorhandene oder berechenbare Angaben. Fehlende Werte werden bewusst nicht als leere Felder dargestellt.", CW - 16), M + 8, 250);

  doc.addPage();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 22, "F");
  fmt(doc, [255, 255, 255], "bold", 10);
  doc.text("TECHNISCHE DATEN", M, 14);
  doc.text(name, W - M, 14, { align: "right" });

  fmt(doc, NAVY, "bold", 16);
  doc.text("Technische Daten", M, 48);
  doc.setDrawColor(...GREEN);
  doc.line(M, 52, M + 22, 52);
  card(doc, M, 66, CW, 96);

  let y = 86;
  const rows = [
    ["Einspeiseart", clean(project?.feed_in_type ?? project?.einspeiseart, "")],
    ["Vergütung", tariff],
    ["Spezifischer Ertrag", specificYield],
    ["PV-Leistung", pv],
    ["Standort", location],
  ].filter((item) => item[1]);
  rows.forEach(([label, value], i) => {
    row(doc, label, value, M + 10, y, CW - 20, i % 2 === 0);
    y += 12;
  });

  card(doc, M, 188, CW, 70, SOFT);
  fmt(doc, NAVY, "bold", 16);
  doc.text("Wirtschaftlichkeit", M + 10, 208);
  row(doc, "EK-Kaufpreis", price || "–", M + 10, 228, CW - 20, true);
  row(doc, "Amortisation", "wird berechnet, sobald alle Werte vorhanden sind", M + 10, 242, CW - 20, false);

  const file = name.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 60);
  doc.save(`Investment_Memorandum_${file || "Projekt"}_${number}.pdf`);
}
