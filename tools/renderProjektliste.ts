/**
 * Lokale PDF-Erzeugung ohne Next.js – zum Prüfen des Layouts.
 *
 *   pnpm exec esbuild tools/renderProjektliste.ts --bundle --platform=node \
 *     --target=node20 --outfile=.tmp/render.cjs && node .tmp/render.cjs
 *
 * Erzeugt .tmp/projektliste.html und .tmp/EMA-Projektliste.pdf
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderProjektlisteHtml } from '../src/lib/pdf/projektliste/templateCre';
import { sampleInput } from '../src/lib/pdf/projektliste/sampleData';
import type { RegionCollection } from '../src/lib/pdf/projektliste/franceMap';
import { buildInterFontFaceCss, fileToDataUri } from '../src/lib/pdf/projektliste/loadFonts';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.tmp');
fs.mkdirSync(OUT, { recursive: true });

const fontFaceCss = buildInterFontFaceCss(path.join(ROOT, 'public/fonts/inter'));

const regions = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/geo/france-regions.json'), 'utf8'),
) as RegionCollection;

// Optionale Assets – fehlen sie, greifen die Fallbacks aus assets.ts
const logoDataUri = fileToDataUri(path.join(ROOT, 'public/brand/ema-logo.png'), 'image/png');
const logoMarkDataUri = fileToDataUri(path.join(ROOT, 'public/brand/ema-mark.png'), 'image/png');
const logoWhiteDataUri = fileToDataUri(path.join(ROOT, 'public/brand/ema-mark-white.png'), 'image/png');
const heroImage = fileToDataUri(path.join(ROOT, 'public/pdf/hero-solarpark.jpg'), 'image/jpeg');

const html = renderProjektlisteHtml(
  { ...sampleInput, heroImage },
  { regions, fontFaceCss, logoDataUri, logoMarkDataUri, logoWhiteDataUri },
);

const htmlPath = path.join(OUT, 'projektliste.html');
fs.writeFileSync(htmlPath, html);
console.log(`HTML  ${(html.length / 1024).toFixed(0)} kB  -> ${htmlPath}`);
console.log(`Logo  ${logoDataUri ? 'Original-Asset' : 'Fallback (Rekonstruktion)'}`);
console.log(`Hero  ${heroImage ? 'Foto' : 'Fallback (Bildfläche)'}`);

// Chrome-Binary: lokal ggf. anpassen
const CHROME =
  process.env.CHROME_PATH ??
  ['/opt/google/chrome/chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(
    (p) => fs.existsSync(p),
  );
if (!CHROME) throw new Error('Kein Chrome gefunden – CHROME_PATH setzen.');

const pdfPath = path.join(OUT, 'EMA-Projektliste.pdf');
execFileSync(CHROME, [
  '--headless',
  '--no-sandbox',
  '--disable-gpu',
  '--font-render-hinting=none',
  '--no-pdf-header-footer',
  `--print-to-pdf=${pdfPath}`,
  `file://${htmlPath}`,
]);
console.log(`PDF   ${(fs.statSync(pdfPath).size / 1024).toFixed(0)} kB  -> ${pdfPath}`);

