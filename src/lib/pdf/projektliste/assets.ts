export const NAVY = '#1F2A44';
export const GREEN = '#5CB800';

const R = 18;
const SW = 7.6;
const P = (cx: number, cy: number, deg: number) => {
  const t = (deg * Math.PI) / 180;
  return `${(cx + R * Math.cos(t)).toFixed(2)} ${(cy + R * Math.sin(t)).toFixed(2)}`;
};
const glyph = (cx: number, cy: number, color: string) =>
  `<path d="M ${P(cx, cy, 0)} A ${R} ${R} 0 0 0 ${P(cx, cy, 180)} A ${R} ${R} 0 0 0 ${P(cx, cy, 34)}" fill="none" stroke="${color}" stroke-width="${SW}" stroke-linecap="round"/>` +
  `<path d="M ${P(cx, cy, 180)} L ${P(cx, cy, 0)}" fill="none" stroke="${color}" stroke-width="${SW}" stroke-linecap="round"/>`;

/**
 * EMA-Bildmarke (doppeltes "e": navy + grün) mit optionaler Wortmarke.
 * Geometrische Rekonstruktion – wird durch das Original-Asset ersetzt,
 * sobald `logoDataUri` gesetzt ist.
 */
export function emaLogoSvg(opts: { onDark?: boolean; withWordmark?: boolean } = {}): string {
  const { onDark = false, withWordmark = true } = opts;
  const navy = onDark ? '#FFFFFF' : NAVY;
  const word = onDark ? '#FFFFFF' : NAVY;
  const sub = onDark ? 'rgba(255,255,255,.74)' : 'rgba(31,42,68,.60)';
  const mark = `${glyph(44, 30, navy)}${glyph(84, 30, GREEN)}`;

  if (!withWordmark) {
    return `<svg viewBox="18 4 92 52" xmlns="http://www.w3.org/2000/svg" aria-label="EMA Enterprise">${mark}</svg>`;
  }
  return `<svg viewBox="0 0 128 106" xmlns="http://www.w3.org/2000/svg" aria-label="EMA Enterprise GmbH">
    ${mark}
    <text x="64" y="82" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-size="21" font-weight="700" letter-spacing="3.4" fill="${word}">EMA</text>
    <text x="64" y="97" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-size="8.2" font-weight="500" letter-spacing="1.55" fill="${sub}">ENTERPRISE GmbH</text>
  </svg>`;
}

export function franceFlagSvg(): string {
  return `<svg viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-label="Frankreich">
    <defs><clipPath id="fr-clip"><rect x="0" y="0" width="36" height="24" rx="3"/></clipPath></defs>
    <g clip-path="url(#fr-clip)">
      <rect width="12" height="24" fill="#00267F"/><rect x="12" width="12" height="24" fill="#FFFFFF"/><rect x="24" width="12" height="24" fill="#F31830"/>
    </g>
    <rect x=".4" y=".4" width="35.2" height="23.2" rx="2.8" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".9"/>
  </svg>`;
}

export function germanFlagSvg(): string {
  return `<svg viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-label="Deutschland">
    <defs><clipPath id="de-clip"><rect x="0" y="0" width="36" height="24" rx="3"/></clipPath></defs>
    <g clip-path="url(#de-clip)">
      <rect width="36" height="8" fill="#000000"/><rect y="8" width="36" height="8" fill="#DD0000"/><rect y="16" width="36" height="8" fill="#FFCE00"/>
    </g>
    <rect x=".4" y=".4" width="35.2" height="23.2" rx="2.8" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".9"/>
  </svg>`;
}

/**
 * Cover-Bildfläche: abstrahierte Luftaufnahme eines Freiflächen-Solarparks
 * (Modultische in Blöcken, getrennt durch Wartungswege).
 * Wird vollständig ersetzt, sobald ein lizenziertes Foto über `heroImage` übergeben wird.
 */
