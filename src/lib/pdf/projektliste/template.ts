import type { ProjektlisteInput, ProjectRow, PermitStatus } from './types';
import { computeAnalytics, type Analytics } from './analytics';
import { buildFranceMap, type RegionCollection } from './franceMap';
import { emaLogoSvg, franceFlagSvg, heroPanelSvg, NAVY, GREEN } from './assets';
import { styles } from './styles';

const ROWS_FIRST_PAGE = 22;
const ROWS_NEXT_PAGE = 26;

const nf = (v: number, d = 1) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const ni = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 0 });
const pct = (v: number, d = 0) =>
  `${v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const deDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const NA = '<span class="unit">n. v.</span>';

const permitShort: Record<PermitStatus, string> = {
  'PC erteilt · purgé': 'RTB · purgé',
  'PC erteilt': 'PC erteilt',
  'PC eingereicht': 'PC eingereicht',
  'PC in Vorbereitung': 'In Vorbereitung',
};

const permitClass = (p: PermitStatus) =>
  p === 'PC erteilt · purgé'
    ? 'b-rtb'
    : p === 'PC erteilt'
      ? 'b-permit'
      : p === 'PC eingereicht'
        ? 'b-filed'
        : 'b-prep';

function chunk<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  let i = 0;
  while (i < rows.length) {
    const size = out.length === 0 ? ROWS_FIRST_PAGE : ROWS_NEXT_PAGE;
    out.push(rows.slice(i, i + size));
    i += size;
  }
  return out;
}

interface Ctx {
  input: ProjektlisteInput;
  a: Analytics;
  logoMark: string;
  logoFull: string;
  logoWhite: string;
  totalPages: number;
  hasCoords: boolean;
}

const head = (c: Ctx, label: string) => `
<div class="page-head">
  <div class="brand">
    <div class="mark">${c.logoMark}</div>
    <div class="t">${esc(c.input.meta.subtitle)}<span>${esc(label)}</span></div>
  </div>
  <div class="doc">${esc(c.input.meta.documentId)}</div>
</div>`;

const foot = (c: Ctx, page: number) => `
<div class="page-foot"><div class="line">
  <div class="l"><b>EMA Enterprise GmbH</b> · Gabriel-von-Seidl-Str. 56 · 67550 Worms<br>${esc(c.input.meta.confidentialityNote)}</div>
  <div class="r">Seite <span class="num">${page}</span> / ${c.totalPages}</div>
</div></div>`;

/* ------------------------------ Seite 1 ------------------------------ */
function coverPage(c: Ctx, mapSvg: string): string {
  const { meta } = c.input;
  const a = c.a;
  const rtb = a.permitBreakdown.find((x) => x.label === 'PC erteilt · purgé');
  const hero = c.input.heroImage
    ? `<img src="${c.input.heroImage}" alt=""><div class="hero-scrim"></div>`
    : heroPanelSvg();

  return `
