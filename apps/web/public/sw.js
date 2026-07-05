// Minimal service worker: enables "Add to home screen" installability.
// Passthrough (no caching) so there are no stale-asset issues; offline support
// for the range comes with the native mobile app (Phase 4).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // no-op: let the network handle all requests
});
