/* V607 · SERVICE-WORKER UPGRADE GATE
   Verhindert, dass ein neuer App-Build unter einem alten Worker/Cache startet.
   Bei Versionswechsel aktiviert die Seite nur den neuen Worker. Es gibt keinerlei automatische Navigation oder Reload.
*/
(function(){
  'use strict';
  if(window.__modWorkerGateV607)return;

  const VERSION='V607';
  const SW_URL='./sw.js?v=607-worker-gate';
  const SCOPE='./';
    const LEGACY_CACHE_PREFIX='master-of-disaster-';

  let status={state:'idle',label:'App wird geprüft',controller:null,reloaded:false,error:null};

  function emit(extra={}){
    status={...status,...extra};
    try{
      window.dispatchEvent(new CustomEvent('mod:worker-gate-v607-status',{detail:{...status,version:VERSION}}));
      window.dispatchEvent(new CustomEvent('mod:bootstrap-v603-progress',{detail:{
        loaded:0,total:1,percent:0,ready:false,error:status.error,
        label:status.label,version:VERSION,workerGate:true
      }}));
    }catch(_){}
  }

  function timeout(ms){return new Promise(resolve=>setTimeout(()=>resolve(null),ms));}

  async function controllerVersion(controller=navigator.serviceWorker?.controller){
    if(!controller)return null;
    return new Promise(resolve=>{
      let settled=false;
      const done=value=>{if(settled)return;settled=true;resolve(value||null);};
      const timer=setTimeout(()=>done(null),850);
      try{
        const channel=new MessageChannel();
        channel.port1.onmessage=event=>{
          clearTimeout(timer);
          done(event.data?.version||null);
        };
        controller.postMessage({type:'MOD_GET_SW_VERSION'},[channel.port2]);
      }catch(_){
        clearTimeout(timer);
        done(null);
      }
    });
  }

  async function waitForCurrentController(timeoutMs=18000){
    const started=Date.now();
    while(Date.now()-started<timeoutMs){
      const controller=navigator.serviceWorker?.controller||null;
      const version=await controllerVersion(controller);
      if(version===VERSION)return controller;
      await timeout(120);
    }
    return null;
  }

  async function clearLegacyCaches(){
    if(!('caches' in window))return;
    try{
      const keys=await caches.keys();
      await Promise.all(keys.filter(key=>key.startsWith(LEGACY_CACHE_PREFIX)&&key!=='master-of-disaster-v607-static').map(key=>caches.delete(key)));
    }catch(_){}
  }

  function testMode(){
    try{return new URL(location.href).searchParams.has('reg');}catch(_){return false;}
  }

  const ready=(async()=>{
    if(!('serviceWorker' in navigator)){
      emit({state:'unsupported',label:'Bereiche werden geladen',controller:'none'});
      return {version:VERSION,mode:'unsupported'};
    }
    if(testMode()){
      emit({state:'test-bypass',label:'Bereiche werden geladen',controller:'test'});
      return {version:VERSION,mode:'test-bypass'};
    }

    try{
      const beforeController=navigator.serviceWorker.controller||null;
      const beforeVersion=await controllerVersion(beforeController);

      if(beforeVersion===VERSION){
        emit({state:'current',label:'Bereiche werden geladen',controller:VERSION});
        try{
          const reg=await navigator.serviceWorker.getRegistration(SCOPE);
          reg?.update?.().catch(()=>{});
        }catch(_){}
        await clearLegacyCaches();
        return {version:VERSION,mode:'current'};
      }

      emit({
        state:beforeController?'upgrading':'installing',
        label:beforeController?'App wird aktualisiert':'App wird vorbereitet',
        controller:beforeVersion||'legacy'
      });

      const reg=await navigator.serviceWorker.register(SW_URL,{scope:SCOPE,updateViaCache:'none'});
      try{await reg.update();}catch(_){}

      if(reg.waiting){
        try{reg.waiting.postMessage({type:'MOD_SKIP_WAITING'});}catch(_){}
      }

      const controller=await waitForCurrentController();
      if(!controller)throw new Error('Der aktuelle Service Worker wurde nicht rechtzeitig aktiv.');

      await clearLegacyCaches();

      const hadLegacyController=!!beforeController&&beforeVersion!==VERSION;

      /* V607: Nur der Service Worker selbst darf bei einem echten Legacy-Cache
         eine Navigation auslösen. Das Seiten-Gate wartet ausschließlich auf den
         aktuellen Controller und startet niemals zusätzlich neu. */
      emit({state:'ready',label:'Bereiche werden geladen',controller:VERSION,reloaded:false});
      return {version:VERSION,mode:hadLegacyController?'upgraded':'installed',reloaded:false,singleReloadAuthority:'none'};
    }catch(error){
      console.error('V607 Worker Gate:',error);
      emit({state:'error',label:'App-Update fehlgeschlagen · erneut öffnen',error:error?.message||String(error)});
      throw error;
    }
  })();

  window.__modWorkerGateV607={
    version:VERSION,
    swUrl:SW_URL,
    reloadAuthority:'none',
    ready,
    controllerVersion,
    get status(){return {...status};}
  };
})();