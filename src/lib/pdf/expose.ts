import jsPDF from "jspdf";
import { EMA_BANNER_BASE64, EMA_BANNER_ASPECT_RATIO } from "./emaBannerAsset";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/types/constants";

export type ExposeProjectInput = any;

type RGB = [number, number, number];

type Row = {
  label: string;
  value: string;
};

type KPI = {
  label: string;
  value: string;
  sub?: string;
};

type NormalizedProjectData = {
  projectName: string;
  projectNumber: string;
  projectType: string;
  location: string;
  status: string | null;
  pvKWp: number | null;
  pvPowerLabel: string | null;
  bessMWh: number | null;
  bessLabel: string | null;
  purchasePrice: number | null;
  purchasePriceLabel: string | null;
  feedInType: string | null;
  tariff: number | null;
  tariffLabel: string | null;
  specificYield: number | null;
  specificYieldLabel: string | null;
  annualYieldKWh: number | null;
  annualRevenue: number | null;
  amortizationYears: number | null;
};

const GREEN: RGB = [92, 184, 0];
const DARK_GREEN: RGB = [45, 130, 0];
const NAVY: RGB = [7, 20, 47];
const TEXT: RGB = [91, 103, 125];
const LIGHT: RGB = [247, 249, 252];
const BORDER: RGB = [221, 226, 235];
const RED: RGB = [218, 64, 32];
const SOFT_GREEN: RGB = [238, 248, 229];
const SOFT_RED: RGB = [255, 238, 235];

const PAGE_W = 210;
const PAGE_H = 297;
const MX = 14;
const CW = PAGE_W - MX * 2;

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(/EUR/gi, "")
    .replace(/kWh\/kWp/gi, "")
    .replace(/kWh/gi, "")
    .replace(/kWp/gi, "")
    .replace(/MWp/gi, "")
    .replace(/MWh/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function de(value: number, decimals = 2): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function euro(value: number, decimals = 0): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function label(map: Record<string, string>, value: unknown): string | null {
  const key = str(value);
  if (!key) return null;
  return map[key] ?? key;
}

function extractFromNotes(project: ExposeProjectInput, key: string): string | null {
  const notes = str(project?.notes ?? project?.notizen ?? project?.description ?? "");
  if (!notes) return null;
  const pattern = new RegExp(`${key}\\s*:?\\s*([^\\n]+)`, "i");
  return str(notes.match(pattern)?.[1]);
}

function getLocation(project: ExposeProjectInput): string {
  return (
    str(project?.location) ??
    str(project?.standort) ??
    [project?.location_zip, project?.location_city, project?.location_state]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    [project?.zip, project?.city, project?.state].filter(Boolean).join(" ").trim() ||
    "Deutschland"
  );
}

function normalize(project: ExposeProjectInput): NormalizedProjectData {
  const projectNumber = str(project?.project_number ?? project?.projectNumber ?? project?.id) ?? "—";
  const projectName = str(project?.project_name ?? project?.projectName ?? project?.name ?? project?.title) ?? `Projekt ${projectNumber}`;
  const projectType = label(PROJECT_TYPE_LABELS as Record<string, string>, project?.project_type ?? project?.type) ?? "Projekt";
  const status = label(PROJECT_STATUS_LABELS as Record<string, string>, project?.status);

  const pvRaw = project?.pv_mwp ?? project?.pv_kwp ?? project?.pvPowerKWp ?? project?.leistung_kwp ?? null;
  let pvKWp = num(pvRaw);
  if (pvKWp !== null && (project?.pv_mwp !== undefined || /mwp/i.test(String(pvRaw)))) pvKWp = pvKWp * 1000;

  const bessMWh = num(project?.bess_mwh ?? project?.bessCapacityMWh ?? null);
  const purchasePrice = num(project?.deal_purchase_price ?? project?.purchase_price ?? project?.ek_kaufpreis ?? extractFromNotes(project, "EK-Kaufpreis"));

  const feedInType =
    str(project?.feed_in_type ?? project?.einspeiseart ?? extractFromNotes(project, "Einspeiseart")) ?? null;

  let tariff = num(project?.tariff ?? project?.verguetung ?? project?.vergütung ?? extractFromNotes(project, "Vergütung"));
  if (tariff !== null && tariff > 1) tariff = tariff / 100;

  const specificYield = num(project?.specific_yield ?? project?.spezifischer_ertrag ?? extractFromNotes(project, "Spezifischer Ertrag"));
  const annualYieldKWh = pvKWp !== null && specificYield !== null ? pvKWp * specificYield : null;
  const annualRevenue = annualYieldKWh !== null && tariff !== null ? annualYieldKWh * tariff : null;
  const amortizationYears = purchasePrice !== null && annualRevenue !== null && annualRevenue > 0 ? purchasePrice / annualRevenue : null;

  return {
    projectName,
    projectNumber,
    projectType,
    location: getLocation(project),
    status,
    pvKWp,
    pvPowerLabel: pvKWp !== null ? `${de(pvKWp, 2)} kWp` : null,
    bessMWh,
    bessLabel: bessMWh !== null ? `${de(bessMWh, 2)} MWh` : null,
    purchasePrice,
    purchasePriceLabel: purchasePrice !== null ? euro(purchasePrice, 0) : null,
    feedInType,
    tariff,
    tariffLabel: tariff !== null ? `${de(tariff, 4)} €/kWh` : null,
    specificYield,
    specificYieldLabel: specificYield !== null ? `${de(specificYield, 2)} kWh/kWp` : null,
    annualYieldKWh,
    annualRevenue,
    amortizationYears,
  };
}

function set(doc: jsPDF, color: RGB, font: "normal" | "bold" = "normal", size = 10) {
  doc.setTextColor(...color);
  doc.setFont("helvetica", font);
  doc.setFontSize(size);
}

function logo(doc: jsPDF, x: number, y: number, scale = 1) {
  set(doc, NAVY, "bold", 21 * scale);
  doc.text("EMA", x, y);
  set(doc, GREEN, "bold", 7 * scale);
  doc.text("ENTERPRISE", x + 1, y + 7 * scale);
}

function roundedCard(doc: jsPDF, x: number, y: number, w: number, h: number, fill: RGB = [255, 255, 255]) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");
}