<section class="sheet">
  <div class="cover-hero">
    ${hero}
    <div class="layer">
      <div class="cover-top">
        <div class="cover-brand"><div class="mk">${c.logoWhite}</div><div class="wd">EMA<span>ENTERPRISE GmbH</span></div></div>
        <div class="chip"><span class="dot"></span>Vertraulich</div>
      </div>
      <div class="cover-title">
        <div class="cover-eyebrow">Portfolio-Übersicht · Off-Market</div>
        <h1>${esc(meta.title)}</h1>
        <div class="cover-rule"></div>
        <div class="cover-sub"><span class="flag">${franceFlagSvg()}</span>${esc(meta.subtitle)}</div>
      </div>
    </div>
  </div>

  <div class="cover-body">
    <div class="cover-meta">
      <p class="cover-lead">Kuratierte Übersicht von ${ni(a.count)} Freiflächen-Photovoltaikprojekten
      in ${ni(a.regionCount)} französischen Regionen mit einer Gesamtleistung von ${nf(a.totalMwc)} MWc.
      Alle Projekte werden über EMA Enterprise off-market angeboten; Detailunterlagen und Datenraum
      stehen nach gegengezeichneter Vertraulichkeitsvereinbarung zur Verfügung.</p>
      <div class="cover-facts">
        <div class="fr"><span class="n">Baugenehmigung bestandskräftig (RTB)</span><span class="v">${rtb ? `${nf(rtb.capacityMwc)}<small>MWc</small>` : 'n. v.'}</span></div>
        <div class="fr"><span class="n">Ø Distanz zum Netzverknüpfungspunkt</span><span class="v">${a.avgGridDistanceKm !== null ? `${nf(a.avgGridDistanceKm)}<small>km</small>` : 'n. v.'}</span></div>
        <div class="fr"><span class="n">Ø spezifischer Ertrag (P50)</span><span class="v">${a.avgSpecificYield ? ni(a.avgSpecificYield) : 'n. v.'}<small>kWh/kWc</small></span></div>
      </div>
      <div class="meta-grid">
        <div class="meta-item"><div class="k">Dokument-ID</div><div class="v">${esc(meta.documentId)}</div></div>
        <div class="meta-item"><div class="k">Erstellungsdatum</div><div class="v">${deDate(meta.createdAt)}</div></div>
        <div class="meta-item"><div class="k">Land</div><div class="v">${esc(meta.country)}</div></div>
        <div class="meta-item"><div class="k">Technologie</div><div class="v">PV Freifläche</div></div>
      </div>
    </div>
    <div class="cover-map">
      <div class="map-frame">${mapSvg}</div>
      <div class="map-caption"><span class="key"></span>${c.hasCoords ? 'Projektstandorte · Markergröße nach Leistung' : 'Regionen mit Projektbestand · Einfärbung nach Leistungsanteil'}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi"><div class="k">Projekte</div><div class="v">${ni(a.count)}</div><div class="s">Einzelvorhaben in der Liste</div></div>
    <div class="kpi"><div class="k">Gesamtleistung</div><div class="v">${nf(a.totalMwc)}<small>MWc</small></div><div class="s">Ø ${nf(a.avgMwc)} MWc je Projekt</div></div>
    <div class="kpi"><div class="k">Regionen</div><div class="v">${ni(a.regionCount)}</div><div class="s">${esc(a.regions[0].region)} führend mit ${pct(a.regions[0].share * 100)}</div></div>
  </div>

  ${foot(c, 1)}
</section>`;
}

/* --------------------------- Tabellenseiten --------------------------- */
function tablePages(c: Ctx): string {
  const pages = chunk(c.input.projects.map((p, i) => ({ ...p, no: i + 1 })));
  const a = c.a;

  return pages
    .map((rows, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === pages.length - 1;
      const from = rows[0].no as number;
      const to = rows[rows.length - 1].no as number;
      const pageCap = rows.reduce((s, r) => s + r.capacityMwc, 0);

      const body = rows
        .map(
          (p) => `
  <tr>
    <td class="t-no">${String(p.no).padStart(2, '0')}</td>
    <td class="t-region">${esc(p.region)}</td>
    <td class="t-name">${esc(p.name)}</td>
    <td class="num"><b>${nf(p.capacityMwc)}</b></td>
    <td class="num">${p.gridDistanceKm !== undefined ? nf(p.gridDistanceKm) : NA}</td>
    <td class="num">${p.areaHa !== undefined ? nf(p.areaHa) : NA}</td>
    <td>${p.structure ? `<span class="badge b-share">${esc(p.structure)}</span>` : NA}</td>
    <td>${p.permit ? `<span class="badge ${permitClass(p.permit)}">${esc(permitShort[p.permit])}</span>` : NA}</td>
    <td style="white-space:nowrap">${esc(p.cod)}</td>
    <td class="num">${p.specificYield ? ni(p.specificYield) : '<span class="unit">n. v.</span>'}</td>
  </tr>`,
        )
        .join('');

      return `
