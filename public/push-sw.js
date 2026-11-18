/* Notifications sur téléphone : chargé par le service worker de l'appli. */
self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Kollab', {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || d.id || undefined,
      data: { url: d.url || '/app/', id: d.id || null },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { url, id } = event.notification.data || {}
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const app = wins.find((w) => new URL(w.url).pathname.startsWith('/app'))
      if (app) {
        await app.focus()
        app.postMessage({ type: 'kollab:open-notification', id })
        return
      }
      await self.clients.openWindow(url || '/app/')
    })(),
  )
})