function kpiCard(doc: jsPDF, kpi: KPI, x: number, y: number, w: number, h: number) {
  roundedCard(doc, x, y, w, h);
  doc.setFillColor(...SOFT_GREEN);
  doc.circle(x + 8, y + 8, 4, "F");
  set(doc, TEXT, "normal", 7.5);
  doc.text(kpi.label, x + 5, y + 18);
  set(doc, kpi.value.includes("–") ? TEXT : NAVY, "bold", 11);
  const lines = doc.splitTextToSize(kpi.value, w - 10);
  doc.text(lines, x + 5, y + 25);
  if (kpi.sub) {
    set(doc, TEXT, "normal", 7);
    doc.text(kpi.sub, x + 5, y + h - 5);
  }
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.7);
  doc.line(x + 5, y + h - 10, x + 18, y + h - 10);
}

function sectionTitle(doc: jsPDF, title: string, x: number, y: number) {
  set(doc, NAVY, "bold", 12);
  doc.text(title.toUpperCase(), x, y);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.line(x, y + 2, x + 14, y + 2);
}

function table(doc: jsPDF, rows: Row[], x: number, y: number, w: number): number {
  let cy = y;
  rows.forEach((row, i) => {
    const h = 8;
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT);
      doc.roundedRect(x, cy - 5.5, w, h, 1, 1, "F");
    }
    set(doc, TEXT, "normal", 8);
    doc.text(row.label, x + 3, cy);
    set(doc, NAVY, "bold", 8);
    doc.text(row.value, x + w - 3, cy, { align: "right" });
    cy += h;
  });
  return cy;
}

function onlyExisting(rows: Array<{ label: string; value: string | null | undefined }>): Row[] {
  return rows.filter((r) => r.value && r.value !== "k. A.").map((r) => ({ label: r.label, value: String(r.value) }));
}

