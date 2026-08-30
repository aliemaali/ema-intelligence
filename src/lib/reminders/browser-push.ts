export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function requestPushPermission() {
  if (!isPushSupported()) return 'unsupported' as const
  return Notification.requestPermission()
}

export async function registerEmaPushWorker() {
  if (!isPushSupported()) return null
  await navigator.serviceWorker.register('/ema-push-sw.js')
  return navigator.serviceWorker.ready
}

export async function subscribeToEmaPush(applicationServerKey: Uint8Array) {
  const registration = await registerEmaPushWorker()
  if (!registration) return null
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  })
}
