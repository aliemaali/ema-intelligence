export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function requestPushPermission() {
  if (!isPushSupported()) return 'unsupported' as const
  return Notification.requestPermission()
}

export async function getPushRegistration() {
  if (!isPushSupported()) return null
  return navigator.serviceWorker.ready
}
