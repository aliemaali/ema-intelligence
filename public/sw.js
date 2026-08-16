self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch (_) { payload = { title: 'EMA Erinnerung', body: event.data ? event.data.text() : '' } }
  const title = payload.title || 'EMA Erinnerung'
  const options = { body: payload.body || 'Eine Erinnerung ist fällig.', icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png', tag: payload.tag || payload.reminderId || 'ema-reminder', data: { url: payload.url || '/assistant', reminderId: payload.reminderId || null } }
  event.waitUntil(self.registration.showNotification(title, options))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/assistant', self.location.origin).href
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => { for (const client of windows) { if ('focus' in client) { client.navigate(url); return client.focus() } } return clients.openWindow ? clients.openWindow(url) : undefined }))
})
