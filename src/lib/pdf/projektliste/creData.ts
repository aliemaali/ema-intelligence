/**
 * Offizielle Ergebnisse des Appel d'offres PPE2 « Centrales au sol » (AO PPE2 PV Sol).
 *
 * QUELLE: ausschließlich die Rapports de synthèse der Commission de régulation
 * de l'énergie (CRE). Jeder Wert ist unten mit Délibérationsnummer und Datum
 * belegt. Keine Presse-, Blog- oder Drittanbieterwerte, keine Interpolation,
 * keine Schätzung.
 *
 * Stand: 06.08.2026. Die 9. Periode (Einreichungsschluss 31.07.2026) ist zu
 * diesem Zeitpunkt NICHT veröffentlicht – weder Délibération noch Rapport de
 * synthèse liegen vor. Sie wird deshalb bewusst nicht dargestellt. Sobald die
 * CRE die Ergebnisse veröffentlicht, wird hier ein Eintrag ergänzt und der
 * älteste (3. Periode) entfernt, damit die Reihe sechs Perioden umfasst.
 */

export interface CrePeriod {
  /** Nummer der Ausschreibungsperiode */
  period: number;
  /** Ende der Angebotsfrist, TT.MM.JJJJ */
  closed: string;
  /** Veröffentlichung der CRE-Délibération / des Rapport de synthèse */
  published: string;
  /** Aktenzeichen der Délibération */
  deliberation: string;
  /** gewichteter durchschnittlicher Zuschlagswert der von der CRE zur
   *  Bezuschlagung vorgeschlagenen Dossiers, in €/MWh (Referenzpreis T0) */
  priceEurMwh: number;
  /** bezuschlagte Leistung in MWc */
  awardedMwc: number;
  /** Anzahl der bezuschlagten Dossiers */
  awardedCount: number;
  /** ausgeschriebene Leistung der Periode in MWc */
  calledMwc: number;
}

/** Die sechs zuletzt offiziell abgeschlossenen und veröffentlichten Perioden. */
export const crePeriods: CrePeriod[] = [
  { period: 3, closed: '23.12.2022', published: '23.02.2023', deliberation: '2023-60',  priceEurMwh: 82.23, awardedMwc: 115.03,   awardedCount: 7,   calledMwc: 925 },
  { period: 4, closed: '07.07.2023', published: '31.08.2023', deliberation: '2023-217', priceEurMwh: 82.42, awardedMwc: 1518.97,  awardedCount: 129, calledMwc: 1500 },
  { period: 5, closed: '15.12.2023', published: '01.02.2024', deliberation: '2024-26',  priceEurMwh: 81.90, awardedMwc: 911.53,   awardedCount: 92,  calledMwc: 925 },
  { period: 6, closed: '30.08.2024', published: '10.10.2024', deliberation: '2024-184', priceEurMwh: 79.28, awardedMwc: 948.31,   awardedCount: 120, calledMwc: 925 },
  { period: 7, closed: '20.12.2024', published: '06.02.2025', deliberation: '2025-46',  priceEurMwh: 79.09, awardedMwc: 887.46,   awardedCount: 103, calledMwc: 925 },
  { period: 8, closed: '13.06.2025', published: '29.07.2025', deliberation: '2025-205', priceEurMwh: 79.48, awardedMwc: 971.02,   awardedCount: 165, calledMwc: 925 },
];

/**
 * Kennzahlen der jüngsten veröffentlichten Periode, die über die Reihe oben
 * hinausgehen. Alle Werte aus Rapport de synthèse 2025-205 vom 29.07.2025.
 */
export const creLatest = {
  period: 8,
  /** konforme Dossiers unter dem Preisdeckel */
  conformCount: 222,
  /** deren kumulierte Leistung in MWc */
  conformMwc: 1616.36,
  /** eingereichte Dossiers ohne Doubletten und Leerumschläge */
  submittedCount: 267,
  submittedMwc: 1935.67,
  /** Veränderung des gewichteten Zuschlagswerts ggü. der Vorperiode in €/MWh */
  priceDeltaEurMwh: 0.39,
  /** mittlere installierte Leistung der bezuschlagten Dossiers in MWc */
  avgProjectMwc: 5.88,
  /** mittleres Produktible der bezuschlagten Dossiers in Volllaststunden */
  fullLoadHours: 1230,
};

/**
 * Cas 2 bis = Projekte auf landwirtschaftlichen Flächen (Agri-PV).
 * Der Cahier des charges begrenzt das bezuschlagbare Volumen je Periode auf
 * 250 MWc. Werte aus den Rapports 2024-184 (6. P.) und 2025-205 (8. P.).
 */
export const creCas2bis = {
  capMwc: 250,
  /** 8. Periode */
  p8: {
    conformCount: 57,
    conformMwc: 786.52,
    awardedCount: 24,
    awardedMwc: 231.98,
    priceEurMwh: 73.19,
    /** allein wegen der Mengenbegrenzung eliminiert */
    cappedOutCount: 33,
    cappedOutMwc: 554.54,
  },
  /** Vergleichswert 6. Periode, gewichteter Zuschlagswert Cas 2 bis */
  p6PriceEurMwh: 74.78,
};

/**
 * Regionale Verteilung der in der 8. Periode bezuschlagten Leistung.
 * Rapport 2025-205, Abschnitt 2.6 – Angabe der CRE in Prozent der kumulierten
 * Leistung. Die CRE veröffentlicht keine MWc je Region; es wird daher
 * ausschließlich der Prozentwert und die Dossieranzahl dargestellt.
 *
 * Regionsnamen in der Schreibweise des GeoJSON, damit die Einfärbung greift.
 */
export interface CreRegionShare {
  region: string;
  /** Anteil an der bezuschlagten Leistung, 0–1 */
  share: number;
  /** Anzahl bezuschlagter Dossiers */
  count: number;
}

export const creRegions: CreRegionShare[] = [
  { region: 'Centre-Val de Loire', share: 0.22, count: 32 },
  { region: 'Nouvelle-Aquitaine', share: 0.18, count: 34 },
  { region: 'Grand Est', share: 0.14, count: 12 },
  { region: 'Bourgogne-Franche-Comté', share: 0.14, count: 15 },
  { region: 'Occitanie', share: 0.12, count: 25 },
  { region: 'Auvergne-Rhône-Alpes', share: 0.11, count: 27 },
  { region: 'Pays de la Loire', share: 0.04, count: 7 },
  { region: 'Bretagne', share: 0.02, count: 5 },
  { region: 'Normandie', share: 0.01, count: 2 },
  { region: 'Île-de-France', share: 0.01, count: 1 },
  { region: "Provence-Alpes-Côte d'Azur", share: 0.01, count: 3 },
  { region: 'Hauts-de-France', share: 0.0, count: 2 },
];

/** Belegstellen für die Quellenzeile am Seitenfuß. */
export const creSources = crePeriods.map(
  (p) => `${p.period}. Periode (Dél. ${p.deliberation}, ${p.published})`,
);
