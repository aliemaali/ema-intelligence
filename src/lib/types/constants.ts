import type {
  ProjectType,
  ProjectStatus,
  ProjectPriority,
  MarketingStatus,
  DealStatus,
  DocumentType,
  TaskStatus,
  TaskPriority,
  ActivityType,
  CommissionStatus,
} from './database.types'

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  pv_freiflaeche: 'PV Freifläche',
  pv_dach: 'PV Dach',
  bess: 'BESS',
  hybrid: 'Hybrid',
  wind: 'Wind',
  rechenzentrum: 'Rechenzentrum',
  sonstiges: 'Sonstiges',
}

export const PROJECT_TYPE_PREFIX: Record<ProjectType, string> = {
  pv_freiflaeche: 'PV',
  pv_dach: 'PV',
  bess: 'BESS',
  hybrid: 'HYB',
  wind: 'WIND',
  rechenzentrum: 'RZ',
  sonstiges: 'SON',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  lead: 'Lead',
  vorpruefung: 'Vorprüfung',
  investorensuche: 'Investorensuche',
  dd: 'DD',
  loi: 'LOI',
  spa: 'SPA',
  closing: 'Closing',
  verkauft: 'Verkauft',
  abgelehnt: 'Abgelehnt',
}

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  'lead', 'vorpruefung', 'investorensuche', 'dd', 'loi', 'spa', 'closing', 'verkauft', 'abgelehnt',
]

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string; dot: string }> = {
  lead: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
  vorpruefung: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-400' },
  investorensuche: { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-400' },
  dd: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  loi: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  spa: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  closing: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  verkauft: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', dot: 'bg-[#5CB800]' },
  abgelehnt: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
}

export const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  hoch: 'Hoch',
  mittel: 'Mittel',
  niedrig: 'Niedrig',
}

export const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  hoch: 'text-red-500',
  mittel: 'text-amber-500',
  niedrig: 'text-slate-400',
}

export const MARKETING_STATUS_LABELS: Record<MarketingStatus, string> = {
  nicht_gestartet: 'Nicht gestartet',
  in_vermarktung: 'In Vermarktung',
  an_investoren_versendet: 'An Investoren versendet',
  dd_laeuft: 'DD läuft',
  loi_erhalten: 'LOI erhalten',
  exklusiv_reserviert: 'Exklusiv reserviert',
  verkauft: 'Verkauft',
}

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  open: 'Offen',
  negotiating: 'In Verhandlung',
  closed_won: 'Abgeschlossen ✓',
  closed_lost: 'Nicht realisiert',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  expose: 'Exposé',
  lageplan: 'Lageplan',
  netzanschluss: 'Netzanschluss',
  pachtvertrag: 'Pachtvertrag',
  genehmigung: 'Genehmigung',
  gutachten: 'Gutachten',
  bild: 'Bild / Foto',
  nda: 'NDA',
  loi: 'LOI',
  spa: 'SPA',
  sonstiges: 'Sonstiges',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  hoch: 'Hoch',
  mittel: 'Mittel',
  niedrig: 'Niedrig',
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  status_change: 'Statusänderung',
  document_upload: 'Dokument hochgeladen',
  investor_contact: 'Investorenkontakt',
  note_added: 'Notiz hinzugefügt',
  email_sent: 'E-Mail gesendet',
  deal_update: 'Deal aktualisiert',
  task_created: 'Aufgabe erstellt',
  partner_linked: 'Partner verknüpft',
  investor_linked: 'Investoren verknüpft',
  manual: 'Manueller Eintrag',
}

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  status_change: '🔄',
  document_upload: '📎',
  investor_contact: '🤝',
  note_added: '✏️',
  email_sent: '📧',
  deal_update: '💰',
  task_created: '✓',
  partner_linked: '👤',
  investor_linked: '🏦',
  manual: '📝',
}

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  offen: 'Offen',
  faellig: 'Fällig',
  bezahlt: 'Bezahlt',
}

export const GERMAN_STATES = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen',
  'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz',
  'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
] as const

export type GermanState = typeof GERMAN_STATES[number]

export const INVESTOR_SIZE_LABELS: Record<string, string> = {
  size_1_10mw: '1 – 10 MW',
  size_10_50mw: '10 – 50 MW',
  size_50_250mw: '50 – 250 MW',
  size_250plus: '250+ MW',
}

export interface NavItem {
  label: string
  href: string
  iconName: string
  badge?: number
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' },
  { label: 'Projekte', href: '/projects', iconName: 'FolderOpen' },
  { label: 'Projekt-Import', href: '/project-import', iconName: 'UploadCloud' },
  { label: 'Datenquellen', href: '/data-sources', iconName: 'Cable' },
  { label: 'Deals', href: '/deals', iconName: 'Handshake' },
  { label: 'Partner', href: '/partners', iconName: 'Users' },
  { label: 'Investoren', href: '/investors', iconName: 'Building2' },
  { label: 'Aufgaben', href: '/tasks', iconName: 'CheckSquare' },
]

export const NAV_ITEMS_MOBILE: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' },
  { label: 'Projekte', href: '/projects', iconName: 'FolderOpen' },
  { label: 'Import', href: '/project-import', iconName: 'UploadCloud' },
  { label: 'Investoren', href: '/investors', iconName: 'Building2' },
  { label: 'CAPEX', href: '/capex', iconName: 'Calculator' },
  { label: 'Aufgaben', href: '/tasks', iconName: 'CheckSquare' },
]

export const NAV_ITEMS_SECONDARY: NavItem[] = [
  { label: 'CAPEX Rechner', href: '/capex', iconName: 'Calculator' },
  { label: 'Einstellungen', href: '/settings', iconName: 'Settings' },
]