<section class="sheet">
  ${head(c, isFirst ? 'Projektübersicht' : `Projektübersicht · Fortsetzung ${idx + 1}`)}
  <div class="page-body">
    <div class="section-head">
      <div class="accent"></div>
      <h2>Projektübersicht</h2>
      <div class="sub">${isFirst ? `${ni(a.count)} Projekte · ${nf(a.totalMwc)} MWc · Stand ${deDate(c.input.meta.createdAt)}` : `Fortsetzung · Projekte ${from}–${to}`}</div>
    </div>

    <table class="projects">
      <colgroup>
        <col style="width:7mm"><col style="width:29mm"><col style="width:27mm">
        <col style="width:14mm"><col style="width:14mm"><col style="width:13mm">
        <col style="width:17mm"><col style="width:23mm"><col style="width:14mm"><col style="width:16mm">
      </colgroup>
      <thead>
        <tr>
          <th>Nr.</th><th>Region</th><th>Projektname</th>
          <th style="text-align:right">Leistung<span class="u">MWc</span></th>
          <th style="text-align:right">Netz<span class="u">km</span></th>
          <th style="text-align:right">Fläche<span class="u">ha</span></th>
          <th>Struktur</th><th>Genehmigung</th>
          <th>IBN<span class="u">Ziel</span></th>
          <th style="text-align:right">Ertrag<span class="u">kWh/kWc</span></th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>

    <div class="tfoot-strip">
      <div class="l">${isLast && pages.length === 1 ? 'Summe Portfolio' : `Zwischensumme Projekte ${from}–${to}`}</div>
      <div class="r">${nf(pageCap)} MWc</div>
    </div>
    ${
      isLast
        ? `<div class="legend-note">Genehmigung: <b>RTB · purgé</b> (PC erteilt · purgé) = Baugenehmigung erteilt und Rechtsmittelfrist abgelaufen (ready-to-build) · <b>PC erteilt</b> = Genehmigung erteilt, Frist läuft · <b>PC eingereicht</b> = Antrag in Bearbeitung · <b>In Vorbereitung</b> = Antrag in Vorbereitung. Netzdistanz = Luftlinie zum vorgesehenen Verknüpfungspunkt. Spezifischer Ertrag = P50-Erwartungswert je kWc gemäß Projektunterlagen des Entwicklers.</div>`
        : ''
    }
  </div>
  ${foot(c, 2 + idx)}
</section>`;
    })
    .join('');
}

/* ---------------------------- Analyseseite ---------------------------- */
function donut(slices: { label: string; value: number; color: string }[]): string {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 42;
  const SW = 17;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = slices
    .map((s) => {
      const len = (s.value / total) * C;
      const el = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${s.color}" stroke-width="${SW}"
        stroke-dasharray="${(len - 1.6).toFixed(2)} ${(C - len + 1.6).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
      offset += len;
      return el;
    })
    .join('');
  return `<svg viewBox="0 0 120 120">${arcs}</svg>`;
}

function analysisPage(c: Ctx, page: number): string {
  const a = c.a;
  const maxRegion = a.regions[0].capacityMwc;
  const classColors = ['#C6CEDC', '#8895AE', '#41527A', GREEN];

  const bars = a.regions
    .map(
      (r) => `
  <div class="bar-row">
    <div class="bar-label">${esc(r.region)}</div>
    <div class="bar-val">${nf(r.capacityMwc)} MWc</div>
    <div class="bar-track"><div class="bar-fill" style="width:${((r.capacityMwc / maxRegion) * 100).toFixed(1)}%"></div></div>
    <div class="bar-meta">${r.count} ${r.count === 1 ? 'Projekt' : 'Projekte'} · ${pct(r.share * 100, 1)} der Gesamtleistung</div>
  </div>`,
    )
    .join('');

  const legend = a.sizeClasses
    .map(
      (s, i) => `
  <div class="li">
    <span class="sw" style="background:${classColors[i]}"></span>
    <span class="nm">${esc(s.label)}</span>
    <span class="vl">${nf(s.capacityMwc)} MWc</span>
    <span class="pc">${pct(s.share * 100)}</span>
  </div>`,
    )
    .join('');

  const miniRows = (items: { label: string; count: number; capacityMwc: number }[]) =>
    items
      .map(
        (i) => `<div class="mini-row"><span class="n">${esc(i.label)}</span>
      <span class="v">${nf(i.capacityMwc)} MWc<span>${i.count} Pr.</span></span></div>`,
      )
      .join('');

  return `
