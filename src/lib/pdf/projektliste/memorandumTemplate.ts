import type { MemorandumPdfData } from '../memorandumPdf';
import { emaLogoSvg, franceFlagSvg, germanFlagSvg } from './assets';
import { buildGermanyMap, type GermanyMapData } from './germanyMap';
import { memorandumStyles } from './memorandumStyles';
import { styles } from './styles';

export interface MemorandumRenderOptions {
  germanyMap: GermanyMapData;
  fontFaceCss: string;
  heroImage: string;
  logoWhiteDataUri?: string;
  projectImage?: string;
}

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NUMBER_LOCALE = 'de-DE';
const nf = (value: number, digits = 0, _language: MemorandumPdfData['language'] = 'de') => value.toLocaleString(NUMBER_LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const money = (value: number, _language: MemorandumPdfData['language'] = 'de') => value.toLocaleString(NUMBER_LOCALE, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const upper = (value: string, language: MemorandumPdfData['language']) => language === 'de' ? value.replace(/ß/g, 'ẞ').toLocaleUpperCase('de-DE') : value.toLocaleUpperCase('en-GB');

function parseMetricNumber(value: string, _language: MemorandumPdfData['language']): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function flag(country: string): string {
  const key = country.toLocaleLowerCase('de-DE');
  if (key.includes('deutsch') || key.includes('german')) return germanFlagSvg();
  if (key.includes('frank') || key.includes('france')) return franceFlagSvg();
  return '';
}

function isGermanCountry(country: string): boolean {
  const key = country.toLocaleLowerCase('de-DE');
  return key.includes('deutsch') || key.includes('german');
}

function copy(language: MemorandumPdfData['language']) {
  const en = language === 'en';
  return {
    confidential: en ? 'Confidential' : 'Vertraulich',
    eyebrow: 'Exposé',
    executive: en ? 'Executive Summary' : 'Executive Summary',
    profile: en ? 'Project Profile' : 'Projektprofil',
    highlights: en ? 'Investment Highlights' : 'Investment Highlights',
    economics: en ? 'Financial Metrics' : 'Wirtschaftliche Kennzahlen',
    siteCheck: en ? 'Site assessment' : 'Standortprüfung',
    siteData: en ? 'Data center · Site data' : 'Rechenzentrum · Standortdaten',
    portfolioData: en ? 'BESS portfolio · Site overview' : 'BESS-Portfolio · Standortübersicht',
    portfolioOverview: en ? 'Portfolio and site due diligence' : 'Portfolio- und Standortprüfung',
    sites: en ? 'Sites' : 'Standorte',
    power: en ? 'Power' : 'Leistung',
    capacity: en ? 'Capacity' : 'Kapazität',
    duration: en ? 'Duration' : 'Dauer',
    grid: en ? 'Grid status' : 'Netzstatus',
    land: en ? 'Land security' : 'Flächensicherung',
    permit: en ? 'Permitting' : 'Genehmigung',
    evidenceNote: en
      ? 'The following information is based on the stored site and assessment data. Unverified values are explicitly marked as unknown or requiring verification.'
      : 'Die folgenden Angaben stammen aus den hinterlegten Standort- und Prüfdaten. Nicht belegte Werte werden ausdrücklich als „Nicht bekannt“ oder „Muss geprüft werden“ ausgewiesen.',
    dueDiligence: en
      ? 'Note: The information is intended for an initial site assessment. Technical availability, permitting, land security and telecommunications connectivity must be confirmed during due diligence.'
      : 'Hinweis: Die Angaben dienen der ersten Standortbewertung. Technische Verfügbarkeit, Genehmigungsfähigkeit, Grundstückssicherung und Telekommunikationsanbindung sind im Rahmen der Due Diligence zu bestätigen.',
    location: en ? 'Project Location' : 'Projektstandort',
    type: en ? 'Project type' : 'Projekttyp',
    country: en ? 'Country' : 'Land',
    status: en ? 'Project status' : 'Projektstatus',
    projectView: en ? 'Project view' : 'Projektansicht',
    annualProduction: en ? 'Annual production' : 'Jahresproduktion',
    annualRevenue: en ? 'Annual revenue' : 'Jahreserlös',
    purchasePrice: en ? 'Purchase price' : 'Kaufpreis',
    pricePerKwp: en ? 'Price per kWp' : 'Preis pro kWp',
    amortisation: en ? 'Payback period' : 'Amortisation',
    returnPa: en ? 'Annual return' : 'Rendite p. a.',
    tariff: en ? 'Feed-in tariff' : 'Vergütung',
    mapHint: en ? 'Location marker based on the project record' : 'Standortmarker auf Basis der Projektdaten',
    confidentiality: en
      ? 'CONFIDENTIAL · For the intended recipient only · No disclosure or reproduction without the prior written consent of EMA Enterprise GmbH'
      : 'VERTRAULICH · Nur für den vorgesehenen Empfänger · Keine Weitergabe oder Vervielfältigung ohne vorherige schriftliche Zustimmung der EMA Enterprise GmbH',
    page: en ? 'Page' : 'Seite',
  };
}

function buildKpis(data: MemorandumPdfData) {
  const c = copy(data.language);
  const visible = data.metrics.filter((item) => item.value && item.value !== '—' && !item.label.toLocaleLowerCase('de-DE').includes('pachtdauer'));
  if (!data.showPvEconomics || !data.pvEconomics) return visible.slice(0, 5);

  const capacity = visible.find((item) => {
    const key = item.label.toLocaleLowerCase('de-DE');
    return key.includes('pv-leistung') || key === 'leistung' || key.includes('pv capacity');
  });
  const pvKwp = capacity ? parseMetricNumber(capacity.value, data.language) : 0;
  const economics = data.pvEconomics;
  return [
    capacity,
    economics.purchasePrice > 0 ? { label: c.purchasePrice, value: money(economics.purchasePrice, data.language) } : undefined,
    economics.purchasePrice > 0 && pvKwp > 0 ? { label: c.pricePerKwp, value: `${nf(economics.purchasePrice / pvKwp, 0, data.language)} €/kWp` } : undefined,
    economics.amortisation > 0 ? { label: c.amortisation, value: `${nf(economics.amortisation, 1, data.language)} ${data.language === 'en' ? 'years' : 'Jahre'}` } : undefined,
    economics.roi > 0 ? { label: c.returnPa, value: `${nf(economics.roi, 2, data.language)} %` } : undefined,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
}

function buildProfile(data: MemorandumPdfData) {
  const c = copy(data.language);
  const fixed = [
    { label: c.type, value: data.typeLabel },
    { label: data.language === 'en' ? 'Location' : 'Standort', value: data.location },
    { label: c.country, value: data.country },
    { label: c.status, value: data.status },
  ];
  const blocked = new Set(['projekttyp', 'project type', 'standort', 'location', 'land', 'country', 'projektstatus', 'project status']);
  const additional = data.profile.filter((item) => !blocked.has(item.label.toLocaleLowerCase('de-DE')));
  return [...fixed, ...additional].filter((item) => item.value && item.value !== '—').slice(0, 7);
}

function orderedHighlights(data: MemorandumPdfData) {
  const score = (value: string) => {
    const key = value.toLocaleLowerCase('de-DE');
    if (key.includes('projektstatus') || key.includes('project status')) return 1;
    if (key.includes('netzanschluss') || key.includes('grid connection')) return 2;
    if (key.includes('vergütung') || key.includes('feed-in')) return 3;
    if (key.includes('ertrag') || key.includes('yield')) return 4;
    return 5;
  };
  return data.highlights.filter(Boolean).sort((a, b) => score(a) - score(b)).slice(0, 4);
}

function checkIcon() {
  return `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3.2 8.2 6.4 11.2 12.9 4.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function renderMemorandumHtml(data: MemorandumPdfData, options: MemorandumRenderOptions): string {
  const c = copy(data.language);
  const hero = `<img src="${options.heroImage}" alt=""><div class="hero-scrim"></div>`;
  const logoWhite = options.logoWhiteDataUri
    ? `<img src="${options.logoWhiteDataUri}" alt="EMA">`
    : emaLogoSvg({ onDark: true, withWordmark: false });
  const kpis = buildKpis(data).map((item) => `<div class="kpi"><div class="k">${esc(item.label)}</div><div class="v${item.value.length > 13 ? ' compact' : ''}">${esc(item.value)}</div></div>`).join('');
  const profile = buildProfile(data).map((item) => `<div class="row"><span class="n">${esc(item.label)}</span><span class="v">${esc(item.value)}</span></div>`).join('');
  const highlights = orderedHighlights(data).map((item) => `<div class="memo-highlight"><span class="check">${checkIcon()}</span><span class="t">${esc(item)}</span></div>`).join('');
  const economics = data.pvEconomics;
  const capacity = buildKpis(data)[0];
  const pvKwp = capacity ? parseMetricNumber(capacity.value, data.language) : 0;
  const economicsRows = economics ? [
    economics.annualYield > 0 ? [c.annualProduction, `${nf(economics.annualYield, 0, data.language)} <small>kWh</small>`] : undefined,
    economics.annualRevenue > 0 ? [c.annualRevenue, money(economics.annualRevenue, data.language)] : undefined,
    economics.purchasePrice > 0 ? [c.purchasePrice, money(economics.purchasePrice, data.language)] : undefined,
    economics.purchasePrice > 0 && pvKwp > 0 ? [c.pricePerKwp, `${nf(economics.purchasePrice / pvKwp, 0, data.language)} <small>€/kWp</small>`] : undefined,
    economics.tariffEurKwh > 0 ? [c.tariff, `${nf(economics.tariffEurKwh, 3, data.language)} <small>€/kWh</small>`] : undefined,
    economics.roi > 0 ? [c.returnPa, `${nf(economics.roi, 2, data.language)} <small>%</small>`] : undefined,
    economics.amortisation > 0 ? [c.amortisation, `${nf(economics.amortisation, 1, data.language)} <small>${data.language === 'en' ? 'years' : 'Jahre'}</small>`] : undefined,
  ].filter((item): item is string[] => Boolean(item)) : [];
  const figures = economicsRows.map(([label, value]) => `<div class="fig-row"><span class="n">${esc(label)}</span><span class="v">${value}</span></div>`).join('');
  const projectPhoto = options.projectImage
    ? `<div class="memo-photo"><div class="frame"><img src="${options.projectImage}" alt="${esc(data.projectName)}"></div><div class="cap">${upper(c.projectView, data.language)} · ${upper(data.projectName, data.language)}</div></div>`
    : '';
  const german = isGermanCountry(data.country);
  const map = german ? buildGermanyMap(options.germanyMap, data.location) : '';
  const flagSvg = flag(data.country);
  const totalPages = data.dataCenterDetails || data.bessPortfolioDetails ? 2 : 1;
  const detailSections = data.dataCenterDetails?.sections.map((section, sectionIndex) => {
    const rows = section.rows.map((row) => {
      const state = row.value.toLocaleLowerCase('de-DE');
      const pending = state.includes('nicht bekannt') || state.includes('muss geprüft') || state.includes('nicht vorhanden') || state.includes('unknown') || state.includes('verification') || state.includes('not available');
      return `<div class="memo-detail-row"><span class="n">${esc(row.label)}</span><span class="v${pending ? ' pending' : ''}">${esc(row.value)}</span></div>`;
    }).join('');
    return `<div class="memo-detail-card${sectionIndex === 4 ? ' wide' : ''}"><h3><span></span>${esc(section.title)}</h3><div class="memo-detail-rows">${rows}</div></div>`;
  }).join('') ?? '';
  const detailPage = data.dataCenterDetails ? `
<section class="sheet memo-detail-sheet">
  <div class="page-head">
    <div class="brand"><div class="mark">${emaLogoSvg({ onDark: false, withWordmark: false })}</div><div class="t">${esc(c.siteData)}<span>${esc(data.projectName)}</span></div></div>
    <div class="doc">${esc(data.projectNumber)}<br>${data.dataCenterDetails.sourceDate ? `${data.language === 'en' ? 'Assessment' : 'Prüfstand'} ${esc(data.dataCenterDetails.sourceDate)}` : esc(data.dateLabel)}</div>
  </div>
  <div class="page-body">
    <div class="section-head"><div class="accent"></div><h2>${c.siteCheck}</h2><div class="sub">${esc(c.evidenceNote)}</div></div>
    <div class="memo-detail-grid">${detailSections}</div>
    <div class="memo-detail-note">${esc(c.dueDiligence)}</div>
  </div>
  <div class="page-foot"><div class="line"><div class="l"><b>EMA Enterprise GmbH</b> · Gabriel-von-Seidl-Str. 56 · 67550 Worms<br>${c.confidentiality}</div><div class="r">${esc(data.projectNumber)} · ${esc(data.dateLabel)}<br>${c.page} <span class="num">2</span> / 2</div></div></div>
</section>` : '';
  const portfolio = data.bessPortfolioDetails;
  const portfolioRows = portfolio?.sites.map((site) => `
    <div class="memo-portfolio-site">
      <div class="site-title"><div><b>${esc(site.name)}</b><span>${esc(site.state || data.country)}</span></div><div class="site-power">${site.mw !== null ? `${nf(site.mw, 2, data.language)} MW` : '—'}<span>${site.mwh !== null ? `${nf(site.mwh, 2, data.language)} MWh` : '—'}${site.durationH !== null ? ` · ${nf(site.durationH, 2, data.language)} h` : ''}</span></div></div>
      <div class="site-dd"><div><span>${c.grid}</span><b>${esc(site.gridStatus || (data.language === 'en' ? 'Unknown' : 'Nicht bekannt'))}</b></div><div><span>${c.land}</span><b>${esc(site.landStatus || (data.language === 'en' ? 'Unknown' : 'Nicht bekannt'))}</b></div><div><span>${c.permit}</span><b class="${/nicht|unknown|offen|open/i.test(site.permitStatus) ? 'pending' : ''}">${esc(site.permitStatus || (data.language === 'en' ? 'Unknown' : 'Nicht bekannt'))}</b></div></div>
    </div>`).join('') ?? '';
  const portfolioPage = portfolio ? `
<section class="sheet memo-detail-sheet memo-portfolio-sheet">
  <div class="page-head">
    <div class="brand"><div class="mark">${emaLogoSvg({ onDark: false, withWordmark: false })}</div><div class="t">${esc(c.portfolioData)}<span>${esc(data.projectName)}</span></div></div>
    <div class="doc">${esc(data.projectNumber)}<br>${esc(data.dateLabel)}</div>
  </div>
  <div class="page-body">
    <div class="section-head"><div class="accent"></div><h2>${c.portfolioOverview}</h2><div class="sub">${data.language === 'en' ? 'The portfolio is marketed as one package. Grid, land and permitting status remain subject to separate verification for each site.' : 'Das Portfolio wird als ein Paket vermarktet. Netzanschluss, Flächensicherung und Genehmigungen bleiben je Standort separat zu prüfen.'}</div></div>
    <div class="memo-portfolio-kpis"><div><span>${c.sites}</span><b>${portfolio.siteCount}</b></div><div><span>${c.power}</span><b>${nf(portfolio.totalMw, 2, data.language)} MW</b></div><div><span>${c.capacity}</span><b>${nf(portfolio.totalMwh, 2, data.language)} MWh</b></div><div><span>${c.duration}</span><b>${portfolio.averageDurationH !== null ? `${nf(portfolio.averageDurationH, 2, data.language)} h` : '—'}</b></div></div>
    <div class="memo-portfolio-list">${portfolioRows}</div>
    <div class="memo-detail-note">${data.language === 'en' ? 'Important: The information is based on documents provided by the project partner and does not constitute a guarantee, valuation or investment recommendation. All assumptions must be confirmed during technical, legal, tax and financial due diligence.' : 'Wichtig: Die Angaben basieren auf den vom Projektpartner bereitgestellten Unterlagen und stellen weder eine Garantie noch eine Bewertung oder Anlageempfehlung dar. Sämtliche Annahmen sind im Rahmen der technischen, rechtlichen, steuerlichen und wirtschaftlichen Due Diligence zu bestätigen.'}</div>
  </div>
  <div class="page-foot"><div class="line"><div class="l"><b>EMA Enterprise GmbH</b> · Gabriel-von-Seidl-Str. 56 · 67550 Worms<br>${c.confidentiality}</div><div class="r">${esc(data.projectNumber)} · ${esc(data.dateLabel)}<br>${c.page} <span class="num">2</span> / 2</div></div></div>
</section>` : '';

  return `<!doctype html>
<html lang="${data.language === 'en' ? 'en' : 'de'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.projectName)} – Exposé</title><style>${options.fontFaceCss}${styles}${memorandumStyles}</style></head>
<body>
<section class="sheet memo-sheet ${options.projectImage ? 'has-photo' : 'no-photo'}">
  <div class="cover-hero memo-hero">
    ${hero}
    <div class="layer">
      <div class="cover-top">
        <div class="cover-brand"><div class="mk">${logoWhite}</div><div class="wd">EMA<span>ENTERPRISE GmbH</span></div></div>
        <div class="chip"><span class="dot"></span>${c.confidential}</div>
      </div>
      <div class="cover-title">
        <div class="cover-eyebrow">${c.eyebrow} · ${esc(data.typeLabel)}</div>
        <h1>${esc(data.projectName)}</h1>
        <div class="cover-rule"></div>
        <div class="cover-sub">${flagSvg ? `<span class="flag">${flagSvg}</span>` : ''}${esc(data.location)} · ${esc(data.country)}${data.status ? ` · ${esc(data.status)}` : ''}</div>
        <div class="memo-docid">${esc(data.projectNumber)}</div>
      </div>
    </div>
  </div>

  <div class="memo-kpis">${kpis}</div>

  <div class="memo-body">
    <div class="memo-col">
      <div><div class="memo-head"><span class="dot"></span><h3>${c.executive}</h3></div><p class="memo-summary">${esc(data.summary)}</p></div>
      ${projectPhoto}
      <div><div class="memo-head"><span class="dot"></span><h3>${c.location}</h3></div><div class="memo-map-card">${map ? `<div class="map">${map}</div>` : ''}<div class="loc"><b>${esc(data.location)}</b><br>${esc(data.country)}<div class="hint">${c.mapHint}</div></div></div></div>
    </div>
    <div class="memo-col">
      <div><div class="memo-head"><span class="dot"></span><h3>${c.profile}</h3></div><div class="memo-profile">${profile}</div></div>
      <div><div class="memo-head"><span class="dot"></span><h3>${c.highlights}</h3></div><div class="memo-highlights">${highlights}</div></div>
      ${figures ? `<div><div class="memo-head"><span class="dot"></span><h3>${c.economics}</h3></div><div class="memo-figures">${figures}</div></div>` : ''}
    </div>
  </div>

  <div class="page-foot"><div class="line"><div class="l"><b>EMA Enterprise GmbH</b> · Gabriel-von-Seidl-Str. 56 · 67550 Worms<br>${c.confidentiality}</div><div class="r">${esc(data.projectNumber)} · ${esc(data.dateLabel)}<br>${c.page} <span class="num">1</span> / ${totalPages}</div></div></div>
</section>
${detailPage}
${portfolioPage}
</body></html>`;
}
