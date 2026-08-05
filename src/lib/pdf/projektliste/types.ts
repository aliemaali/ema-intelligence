export type PermitStatus =
  | 'PC erteilt · purgé'
  | 'PC erteilt'
  | 'PC eingereicht'
  | 'PC in Vorbereitung';

export type DealStructure = 'Share Deal' | 'Asset Deal';

export interface ProjectRow {
  /** laufende Nummer, wird beim Rendern vergeben */
  no?: number;
  region: string;
  name: string;
  /** MWc (DC) */
  capacityMwc: number;
  /** Distanz zum Netzverknüpfungspunkt in km – optional */
  gridDistanceKm?: number;
  /** Fläche in ha – optional */
  areaHa?: number;
  /** optional – wird in der echten Liste nicht zuverlässig geliefert */
  structure?: DealStructure;
  /** optional – NIE aus permissionDate abgeleitet */
  permit?: PermitStatus;
  /** Ziel-Inbetriebnahme, z. B. "Q3 2027" */
  cod: string;
  /** spezifischer Ertrag in kWh/kWc, optional */
  specificYield?: number;
  /** WGS84 für die Kartenmarker – optional; ohne Koordinaten entfällt der Marker */
  lat?: number;
  lon?: number;
}

export interface DocumentMeta {
  title: string;
  subtitle: string;
  documentId: string;
  /** ISO-Datum */
  createdAt: string;
  country: string;
  countryCode: 'FR';
  confidentialityNote: string;
}

export interface ProjektlisteInput {
  meta: DocumentMeta;
  projects: ProjectRow[];
  /** optionale URL/Data-URI eines lizenzierten Hero-Fotos; ohne Angabe greift das EMA-Coverpanel */
  heroImage?: string;
}
