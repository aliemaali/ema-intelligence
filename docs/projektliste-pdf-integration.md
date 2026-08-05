# Projektlisten-PDF (v3) – Integration

Ersetzt die bisherige clientseitige `jsPDF`-Erzeugung der EMA-Projektliste
(`src/lib/pdf/project-list-report.ts`, entfernt) durch serverseitiges
HTML/CSS-Rendering über eine headless-Chromium-Instanz. Grund und Details
siehe `ema-projektliste-v3/INTEGRATION.md` (Ausgangspaket) – hier nur der
tatsächliche Einbau in dieses Repo.

## Layout-Module

`src/lib/pdf/projektliste/` – unverändert aus dem Paket übernommen:

- `styles.ts`, `template.ts` – **byte-identisch**, Design/Layout nicht angefasst
- `types.ts`, `analytics.ts`, `franceMap.ts`, `assets.ts`, `sampleData.ts`
- `mapEmaProjects.ts` – einzige erlaubte Quelle für `EmaProjectRecord -> ProjectRow`
- `sampleDataEma.ts` – Testdaten in echter (unvollständiger) Datenlage
- `loadFonts.ts` – bettet die acht Inter-woff2-Dateien als Base64 ein

Assets: `src/data/geo/france-regions.json`, `public/fonts/inter/*.woff2` (+ `LICENSE.txt`).

## Route

`src/app/api/projektliste/pdf/route.ts` (`runtime = 'nodejs'`, `maxDuration = 60`)

- Auth: `createClient()` aus `@/lib/supabase/server`, `supabase.auth.getUser()`,
  `401` ohne Session – gleiches Muster wie die übrigen API-Routen
  (`src/app/api/ema-ai/save/route.ts`, `src/app/api/expose-values/[id]/route.ts`).
- Datenherkunft: Der Request-Body enthält `records: EmaProjectRecord[]` –
  die vom Client bereits editierte Zeilenauswahl aus dem Projektlisten-Import
  (`ProjectListImportPreview`). Die Route selbst liest keine Projekttabelle,
  da die dort verfügbaren Spalten (Netzdistanz, Struktur, Genehmigungsdatum,
  gesicherte Fläche) aktuell nicht als eigene DB-Spalten existieren, sondern
  nur als Freitext im `notes`-Feld nach dem Speichern (siehe
  `src/lib/actions/project-list-import.actions.ts`). Die Zeilen werden
  **ausschließlich** über `mapEmaProjects()` auf `ProjectRow` gemappt.
  Sätze ohne Region, Name oder Leistung werden verworfen (`report.skipped`).
- Rendering: `puppeteer-core` + `@sparticuz/chromium-min`,
  `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })`.
  Ohne die beiden Flags fehlen Hero-Fläche, Navy-Flächen und Zeilenhintergründe.
- Fehlerfälle: `400` (kein/ungültiger Body), `422` (keine verwertbaren Zeilen
  nach dem Mapping), `500` (Rendering fehlgeschlagen).
- Fehlende optionale Assets (`public/brand/ema-logo.svg`,
  `public/pdf/hero-solarpark.jpg`) sind kein Fehler – `assets.ts` greift dann
  auf die geometrische Logo-Rekonstruktion bzw. abstrahierte Bildfläche
  zurück (`fileToDataUri` gibt `undefined` zurück, wenn die Datei fehlt).

`examples/route.ts.example` bleibt unverändert als Vorlage aus dem
Ausgangspaket erhalten (Referenz für künftige Anpassungen).

## Client

`src/components/project-import/ProjectListImportPreview.tsx` –
`createPdf()` ruft jetzt `POST /api/projektliste/pdf` mit den ausgewählten
Zeilen auf und löst den Download aus dem zurückgegebenen PDF-Blob aus, statt
`jsPDF` im Browser zu bauen. `memorandumPdf.ts` ist von dieser Umstellung
nicht betroffen und wurde nicht verändert.

## Deployment-Hinweise (Vercel)

- `next.config.js`: `experimental.serverComponentsExternalPackages` enthält
  `puppeteer-core` und `@sparticuz/chromium-min`, damit Webpack die Pakete
  nicht bündelt (sie laden die Chromium-Binary zur Laufzeit per Brotli-Paket
  von GitHub nach, siehe `CHROMIUM_PACK_URL`).
- `maxDuration = 60` setzt eine Node-Funktion mit bis zu 60 s Laufzeit voraus
  (Vercel-Hobby-Limit liegt bei 10 s). Auf dem Hobby-Plan entweder Plan
  wechseln oder `maxDuration` senken.
- Optional: `CHROMIUM_PACK_URL` als Env-Var setzen, um das Chromium-Brotli-
  Paket auf eine andere @sparticuz/chromium-min-Version zu pinnen.

## Lokale Prüfwerkzeuge (`tools/`, nicht Teil des Next.js-Builds)

- `pnpm pl:render` – rendert `sampleData.ts` lokal zu `.tmp/projektliste.html`
  und `.tmp/EMA-Projektliste.pdf` (benötigt lokal installiertes Chrome/Chromium,
  `CHROME_PATH` überschreibt die Autodetektion).
- `pnpm pl:check` – misst je Seite `scrollHeight` gegen `clientHeight` gegen
  `.tmp/projektliste.html`. Abnahmekriterium: `overflowMm === 0` auf jeder
  Seite, sonst Exit 1.
- `pnpm pl:fonts` – `pdffonts .tmp/EMA-Projektliste.pdf`, muss ausschließlich
  eingebettetes Inter zeigen, keinen Fallback-Font.

## Nicht enthalten

`public/brand/ema-logo.svg` und `public/pdf/hero-solarpark.jpg` fehlen im
Repo (siehe oben, Fallbacks greifen automatisch). Keine DB-Migration und
keine Änderung an bestehenden Projektdaten sind Teil dieser Umstellung.
