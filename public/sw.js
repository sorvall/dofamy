/**
 * Минимальный service worker для установки PWA (Android «Установить приложение»).
 * Без агрессивного кэша — всегда сеть, чтобы обновления доходили сразу.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