<section class="sheet">
  ${head(c, 'Portfolio-Analyse')}
  <div class="page-body">
    <div class="section-head">
      <div class="accent"></div>
      <h2>Portfolio-Analyse</h2>
      <div class="sub">Alle Kennzahlen berechnet aus den ${ni(a.count)} gelisteten Projekten</div>
    </div>

    <div class="stat-row">
      <div class="stat"><div class="k">Gesamtleistung</div><div class="v">${nf(a.totalMwc)}<small> MWc</small></div><div class="s">${a.totalAreaHa > 0 ? `${nf(a.totalAreaHa, 0)} ha Projektfläche` : 'Fläche n. v.'}</div></div>
      <div class="stat"><div class="k">Ø Leistung</div><div class="v">${nf(a.avgMwc)}<small> MWc</small></div><div class="s">Median ${nf(a.medianMwc)} MWc</div></div>
      <div class="stat"><div class="k">Größtes Projekt</div><div class="v">${nf(a.largest.capacityMwc)}<small> MWc</small></div><div class="s">${esc(a.largest.name)} · ${esc(a.largest.region)}</div></div>
      <div class="stat"><div class="k">Kleinstes Projekt</div><div class="v">${nf(a.smallest.capacityMwc)}<small> MWc</small></div><div class="s">${esc(a.smallest.name)} · ${esc(a.smallest.region)}</div></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Regionale Leistungsverteilung</h3>
        <div class="hint">${ni(a.regionCount)} Regionen · absteigend nach installierter Leistung</div>
        <div class="bars">${bars}</div>
      </div>
      <div class="card">
        <h3>Leistungsklassen</h3>
        <div class="hint">Anteil an der Gesamtleistung</div>
        <div class="donut-wrap">
          <div class="donut">
            ${donut(a.sizeClasses.map((s, i) => ({ label: s.label, value: s.capacityMwc, color: classColors[i] })))}
            <div class="center"><div class="v">${nf(a.totalMwc, 0)}</div><div class="k">MWc gesamt</div></div>
          </div>
          <div class="legend">${legend}</div>
        </div>
      </div>
    </div>

    <div class="grid-3">
      <div class="card"><h3>Genehmigungsstatus</h3><div class="hint">nach Leistung</div>${miniRows(a.permitBreakdown)}</div>
      <div class="card"><h3>Transaktionsstruktur</h3><div class="hint">nach Leistung</div>${miniRows(a.structureBreakdown)}</div>
      <div class="card"><h3>Inbetriebnahme</h3><div class="hint">nach Zieljahr</div>${miniRows(a.codBreakdown)}</div>
    </div>
  </div>
  ${foot(c, page)}
</section>`;
}

/* --------------------------- Abschlussseite --------------------------- */
function summaryPage(c: Ctx, page: number): string {
  const a = c.a;
  const top3 = a.regions.slice(0, 3);
  const rtbMwc = a.permitBreakdown.find((p) => p.label === 'PC erteilt · purgé');
  const firstCod = a.codBreakdown[0];

  return `
