const CACHE_NAME="master-of-disaster-v525-fast-start";
const APP_SHELL=["./","./index.html","./app.css","./categories.css","./ui.css","./app.js","./app-hub-v515.css","./app-hub-v515.js","./build-version-v515.js","./app-hub-icon-buttons-v516.css","./app-hub-icon-buttons-v516.js","./build-version-v516.js","./app-hub-launcher-v517.css","./app-hub-launcher-v517.js","./build-version-v517.js","./build-version-v518.js","./build-version-v519.js","./apple-touch-icon.png","./sport-icon-v516.webp","./food-icon-v517.svg","./future-icon-v517.svg","./assets/icons/todo-v524-192.png","./assets/icons/sport-v524-192.png","./assets/icons/kistology-v524-192.png","./assets/icons/food-v524-192.png","./assets/icons/future-v524-192.png","./assets/icons/backstage-v524-192.png","./sport-mode-v510.css","./sport-mode-v510.js","./sport-tabs-v512.css","./sport-tabs-v512.js","./sport-header-compat-v511.js","./build-version-v512.js","./segment-active-duration-v487.js","./historical-segment-breakdown-v488.js","./task-time-weight-details-v489.js","./nested-task-weight-layout-v490.js","./ui-card-stability-v491.js","./task-card-rail-polish-v492.js","./ui-alignment-v493.js","./summary-weight-due-polish-v494.js","./paused-today-v447.js","./remote-work-blocks-v495.js","./history-safety-net-v498.js","./log-stability-v499.js","./meaningful-history-v500.js","./today-action-order-v501.js","./build-freshness-v502.js","./today-interaction-stability-v503.js","./category-create-stability-v504.js","./running-task-render-stability-v505.js","./backup-stability-v506.js","./backup-source-fallback-v506.js","./task-title-library-v507.js","./archive-weight-layout-v508.js","./remote-commands.js","./remote-archive-maintenance-v472.js","./remote-archive-sequence-v478.js","./remote-task-reopen-v484.js","./remote-task-segment-repair-v497.js","./terminal-delete-v485.js","./time-segment-scroll-v486.js","./theme-layout-editor-v458.js","./ux-cooking-editor-v460.js","./theme-editor-comfort-v463.js","./theme-state-design-v464.js","./theme-state-sync-v465.js","./theme-package-actions-v466.js","./theme-package-stability-v467.js","./theme-editor-polish-v468.js","./theme-editor-help-v469.js","./theme-editor-help-stability-v470.js","./category-group-drag-v473.js","./today-work-blocks-v474.js","./fixed-app-header-v475.js","./development-stats-current-v476.js","./statistics-alignment-v477.js","./render-stability-v479.js","./today-create-render-v480.js","./development-metrics.json","./manifest.webmanifest","./supabase-config.js"];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).catch(()=>{}));
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

function fetchAndRefresh(request){
  return fetch(request,{cache:"no-store"}).then(response=>{
    if(response&&response.ok){
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)).catch(()=>{});
    }
    return response;
  });
}

function cached(request){
  return caches.match(request,{ignoreSearch:true});
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const navigation=event.request.mode==="navigate";
  if(!navigation&&!sameOrigin)return;

  const networkPromise=fetchAndRefresh(event.request).catch(()=>null);
  event.waitUntil(networkPromise.then(()=>{}).catch(()=>{}));

  if(navigation){
    event.respondWith((async()=>{
      const hit=await cached(event.request)||await caches.match("./index.html")||await caches.match("./");
      if(!hit)return (await networkPromise)||Response.error();
      const fastCache=new Promise(resolve=>setTimeout(()=>resolve(hit),350));
      return Promise.race([networkPromise.then(response=>response||hit),fastCache]);
    })());
    return;
  }

  event.respondWith((async()=>{
    const hit=await cached(event.request);
    if(hit)return hit;
    return (await networkPromise)||Response.error();
  })());
});
