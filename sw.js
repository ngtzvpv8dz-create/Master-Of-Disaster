/* Master of Disaster service worker
   Recovery mode: data stays local/Supabase, but application code is NEVER served from Cache Storage.
   This prevents old app shells (V392/V393/V395) from taking control again.
*/
const CACHE_NAME = "master-of-disaster-static-v401-recovery";
const STATIC_ONLY = [
  "./master-of-disaster-192.png",
  "./master-of-disaster-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => caches.open(CACHE_NAME))
      .then(cache => cache.addAll(STATIC_ONLY))
      .catch(() => {})
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

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;

  // HTML, JS, CSS, manifest and config must always come from the network.
  // No fallback to an old cached app shell.
  if (
    event.request.mode === "navigate" ||
    (sameOrigin && /\.(?:html|js|css|webmanifest)$/i.test(url.pathname)) ||
    (sameOrigin && url.pathname.endsWith("/"))
  ) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  // Only harmless static images may be cached.
  if (sameOrigin && /\.(?:png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      }))
    );
  }
});
