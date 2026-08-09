export interface GermanyLocation {
  id: string;
  name: string;
  path: string;
}

export interface GermanyMapData {
  viewBox: string;
  locations: GermanyLocation[];
}

interface Point {
  x: number;
  y: number;
}

const STATE_POINTS: Record<string, Point> = {
  'schleswig-holstein': { x: 49, y: 10 },
  hamburg: { x: 48, y: 19 },
  bremen: { x: 36, y: 27 },
  niedersachsen: { x: 42, y: 31 },
  'mecklenburg-vorpommern': { x: 66, y: 23 },
  brandenburg: { x: 67, y: 41 },
  berlin: { x: 70, y: 40 },
  sachsen: { x: 68, y: 59 },
  'sachsen-anhalt': { x: 56, y: 45 },
  thüringen: { x: 54, y: 57 },
  hessen: { x: 43, y: 58 },
  'nordrhein-westfalen': { x: 28, y: 49 },
  'rheinland-pfalz': { x: 31, y: 66 },
  saarland: { x: 24, y: 73 },
  'baden-württemberg': { x: 38, y: 82 },
  bayern: { x: 59, y: 79 },
};

const CITY_POINTS: Record<string, Point> = {
  worms: { x: 34, y: 69 },
  berlin: { x: 70, y: 40 },
  hamburg: { x: 48, y: 19 },
  münchen: { x: 59, y: 89 },
  stuttgart: { x: 39, y: 79 },
  frankfurt: { x: 41, y: 62 },
  leipzig: { x: 61, y: 53 },
  dresden: { x: 70, y: 57 },
  delitzsch: { x: 61, y: 51 },
  köln: { x: 28, y: 52 },
  hannover: { x: 43, y: 35 },
  polßen: { x: 70, y: 33 },
  polssen: { x: 70, y: 33 },
  gramzow: { x: 70, y: 33 },
  uckermark: { x: 70, y: 33 },
};

function resolvePoint(location: string): Point {
  const key = location.toLocaleLowerCase('de-DE');
  const city = Object.entries(CITY_POINTS).find(([name]) => key.includes(name))?.[1];
  if (city) return city;
  return Object.entries(STATE_POINTS).find(([name]) => key.includes(name))?.[1] ?? { x: 50, y: 50 };
}

export function buildGermanyMap(data: GermanyMapData, location: string): string {
  const [minX, minY, vbW, vbH] = data.viewBox.split(' ').map(Number);
  const point = resolvePoint(location);
  const markerX = minX + (point.x / 100) * vbW;
  const markerY = minY + (point.y / 100) * vbH;
  const radius = Math.max(vbW, vbH) * 0.019;
  const paths = data.locations
    .map((item) => `<path d="${item.path}" fill="#E8EBF1" stroke="#FFFFFF" stroke-width="0.9"/>`)
    .join('');

  return `<svg viewBox="${data.viewBox}" xmlns="http://www.w3.org/2000/svg" aria-label="Projektstandort Deutschland">
    ${paths}
    <circle cx="${markerX.toFixed(2)}" cy="${markerY.toFixed(2)}" r="${(radius * 2.5).toFixed(2)}" fill="#5CB800" opacity=".18"/>
    <circle cx="${markerX.toFixed(2)}" cy="${markerY.toFixed(2)}" r="${(radius * 1.2).toFixed(2)}" fill="#1F2A44"/>
    <circle cx="${markerX.toFixed(2)}" cy="${markerY.toFixed(2)}" r="${radius.toFixed(2)}" fill="#5CB800"/>
    <circle cx="${markerX.toFixed(2)}" cy="${markerY.toFixed(2)}" r="${(radius * .32).toFixed(2)}" fill="#FFFFFF"/>
  </svg>`;
}
