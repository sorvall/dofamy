/**
 * Минимальный service worker для установки PWA (Android «Установить приложение»).
 * Без обработчика fetch — иначе ломаются blob: (голосовая запись) и API (SpeechKit, DeepSeek).
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