export function heroPanelSvg(): string {
  const W = 1240;
  const ROWS = 30;
  const HORIZON = 96;
  const out: string[] = [];

  for (let i = 0; i < ROWS; i++) {
    const t = i / (ROWS - 1);
    const y = HORIZON + 26 + Math.pow(t, 2.05) * 560;
    const h = 3.4 + Math.pow(t, 2.1) * 34;
    const spread = 1 - Math.pow(1 - t, 1.5);
    const x0 = 620 - (420 + spread * 1250);
    const x1 = 620 + (420 + spread * 1250);
    const gap = 20 + t * 66;
    const stagger = (i % 2) * gap * 0.22;

    // drei Blöcke, getrennt durch Wartungswege
    const span = x1 - x0;
    const roads = [x0 + span * 0.31, x0 + span * 0.655];
    const roadW = 34 + t * 90;

    const mods: string[] = [];
    for (let x = x0 + stagger; x < x1; x += gap) {
      if (roads.some((r) => x + gap * 0.82 > r && x < r + roadW)) continue;
      mods.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(gap * 0.8).toFixed(1)}" height="${h.toFixed(1)}" fill="url(#mod)"/>`,
      );
    }
    out.push(
      `<g opacity="${(0.5 + 0.5 * t).toFixed(2)}">${mods.join('')}</g>` +
        `<rect x="${x0.toFixed(1)}" y="${(y + h).toFixed(1)}" width="${span.toFixed(1)}" height="${(h * 0.3 + 1).toFixed(1)}" fill="#0B1020" opacity="${(0.1 + 0.12 * t).toFixed(2)}"/>`,
    );
  }

  return `<svg viewBox="0 0 ${W} 660" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-label="Freiflächen-Solarpark aus der Luft">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0B1222"/><stop offset="0.55" stop-color="#26375A"/><stop offset="1" stop-color="#7E88A0"/>
      </linearGradient>
      <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#A9A084"/><stop offset="0.3" stop-color="#8E8770"/><stop offset="1" stop-color="#5E5A4C"/>
      </linearGradient>
      <linearGradient id="mod" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#46587F"/><stop offset="0.4" stop-color="#25324E"/><stop offset="1" stop-color="#131C30"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.78" cy="0.06" r="0.6">
        <stop offset="0" stop-color="#FFE7B0" stop-opacity="0.5"/><stop offset="1" stop-color="#FFE7B0" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#101828" stop-opacity="0.92"/>
        <stop offset="0.30" stop-color="#18223A" stop-opacity="0.62"/>
        <stop offset="0.52" stop-color="#1F2A44" stop-opacity="0.30"/>
        <stop offset="0.74" stop-color="#1F2A44" stop-opacity="0.60"/>
        <stop offset="1" stop-color="#0E1626" stop-opacity="0.97"/>
      </linearGradient>
      <linearGradient id="sweep" x1="0" y1="1" x2="0.9" y2="0.1">
        <stop offset="0" stop-color="#5CB800" stop-opacity="0.26"/><stop offset="0.55" stop-color="#5CB800" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="vig" cx="0.5" cy="0.45" r="0.78">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.42"/>
      </radialGradient>
      <linearGradient id="left" x1="0" y1="0" x2="1" y2="0.25">
        <stop offset="0" stop-color="#0E1626" stop-opacity="0.88"/>
        <stop offset="0.5" stop-color="#0E1626" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#0E1626" stop-opacity="0"/>
      </linearGradient>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2"/><feColorMatrix type="saturate" values="0"/></filter>
    </defs>

    <rect width="${W}" height="660" fill="url(#sky)"/>
    <rect y="${HORIZON}" width="${W}" height="${660 - HORIZON}" fill="url(#ground)"/>
    <rect y="${HORIZON - 9}" width="${W}" height="14" fill="#2F3A52" opacity="0.7"/>
    <rect width="${W}" height="660" fill="url(#glow)"/>

    <g transform="translate(620 340) rotate(-4.5) translate(-620 -340)">${out.join('')}</g>

    <rect width="${W}" height="660" fill="url(#sweep)"/>
    <rect width="${W}" height="660" fill="url(#vig)"/>
    <rect width="${W}" height="660" fill="url(#scrim)"/>
    <rect width="${W}" height="660" fill="url(#left)"/>
  </svg>`;
}
