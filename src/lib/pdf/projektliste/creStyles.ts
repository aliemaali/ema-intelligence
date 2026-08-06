/**
 * Zusatz-CSS ausschließlich für die Seite „CRE Market Intelligence".
 *
 * `styles.ts` bleibt unverändert (Vorgabe DESIGN-SPEC Abschnitt 0). Hier stehen
 * nur neue Klassen; sie verwenden dieselben Tokens, Radien, Linienstärken,
 * Schriftgrößen und Abstände wie das Grundlayout. Es wird keine bestehende
 * Regel überschrieben – einzige Ausnahme ist `.kpi-row.four`, das die
 * Spaltenzahl der Kachelreihe von drei auf vier setzt; Kachel-Chrome
 * (Rahmen, Radius, Verlauf, grüne Kante, Typografie) bleibt identisch.
 */
export const creStyles = `
/* Hero der Analyseseite: identischer Aufbau wie das Cover (Scrim, Marken-
   Lockup, Titelblock, grüne Regel, Flagge), reduzierte Bauhöhe. Ein
   Cover-Hero von 128 mm lässt neben Kachelreihe, Diagramm, Karte, Insight
   und Quellenangabe keine 297 mm Seitenhöhe übrig – gemessen, nicht
   geschätzt. Wert zentral hier, damit er an einer Stelle änderbar bleibt. */
.cre-hero{height:92mm;flex:0 0 92mm;}

/* Kachelreihe mit vier statt drei Karten – identisches Kartenlayout */
.kpi-row.four{grid-template-columns:repeat(4,1fr);gap:3.5mm;padding-top:6.5mm;}
.kpi-row.four .kpi{padding:4.4mm 4.2mm 4mm;}
.kpi-row.four .kpi .v{font-size:20pt;}
.kpi-row.four .kpi .v small{font-size:9.5pt;}
.kpi-row.four .kpi .s{font-size:6.5pt;line-height:1.35;}
.kpi-row.four .kpi .v.assess{font-size:10.5pt;display:flex;align-items:center;gap:1.8mm;line-height:1.2;white-space:nowrap;}
.kpi-row.four .kpi .v.assess .dot{width:2.4mm;height:2.4mm;border-radius:50%;background:var(--green);flex:0 0 auto;}

/* Dokument-ID im Cover-Kopf, Darstellung wie .page-head .doc, nur negativ */
.cover-top .cover-id{display:flex;flex-direction:column;align-items:flex-end;gap:2.4mm;}
.cover-top .cover-id .doc{font-size:6.6pt;color:rgba(255,255,255,.72);letter-spacing:.1em;text-transform:uppercase;text-align:right;}

/* Inhaltsspalte unterhalb der Kachelreihe – Pendant zu .page-body */
.cre-body{flex:1;padding:0 var(--pad);display:flex;flex-direction:column;min-height:0;}
.cre-cols{grid-template-columns:1.85fr 1fr;margin-top:4mm;}
/* Karte etwas kleiner als die Spaltenbreite, damit Karte und Diagramm gleich hoch werden */
.cre-cols .map-frame svg{width:92%;margin:0 auto;}

/* Liniendiagramm */
.chart{margin-top:.6mm;}
.chart svg{width:100%;height:auto;display:block;}
.chart-foot{margin-top:2.4mm;padding-top:2.2mm;border-top:.25mm solid var(--line);display:flex;justify-content:space-between;font-size:6.4pt;color:var(--muted);}
.chart-foot b{color:var(--navy);font-weight:600;font-variant-numeric:tabular-nums;}

/* Kartenlegende – Aufbau wie .legend, kompaktere Zeilenhöhe */
.cre-legend{margin-top:2.6mm;display:flex;flex-direction:column;gap:1.1mm;}
.cre-legend .li{display:flex;align-items:center;gap:2.2mm;font-size:6.4pt;}
.cre-legend .sw{width:2.4mm;height:2.4mm;border-radius:.6mm;flex:0 0 auto;}
.cre-legend .nm{flex:1;color:#2E3850;}
.cre-legend .vl{font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;}
.cre-legend .marker{width:2.4mm;height:2.4mm;border-radius:50%;background:var(--green);flex:0 0 auto;}

/* Agri-PV-Block (Cas 2 bis) unterhalb des Diagramms */
.cas-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3.2mm;margin-top:3.2mm;}
.cas-item{border-left:.7mm solid var(--line);padding-left:2.8mm;}
.cas-item.hi{border-left-color:var(--green);}
.cas-item .k{font-size:6.1pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);line-height:1.3;}
.cas-item .v{font-size:10.5pt;font-weight:700;color:var(--navy);margin-top:.8mm;font-variant-numeric:tabular-nums;}
.cas-item .v small{font-size:7pt;font-weight:600;color:var(--navy-700);margin-left:.6mm;}
.cas-item .s{font-size:6.3pt;color:var(--muted);margin-top:.6mm;line-height:1.4;}

/* Market Insight – Aufbau wie .exec .pull */
.insight{margin-top:3.6mm;border-left:1.1mm solid var(--green);padding:1.4mm 0 1.4mm 4.5mm;}
.insight .k{font-size:6.4pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:1.6mm;}
.insight p{font-size:7.5pt;line-height:1.5;color:#333C52;}
.insight p b{color:var(--navy);font-weight:600;}

.cre-note{margin-top:2.8mm;font-size:5.9pt;color:var(--muted);line-height:1.45;}
.cre-note b{color:var(--navy);font-weight:600;}
`;
