import type { ProjektlisteInput, ProjectRow } from './types';

const projects: ProjectRow[] = [
  { region: 'Occitanie', name: 'Narbonne Est', capacityMwc: 48.5, gridDistanceKm: 2.4, areaHa: 58.0, structure: 'Share Deal', permit: 'PC erteilt · purgé', cod: 'Q2 2027', specificYield: 1480, lat: 43.19, lon: 3.05 },
  { region: 'Occitanie', name: 'Toulouse Nord', capacityMwc: 35.1, gridDistanceKm: 4.1, areaHa: 42.5, structure: 'Share Deal', permit: 'PC erteilt · purgé', cod: 'Q3 2027', specificYield: 1395, lat: 43.72, lon: 1.41 },
  { region: 'Occitanie', name: 'Béziers Sud', capacityMwc: 32.0, gridDistanceKm: 1.8, areaHa: 38.4, structure: 'Share Deal', permit: 'PC erteilt', cod: 'Q4 2027', specificYield: 1465, lat: 43.31, lon: 3.24 },
  { region: 'Occitanie', name: 'Carcassonne Ouest', capacityMwc: 24.8, gridDistanceKm: 6.2, areaHa: 30.1, structure: 'Asset Deal', permit: 'PC eingereicht', cod: 'Q1 2028', specificYield: 1440, lat: 43.21, lon: 2.24 },
  { region: 'Occitanie', name: 'Nîmes Garrigues', capacityMwc: 18.4, gridDistanceKm: 3.3, areaHa: 22.6, structure: 'Asset Deal', permit: 'PC eingereicht', cod: 'Q2 2028', specificYield: 1455, lat: 43.86, lon: 4.32 },
  { region: 'Nouvelle-Aquitaine', name: 'Bordeaux Médoc', capacityMwc: 56.2, gridDistanceKm: 3.7, areaHa: 68.9, structure: 'Share Deal', permit: 'PC erteilt · purgé', cod: 'Q1 2027', specificYield: 1330, lat: 45.05, lon: -0.79 },
  { region: 'Nouvelle-Aquitaine', name: 'Mont-de-Marsan', capacityMwc: 41.0, gridDistanceKm: 5.5, areaHa: 49.7, structure: 'Share Deal', permit: 'PC erteilt', cod: 'Q3 2027', specificYield: 1385, lat: 43.89, lon: -0.50 },
  { region: 'Nouvelle-Aquitaine', name: 'Angoulême Nord', capacityMwc: 27.6, gridDistanceKm: 2.9, areaHa: 33.8, structure: 'Asset Deal', permit: 'PC erteilt', cod: 'Q4 2027', specificYield: 1305, lat: 45.72, lon: 0.15 },
  { region: 'Nouvelle-Aquitaine', name: 'Limoges Est', capacityMwc: 15.9, gridDistanceKm: 8.4, areaHa: 19.8, structure: 'Asset Deal', permit: 'PC eingereicht', cod: 'Q2 2028', specificYield: 1270, lat: 45.86, lon: 1.36 },
  { region: 'Nouvelle-Aquitaine', name: 'Poitiers Sud', capacityMwc: 14.2, gridDistanceKm: 4.8, areaHa: 17.9, structure: 'Asset Deal', permit: 'PC in Vorbereitung', cod: 'Q4 2028', specificYield: 1290, lat: 46.51, lon: 0.34 },
  { region: "Provence-Alpes-Côte d'Azur", name: 'Manosque Plateau', capacityMwc: 38.7, gridDistanceKm: 2.1, areaHa: 45.2, structure: 'Share Deal', permit: 'PC erteilt · purgé', cod: 'Q2 2027', specificYield: 1520, lat: 43.83, lon: 5.79 },
  { region: "Provence-Alpes-Côte d'Azur", name: 'Aix Nord', capacityMwc: 22.3, gridDistanceKm: 3.6, areaHa: 26.4, structure: 'Share Deal', permit: 'PC erteilt', cod: 'Q3 2027', specificYield: 1505, lat: 43.61, lon: 5.44 },
  { region: "Provence-Alpes-Côte d'Azur", name: 'Avignon Sud', capacityMwc: 12.6, gridDistanceKm: 1.5, areaHa: 15.1, structure: 'Asset Deal', permit: 'PC erteilt', cod: 'Q1 2028', specificYield: 1495, lat: 43.88, lon: 4.85 },
  { region: "Provence-Alpes-Côte d'Azur", name: 'Digne Vallée', capacityMwc: 9.8, gridDistanceKm: 7.9, areaHa: 12.7, structure: 'Asset Deal', permit: 'PC in Vorbereitung', cod: 'Q3 2028', specificYield: 1510, lat: 44.09, lon: 6.24 },
  { region: 'Auvergne-Rhône-Alpes', name: 'Valence Rhône', capacityMwc: 29.4, gridDistanceKm: 2.7, areaHa: 35.3, structure: 'Share Deal', permit: 'PC erteilt · purgé', cod: 'Q4 2027', specificYield: 1420, lat: 44.93, lon: 4.89 },
  { region: 'Auvergne-Rhône-Alpes', name: 'Montélimar Ouest', capacityMwc: 19.8, gridDistanceKm: 4.4, areaHa: 24.0, structure: 'Asset Deal', permit: 'PC eingereicht', cod: 'Q2 2028', specificYield: 1435, lat: 44.56, lon: 4.72 },
  { region: 'Centre-Val de Loire', name: 'Bourges Sud', capacityMwc: 33.5, gridDistanceKm: 3.1, areaHa: 40.9, structure: 'Share Deal', permit: 'PC erteilt', cod: 'Q3 2027', specificYield: 1265, lat: 47.02, lon: 2.40 },
  { region: 'Centre-Val de Loire', name: 'Châteauroux Nord', capacityMwc: 21.2, gridDistanceKm: 5.9, areaHa: 26.1, structure: 'Asset Deal', permit: 'PC eingereicht', cod: 'Q1 2028', specificYield: 1255, lat: 46.86, lon: 1.69 },
  { region: 'Grand Est', name: 'Châlons Plaine', capacityMwc: 26.7, gridDistanceKm: 4.6, areaHa: 32.8, structure: 'Share Deal', permit: 'PC erteilt', cod: 'Q4 2027', specificYield: 1185, lat: 48.96, lon: 4.36 },
  { region: 'Grand Est', name: 'Troyes Est', capacityMwc: 17.3, gridDistanceKm: 6.8, areaHa: 21.4, structure: 'Asset Deal', permit: 'PC in Vorbereitung', cod: 'Q3 2028', specificYield: 1195, lat: 48.30, lon: 4.15 },
  { region: 'Bourgogne-Franche-Comté', name: 'Dijon Sud', capacityMwc: 23.9, gridDistanceKm: 3.4, areaHa: 29.2, structure: 'Share Deal', permit: 'PC erteilt', cod: 'Q1 2028', specificYield: 1225, lat: 47.27, lon: 5.02 },
  { region: 'Pays de la Loire', name: 'Le Mans Ouest', capacityMwc: 20.5, gridDistanceKm: 5.2, areaHa: 25.6, structure: 'Asset Deal', permit: 'PC eingereicht', cod: 'Q2 2028', specificYield: 1210, lat: 48.00, lon: 0.16 },
];

export const sampleInput: ProjektlisteInput = {
  meta: {
    title: 'Projektliste',
    subtitle: 'Frankreich – Utility Scale PV',
    documentId: 'EMA-PL-FR-2026-014',
    createdAt: '2026-08-05',
    country: 'Frankreich',
    countryCode: 'FR',
    confidentialityNote:
      'Vertraulich · ausschließlich zur Prüfung durch den benannten Empfänger · kein öffentliches Angebot',
  },
  projects,
};
