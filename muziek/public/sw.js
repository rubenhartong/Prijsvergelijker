// Minimale service worker zodat de app installeerbaar is; alles gaat gewoon via het netwerk.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
