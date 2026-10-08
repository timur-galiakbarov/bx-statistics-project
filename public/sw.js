// Service worker socstat: только push-уведомления, без кеширования.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'socstat', {
      body: payload.body || '',
      icon: '/socstat-logo.svg',
      tag: payload.tag,
      data: { url: payload.url || '/app/dashboard', deliveryId: payload.deliveryId }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, deliveryId } = event.notification.data || {};
  const target = new URL(url || '/app/dashboard', self.location.origin).href;

  const trackClick = deliveryId
    ? fetch('/api/push/click', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId })
      }).catch(() => undefined)
    : Promise.resolve();

  const openWindow = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const appWindow = windows.find((client) => new URL(client.url).pathname.startsWith('/app'));
    if (appWindow) {
      return appWindow.navigate(target).then((client) => (client || appWindow).focus());
    }
    return self.clients.openWindow(target);
  });

  event.waitUntil(Promise.all([trackClick, openWindow]));
});
