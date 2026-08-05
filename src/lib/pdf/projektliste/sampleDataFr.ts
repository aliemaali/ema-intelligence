import { mapFrenchList } from './mapFrenchList';
import { frenchListRaw } from './frenchListRaw';
import type { ProjektlisteInput } from './types';

export const frMapping = mapFrenchList(frenchListRaw, new Date('2026-08-05'));

export const frInput: ProjektlisteInput = {
  meta: {
    title: 'Projektliste',
    subtitle: 'Frankreich – Agri-PV & Freifläche',
    documentId: 'EMA-PL-FR-2026-014',
    createdAt: '2026-08-05',
    country: 'Frankreich',
    countryCode: 'FR',
    confidentialityNote:
      'Vertraulich · ausschließlich zur Prüfung durch den benannten Empfänger · kein öffentliches Angebot',
  },
  projects: frMapping.rows,
};
