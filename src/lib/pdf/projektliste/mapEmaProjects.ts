import type { ProjectRow, DealStructure } from './types';

/**
 * Rohsatz aus der EMA-Projektliste (Import-Vorschau / Datenbank).
 * Bewusst alles optional – die Quelle liefert nicht jedes Feld zuverlässig.
 */
export interface EmaProjectRecord {
  externalNumber?: string | number | null;
  region?: string | null;
  projectName?: string | null;
  /** Leistung in kWp */
  pvKwp?: number | string | null;
  gridDistanceKm?: number | string | null;
  structure?: string | null;
  /** wird NICHT als Genehmigungsstatus interpretiert */
  permissionDate?: string | null;
  commissioning?: string | null;
  securedLandHa?: number | string | null;
  specificYield?: number | string | null;
}

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

const text = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
};

/**
 * Nur exakte Treffer werden als DealStructure gewertet. Freitext wie
 * "Anteilsverkauf möglich" oder "n. n." bleibt leer – lieber keine Angabe
 * als eine geratene Struktur in einem Investorendokument.
 */
function toStructure(v: unknown): DealStructure | undefined {
  const t = text(v)?.toLowerCase();
  if (!t) return undefined;
  if (t === 'share deal' || t === 'sharedeal') return 'Share Deal';
  if (t === 'asset deal' || t === 'assetdeal') return 'Asset Deal';
  return undefined;
}

/**
 * Formatiert die Inbetriebnahme, ohne Inhalte zu erfinden.
 * "2027-09-01" -> "Q3 2027", "Q2 2028" bleibt, alles andere unverändert.
 */
function toCod(v: unknown): string {
  const t = text(v);
  if (!t) return '–';
  const iso = /^(\d{4})-(\d{2})/.exec(t);
  if (iso) {
    const q = Math.floor((Number(iso[2]) - 1) / 3) + 1;
    return `Q${q} ${iso[1]}`;
  }
  return t;
}

export interface MappingReport {
  total: number;
  skipped: number;
  withCoordinates: number;
  withPermit: number;
  withStructure: number;
  withSpecificYield: number;
}

/**
 * Mappt EMA-Rohsätze auf ProjectRow.
 *
 * Bewusst NICHT abgeleitet:
 * - `permit`  – `permissionDate` sagt nichts über den Rechtsstand aus
 *               (erteilt? purgé? Frist läuft?), bleibt daher leer
 * - `lat`/`lon` – die Liste führt keine Koordinaten; ohne sie entfällt
 *               der Kartenmarker, die Regionseinfärbung bleibt bestehen
 * - `structure` – nur bei exaktem Treffer, sonst leer
 *
 * Sätze ohne Projektname, Region oder Leistung werden verworfen und im
 * Report gezählt – sie wären in der Tabelle wertlos.
 */
export function mapEmaProjects(records: EmaProjectRecord[]): {
  rows: ProjectRow[];
  report: MappingReport;
} {
  const rows: ProjectRow[] = [];
  let skipped = 0;

  for (const r of records) {
    const region = text(r.region);
    const name = text(r.projectName);
    const kwp = num(r.pvKwp);

    if (!region || !name || kwp === undefined) {
      skipped += 1;
      continue;
    }

    rows.push({
      region,
      name,
      capacityMwc: Math.round((kwp / 1000) * 100) / 100,
      gridDistanceKm: num(r.gridDistanceKm),
      areaHa: num(r.securedLandHa),
      structure: toStructure(r.structure),
      permit: undefined,
      cod: toCod(r.commissioning),
      specificYield: num(r.specificYield),
    });
  }

  return {
    rows,
    report: {
      total: records.length,
      skipped,
      withCoordinates: rows.filter((r) => typeof r.lat === 'number').length,
      withPermit: rows.filter((r) => r.permit !== undefined).length,
      withStructure: rows.filter((r) => r.structure !== undefined).length,
      withSpecificYield: rows.filter((r) => r.specificYield !== undefined).length,
    },
  };
}