<section class="sheet">
  ${head(c, 'Executive Summary')}
  <div class="page-body">
    <div class="section-head">
      <div class="accent"></div>
      <h2>Executive Summary</h2>
      <div class="sub">${esc(c.input.meta.subtitle)} · ${esc(c.input.meta.documentId)}</div>
    </div>

    <div class="exec">
      <div>
        <div class="pull">${ni(a.count)} Projekte · ${nf(a.totalMwc)} MWc · ${ni(a.regionCount)} Regionen –
        ${rtbMwc ? `davon ${nf(rtbMwc.capacityMwc)} MWc mit bestandskräftiger Baugenehmigung.` : 'Genehmigungsstatus je Projekt in der Übersicht.'}</div>
        <p>Die Liste bündelt ${ni(a.count)} französische Freiflächen-Photovoltaikprojekte mit einer
        Gesamtleistung von ${nf(a.totalMwc)} MWc ${a.totalAreaHa > 0 ? `auf rund ${nf(a.totalAreaHa, 0)} ha Projektfläche` : ''}. Die
        Einzelgrößen reichen von ${nf(a.smallest.capacityMwc)} MWc bis ${nf(a.largest.capacityMwc)} MWc bei
        einem Median von ${nf(a.medianMwc)} MWc; das Portfolio ist damit sowohl für Einzelankäufe als auch
        für eine Paketlösung geeignet.</p>
        <p>${a.avgGridDistanceKm !== null ? `Die durchschnittliche Distanz zum vorgesehenen Netzverknüpfungspunkt beträgt ${nf(a.avgGridDistanceKm)} km${a.avgSpecificYield ? `, der mittlere spezifische Ertrag liegt bei ${ni(a.avgSpecificYield)} kWh/kWc` : ''}.` : a.avgSpecificYield ? `Der mittlere spezifische Ertrag liegt bei ${ni(a.avgSpecificYield)} kWh/kWc.` : ''}
        ${rtbMwc ? `Auf Projekte mit bestandskräftiger Genehmigung entfallen ${pct(a.rtbShare * 100)} der Leistung – dieser Teil ist kurzfristig bau- und finanzierbar.` : ''}
        ${firstCod ? `Die frühesten Inbetriebnahmen sind für ${firstCod.label} vorgesehen.` : ''}</p>
        <p>Sämtliche Angaben beruhen auf den Unterlagen der jeweiligen Projektentwickler. Sie ersetzen
        keine technische, rechtliche oder steuerliche Due Diligence; Netzanschlusszusagen, Flächenverträge,
        Genehmigungsbescheide und Ertragsgutachten werden im Datenraum projektbezogen bereitgestellt.</p>
      </div>

      <div class="figures">
        <h3>Kennzahlen</h3>
        <div class="fig-row"><span class="n">Projekte</span><span class="v">${ni(a.count)}</span></div>
        <div class="fig-row"><span class="n">Gesamtleistung</span><span class="v">${nf(a.totalMwc)}<small>MWc</small></span></div>
        <div class="fig-row"><span class="n">Ø Projektgröße</span><span class="v">${nf(a.avgMwc)}<small>MWc</small></span></div>
        <div class="fig-row"><span class="n">Median</span><span class="v">${nf(a.medianMwc)}<small>MWc</small></span></div>
        ${a.totalAreaHa > 0 ? `<div class="fig-row"><span class="n">Projektfläche</span><span class="v">${nf(a.totalAreaHa, 0)}<small>ha</small></span></div>` : ''}
        ${a.avgGridDistanceKm !== null ? `<div class="fig-row"><span class="n">Ø Netzdistanz</span><span class="v">${nf(a.avgGridDistanceKm)}<small>km</small></span></div>` : ''}
        ${a.avgSpecificYield ? `<div class="fig-row"><span class="n">Ø spez. Ertrag</span><span class="v">${ni(a.avgSpecificYield)}<small>kWh/kWc</small></span></div>` : ''}
        <div class="fig-row"><span class="n">Regionen</span><span class="v">${ni(a.regionCount)}</span></div>
      </div>
    </div>

    <div class="focus">
      <div class="section-head" style="padding:0 0 0"><h2 style="font-size:11pt">Regionale Schwerpunkte</h2></div>
      <div class="focus-grid">
        ${top3
          .map(
            (r, i) => `
        <div class="focus-card">
          <div class="r">Rang ${i + 1}</div>
          <div class="n">${esc(r.region)}</div>
          <div class="d">${nf(r.capacityMwc)} MWc · ${r.count} ${r.count === 1 ? 'Projekt' : 'Projekte'}<br>${pct(r.share * 100, 1)} der Gesamtleistung</div>
        </div>`,
          )
          .join('')}
      </div>
    </div>

    <div class="steps">
      <div class="section-head" style="padding:0 0 0"><h2 style="font-size:11pt">Nächste Schritte</h2></div>
      <div class="steps-grid">
        <div class="step"><div class="i">1</div><div class="c"><div class="t">NDA zeichnen</div><div class="d">Gegenzeichnung der Vertraulichkeitsvereinbarung; anschließend Freigabe der projektbezogenen Unterlagen.</div></div></div>
        <div class="step"><div class="i">2</div><div class="c"><div class="t">Shortlist festlegen</div><div class="d">Auswahl der Projekte nach Größe, Region, Genehmigungsstand und Zeitpunkt der Inbetriebnahme.</div></div></div>
        <div class="step"><div class="i">3</div><div class="c"><div class="t">Datenraum und Prüfung</div><div class="d">Netzanschluss, Flächensicherung, Genehmigung und Ertragsgutachten je Projekt im Datenraum.</div></div></div>
        <div class="step"><div class="i">4</div><div class="c"><div class="t">Indikatives Angebot</div><div class="d">Abstimmung von Struktur, Kaufpreismechanik und Zeitplan; danach Exklusivität und SPA-Verhandlung.</div></div></div>
      </div>
    </div>

    <div class="contact">
      <div class="who">
        <div class="n">Ali Ünlüer</div>
        <div class="r">Geschäftsführer · EMA Enterprise GmbH</div>
        <div class="c">Gabriel-von-Seidl-Str. 56 · 67550 Worms<br>unluer@ema-enterprise.de · +49 176 620 51 942</div>
      </div>
      <div class="brand"><div class="mk">${c.logoMark}</div><div class="wd">EMA<span>ENTERPRISE GmbH</span></div></div>
    </div>
    <div class="disclaimer">Dieses Dokument dient ausschließlich der unverbindlichen Information des benannten Empfängers und stellt kein Angebot,
    keine Anlageberatung und keine Aufforderung zur Abgabe eines Angebots dar. Angaben zu Leistung, Fläche, Netzdistanz, Genehmigungsstand und
    Erträgen beruhen auf Informationen Dritter und wurden von EMA Enterprise GmbH nicht abschließend verifiziert. Eine Weitergabe an Dritte ist
    ohne schriftliche Zustimmung nicht gestattet.</div>
  </div>
  ${foot(c, page)}
