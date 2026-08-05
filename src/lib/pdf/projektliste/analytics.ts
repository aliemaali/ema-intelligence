import type { ProjectRow } from './types';

export interface RegionStat {
  region: string;
  count: number;
  capacityMwc: number;
  share: number;
}

export interface SizeClass {
  label: string;
  count: number;
  capacityMwc: number;
  share: number;
}

export interface Analytics {
  count: number;
  totalMwc: number;
  avgMwc: number;
  medianMwc: number;
  largest: ProjectRow;
  smallest: ProjectRow;
  regionCount: number;
  regions: RegionStat[];
  sizeClasses: SizeClass[];
  totalAreaHa: number;
  avgGridDistanceKm: number | null;
  avgSpecificYield: number | null;
  rtbShare: number;
  permitBreakdown: { label: string; count: number; capacityMwc: number }[];
  structureBreakdown: { label: string; count: number; capacityMwc: number }[];
  codBreakdown: { label: string; count: number; capacityMwc: number }[];
}

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

export function computeAnalytics(projects: ProjectRow[]): Analytics {
  if (projects.length === 0) throw new Error('Projektliste enthält keine Projekte.');

  const totalMwc = projects.reduce((s, p) => s + p.capacityMwc, 0);
  const sortedByMwc = [...projects].sort((a, b) => a.capacityMwc - b.capacityMwc);
  const mid = Math.floor(sortedByMwc.length / 2);
  const medianMwc =
    sortedByMwc.length % 2 === 0
      ? (sortedByMwc[mid - 1].capacityMwc + sortedByMwc[mid].capacityMwc) / 2
      : sortedByMwc[mid].capacityMwc;

  const byRegion = new Map<string, { count: number; capacityMwc: number }>();
  for (const p of projects) {
    const e = byRegion.get(p.region) ?? { count: 0, capacityMwc: 0 };
    e.count += 1;
    e.capacityMwc += p.capacityMwc;
    byRegion.set(p.region, e);
  }
  const regions: RegionStat[] = [...byRegion.entries()]
    .map(([region, e]) => ({
      region,
      count: e.count,
      capacityMwc: round(e.capacityMwc),
      share: e.capacityMwc / totalMwc,
    }))
    .sort((a, b) => b.capacityMwc - a.capacityMwc);

  const classDefs: { label: string; test: (mw: number) => boolean }[] = [
    { label: 'unter 20 MWc', test: (mw) => mw < 20 },
    { label: '20 – 35 MWc', test: (mw) => mw >= 20 && mw < 35 },
    { label: '35 – 50 MWc', test: (mw) => mw >= 35 && mw < 50 },
    { label: 'ab 50 MWc', test: (mw) => mw >= 50 },
  ];
  const sizeClasses: SizeClass[] = classDefs.map((c) => {
    const rows = projects.filter((p) => c.test(p.capacityMwc));
    const cap = rows.reduce((s, p) => s + p.capacityMwc, 0);
    return { label: c.label, count: rows.length, capacityMwc: round(cap), share: cap / totalMwc };
  });

  // Gruppierungen ignorieren Projekte ohne belegten Wert – nichts wird geraten
  const group = (key: (p: ProjectRow) => string | undefined, order?: string[]) => {
    const m = new Map<string, { count: number; capacityMwc: number }>();
    for (const p of projects) {
      const k = key(p);
      if (k === undefined || k === '') continue;
      const e = m.get(k) ?? { count: 0, capacityMwc: 0 };
      e.count += 1;
      e.capacityMwc += p.capacityMwc;
      m.set(k, e);
    }
    const out = [...m.entries()].map(([label, e]) => ({
      label,
      count: e.count,
      capacityMwc: round(e.capacityMwc),
    }));
    return order
      ? out.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
      : out.sort((a, b) => b.capacityMwc - a.capacityMwc);
  };

  const withYield = projects.filter((p) => typeof p.specificYield === 'number');
  const withGrid = projects.filter((p) => typeof p.gridDistanceKm === 'number');
  const rtbMwc = projects
    .filter((p) => p.permit === 'PC erteilt · purgé')
    .reduce((s, p) => s + p.capacityMwc, 0);

  return {
    count: projects.length,
    totalMwc: round(totalMwc),
    avgMwc: round(totalMwc / projects.length),
    medianMwc: round(medianMwc),
    largest: sortedByMwc[sortedByMwc.length - 1],
    smallest: sortedByMwc[0],
    regionCount: byRegion.size,
    regions,
    sizeClasses,
    totalAreaHa: round(projects.reduce((s, p) => s + (p.areaHa ?? 0), 0)),
    avgGridDistanceKm: withGrid.length
      ? round(
          withGrid.reduce((s, p) => s + (p.gridDistanceKm as number), 0) / withGrid.length,
        )
      : null,
    avgSpecificYield: withYield.length
      ? Math.round(
          withYield.reduce((s, p) => s + (p.specificYield as number), 0) / withYield.length,
        )
      : null,
    rtbShare: rtbMwc / totalMwc,
    permitBreakdown: group((p) => p.permit, [
      'PC erteilt · purgé',
      'PC erteilt',
      'PC eingereicht',
      'PC in Vorbereitung',
    ]),
    structureBreakdown: group((p) => p.structure),
    codBreakdown: group((p) => p.cod.split(' ').pop()).sort(
      (a, b) => Number(a.label) - Number(b.label),
    ),
  };
}
