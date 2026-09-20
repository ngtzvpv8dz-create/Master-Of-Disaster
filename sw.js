// V603 · Current app shell + network-first code delivery.
const CACHE_NAME="master-of-disaster-v603-bootstrap-cleanup";
const CORE_SHELL=[
  "./",
  "./index.html",
  "./app.css",
  "./categories.css",
  "./ui.css",
  "./manifest.webmanifest",
  "./app-hub-v515.css",
  "./app-hub-v515.js",
  "./app-hub-launcher-v603.css",
  "./app-hub-launcher-v603.js",
  "./surface-brand-v556.css",
  "./header-consolidated-v560.css",
  "./surface-header-v603.css",
  "./surface-header-v603.js",
  "./area-runtime-v603.js",
  "./fixed-app-header-v475.js",
  "./kistology-v603.css",
  "./kistology-v603.js",
  "./log-core-v603.js",
  "./todo-stability-v603.js",
  "./backstage-v531.css",
  "./backstage-content-v531.css",
  "./backstage-size-v532.css",
  "./backstage-v531.js",
  "./backstage-size-v532.js",
  "./assets/icons/todo-v524-192.png",
  "./assets/icons/sport-v524-192.png",
  "./assets/icons/kistology-v524-192.png",
  "./assets/icons/food-v524-192.png",
  "./assets/icons/shopping-v584-192.png",
  "./assets/icons/progress-v540-192.png",
  "./assets/icons/finance-v584-192.png",
  "./assets/icons/backstage-v524-192.png"
];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.all(CORE_SHELL.map(async path=>{
      try{
        const response=await fetch(path,{cache:"no-store"});
        if(response&&response.ok)await cache.put(path,response.clone());
      }catch(_){}
    }));
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
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

async function cached(request){
  const cache=await caches.open(CACHE_NAME);
  return cache.match(request,{ignoreSearch:true});
}

function timeout(ms){
  return new Promise(resolve=>setTimeout(()=>resolve(null),ms));
}

async function networkFirst(request,{fallback=null,timeoutMs=2600}={}){
  const network=fetchAndRefresh(request).catch(()=>null);
  const first=await Promise.race([network,timeout(timeoutMs)]);
  if(first)return first;
  const hit=(await cached(request))||fallback;
  if(hit)return hit;
  return (await network)||Response.error();
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const navigation=event.request.mode==="navigate";
  if(!navigation&&!sameOrigin)return;

  if(navigation){
    event.respondWith((async()=>{
      const fallback=(await cached(event.request))||await caches.match("./index.html")||await caches.match("./");
      return networkFirst(event.request,{fallback,timeoutMs:3200});
    })());
    return;
  }

  const codeAsset=sameOrigin&&(
    event.request.destination==="script"||
    event.request.destination==="style"||
    /\.(?:js|css|json|webmanifest)$/i.test(url.pathname)
  );

  if(codeAsset){
    event.respondWith(networkFirst(event.request,{timeoutMs:2200}));
    return;
  }

  const networkPromise=fetchAndRefresh(event.request).catch(()=>null);
  event.waitUntil(networkPromise.then(()=>{}).catch(()=>{}));
  event.respondWith((async()=>{
    const hit=await cached(event.request);
    if(hit)return hit;
    return (await networkPromise)||Response.error();
  })());
});