function drawAmortizationChart(doc: jsPDF, data: NormalizedProjectData, x: number, y: number, w: number, h: number) {
  const purchase = data.purchasePrice;
  const annual = data.annualRevenue;
  if (!purchase || !annual || annual <= 0) return;

  const years = 20;
  const values = Array.from({ length: years + 1 }, (_, year) => -purchase + annual * year);
  const min = Math.min(...values, -purchase);
  const max = Math.max(...values, annual * years - purchase);
  const pad = 10;
  const chartX = x + 8;
  const chartY = y + 12;
  const chartW = w - 16;
  const chartH = h - 26;
  const zeroY = chartY + (max / (max - min)) * chartH;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  for (let i = 0; i <= 4; i++) {
    const gy = chartY + (chartH / 4) * i;
    doc.line(chartX, gy, chartX + chartW, gy);
  }
  doc.setDrawColor(120, 130, 145);
  doc.line(chartX, zeroY, chartX + chartW, zeroY);

  const point = (year: number, value: number) => ({
    px: chartX + (year / years) * chartW,
    py: chartY + ((max - value) / (max - min)) * chartH,
  });

  values.forEach((value, year) => {
    if (year === 0) return;
    const a = point(year - 1, values[year - 1]);
    const b = point(year, value);
    doc.setDrawColor(value < 0 ? RED[0] : GREEN[0], value < 0 ? RED[1] : GREEN[1], value < 0 ? RED[2] : GREEN[2]);
    doc.setLineWidth(0.8);
    doc.line(a.px, a.py, b.px, b.py);
  });

  const breakEven = Math.min(years, purchase / annual);
  const be = point(breakEven, 0);
  doc.setDrawColor(...GREEN);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(be.px, chartY, be.px, chartY + chartH);
  doc.setLineDashPattern([], 0);

  doc.setFillColor(...SOFT_GREEN);
  doc.setDrawColor(...GREEN);
  doc.roundedRect(be.px + 6, zeroY + 12, 34, 16, 3, 3, "FD");
  set(doc, DARK_GREEN, "bold", 8);
  doc.text("Amortisation", be.px + 9, zeroY + 18);
  doc.text(`${de(data.amortizationYears ?? breakEven, 1)} Jahre`, be.px + 9, zeroY + 24);

  set(doc, TEXT, "normal", 7);
  doc.text("0", chartX, chartY + chartH + 7);
  doc.text("10", chartX + chartW / 2, chartY + chartH + 7, { align: "center" });
  doc.text("20 Jahre", chartX + chartW, chartY + chartH + 7, { align: "right" });
  doc.text(euro(max, 0), chartX, chartY - 3);
  doc.text(euro(min, 0), chartX, chartY + chartH + 14);
}

function footer(doc: jsPDF, data: NormalizedProjectData) {
  const y = PAGE_H - 10;
  doc.setDrawColor(...BORDER);
  doc.line(MX, y - 6, PAGE_W - MX, y - 6);
  set(doc, DARK_GREEN, "bold", 7);
  doc.text("EMA Enterprise GmbH", MX, y);
  set(doc, TEXT, "normal", 7);
  doc.text("Connecting Capital with Energy Infrastructure.", MX + 28, y);
  doc.text(`Projekt-Nr.: ${data.projectNumber}`, PAGE_W - MX, y, { align: "right" });
}

