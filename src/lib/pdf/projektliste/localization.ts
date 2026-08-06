import type { ProjectListLanguage } from './types';

const englishReplacements: Array<[string, string]> = [
  ['lang="de"', 'lang="en"'], ['Vertraulich', 'Confidential'], ['Seite ', 'Page '],
  ['Portfolio-Übersicht', 'Portfolio overview'], ['Projektübersicht', 'Project overview'],
  ['Portfolio-Analyse', 'Portfolio analysis'], ['Marktanalyse · Ausschreibungsergebnisse', 'Market analysis · tender results'],
  ['Frankreich · Marktumfeld &amp; Ausschreibungsanalyse 2026', 'France · market environment &amp; tender analysis 2026'],
  ['Letzte CRE-Runde', 'Latest CRE round'], ['Periode', 'period'], ['Frist', 'Deadline'], ['Ergebnis', 'Result'],
  ['Ø Zuschlagswert', 'Ø awarded price'], ['gewichtetes Mittel', 'weighted average'], ['ggü.', 'vs.'],
  ['Zuschlagsvolumen', 'Awarded volume'], ['Projekte', 'projects'], ['Projekt', 'project'], ['ausgeschrieben', 'tendered'],
  ['Markteinschätzung', 'Market assessment'], ['Sehr attraktiv', 'Very attractive'], ['fach überzeichnet', 'x oversubscribed'],
  ['Vergütung der letzten sechs CRE-Ausschreibungen', 'Remuneration in the last six CRE tenders'],
  ['Gewichteter durchschnittlicher Zuschlagswert der bezuschlagten Dossiers', 'Weighted average awarded price of successful applications'],
  ['Spanne', 'Range'], ['Bezuschlagt insgesamt', 'Total awarded'], ['Agri-PV · Cas 2 bis', 'Agrivoltaics · Case 2 bis'],
  ['unter dem Gesamtschnitt', 'below the overall average'], ['Konform eingereicht', 'Compliant submissions'],
  ['Dossiers auf', 'applications against'], ['Periodendeckel', 'period cap'], ['Deckelbedingt eliminiert', 'Excluded due to cap'],
  ['der konformen Agri-PV-Leistung', 'of compliant agrivoltaic capacity'], ['Regionale Schwerpunkte', 'Regional focus'],
  ['EMA-Projektstandorte', 'EMA project locations'], ['Quelle:', 'Source:'],
  ['Projektstandorte · Markergröße nach Leistung', 'Project locations · marker size by capacity'],
  ['Regionen mit Projektbestand · Einfärbung nach Leistungsanteil', 'Regions with projects · colour by capacity share'],
  ['Projektliste', 'Project list'], ['Dokument-ID', 'Document ID'], ['Erstellungsdatum', 'Creation date'],
  ['Land', 'Country'], ['Technologie', 'Technology'], ['Gesamtleistung', 'Total capacity'],
  ['Einzelvorhaben in der Liste', 'Individual assets in the list'], ['beantragte Leistung', 'requested capacity'],
  ['Regionen', 'regions'], ['führend mit', 'leading with'], ['Fortsetzung', 'continued'], ['Stand', 'as of'],
  ['Département', 'Department'], ['Leistung', 'Capacity'], ['beantragt', 'requested'], ['Netz', 'Grid'],
  ['Fläche', 'Area'], ['Anlagentyp', 'Technology'], ['PC-Datum', 'Permit date'], ['IBN', 'COD'], ['Ziel', 'Target'],
  ['Ertrag', 'Yield'], ['Summe Portfolio', 'Portfolio total'], ['Zwischensumme', 'Subtotal'],
  ['Alle Kennzahlen berechnet aus den', 'All metrics calculated from the'], ['gelisteten projects', 'listed projects'],
  ['Ø Capacity', 'Ø capacity'], ['Größtes project', 'Largest project'], ['Kleinstes project', 'Smallest project'],
  ['Regionale Leistungsverteilung', 'Regional capacity distribution'], ['Leistungsklassen', 'Capacity classes'],
  ['Anteil an der Total capacity', 'Share of total capacity'], ['Genehmigungsstatus', 'Permit status'],
  ['Genehmigungsreife', 'Permit maturity'], ['Transaktionsstruktur', 'Transaction structure'],
  ['Inbetriebnahme', 'Commissioning'], ['nach Zieljahr', 'by target year'], ['Kennzahlen', 'Key figures'],
  ['Projektgröße', 'project size'], ['Nächste Schritte', 'Next steps'], ['NDA zeichnen', 'Execute NDA'],
  ['Shortlist festlegen', 'Define shortlist'], ['Datenraum und Prüfung', 'Data room and review'],
  ['Indikatives Angebot', 'Indicative offer'], ['Geschäftsführer', 'Managing Director'], ['n. v.', 'n/a'],
];

export function localizeProjectListHtml(html: string, language: ProjectListLanguage): string {
  if (language === 'de') return html;
  return englishReplacements.reduce((value, [source, target]) => value.replaceAll(source, target), html);
}

