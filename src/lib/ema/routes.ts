/** Shared destinations: modules link to the owning app instead of creating copies. */
export const EMA_ROUTES = {
  intelligence: '/dashboard', projects: '/projects', documents: '/dms',
  mail: '/mail', calendar: '/mail?view=calendar', contacts: '/mail?view=contacts',
  tasks: '/tasks', connection: '/mail?view=settings',
  office: '/office', invoices: '/office/eingangsrechnungen', expose: '/expose', smartCheck: '/smart-check',
} as const;
export type MailInitialView = 'home' | 'mail' | 'calendar' | 'contacts' | 'tasks' | 'settings';
export function mailInitialView(value: unknown): MailInitialView {
  return typeof value === 'string' && ['home','mail','calendar','contacts','tasks','settings'].includes(value)
    ? value as MailInitialView : 'home';
}
