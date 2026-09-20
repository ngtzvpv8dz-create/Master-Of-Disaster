// V604 · Minimal current app shell + cache-first versioned code assets.
const CACHE_NAME="master-of-disaster-v604-static";
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
  "./area-runtime-v604.js",
  "./fixed-app-header-v475.js",
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
    for(const path of CORE_SHELL){
      try{
        const response=await fetch(path,{cache:"no-store"});
        if(response&&response.ok)await cache.put(path,response.clone());
      }catch(_){}
    }
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    for(const key of keys){
      if(key!==CACHE_NAME){
        try{await caches.delete(key);}catch(_){}
      }
    }
    await self.clients.claim();
  })());
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

async function cacheFirstCurrent(request){
  const hit=await cached(request);
  if(hit)return hit;
  return (await fetchAndRefresh(request).catch(()=>null))||Response.error();
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
    /.(?:js|css|json|webmanifest)$/i.test(url.pathname)
  );

  if(codeAsset){
    event.respondWith(cacheFirstCurrent(event.request));
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