</section>`;
}

/* ------------------------------ Dokument ------------------------------ */
export interface RenderOptions {
  /** GeoJSON der französischen Regionen */
  regions: RegionCollection;
  /** @font-face-Block mit eingebetteten woff2-Daten (base64) */
  fontFaceCss?: string;
  /** Data-URI des Original-EMA-Logos; überschreibt die Rekonstruktion */
  logoDataUri?: string;
}

export function renderProjektlisteHtml(
  input: ProjektlisteInput,
  opts: RenderOptions,
): string {
  const a = computeAnalytics(input.projects);
  const tablePageCount = Math.max(
    1,
    Math.ceil(Math.max(0, input.projects.length - ROWS_FIRST_PAGE) / ROWS_NEXT_PAGE) + 1,
  );
  const totalPages = 1 + tablePageCount + 2;

  const img = (uri: string, alt: string) => `<img src="${uri}" alt="${alt}" style="width:100%;height:auto;display:block">`;
  const c: Ctx = {
    input,
    a,
    logoMark: opts.logoDataUri ? img(opts.logoDataUri, 'EMA') : emaLogoSvg({ withWordmark: false }),
    logoFull: opts.logoDataUri ? img(opts.logoDataUri, 'EMA Enterprise GmbH') : emaLogoSvg(),
    logoWhite: emaLogoSvg({ onDark: true, withWordmark: false }),
    totalPages,
    hasCoords: input.projects.some(
      (p) => typeof p.lat === 'number' && typeof p.lon === 'number',
    ),
  };

  const mapSvg = buildFranceMap(opts.regions, input.projects, a.regions, {
    width: 200,
    height: 210,
  });

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(input.meta.title)} – ${esc(input.meta.subtitle)} | ${esc(input.meta.documentId)}</title>
<style>${opts.fontFaceCss ?? ''}${styles}</style>
</head>
<body>
${coverPage(c, mapSvg)}
${tablePages(c)}
${analysisPage(c, 1 + tablePageCount + 1)}
${summaryPage(c, totalPages)}
</body>
</html>`;
}

export { NAVY, GREEN };
