import type { ProjectRow } from './types';
import type { RegionStat } from './analytics';

/** minimales GeoJSON-Interface – wir brauchen nur Geometrie und den Regionsnamen */
export interface RegionFeature {
  properties: { nom: string };
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}
export interface RegionCollection {
  features: RegionFeature[];
}

const D = Math.PI / 180;

/** Lambert-93-nahe konforme Kegelprojektion (Standardparallelen 44°/49°, Bezugsmeridian 3°) */
function lambert(lon: number, lat: number) {
  const p1 = 44 * D;
  const p2 = 49 * D;
  const l0 = 3 * D;
  const p0 = 46.5 * D;
  const t = (p: number) => Math.tan(Math.PI / 4 + p / 2);
  const n = Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(t(p2) / t(p1));
  const F = (Math.cos(p1) * Math.pow(t(p1), n)) / n;
  const rho = F / Math.pow(t(lat * D), n);
  const rho0 = F / Math.pow(t(p0), n);
  const theta = n * (lon * D - l0);
  // y invertiert: Bildschirmkoordinaten wachsen nach unten, Norden soll oben liegen
  return { x: rho * Math.sin(theta), y: rho * Math.cos(theta) - rho0 };
}

interface Fit {
  scale: number;
  dx: number;
  dy: number;
}

function project(lon: number, lat: number, fit: Fit) {
  const p = lambert(lon, lat);
  return { x: p.x * fit.scale + fit.dx, y: p.y * fit.scale + fit.dy };
}

function ringsOf(f: RegionFeature): number[][][] {
  return f.geometry.type === 'Polygon'
    ? f.geometry.coordinates
    : f.geometry.coordinates.flat();
}

function computeFit(
  collection: RegionCollection,
  width: number,
  height: number,
  pad: number,
): Fit {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of collection.features) {
    for (const ring of ringsOf(f)) {
      for (const [lon, lat] of ring) {
        const p = lambert(lon, lat);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }
  const scale = Math.min((width - 2 * pad) / (maxX - minX), (height - 2 * pad) / (maxY - minY));
  return {
    scale,
    dx: pad - minX * scale + (width - 2 * pad - (maxX - minX) * scale) / 2,
    dy: pad - minY * scale + (height - 2 * pad - (maxY - minY) * scale) / 2,
  };
}

function pathFor(f: RegionFeature, fit: Fit, tol: number): string {
  const parts: string[] = [];
  for (const ring of ringsOf(f)) {
    if (ring.length < 4) continue;
    let d = '';
    let last: { x: number; y: number } | null = null;
    for (let i = 0; i < ring.length; i++) {
      const p = project(ring[i][0], ring[i][1], fit);
      const isLast = i === ring.length - 1;
      if (last && !isLast && Math.abs(p.x - last.x) < tol && Math.abs(p.y - last.y) < tol) continue;
      d += `${d ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      last = p;
    }
    if (d) parts.push(`${d}Z`);
  }
  return parts.join('');
}

export interface MapOptions {
  width: number;
  height: number;
  /** Füllstufen von schwach nach stark (Regionen ohne Projekte erhalten idle) */
  idleFill?: string;
  strokeColor?: string;
  markerColor?: string;
  labelRegions?: boolean;
}

/**
 * Erzeugt eine Frankreichkarte: Regionen mit Projektbestand werden nach Anteil an der
 * Gesamtleistung eingefärbt, jedes Projekt erhält einen Marker an seiner realen Position.
 */
export function buildFranceMap(
  collection: RegionCollection,
  projects: ProjectRow[],
  regions: RegionStat[],
  opts: MapOptions,
): string {
  const {
    width,
    height,
    idleFill = '#E8EBF1',
    strokeColor = '#FFFFFF',
    markerColor = '#5CB800',
  } = opts;

  const fit = computeFit(collection, width, height, 4);
  const maxShare = Math.max(...regions.map((r) => r.share), 0.0001);
  const shareByRegion = new Map(regions.map((r) => [r.region, r.share]));

  const body = collection.features
    .map((f) => {
      const share = shareByRegion.get(f.properties.nom);
      const d = pathFor(f, fit, 0.35);
      if (share === undefined) {
        return `<path d="${d}" fill="${idleFill}" stroke="${strokeColor}" stroke-width="0.8"/>`;
      }
      const t = 0.28 + 0.72 * (share / maxShare);
      return `<path d="${d}" fill="#1F2A44" fill-opacity="${t.toFixed(3)}" stroke="${strokeColor}" stroke-width="0.8"/>`;
    })
    .join('');

  // Marker nur für Projekte mit echten Koordinaten – nichts wird geschätzt
  const located = projects.filter(
    (p): p is ProjectRow & { lat: number; lon: number } =>
      typeof p.lat === 'number' && typeof p.lon === 'number',
  );
  const maxMw = located.length ? Math.max(...located.map((p) => p.capacityMwc)) : 1;
  const markers = located
    .map((p) => {
      const { x, y } = project(p.lon, p.lat, fit);
      const r = 2.1 + 2.6 * Math.sqrt(p.capacityMwc / maxMw);
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r + 1.5).toFixed(2)}" fill="#FFFFFF" fill-opacity="0.85"/><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${markerColor}" stroke="#FFFFFF" stroke-width="0.9"/>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Projektstandorte in Frankreich">${body}${markers}</svg>`;
}
