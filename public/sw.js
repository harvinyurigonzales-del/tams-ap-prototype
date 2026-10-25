// Replaces the old offline service worker. Browsers that still have it fetch this file on their next update check:
// it clears the old caches, unregisters itself and reloads open tabs, so they load the live site again.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key)
      await self.registration.unregister()
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
    })(),
  )
})