export function generateExposePdf(project: ExposeProjectInput): void {
  const data = normalize(project);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const today = new Intl.DateTimeFormat("de-DE").format(new Date());

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  logo(doc, MX, 18, 1.25);
  set(doc, NAVY, "bold", 22);
  doc.text(data.projectName, 54, 18);
  set(doc, TEXT, "normal", 10);
  doc.text(data.projectType, 54, 28);
  doc.text(data.location, 54, 36);

  roundedCard(doc, PAGE_W - MX - 48, 12, 48, 25, LIGHT);
  set(doc, TEXT, "normal", 7);
  doc.text("Projekt-Nr.", PAGE_W - MX - 44, 18);
  set(doc, DARK_GREEN, "bold", 10);
  doc.text(data.projectNumber, PAGE_W - MX - 44, 25);
  set(doc, TEXT, "normal", 7);
  doc.text(`Datum ${today}`, PAGE_W - MX - 44, 33);

  try {
    const heroW = CW;
    const heroH = heroW / EMA_BANNER_ASPECT_RATIO;
    doc.addImage(EMA_BANNER_BASE64, "JPEG", MX, 46, heroW, heroH, undefined, "FAST");
  } catch {
    doc.setFillColor(...LIGHT);
    doc.roundedRect(MX, 46, CW, 72, 3, 3, "F");
  }

  const kpis: KPI[] = onlyExisting([
    { label: "Anlagenleistung", value: data.pvPowerLabel, sub: "DC" },
    { label: "EK-Kaufpreis", value: data.purchasePriceLabel },
    { label: "Vergütung", value: data.tariffLabel },
    { label: "Spezifischer Ertrag", value: data.specificYieldLabel },
    { label: "Amortisation", value: data.amortizationYears ? `${de(data.amortizationYears, 1)} Jahre` : null },
    { label: "Jährlicher Ertrag", value: data.annualYieldKWh ? `${de(data.annualYieldKWh, 0)} kWh` : null },
  ]).map((r) => ({ label: r.label, value: r.value }));

  const kpiY = 125;
  const kpiGap = 3;
  const kpiW = (CW - kpiGap * (kpis.length - 1)) / Math.max(kpis.length, 1);
  kpis.slice(0, 6).forEach((kpi, i) => kpiCard(doc, kpi, MX + i * (kpiW + kpiGap), kpiY, kpiW, 32));

  const chartY = 166;
  roundedCard(doc, MX, chartY, CW, 70);
  sectionTitle(doc, "Amortisation", MX + 5, chartY + 12);
  set(doc, TEXT, "normal", 8);
  const amortText = data.amortizationYears
    ? `Der Break-even wird nach ca. ${de(data.amortizationYears, 1)} Jahren erreicht. Die Grafik zeigt den kumulierten Cashflow.`
    : "Amortisation wird angezeigt, sobald EK-Kaufpreis, Vergütung, spezifischer Ertrag und Leistung vorhanden sind.";
  doc.text(doc.splitTextToSize(amortText, 50), MX + 5, chartY + 22);
  if (data.amortizationYears) {
    doc.setFillColor(...SOFT_GREEN);
    doc.roundedRect(MX + 5, chartY + 44, 48, 18, 3, 3, "F");
    set(doc, DARK_GREEN, "bold", 12);
    doc.text(`${de(data.amortizationYears, 1)} Jahre`, MX + 9, chartY + 55);
  }
  drawAmortizationChart(doc, data, MX + 58, chartY + 4, CW - 63, 62);

  const lowerY = 244;
  const colW = (CW - 6) / 3;
  roundedCard(doc, MX, lowerY, colW, 38);
  sectionTitle(doc, "Technische Daten", MX + 4, lowerY + 10);
  const techRows = onlyExisting([
    { label: "Einspeiseart", value: data.feedInType },
    { label: "Vergütung", value: data.tariffLabel },
    { label: "Spezifischer Ertrag", value: data.specificYieldLabel },
  ]);
  if (techRows.length) table(doc, techRows, MX + 4, lowerY + 19, colW - 8);
  else {
    set(doc, TEXT, "normal", 8);
    doc.text("Keine technischen Daten erkannt.", MX + 4, lowerY + 20);
  }

  roundedCard(doc, MX + colW + 3, lowerY, colW, 38);
  sectionTitle(doc, "Wirtschaftlich", MX + colW + 7, lowerY + 10);
  table(doc, onlyExisting([
    { label: "EK-Kaufpreis", value: data.purchasePriceLabel },
    { label: "Jährliche Vergütung", value: data.annualRevenue ? euro(data.annualRevenue, 0) : null },
    { label: "Amortisation", value: data.amortizationYears ? `${de(data.amortizationYears, 1)} Jahre` : null },
  ]), MX + colW + 7, lowerY + 19, colW - 8);

  roundedCard(doc, MX + (colW + 3) * 2, lowerY, colW, 38);
  sectionTitle(doc, "Hinweis", MX + (colW + 3) * 2 + 4, lowerY + 10);
  set(doc, TEXT, "normal", 7.5);
  doc.text(doc.splitTextToSize("Es werden nur vorhandene oder berechenbare Angaben angezeigt. Alle Werte ohne Gewähr.", colW - 8), MX + (colW + 3) * 2 + 4, lowerY + 20);

  footer(doc, data);

  const filePart = data.projectName.replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "_").slice(0, 60);
  doc.save(`Expose_${filePart || "Projekt"}_${data.projectNumber}.pdf`);
}
