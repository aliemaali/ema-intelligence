// Mail-specific worker. No email bodies, tokens or offline mail cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
async function refreshBadge() {
  if (!('setAppBadge' in self.navigator)) return;
  try {
    const response = await fetch('/api/mail/badge', {credentials:'same-origin', cache:'no-store'});
    if ([401,403].includes(response.status)) { await self.navigator.setAppBadge(0); return; }
    if (!response.ok) return; // Offline/configuration issue: retain previous count.
    const {count} = await response.json();
    if (!Number.isSafeInteger(count) || count < 0) return;
    await self.navigator.setAppBadge(count); // 0 clears; never increment per push.
  } catch (_) { /* A network failure must not remove the last known badge. */ }
}
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}
  const isMail = typeof payload.url === 'string' && /^\/mail(?:[/?]|$)/.test(payload.url);
  const url = isMail ? payload.url : '/mail';
  event.waitUntil(Promise.allSettled([
    self.registration.showNotification(isMail ? 'EMA Mail' : 'EMA', {
      body: isMail ? 'Eine neue Nachricht ist eingegangen.' : 'Eine Erinnerung ist fällig.',
      icon:'/mail/icons/icon-192-v2.png', tag: payload.tag || 'ema-mail', data:{url},
    }),
    refreshBadge(),
  ]));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/mail', self.location.origin);
  if (target.origin !== self.location.origin || !/^\/mail(?:[/?]|$)/.test(target.pathname)) return;
  event.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(async clients => {
    const client = clients.find(c => new URL(c.url).pathname.startsWith('/mail'));
    if (client) { await client.navigate(target.href); return client.focus(); }
    return self.clients.openWindow(target.href);
  }));
});
