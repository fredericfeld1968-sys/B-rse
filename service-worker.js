const CACHE_NAME = "boerse-app-v3";
const CORE_ASSETS = [
  "index.html",
  "portfolio.html",
  "log.html",
  "gepvolt.html",
  "settings.html",
  "css/style.css",
  "js/common.js",
  "manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first fuer alles: zeigt immer die aktuelle Version, faellt bei fehlendem
// Netz auf den Cache zurueck (Offline-Unterstuetzung ohne Risiko veralteter Inhalte).
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
