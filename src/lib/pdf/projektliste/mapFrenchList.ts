import type { ProjectRow } from './types';
import { DEPARTMENTS } from './frenchDepartments';

/** Rohsatz einer französischen Entwicklerliste (Spalten wie im Original-PDF). */
export interface FrenchListRecord {
  /** N° */
  no: number;
  /** zweistelliger Département-Code aus der Spalte "region" */
  dep: string;
  /** "Plannning Permission" – Datum TT/MM/JJJJ */
  permit_date: string;
  /** "Power asked (MWp)" – bereits in MW */
  mwp: number;
  /** Freitext aus "grid connection (km)" + "Structure" */
  mid: string;
  studies: string | null;
  /** "Commissionning" – Datum TT/MM/JJJJ */
  cod: string;
  /** "Secured land Ha" */
  ha: number;
  /** "prod hours PVSYST" */
  yld: number;
}

const TECH = [
  'Ombrière élevage',
  'Ombrière culture',
  'Ombrière fauche',
  'Ombrière avicole',
  'Claustra culture',
  'Fixe élevage',
  'Fixe site dégradé',
  'Multi',
  'AVD',
];

/** PS-Distanz aus dem Freitext; HTA/BT-Werte werden bewusst ignoriert. */
function parseGrid(mid: string): number | undefined {
  const m = /PS\s*:\s*([\d.]+)/.exec(mid);
  return m ? Number(m[1]) : undefined;
}

function parseTech(mid: string): string | undefined {
  return TECH.find((t) => mid.includes(t));
}

function toDe(d: string): string {
  const [dd, mm, yy] = d.split('/');
  return `${dd}.${mm}.${yy}`;
}

function toDate(d: string): Date {
  const [dd, mm, yy] = d.split('/');
  return new Date(Number(yy), Number(mm) - 1, Number(dd));
}

function toQuarter(d: string): string {
  const [, mm, yy] = d.split('/');
  return `Q${Math.floor((Number(mm) - 1) / 3) + 1} ${yy}`;
}

export interface FrenchMappingReport {
  total: number;
  skipped: number;
  unknownDepartment: string[];
  withGridDistance: number;
  maturePermit: number;
  yieldOutliers: { no: number; value: number }[];
}

/**
 * Mappt eine französische Entwicklerliste auf ProjectRow.
 *
 * Bewusst NICHT abgeleitet:
 * - `permit` (Status) – die Liste führt nur ein Datum, kein Rechtsstand.
 *   Stattdessen `permitDate` + `permitMature` als reiner Reifeindikator.
 * - `name` – die Liste enthält keine Projektnamen; die Nummer bleibt die Kennung.
 * - `lat`/`lon` – keine Koordinaten vorhanden, Kartenmarker entfallen.
 * - `structure` (DealStructure) – die Spalte "Structure" ist der Anlagentyp.
 *
 * Erträge außerhalb von 700–2000 h werden als unplausibel behandelt und als
 * "n. v." ausgewiesen, statt sie zu korrigieren oder zu entfernen.
 */
export function mapFrenchList(
  records: FrenchListRecord[],
  referenceDate = new Date(),
): { rows: ProjectRow[]; report: FrenchMappingReport } {
  const rows: ProjectRow[] = [];
  const unknown = new Set<string>();
  const outliers: { no: number; value: number }[] = [];
  let skipped = 0;

  const matureBefore = new Date(referenceDate);
  matureBefore.setDate(matureBefore.getDate() - 120);

  for (const r of records) {
    const d = DEPARTMENTS[r.dep];
    if (!d) unknown.add(r.dep);
    if (!r.mwp || !r.cod) {
      skipped += 1;
      continue;
    }

    const plausible = r.yld >= 700 && r.yld <= 2000;
    if (!plausible) outliers.push({ no: r.no, value: r.yld });

    rows.push({
      no: r.no,
      region: d?.region ?? `Département ${r.dep}`,
      department: `${r.dep} · ${d?.name ?? 'unbekannt'}`,
      name: `Nr. ${r.no}`,
      capacityMwc: r.mwp,
      gridDistanceKm: parseGrid(r.mid),
      areaHa: r.ha,
      techType: parseTech(r.mid),
      permitDate: toDe(r.permit_date),
      permitMature: toDate(r.permit_date) < matureBefore,
      cod: toQuarter(r.cod),
      specificYield: plausible ? r.yld : undefined,
    });
  }

  return {
    rows,
    report: {
      total: records.length,
      skipped,
      unknownDepartment: [...unknown],
      withGridDistance: rows.filter((r) => r.gridDistanceKm !== undefined).length,
      maturePermit: rows.filter((r) => r.permitMature).length,
      yieldOutliers: outliers,
    },
  };
}
