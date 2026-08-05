import type { ProjectRow, DealStructure } from './types';

export interface EmaProjectRecord {
  externalNumber?: string | number | null;
  region?: string | null;
  projectName?: string | null;
  pvKwp?: number | string | null;
  gridDistanceKm?: number | string | null;
  structure?: string | null;
  techType?: string | null;
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

function toStructure(v: unknown): DealStructure | undefined {
  const t = text(v)?.toLowerCase();
  if (!t) return undefined;
  if (t === 'share deal' || t === 'sharedeal') return 'Share Deal';
  if (t === 'asset deal' || t === 'assetdeal') return 'Asset Deal';
  return undefined;
}

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
      techType: text(r.techType),
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
