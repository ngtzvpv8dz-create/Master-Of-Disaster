// V611 · Version-gated service worker + query-aware app cache warming.
const SW_VERSION="V611";
const CACHE_NAME="master-of-disaster-v611-static";
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
  "./service-worker-gate-v611.js",
  "./area-runtime-v609.js",
  "./area-loader-v608.css",
  "./backstage-section-loader-v609.css",
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
    const legacyKeys=keys.filter(key=>key!==CACHE_NAME&&key.startsWith("master-of-disaster-"));
    const hadLegacy=legacyKeys.length>0;
    for(const key of legacyKeys){
      try{await caches.delete(key);}catch(_){}
    }
    await self.clients.claim();

    /* V611: Kein automatisches Navigieren mehr.
       Der neue Worker übernimmt mit clients.claim(); die laufende Seite bleibt unangetastet. */
  })());
});

self.addEventListener("message",event=>{
  const data=event.data||{};
  const port=event.ports?.[0]||null;

  if(data.type==="MOD_GET_SW_VERSION"){
    try{port?.postMessage({type:"MOD_SW_VERSION",version:SW_VERSION,cacheName:CACHE_NAME});}catch(_){}
    return;
  }

  if(data.type==="MOD_SKIP_WAITING"){
    self.skipWaiting();
    return;
  }

  if(data.type==="MOD_WARM_URLS"){
    const entries=Array.isArray(data.entries)?data.entries:[];
    const job=(async()=>{
      const cache=await caches.open(CACHE_NAME);
      let done=0;
      const failures=[];
      for(const entry of entries){
        const url=String(entry?.url||"");
        if(!url)continue;
        const label=String(entry?.label||"Bereiche werden geladen");
        try{
          const request=new Request(url,{cache:"no-store",credentials:"same-origin"});
          const hit=await cache.match(request);
          if(!hit){
            try{
              const response=await fetch(request);
              if(!response||!response.ok)throw new Error("HTTP "+(response?.status||0));
              await cache.put(request,response.clone());
            }catch(error){
              const fallback=await cache.match(request,{ignoreSearch:true});
              if(!fallback)throw error;
            }
          }
        }catch(error){
          failures.push({url,label,message:error?.message||String(error)});
        }
        done++;
        try{port?.postMessage({type:"MOD_WARM_PROGRESS",done,total:entries.length,label,url,failed:failures.some(item=>item.url===url)});}catch(_){}
      }
      try{port?.postMessage({type:"MOD_WARM_DONE",done,total:entries.length,version:SW_VERSION,failures});}catch(_){}
    })();
    event.waitUntil(job);
  }
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

async function cached(request,{ignoreSearch=false}={}){
  const cache=await caches.open(CACHE_NAME);
  return cache.match(request,{ignoreSearch});
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
  const exact=await cached(request);
  if(exact)return exact;
  const fresh=await fetchAndRefresh(request).catch(()=>null);
  if(fresh)return fresh;
  return (await cached(request,{ignoreSearch:true}))||Response.error();
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
    event.respondWith(cacheFirstCurrent(event.request));
    return;
  }

  const networkPromise=fetchAndRefresh(event.request).catch(()=>null);
  event.waitUntil(networkPromise.then(()=>{}).catch(()=>{}));
  event.respondWith((async()=>{
    const hit=await cached(event.request);
    if(hit)return hit;
    const fallback=await cached(event.request,{ignoreSearch:true});
    if(fallback)return fallback;
    return (await networkPromise)||Response.error();
  })());
});