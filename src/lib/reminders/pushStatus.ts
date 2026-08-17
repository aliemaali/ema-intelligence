export type ReminderPushDiagnostics = {
  standalone: boolean
  notificationsSupported: boolean
  permission: NotificationPermission | 'unsupported'
  serviceWorkerRegistered: boolean
  serviceWorkerActive: boolean
  subscriptionExists: boolean
  subscriptionSavedServerSide: boolean
  schedulerHealthy: boolean | null
}

export const EMPTY_PUSH_DIAGNOSTICS: ReminderPushDiagnostics = {
  standalone: false,
  notificationsSupported: false,
  permission: 'unsupported',
  serviceWorkerRegistered: false,
  serviceWorkerActive: false,
  subscriptionExists: false,
  subscriptionSavedServerSide: false,
  schedulerHealthy: null,
}

export function reasonForInactivePush(diagnostics: ReminderPushDiagnostics): string {
  if (!diagnostics.notificationsSupported) {
    return 'Push wird hier nicht unterstützt. Öffne EMA auf dem iPhone über das Symbol auf dem Home-Bildschirm – im normalen Safari-Tab funktioniert Push auf iOS nicht.'
  }
  if (diagnostics.permission === 'denied') {
    return 'Mitteilungen sind für EMA blockiert. iPhone-Einstellungen → Mitteilungen → EMA → Erlauben, dann hier erneut aktivieren.'
  }
  if (diagnostics.permission === 'default') {
    return 'Mitteilungen wurden noch nicht erlaubt.'
  }
  if (!diagnostics.serviceWorkerActive) {
    return 'Der EMA Service Worker ist noch nicht aktiv.'
  }
  if (!diagnostics.subscriptionExists) {
    return 'Es liegt noch keine Push-Registrierung für dieses Gerät vor.'
  }
  if (!diagnostics.subscriptionSavedServerSide) {
    return 'Die Push-Registrierung ist nicht in EMA gespeichert.'
  }
  if (diagnostics.schedulerHealthy === false) {
    return 'Der Erinnerungs-Versand läuft gerade nicht zuverlässig. Bitte EMA-Support kontaktieren.'
  }
  return ''
}

export function isPushFullyActive(diagnostics: ReminderPushDiagnostics): boolean {
  return (
    diagnostics.notificationsSupported &&
    diagnostics.permission === 'granted' &&
    diagnostics.serviceWorkerActive &&
    diagnostics.subscriptionExists &&
    diagnostics.subscriptionSavedServerSide &&
    diagnostics.schedulerHealthy !== false
  )
}

export function needsSilentRepair(diagnostics: ReminderPushDiagnostics): boolean {
  return (
    diagnostics.notificationsSupported &&
    diagnostics.permission === 'granted' &&
    diagnostics.serviceWorkerActive &&
    (!diagnostics.subscriptionExists || !diagnostics.subscriptionSavedServerSide)
  )
}
