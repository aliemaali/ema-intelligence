# Projektlisten-PDF (v7) – Integration

Ersetzt die bisherige clientseitige `jsPDF`-Erzeugung der EMA-Projektliste
(`src/lib/pdf/project-list-report.ts`, entfernt) durch serverseitiges
HTML/CSS-Rendering über eine headless-Chromium-Instanz. Grund und Details
siehe `INTEGRATION.md` im jeweiligen Ausgangspaket – hier nur der
tatsächliche Einbau in dieses Repo.

Historie: Erstintegration auf Basis `ema-projektliste-v3.zip`, aktualisiert
auf Basis `ema-projektliste-v7.zip`. Die Paket-Dokumentation (`DATEILISTE.md`,
`DESIGN-SPEC.md`, `INTEGRATION.md`) war in v7 nicht auf den neuen Stand
gebracht (referenziert noch `sampleDataEma.ts` als "Ergänzung v3", nennt
Logo/Hero weiterhin als "fehlt", nennt die alte Paginierung 22/26) – maßgeblich
war in Zweifelsfällen der tatsächliche Code, nicht die Doku-Dateien.

## Layout-Module

`src/lib/pdf/projektliste/` – aus dem Paket übernommen, Datei für Datei
gegen die vorherige Version geprüft:

- `styles.ts`, `template.ts` – **byte-identisch aus dem ZIP**, mit **einer
  gezielten Abweichung** (siehe „Abweichung von unverändert" unten)
- `types.ts` – neue optionale `ProjectRow`-Felder: `department`, `techType`,
  `permitDate`, `permitMature` (additiv, bricht `mapEmaProjects()`-Output nicht)
- `analytics.ts` – neue `techBreakdown`/`maturityBreakdown`, größenadaptive
  Klassengrenzen
- `franceMap.ts`, `assets.ts`, `sampleData.ts`, `sampleDataEma.ts`,
  `mapEmaProjects.ts`, `loadFonts.ts` – unverändert gegenüber v3
- `frenchDepartments.ts`, `frenchListRaw.ts`, `mapFrenchList.ts`,
  `sampleDataFr.ts` – **neu in v7**, siehe „Nicht verdrahtet" unten

Assets: `src/data/geo/france-regions.json`, `public/fonts/inter/*.woff2`
(unverändert gegenüber v3), plus **neu**: `public/brand/ema-logo.png`,
`public/brand/ema-mark.png`, `public/brand/ema-mark-white.png`,
`public/pdf/hero-solarpark.jpg` — die in v3 fehlenden Original-Assets sind
jetzt vorhanden (PNG statt der ursprünglich erwarteten SVG, `template.ts`
akzeptiert beides über `logoDataUri`/`logoMarkDataUri`/`logoWhiteDataUri`
als beliebige Data-URI).

## Abweichung von „unverändert übernehmen“

`styles.ts` enthält gegenüber dem ZIP eine einzeilige Änderung:

```diff
-.disclaimer{margin-top:3mm;font-size:6pt;line-height:1.5;color:#8A90A0;}
+.disclaimer{margin-top:1.8mm;font-size:6pt;line-height:1.38;color:#8A90A0;}
```

Grund: Mit dem byteidentisch aus dem ZIP kopierten `styles.ts`/`template.ts`
lief `pl:check` auf Seite 4 (Abschlussseite) in **2,4 mm Überlauf** — reproduzierbar
mit dem mitgelieferten `sampleData.ts`-Testportfolio, unabhängig von den neuen
Logo-Assets (mit und ohne echtes Logo getestet, derselbe Überlauf). Ursache:
der in v7 verlängerte Disclaimer-Text auf der Abschlussseite passt bei
unveränderter Zeilenhöhe/Abstand nicht mehr auf die Seite. Das Paket
verfehlt damit an dieser Stelle sein eigenes Abnahmekriterium („0 mm Überlauf
auf jeder Seite", `DESIGN-SPEC.md` Punkt 3).

Nur `margin-top` und `line-height` des Disclaimers wurden angepasst
(Schriftgröße unverändert 6 pt) — der kleinstmögliche Eingriff, um die
~9 px fehlenden Platz zurückzugewinnen, ohne Layout, Spaltenbreiten oder
sonstige Designentscheidungen anzufassen. Verifiziert mit `pl:check` gegen
sowohl `sampleData.ts` (4 Seiten) als auch die reale 232-Projekte-Liste
(13 Seiten, `mapFrenchList`/`frenchListRaw.ts`) — beide Male 0 mm Überlauf
auf jeder Seite.

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
- Logo: `logoDataUri` (Vollmarke, `ema-logo.png`), `logoMarkDataUri`
  (Bildmarke, `ema-mark.png`), `logoWhiteDataUri` (Bildmarke Negativ,
  `ema-mark-white.png`) – alle drei jetzt echte Original-Assets statt
  Fallback-Rekonstruktion.
- Rendering: `puppeteer-core` + `@sparticuz/chromium-min`,
  `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })`.
  Ohne die beiden Flags fehlen Hero-Fläche, Navy-Flächen und Zeilenhintergründe.
- Fehlerfälle: `400` (kein/ungültiger Body), `422` (keine verwertbaren Zeilen
  nach dem Mapping), `500` (Rendering fehlgeschlagen).

`examples/route.ts.example` bleibt unverändert als Vorlage aus dem
Ausgangspaket erhalten (referenziert noch die alten `.svg`-Pfade und nur
`logoDataUri` – bewusst nicht nachgezogen, da laut Auftrag als Vorlage aus
dem Paket erhalten bleibt; die tatsächliche Route nutzt die volle
Drei-Logo-API).

## Nicht verdrahtet: `mapFrenchList.ts` / `frenchListRaw.ts`

v7 liefert zusätzlich einen zweiten, spezialisierten Mapper:

- `frenchDepartments.ts` – Département-Code → Name/Region (nur die in der
  Liste vorkommenden Codes)
- `mapFrenchList.ts` – mappt Rohsätze im Spaltenformat der Original-
  Entwicklerliste (`no`, `dep`, `permit_date` TT/MM/JJJJ, `mwp`, `mid`
  [Netzdistanz+Anlagentyp als Freitext], `studies`, `cod` TT/MM/JJJJ, `ha`,
  `yld`) auf `ProjectRow`. Bewusst NICHT abgeleitet: `permit`-Status (nur
  `permitDate` + `permitMature`-Reifeindikator „> 4 Monate zurück"), `name`
  (Liste enthält keine Projektnamen), `lat`/`lon`, `structure`
  (Spalte „Structure" ist der Anlagentyp, keine Deal-Struktur)
- `frenchListRaw.ts` – 232 reale Rohsätze der französischen Entwicklerliste
  (Stand 08/2026)
- `sampleDataFr.ts` – `frInput`/`frMapping`, verdrahtet `mapFrenchList` mit
  `frenchListRaw`

Dieser Mapper passt vom Spaltenformat her erkennbar besser zur echten
Entwicklerliste als `mapEmaProjects`/`EmaProjectRecord` – u. a. weil das
`region`-Feld, das `src/lib/actions/project-list-import.actions.ts` beim
Import parst, tatsächlich bereits ein Département-Code ist (siehe
`parseWhitespaceLine`/`parseFlattenedPdf`, Gruppe `(\d{2,3})`), nicht ein
ausgeschriebener Regionsname.

**Bewusst nicht in die Live-Route verdrahtet**, weil `mapFrenchList`s
Datumsfunktionen (`toDe`, `toDate`, `toQuarter`) das Rohformat TT/MM/JJJJ
erwarten, das bestehende Import-Pipeline (`normalizeDate()` in
`project-list-import.actions.ts`) aber bereits nach ISO (`JJJJ-MM-TT`)
normalisiert, bevor die Zeilen den Client erreichen. Ein Umstieg der Route
auf `mapFrenchList` würde diese vorgelagerte Normalisierung anfassen müssen
– das ist eine Entscheidung über die Datenpipeline einer produktiven
Money-Data-Route, keine reine PDF-Modul-Integration, und wurde hier bewusst
nicht ohne Rückfrage getroffen. `mapFrenchList`/`frenchListRaw.ts` stehen im
Repo als Referenz/Vorlage zur Verfügung, exakt wie `sampleData.ts` und
`sampleDataEma.ts` auch nur von den lokalen `tools/`-Skripten genutzt
werden, nicht von der Live-Route.

## Client

`src/components/project-import/ProjectListImportPreview.tsx` –
`createPdf()` ruft `POST /api/projektliste/pdf` mit den ausgewählten Zeilen
auf und löst den Download aus dem zurückgegebenen PDF-Blob aus, statt
`jsPDF` im Browser zu bauen (unverändert seit der v3-Integration).
`memorandumPdf.ts` ist von dieser Umstellung nicht betroffen und wurde nicht
verändert.

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
  und `.tmp/EMA-Projektliste.pdf`, jetzt mit den echten Brand-/Hero-Assets
  statt Fallback (benötigt lokal installiertes Chrome/Chromium,
  `CHROME_PATH` überschreibt die Autodetektion).
- `pnpm pl:check` – misst je Seite `scrollHeight` gegen `clientHeight` gegen
  `.tmp/projektliste.html`. Abnahmekriterium: `overflowMm === 0` auf jeder
  Seite, sonst Exit 1.
- `pnpm pl:fonts` – `pdffonts .tmp/EMA-Projektliste.pdf`, muss ausschließlich
  eingebettetes Inter zeigen, keinen Fallback-Font.

## Keine DB-Migration

Keine DB-Migration und keine Änderung an bestehenden Projektdaten sind Teil
dieser Umstellung.
