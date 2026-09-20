/* V606 · WORKER-GATED LIGHT BOOTSTRAP
   Der Homescreen wartet zuerst auf den aktuellen Service Worker.
   Danach werden nur die Kern-Dateien der Bereiche im Worker-Cache vorbereitet.
   Vollständige Bereichs-Runtimes werden erst beim Öffnen ausgeführt.
*/
(function(){
  'use strict';
  if(window.__modAreaRuntimeV606)return;

  const VERSION='V606';
  const CACHE_NAME='master-of-disaster-v606-static';
  const SUPABASE='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  const GROUPS={
    todo:[
      SUPABASE,
      './supabase-config.js?v=606',
      './app.js?v=606',
      './segment-active-duration-v487.js?v=487-1528',
      './segment-duration-v444.js?v=446-1228',
      './time-segments-v443.js?v=446-1228',
      './retroactive-complete-v445.js?v=446-1228',
      './categories.js?v=606-category-refresh',
      './ui.js?v=446-1228',
      './historical-segment-breakdown-v488.js?v=493-2035',
      './task-time-weight-details-v489.js?v=489-1825',
      './nested-task-weight-layout-v490.js?v=490-1853',
      './ui-card-stability-v491.js?v=491-1926',
      './task-card-rail-polish-v492.js?v=492-1954',
      './ui-alignment-v493.js?v=493-2035',
      './summary-weight-due-polish-v494.js?v=494-2103',
      './today-paused-v446.js?v=606-current',
      './render-stability-v479.js?v=606-current',
      './today-create-render-v480.js?v=606-current',
      './terminal-delete-v485.js?v=606-current',
      './time-segment-scroll-v486.js?v=606-current',
      './task-title-library-v507.js?v=507-1345',
      './archive-weight-layout-v508.js?v=508-0709',
      './log-core-v603.js?v=606-current',
      './background-log-v454.js?v=606-current',
      './history-safety-net-v498.js?v=606-current',
      './meaningful-history-v500.js?v=606-current',
      './iphone-backup-v400.js?v=600-live-previous',
      './backup-model-v600.js?v=600-unified',
      './todo-stability-v603.js?v=606-current'
    ],
    sport:[
      SUPABASE,
      './supabase-config.js?v=606',
      './supabase-client-lite-v593.js?v=593',
      './sport-v568.js?v=573-xtraining'
    ],
    food:[
      SUPABASE,
      './supabase-config.js?v=606',
      './supabase-client-lite-v593.js?v=593',
      './food-v544.js?v=582-recipe-edit-prepared'
    ],
    kistology:[
      SUPABASE,
      './supabase-config.js?v=606',
      './supabase-client-lite-v593.js?v=593',
      './kistology-v603.js?v=606-current'
    ],
    finance:[
      SUPABASE,
      './supabase-config.js?v=606',
      './supabase-client-lite-v593.js?v=593',
      './finance-v552.js?v=552-finance',
      './finance-data-v553.js?v=554-finance-interactions'
    ],
    backstage:[
      SUPABASE,
      './supabase-config.js?v=606',
      './app.js?v=606',
      './development-stats-current-v476.js?v=476-1419',
      './development-stats-v451.js?v=451-1431',
      './build-freshness-v502.js?v=606',
      './project-history-v452.js?v=452-1501',
      './backstage-v531.js?v=606',
      './backstage-size-v532.js?v=532-system-size',
      './log-core-v603.js?v=606-current',
      './background-log-v454.js?v=606-current',
      './history-safety-net-v498.js?v=606-current',
      './meaningful-history-v500.js?v=606-current'
    ]
  };

  const SECTION_GROUPS={
    backup:[
      'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
      './cloud-backup-restore-v394.js?v=600-live-previous',
      './full-backup-v397.js?v=446-1228',
      './backup-stability-v506.js?v=600-unified',
      './backup-model-v600.js?v=600-unified',
      './backup-source-fallback-v506.js?v=506-1244',
      './backstage-backup-v533.js?v=600-unified',
      './backstage-backup-v534.js?v=534-backup-consolidation'
    ],
    restore:[
      'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
      './cloud-backup-restore-v394.js?v=600-live-previous',
      './full-backup-v397.js?v=446-1228',
      './backup-stability-v506.js?v=600-unified',
      './backup-model-v600.js?v=600-unified',
      './backup-source-fallback-v506.js?v=506-1244',
      './backstage-backup-v533.js?v=600-unified',
      './backstage-backup-v534.js?v=534-backup-consolidation'
    ]
  };

  const WARM_GROUPS={
    todo:[
      './app.js?v=606',
      './categories.js?v=606-category-refresh',
      './ui.js?v=606',
      './todo-stability-v603.js?v=606-current'
    ],
    sport:['./sport-v568.js?v=606-current'],
    food:['./food-v544.js?v=606-current'],
    kistology:['./kistology-v603.js?v=606-current'],
    finance:[
      './finance-v552.js?v=606-current',
      './finance-data-v553.js?v=606-current'
    ],
    backstage:[
      './backstage-v531.js?v=606-current',
      './log-core-v603.js?v=606-current',
      './history-safety-net-v498.js?v=606-current'
    ]
  };

  const LABELS={
    todo:'To Do',
    sport:'Sport',
    food:'Food',
    kistology:'Kistologie',
    finance:'Finanzen',
    backstage:'Backstage + Log'
  };

  const ACTIVE_AREAS=new Set(['todo','sport','food','kistology','finance','backstage']);
  const executed=new Set();
  const executing=new Map();
  const readyAreas=new Set();
  let ready=false;
  let running=null;
  let progressState={loaded:0,total:1,percent:0,label:'App wird geprüft',ready:false,error:null};

  const abs=src=>{try{return new URL(src,location.href).href}catch(_){return src}};
  const tick=(ms=10)=>new Promise(resolve=>setTimeout(resolve,ms));

  function emit(name,detail){
    try{window.dispatchEvent(new CustomEvent(name,{detail}));}catch(_){}
  }

  function notify(extra={}){
    progressState={...progressState,...extra};
    progressState.percent=Math.max(0,Math.min(100,Math.round(progressState.loaded/progressState.total*100)));
    const detail={...progressState,version:VERSION};
    emit('mod:bootstrap-v606-progress',detail);
    emit('mod:bootstrap-v604-progress',detail);
    emit('mod:bootstrap-v603-progress',detail);
  }

  function loadScript(src){
    const key=abs(src);
    if(executed.has(key))return Promise.resolve(src);
    const existing=[...document.scripts].find(script=>script.src===key);
    if(existing){executed.add(key);return Promise.resolve(src);}
    if(executing.has(key))return executing.get(key);

    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      script.dataset.modAreaRuntimeV606='true';
      script.onload=()=>{executed.add(key);executing.delete(key);resolve(src);};
      script.onerror=()=>{executing.delete(key);reject(new Error('Ausführen fehlgeschlagen: '+src));};
      document.body.appendChild(script);
    });
    executing.set(key,promise);
    return promise;
  }

  function waitFor(test,timeout=20000){
    const started=Date.now();
    return new Promise((resolve,reject)=>{
      const poll=()=>{
        try{const value=test();if(value)return resolve(value);}catch(_){}
        if(Date.now()-started>=timeout)return reject(new Error('Bereitschaftsprüfung abgelaufen.'));
        setTimeout(poll,50);
      };
      poll();
    });
  }

  async function verifyArea(id){
    if(id==='todo'){
      await waitFor(()=>typeof window.render==='function'&&typeof window.switchTab==='function');
      await waitFor(()=>window.__modTodoStabilityV603&&window.__modLogCoreV603&&window.__modRecoveryHistoryV498);
    }else if(id==='sport'){
      await waitFor(()=>window.__modSportV568||window.__modSportModeV510);
    }else if(id==='food'){
      await waitFor(()=>window.__modFoodV544);
    }else if(id==='kistology'){
      await waitFor(()=>window.__modKistologyV603);
    }else if(id==='finance'){
      await waitFor(()=>window.__modFinanceV552||window.__modFinanceV553);
    }else if(id==='backstage'){
      await waitFor(()=>window.__modBackstageV531&&window.__modRecoveryHistoryV498&&window.__modLogCoreV603);
    }
    return true;
  }

  async function loadGroup(id){
    if(readyAreas.has(id))return true;
    notify({label:(LABELS[id]||id)+' wird geöffnet',ready:true});
    for(const src of GROUPS[id]||[]){
      await loadScript(src);
      await tick(7);
    }
    await verifyArea(id);
    readyAreas.add(id);
    notify({label:'Alle Bereiche bereit',ready:true});
    return true;
  }

  function warmEntries(){
    const seen=new Set();
    const entries=[];
    for(const id of ['todo','sport','food','kistology','finance','backstage']){
      for(const src of WARM_GROUPS[id]||[]){
        const url=abs(src);
        if(seen.has(url))continue;
        seen.add(url);
        entries.push({url,label:LABELS[id]||id});
      }
    }
    return entries;
  }

  function warmViaWorker(entries){
    const controller=navigator.serviceWorker?.controller;
    if(!controller||!entries.length)return Promise.resolve(false);
    return new Promise((resolve,reject)=>{
      const channel=new MessageChannel();
      let settled=false;
      const timer=setTimeout(()=>{
        if(settled)return;
        settled=true;
        reject(new Error('Worker-Vorabladen hat zu lange gedauert.'));
      },30000);

      channel.port1.onmessage=event=>{
        const data=event.data||{};
        if(data.type==='MOD_WARM_PROGRESS'){
          progressState.loaded=Math.min(progressState.total,Number(data.done)||0);
          notify({label:data.label||'Bereiche werden geladen'});
        }else if(data.type==='MOD_WARM_DONE'){
          if(settled)return;
          settled=true;
          clearTimeout(timer);
          resolve(true);
        }else if(data.type==='MOD_WARM_ERROR'){
          if(settled)return;
          settled=true;
          clearTimeout(timer);
          reject(new Error(data.message||'Worker-Vorabladen fehlgeschlagen.'));
        }
      };

      try{
        controller.postMessage({
          type:'MOD_WARM_URLS',
          entries:entries.map((entry,index)=>({url:entry.url,label:entry.label,index}))
        },[channel.port2]);
      }catch(error){
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  async function warmFallback(entries){
    let done=0;
    const failures=[];
    for(const entry of entries){
      try{
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),5000);
        try{
          const response=await fetch(entry.url,{cache:'force-cache',signal:controller.signal});
          if(!response||!response.ok)throw new Error('HTTP '+(response?.status||0));
          try{await response.body?.cancel?.();}catch(_){}
        }finally{clearTimeout(timer);}
      }catch(error){
        failures.push({url:entry.url,message:error?.message||String(error)});
        console.warn('V606 optional warmup:',entry.url,error);
      }
      done++;
      progressState.loaded=done;
      notify({label:entry.label});
      await tick(8);
    }
    return {ok:true,failures};
  }

  function regressionMode(){
    try{return new URL(location.href).searchParams.has('reg');}catch(_){return false;}
  }

  async function ensureWorkerGate(){
    const gate=window.__modWorkerGateV606;
    if(!gate?.ready)return {version:VERSION,mode:'no-gate'};
    notify({label:gate.status?.label||'App wird geprüft',loaded:0,total:1});
    return gate.ready;
  }

  async function preloadAll(){
    if(ready)return true;
    if(running)return running;

    running=(async()=>{
      try{
        const gateState=regressionMode()?{version:VERSION,mode:'test-bypass'}:await ensureWorkerGate();

        const entries=warmEntries();
        progressState={loaded:0,total:Math.max(1,entries.length),percent:0,label:'Bereiche werden geladen',ready:false,error:null};
        notify();

        if(gateState?.mode==='test-bypass'){
          progressState.loaded=progressState.total;
          notify({label:'Test-Bootstrap bereit'});
        }else{
          let warmed=false;
          if('serviceWorker' in navigator && navigator.serviceWorker.controller){
            warmed=await warmViaWorker(entries).catch(error=>{
              console.warn('V606 Worker-Warmup fallback:',error);
              return false;
            });
          }
          if(!warmed)await warmFallback(entries);
        }

        ready=true;
        progressState.loaded=progressState.total;
        notify({label:'Alle Bereiche bereit',ready:true,error:null});

        document.documentElement.classList.remove('mod-bootstrap-pending-v603','mod-bootstrap-error-v603');
        document.documentElement.classList.add('mod-bootstrap-ready-v603');

        const detail={version:VERSION,preloadOnly:true,workerGated:true,warmAssets:entries.length};
        emit('mod:bootstrap-v606-ready',detail);
        emit('mod:bootstrap-v604-ready',detail);
        emit('mod:bootstrap-v603-ready',detail);

        try{(window.__modHubLauncherV603||window.__modHubLauncherV517)?.render?.();}catch(_){}
        try{window.__modSurfaceHeaderV603?.apply?.();}catch(_){}
        try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
        return true;
      }catch(error){
        console.error('V606 Bootstrap:',error);
        notify({label:'Laden fehlgeschlagen · App erneut öffnen',ready:false,error:error?.message||String(error)});
        document.documentElement.classList.add('mod-bootstrap-error-v603');
        return false;
      }finally{
        running=null;
      }
    })();

    return running;
  }

  async function retry(){
    document.documentElement.classList.remove('mod-bootstrap-error-v603');
    progressState.error=null;
    return preloadAll();
  }

  async function loadSection(section){
    const list=SECTION_GROUPS[section]||[];
    for(const src of list){await loadScript(src);await tick(7);}
    return true;
  }

  async function openArea(id){
    if(!ACTIVE_AREAS.has(id))return false;
    if(!ready)await preloadAll();
    if(!ready)return false;

    await loadGroup(id);

    if(id==='todo'){
      try{window.render();}catch(_){}
      return window.__modAppHubV515?.open?.('todo',{source:'v606-ready'});
    }
    if(id==='sport')return window.__modAppHubV515?.open?.('sport',{source:'v606-ready'});
    if(id==='food')return window.__modFoodV544?.open?.();
    if(id==='finance')return (window.__modFinanceV553||window.__modFinanceV552)?.open?.();
    if(id==='kistology')return window.__modKistologyV603?.open?.();
    if(id==='backstage')return window.__modBackstageV531?.open?.({section:'dev'});
    return false;
  }

  document.addEventListener('click',event=>{
    const retryButton=event.target?.closest?.('[data-mod-bootstrap-retry-v603]');
    if(retryButton){event.preventDefault();retry();return;}

    const launcher=event.target?.closest?.('[data-mod-hub-launch-v517]');
    if(launcher){
      const id=launcher.dataset.modHubLaunchV517;
      if(!ACTIVE_AREAS.has(id))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(!ready)return;
      openArea(id).catch(error=>console.error('V606 Bereich:',id,error));
      return;
    }

    const sectionButton=event.target?.closest?.('[data-backstage-section-v531]');
    if(!sectionButton||!document.body.classList.contains('mod-backstage-v530'))return;
    const section=sectionButton.dataset.backstageSectionV531;

    if(section==='log'){
      event.preventDefault();
      event.stopImmediatePropagation();
      window.__modBackstageV531?.setSection?.('log');
      Promise.resolve(window.__modRecoveryHistoryV498?.renderEnhancedLog?.()).catch(error=>console.error('V606 Log:',error));
      return;
    }

    if(!SECTION_GROUPS[section]?.length)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    sectionButton.setAttribute('aria-busy','true');
    loadSection(section).then(()=>{
      if(section==='backup'&&window.__modBackstageBackupV533?.openBackup)window.__modBackstageBackupV533.openBackup();
      else window.__modBackstageV531?.setSection?.(section);
      if(section==='backup')window.__modBackstageBackupV533?.renderBackupDashboard?.();
    }).catch(error=>console.error('V606 Backstage:',section,error))
      .finally(()=>sectionButton.removeAttribute('aria-busy'));
  },true);

  const api={
    version:VERSION,
    cacheName:CACHE_NAME,
    preloadMode:'worker-gated-light-cache-warm',
    groups:Object.fromEntries(Object.entries(GROUPS).map(([key,value])=>[key,[...value]])),
    warmGroups:Object.fromEntries(Object.entries(WARM_GROUPS).map(([key,value])=>[key,[...value]])),
    preloadAll,retry,openArea,loadSection,loadGroup,
    loadArea:async id=>id?loadGroup(id):preloadAll(),
    loadBackstageSection:loadSection,
    get ready(){return ready;},
    get progress(){return {...progressState};},
    get readyAreas(){return [...readyAreas];},
    get executedCount(){return executed.size;},
    get warmAssetCount(){return warmEntries().length;}
  };

  window.__modAreaRuntimeV606=api;
  window.__modAreaRuntimeV605=api;
  window.__modAreaRuntimeV604=api;
  window.__modAreaRuntimeV603=api;
  window.__modAreaRuntimeV591=api;

  setTimeout(preloadAll,140);
})();