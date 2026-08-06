import { franceFlagSvg, heroPanelSvg, NAVY, GREEN } from './assets';
import { buildFranceMap, type RegionCollection } from './franceMap';
import type { ProjectRow } from './types';
import {
  crePeriods,
  creLatest,
  creCas2bis,
  creRegions,
  creSources,
  type CrePeriod,
} from './creData';

const nf = (v: number, d = 1) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const ni = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 0 });
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const W = 340;
const H = 112;
const M = { top: 15, right: 8, bottom: 28, left: 25 };

function priceChart(periods: CrePeriod[]): string {
  const yMin = 78;
  const yMax = 84;
  const ticks = [78, 80, 82, 84];
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const x = (i: number) => M.left + (innerW / (periods.length - 1 + 0.6)) * (i + 0.3);
  const y = (v: number) => M.top + innerH * (1 - (v - yMin) / (yMax - yMin));
  const grid = ticks.map((t) => `<line x1="${M.left}" y1="${y(t).toFixed(1)}" x2="${W - M.right}" y2="${y(t).toFixed(1)}" stroke="#E3E7EE" stroke-width="0.8"/><text x="${M.left - 5}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end" font-size="8.2" fill="#6B7385">${t}</text>`).join('');
  const pts = periods.map((p, i) => ({ x: x(i), y: y(p.priceEurMwh), p }));
  const line = pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1].x.toFixed(1)} ${y(yMin).toFixed(1)}L${pts[0].x.toFixed(1)} ${y(yMin).toFixed(1)}Z`;
  const dots = pts.map((q) => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="5.4" fill="#FFFFFF"/><circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="3.4" fill="${GREEN}"/>`).join('');
  const values = pts.map((q) => `<text x="${q.x.toFixed(1)}" y="${(q.y - 9.5).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${NAVY}">${nf(q.p.priceEurMwh, 2)}</text>`).join('');
  const labels = pts.map((q) => `<text x="${q.x.toFixed(1)}" y="${(H - M.bottom + 12).toFixed(1)}" text-anchor="middle" font-size="8.6" font-weight="600" fill="${NAVY}">${q.p.period}. Periode</text><text x="${q.x.toFixed(1)}" y="${(H - M.bottom + 22).toFixed(1)}" text-anchor="middle" font-size="7.8" fill="#6B7385">${q.p.closed.slice(3)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gewichteter durchschnittlicher Zuschlagswert der letzten sechs CRE-Perioden">${grid}<path d="${area}" fill="${NAVY}" fill-opacity="0.05"/><path d="${line}" fill="none" stroke="${GREEN}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${values}${labels}<line x1="${M.left}" y1="${(H - M.bottom).toFixed(1)}" x2="${W - M.right}" y2="${(H - M.bottom).toFixed(1)}" stroke="#C6CEDC" stroke-width="0.9"/></svg>`;
}

export interface CrePageCtx {
  documentId: string;
  logoWhite: string;
  projects: ProjectRow[];
  regionsGeo: RegionCollection;
  confidentialityNote: string;
  heroImage?: string;
  page: number;
  totalPages: number;
}

