import { mapEmaProjects, type EmaProjectRecord } from './mapEmaProjects';
import type { ProjektlisteInput } from './types';

/**
 * Rohsätze in der Form, wie sie die echte EMA-Projektliste liefert:
 * ohne permit, ohne Koordinaten, Struktur teilweise als Freitext,
 * einzelne Felder leer. Dient ausschließlich dem Nachweis, dass das
 * Layout auch bei unvollständiger Datenlage sauber rendert.
 */
const raw: EmaProjectRecord[] = [
  { externalNumber: 'FR-001', region: 'Occitanie', projectName: 'Narbonne Est', pvKwp: 48500, gridDistanceKm: 2.4, securedLandHa: 58, structure: 'Share Deal', permissionDate: '2025-11-14', commissioning: '2027-04-01', specificYield: 1480 },
  { externalNumber: 'FR-002', region: 'Occitanie', projectName: 'Toulouse Nord', pvKwp: 35100, gridDistanceKm: 4.1, securedLandHa: 42.5, structure: 'share deal', permissionDate: '2026-01-09', commissioning: 'Q3 2027', specificYield: 1395 },
  { externalNumber: 'FR-003', region: 'Occitanie', projectName: 'Béziers Sud', pvKwp: 32000, gridDistanceKm: 1.8, securedLandHa: 38.4, structure: 'Anteilsverkauf möglich', commissioning: '2027-10-01', specificYield: 1465 },
  { externalNumber: 'FR-004', region: 'Occitanie', projectName: 'Carcassonne Ouest', pvKwp: 24800, gridDistanceKm: 6.2, securedLandHa: 30.1, structure: 'Asset Deal', commissioning: '2028-01-15' },
  { externalNumber: 'FR-005', region: 'Occitanie', projectName: 'Nîmes Garrigues', pvKwp: 18400, securedLandHa: 22.6, structure: 'Asset Deal', commissioning: 'Q2 2028', specificYield: 1455 },
  { externalNumber: 'FR-006', region: 'Nouvelle-Aquitaine', projectName: 'Bordeaux Médoc', pvKwp: 56200, gridDistanceKm: 3.7, securedLandHa: 68.9, structure: 'Share Deal', commissioning: '2027-02-01', specificYield: 1330 },
  { externalNumber: 'FR-007', region: 'Nouvelle-Aquitaine', projectName: 'Mont-de-Marsan', pvKwp: 41000, gridDistanceKm: 5.5, securedLandHa: 49.7, structure: 'n. n.', commissioning: '2027-08-01', specificYield: 1385 },
  { externalNumber: 'FR-008', region: 'Nouvelle-Aquitaine', projectName: 'Angoulême Nord', pvKwp: 27600, gridDistanceKm: 2.9, structure: 'Asset Deal', commissioning: 'Q4 2027', specificYield: 1305 },
  { externalNumber: 'FR-009', region: 'Nouvelle-Aquitaine', projectName: 'Limoges Est', pvKwp: 15900, gridDistanceKm: 8.4, securedLandHa: 19.8, commissioning: '2028-05-01' },
  { externalNumber: 'FR-010', region: "Provence-Alpes-Côte d'Azur", projectName: 'Manosque Plateau', pvKwp: 38700, gridDistanceKm: 2.1, securedLandHa: 45.2, structure: 'Share Deal', commissioning: '2027-05-01', specificYield: 1520 },
  { externalNumber: 'FR-011', region: "Provence-Alpes-Côte d'Azur", projectName: 'Aix Nord', pvKwp: 22300, gridDistanceKm: 3.6, securedLandHa: 26.4, structure: 'Share Deal', commissioning: 'Q3 2027', specificYield: 1505 },
  { externalNumber: 'FR-012', region: "Provence-Alpes-Côte d'Azur", projectName: 'Avignon Sud', pvKwp: 12600, securedLandHa: 15.1, commissioning: '2028-02-01', specificYield: 1495 },
  { externalNumber: 'FR-013', region: 'Auvergne-Rhône-Alpes', projectName: 'Valence Rhône', pvKwp: 29400, gridDistanceKm: 2.7, securedLandHa: 35.3, structure: 'Share Deal', commissioning: '2027-11-01', specificYield: 1420 },
  { externalNumber: 'FR-014', region: 'Auvergne-Rhône-Alpes', projectName: 'Montélimar Ouest', pvKwp: 19800, gridDistanceKm: 4.4, securedLandHa: 24, structure: 'Asset Deal', commissioning: 'Q2 2028', specificYield: 1435 },
  { externalNumber: 'FR-015', region: 'Centre-Val de Loire', projectName: 'Bourges Sud', pvKwp: 33500, gridDistanceKm: 3.1, securedLandHa: 40.9, commissioning: '2027-09-01', specificYield: 1265 },
  { externalNumber: 'FR-016', region: 'Centre-Val de Loire', projectName: 'Châteauroux Nord', pvKwp: 21200, gridDistanceKm: 5.9, securedLandHa: 26.1, structure: 'Asset Deal', commissioning: 'Q1 2028' },
  { externalNumber: 'FR-017', region: 'Grand Est', projectName: 'Châlons Plaine', pvKwp: 26700, gridDistanceKm: 4.6, securedLandHa: 32.8, structure: 'Share Deal', commissioning: '2027-12-01', specificYield: 1185 },
  { externalNumber: 'FR-018', region: 'Grand Est', projectName: 'Troyes Est', pvKwp: 17300, gridDistanceKm: 6.8, securedLandHa: 21.4, commissioning: 'Q3 2028', specificYield: 1195 },
  { externalNumber: 'FR-019', region: 'Bourgogne-Franche-Comté', projectName: 'Dijon Sud', pvKwp: 23900, gridDistanceKm: 3.4, securedLandHa: 29.2, structure: 'Share Deal', commissioning: '2028-03-01', specificYield: 1225 },
  { externalNumber: 'FR-020', region: 'Pays de la Loire', projectName: 'Le Mans Ouest', pvKwp: 20500, gridDistanceKm: 5.2, securedLandHa: 25.6, structure: 'Asset Deal', commissioning: 'Q2 2028', specificYield: 1210 },
  { region: '', projectName: 'unvollständiger Satz', pvKwp: null },
];

export const emaMapping = mapEmaProjects(raw);

export const emaSampleInput: ProjektlisteInput = {
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
  projects: emaMapping.rows,
};
