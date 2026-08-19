const CACHE_NAME = "master-of-disaster-v390";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.css?v=390",
  "./app.js?v=390",
  "./conflict-center.css?v=390",
  "./conflict-center.js?v=390",
  "./conflict-filter-v388.js?v=390",
  "./conflict-actions-v390.js?v=390",
  "./manifest.webmanifest",
  "./supabase-config.js",
  "./master-of-disaster-192.png",
  "./master-of-disaster-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const isAppAsset = requestUrl.origin === self.location.origin && (
    requestUrl.pathname.endsWith("/index.html") ||
    requestUrl.pathname.endsWith("/app.js") ||
    requestUrl.pathname.endsWith("/app.css") ||
    requestUrl.pathname.endsWith("/conflict-center.js") ||
    requestUrl.pathname.endsWith("/conflict-center.css") ||
    requestUrl.pathname.endsWith("/conflict-filter-v388.js") ||
    requestUrl.pathname.endsWith("/conflict-actions-v390.js")
  );

  if (isNavigation || isAppAsset) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(hit => hit || caches.match("./index.html") || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit => {
      if (hit) return hit;
      return fetch(event.request).then(response => {
        if (response && response.ok && requestUrl.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