export function crePage(c: CrePageCtx): string {
  const latest = crePeriods[crePeriods.length - 1];
  const prev = crePeriods[crePeriods.length - 2];
  const cas = creCas2bis.p8;
  const oversubscription = creLatest.conformMwc / latest.calledMwc;
  const hero = c.heroImage ? `<img src="${c.heroImage}" alt=""><div class="hero-scrim"></div>` : heroPanelSvg();
  const mapSvg = buildFranceMap(c.regionsGeo, c.projects, creRegions.map((r) => ({ region: r.region, count: r.count, capacityMwc: 0, share: r.share })), { width: 200, height: 200 });
  const topRegions = creRegions.slice(0, 3);
  const maxShare = Math.max(...creRegions.map((r) => r.share));
  const legend = topRegions.map((r) => {
    const t = 0.28 + 0.72 * (r.share / maxShare);
    return `<div class="li"><span class="sw" style="background:${NAVY};opacity:${t.toFixed(2)}"></span><span class="nm">${esc(r.region)}</span><span class="vl">${ni(r.share * 100)} %</span></div>`;
  }).join('');

  return `
<section class="sheet">
  <div class="cover-hero cre-hero">${hero}<div class="layer"><div class="cover-top"><div class="cover-brand"><div class="mk">${c.logoWhite}</div><div class="wd">EMA<span>ENTERPRISE GmbH</span></div></div><div class="cover-id"><div class="chip"><span class="dot"></span>Vertraulich</div><div class="doc">${esc(c.documentId)}</div></div></div><div class="cover-title"><div class="cover-eyebrow">Marktanalyse · Ausschreibungsergebnisse</div><h1>CRE Market Intelligence</h1><div class="cover-rule"></div><div class="cover-sub"><span class="flag">${franceFlagSvg()}</span>Frankreich · Marktumfeld &amp; Ausschreibungsanalyse 2026</div></div></div></div>
  <div class="kpi-row four">
    <div class="kpi"><div class="k">Letzte CRE-Runde</div><div class="v">${latest.period}.<small>Periode</small></div><div class="s">Frist ${latest.closed}<br>Ergebnis ${latest.published}</div></div>
    <div class="kpi"><div class="k">Ø Zuschlagswert</div><div class="v">${nf(latest.priceEurMwh, 2)}<small>€/MWh</small></div><div class="s">gewichtetes Mittel<br>${creLatest.priceDeltaEurMwh >= 0 ? '+' : '−'}${nf(Math.abs(creLatest.priceDeltaEurMwh), 2)} €/MWh ggü. ${prev.period}. Periode</div></div>
    <div class="kpi"><div class="k">Zuschlagsvolumen</div><div class="v">${nf(latest.awardedMwc, 0)}<small>MWc</small></div><div class="s">${ni(latest.awardedCount)} Projekte<br>${ni(latest.calledMwc)} MWc ausgeschrieben</div></div>
    <div class="kpi"><div class="k">Markteinschätzung</div><div class="v assess"><span class="dot"></span>Sehr attraktiv</div><div class="s">${nf(oversubscription, 2)}-fach überzeichnet<br>Agri-PV bei ${nf(cas.priceEurMwh, 2)} €/MWh</div></div>
  </div>
  <div class="cre-body"><div class="grid-2 cre-cols"><div class="card"><h3>Vergütung der letzten sechs CRE-Ausschreibungen</h3><div class="hint">Gewichteter durchschnittlicher Zuschlagswert der bezuschlagten Dossiers · €/MWh</div><div class="chart">${priceChart(crePeriods)}</div><div class="chart-foot"><span>Spanne <b>${nf(Math.min(...crePeriods.map((p) => p.priceEurMwh)), 2)}</b> – <b>${nf(Math.max(...crePeriods.map((p) => p.priceEurMwh)), 2)}</b> €/MWh</span><span>Bezuschlagt insgesamt <b>${nf(crePeriods.reduce((s, p) => s + p.awardedMwc, 0), 0)}</b> MWc in <b>${ni(crePeriods.reduce((s, p) => s + p.awardedCount, 0))}</b> Projekten</span></div><div class="cas-grid"><div class="cas-item hi"><div class="k">Agri-PV · Cas 2 bis</div><div class="v">${nf(cas.priceEurMwh, 2)}<small>€/MWh</small></div><div class="s">${nf(latest.priceEurMwh - cas.priceEurMwh, 2)} €/MWh unter dem Gesamtschnitt</div></div><div class="cas-item"><div class="k">Konform eingereicht</div><div class="v">${nf(cas.conformMwc, 0)}<small>MWc</small></div><div class="s">${ni(cas.conformCount)} Dossiers auf ${ni(creCas2bis.capMwc)} MWc Periodendeckel</div></div><div class="cas-item"><div class="k">Deckelbedingt eliminiert</div><div class="v">${nf(cas.cappedOutMwc, 0)}<small>MWc</small></div><div class="s">${ni(Math.round((cas.cappedOutMwc / cas.conformMwc) * 100))} % der konformen Agri-PV-Leistung</div></div></div></div><div class="card"><h3>Regionale Schwerpunkte</h3><div class="hint">Zuschlagsvolumen ${latest.period}. Periode</div><div class="map-frame">${mapSvg}</div><div class="cre-legend">${legend}<div class="li"><span class="marker"></span><span class="nm">EMA-Projektstandorte</span><span class="vl">${ni(c.projects.filter((p) => typeof p.lat === 'number' && typeof p.lon === 'number').length)}</span></div></div></div></div>
    <div class="insight"><div class="k">EMA Market Insight</div><p>Die ${latest.period}. Periode war mit <b>${nf(creLatest.conformMwc, 2)} MWc</b> konformer Leistung gegenüber ${ni(latest.calledMwc)} MWc Zielvolumen <b>${nf(oversubscription, 2)}-fach überzeichnet</b>. Bei einem seit vier Perioden nahezu unveränderten Zuschlagswert von rund ${nf(latest.priceEurMwh, 0)} €/MWh verlagert sich der Wettbewerb vom Preis auf die Projektreife – ausschlaggebend sind eine vorliegende Baugenehmigung und eine kurze Realisierungsdauer. Genehmigungsnahe Vorhaben gewinnen dadurch an relativer Attraktivität, besonders auf landwirtschaftlichen Flächen (Cas 2 bis), wo die Begrenzung auf ${ni(creCas2bis.capMwc)} MWc je Periode zuletzt rund ${ni(Math.round((cas.cappedOutMwc / cas.conformMwc) * 100))} % der konformen Leistung ausgeschlossen hat. Das Portfolio eröffnet Investoren einen strukturierten Off-Market-Zugang zu genau diesem Marktumfeld.</p></div>
    <div class="cre-note"><b>Quelle:</b> Commission de Régulation de l'Énergie (CRE), Rapports de synthèse zum Appel d'offres PPE2 « Centrales au sol » – ${creSources.join(' · ')}. Angegeben ist der gewichtete durchschnittliche Referenzpreis T0 der zur Bezuschlagung vorgeschlagenen Dossiers, nicht indexiert; die Vergütung erfolgt über 20 Jahre als complément de rémunération und entspricht keiner heutigen Einspeisevergütung. Die ${latest.period + 1}. Periode (Frist 31.07.2026) war zum Erstellungsdatum nicht veröffentlicht und ist nicht enthalten.</div>
  </div>
  <div class="page-foot"><div class="line"><div class="l"><b>EMA Enterprise GmbH</b> · Gabriel-von-Seidl-Str. 56 · 67550 Worms<br>${esc(c.confidentialityNote)}</div><div class="r">Seite <span class="num">${c.page}</span> / ${c.totalPages}</div></div></div>
</section>`;
}
