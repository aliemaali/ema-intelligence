/**
 * Prüft je A4-Seite, ob der Inhalt über die Seitenhöhe hinausläuft.
 * Voraussetzung: tools/renderProjektliste.ts wurde vorher ausgeführt
 * (.tmp/projektliste.html muss existieren).
 *
 *   pnpm exec esbuild tools/check.ts --bundle --platform=node \
 *     --target=node20 --outfile=.tmp/check.cjs && node .tmp/check.cjs
 *
 * Abnahmekriterium: overflowMm === 0 auf jeder Seite.
 * Bei Überlauf ROWS_FIRST_PAGE / ROWS_NEXT_PAGE in template.ts reduzieren.
 */
import path from 'node:path';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME_PATH ??
  ['/opt/google/chrome/chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(
    (p) => fs.existsSync(p),
  );
if (!CHROME) throw new Error('Kein Chrome gefunden – CHROME_PATH setzen.');

const htmlPath = path.join(process.cwd(), '.tmp/projektliste.html');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
  await page.emulateMediaType('print');

  const rows = await page.evaluate(() => {
    const PX_PER_MM = 96 / 25.4;
    return [...document.querySelectorAll('.sheet')].map((sheet, i) => {
      const el = sheet as HTMLElement;
      const target = (el.querySelector('.page-body') as HTMLElement | null) ?? el;
      const overflowPx = target.scrollHeight - target.clientHeight;
      const blocks = [...target.children]
        .map((c) => `${(c as HTMLElement).className || c.tagName}:${Math.round((c as HTMLElement).getBoundingClientRect().height)}`)
        .join(' ');
      return {
        page: i + 1,
        scroll: target.scrollHeight,
        client: target.clientHeight,
        overflowMm: +(overflowPx / PX_PER_MM).toFixed(1),
        blocks,
      };
    });
  });

  console.table(rows);
  await browser.close();

  const bad = rows.filter((r) => r.overflowMm > 0);
  if (bad.length) {
    console.error(`FEHLER: Überlauf auf Seite(n) ${bad.map((b) => b.page).join(', ')}`);
    process.exit(1);
  }
  console.log(`OK: ${rows.length} Seiten, kein Überlauf.`);
})();
