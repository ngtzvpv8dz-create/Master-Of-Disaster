const ROOT_PURGE_MARKER='master-of-disaster-root-v2-gate';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==ROOT_PURGE_MARKER).map(key=>caches.delete(key)));
    await caches.open(ROOT_PURGE_MARKER);
    await self.clients.claim();
  })());
});
