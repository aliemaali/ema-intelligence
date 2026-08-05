import fs from 'node:fs';
import path from 'node:path';

/**
 * Lädt die Inter-woff2-Dateien aus public/fonts/inter und baut daraus einen
 * @font-face-Block mit base64-Data-URIs.
 *
 * Muss serverseitig einmal aufgerufen und in `renderProjektlisteHtml`
 * durchgereicht werden. Ohne eingebettete Schrift bricht die Typografie
 * auf iOS auf einen Systemfont zurück und das Raster verschiebt sich.
 *
 * In einer langlebigen Node-Umgebung das Ergebnis cachen – das Einlesen der
 * acht Dateien kostet sonst bei jedem Request unnötig Zeit.
 */

const WEIGHTS = [400, 500, 600, 700] as const;

const SUBSETS = [
  {
    name: 'latin',
    range:
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  },
  {
    name: 'latin-ext',
    range:
      'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF',
  },
] as const;

export function buildInterFontFaceCss(
  fontDir = path.join(process.cwd(), 'public/fonts/inter'),
): string {
  return WEIGHTS.flatMap((weight) =>
    SUBSETS.map(({ name, range }) => {
      const file = path.join(fontDir, `inter-${name}-${weight}-normal.woff2`);
      const b64 = fs.readFileSync(file).toString('base64');
      return `@font-face{font-family:'Inter';font-style:normal;font-weight:${weight};font-display:block;unicode-range:${range};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
    }),
  ).join('');
}

/** Optionales Asset als Data-URI; gibt undefined zurück, wenn die Datei fehlt. */
export function fileToDataUri(
  filePath: string,
  mime: string,
): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}
