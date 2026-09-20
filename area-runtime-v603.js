/* V603 · AREA BOOTSTRAP + READY GATE
   Lädt die tatsächlich verwendeten Bereichs-Runtimes auf dem Homescreen vor.
   Bereichsbuttons werden erst freigegeben, wenn die aktuellen Module vollständig bereit sind.
*/
(function(){
  'use strict';
  if(window.__modAreaRuntimeV603)return;

  const VERSION='V603';
  const SUPABASE='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const GROUPS={
    todo:[
      SUPABASE,
      './supabase-config.js?v=603',
      './app.js?v=603',
      './segment-active-duration-v487.js?v=487-1528',
      './segment-duration-v444.js?v=446-1228',
      './time-segments-v443.js?v=446-1228',
      './retroactive-complete-v445.js?v=446-1228',
      './categories.js?v=446-1228',
      './ui.js?v=446-1228',
      './historical-segment-breakdown-v488.js?v=493-2035',
      './task-time-weight-details-v489.js?v=489-1825',
      './nested-task-weight-layout-v490.js?v=490-1853',
      './ui-card-stability-v491.js?v=491-1926',
      './task-card-rail-polish-v492.js?v=492-1954',
      './ui-alignment-v493.js?v=493-2035',
      './summary-weight-due-polish-v494.js?v=494-2103',
      './today-paused-v446.js?v=603-current',
      './render-stability-v479.js?v=603-current',
      './today-create-render-v480.js?v=603-current',
      './terminal-delete-v485.js?v=603-current',
      './time-segment-scroll-v486.js?v=603-current',
      './task-title-library-v507.js?v=507-1345',
      './archive-weight-layout-v508.js?v=508-0709',
      './log-core-v603.js?v=603',
      './background-log-v454.js?v=603-core',
      './history-safety-net-v498.js?v=603-log',
      './meaningful-history-v500.js?v=603-log',
      './iphone-backup-v400.js?v=600-live-previous',
      './backup-model-v600.js?v=600-unified',
      './todo-stability-v603.js?v=603'
    ],
    sport:[
      SUPABASE,
      './supabase-config.js?v=603',
      './supabase-client-lite-v593.js?v=593',
      './sport-v568.js?v=573-xtraining'
    ],
    food:[
      SUPABASE,
      './supabase-config.js?v=603',
      './supabase-client-lite-v593.js?v=593',
      './food-v544.js?v=582-recipe-edit-prepared'
    ],
    kistology:[
      SUPABASE,
      './supabase-config.js?v=603',
      './supabase-client-lite-v593.js?v=593',
      './kistology-v603.js?v=603'
    ],
    finance:[
      SUPABASE,
      './supabase-config.js?v=603',
      './supabase-client-lite-v593.js?v=593',
      './finance-v552.js?v=552-finance',
      './finance-data-v553.js?v=554-finance-interactions'
    ],
    backstage:[
      SUPABASE,
      './supabase-config.js?v=603',
      './app.js?v=603',
      './development-stats-current-v476.js?v=476-1419',
      './development-stats-v451.js?v=451-1431',
      './build-freshness-v502.js?v=603',
      './project-history-v452.js?v=452-1501',
      './backstage-v531.js?v=603',
      './backstage-size-v532.js?v=532-system-size'
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
  const LABELS={
    todo:'To Do',
    sport:'Sport',
    food:'Food',
    kistology:'Kistologie',
    finance:'Finanzen',
    backstage:'Backstage + Log'
  };
  const ACTIVE_AREAS=new Set(['todo','sport','food','kistology','finance','backstage']);
  const loaded=new Set();
  const pending=new Map();
  const readyAreas=new Set();
  let ready=false;
  let running=null;
  let progressState={loaded:0,total:1,percent:0,label:'Grundsystem',ready:false,error:null};

  const abs=src=>{try{return new URL(src,location.href).href}catch(_){return src}};
  const tick=()=>new Promise(resolve=>setTimeout(resolve,18));

  function notify(extra={}){
    progressState={...progressState,...extra};
    progressState.percent=Math.max(0,Math.min(100,Math.round(progressState.loaded/progressState.total*100)));
    window.dispatchEvent(new CustomEvent('mod:bootstrap-v603-progress',{detail:{...progressState}}));
  }

  function markComplete(label){
    progressState.loaded=Math.min(progressState.total,progressState.loaded+1);
    notify({label});
  }

  function loadScript(src,label){
    const key=abs(src);
    if(loaded.has(key))return Promise.resolve(src);
    const existing=[...document.scripts].find(s=>s.src===key);
    if(existing){
      loaded.add(key);
      markComplete(label);
      return Promise.resolve(src);
    }
    if(pending.has(key))return pending.get(key);
    const p=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      script.dataset.modAreaRuntimeV603='true';
      script.onload=()=>{loaded.add(key);pending.delete(key);markComplete(label);resolve(src);};
      script.onerror=()=>{pending.delete(key);reject(new Error('Laden fehlgeschlagen: '+src));};
      document.body.appendChild(script);
    });
    pending.set(key,p);
    return p;
  }

  function preloadImage(src){
    const key='image:'+abs(src);
    if(loaded.has(key))return Promise.resolve(src);
    return new Promise((resolve,reject)=>{
      const img=new Image();
      let finished=false;
      const done=()=>{
        if(finished)return;
        finished=true;
        loaded.add(key);
        markComplete('Bereichssymbole');
        resolve(src);
      };
      img.onload=()=>{if(typeof img.decode==='function')img.decode().catch(()=>{}).finally(done);else done();};
      img.onerror=()=>{if(finished)return;finished=true;reject(new Error('Icon konnte nicht geladen werden: '+src));};
      img.src=src;
      if(img.complete&&img.naturalWidth>0)done();
    });
  }

  function waitFor(test,timeout=15000){
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

  async function loadGroup(id){
    notify({label:LABELS[id]||id});
    for(const src of GROUPS[id]||[]){
      await loadScript(src,LABELS[id]||id);
      await tick();
    }
    readyAreas.add(id);
  }

  async function verifyCurrentModules(){
    notify({label:'Bereiche werden geprüft'});
    await waitFor(()=>typeof window.render==='function'&&typeof window.switchTab==='function');
    await waitFor(()=>window.__modSportV568||window.__modSportModeV510);
    await waitFor(()=>window.__modFoodV544);
    await waitFor(()=>window.__modKistologyV603);
    await waitFor(()=>window.__modFinanceV552||window.__modFinanceV553);
    await waitFor(()=>window.__modBackstageV531);
    await waitFor(()=>window.__modTodoStabilityV603&&window.__modLogCoreV603&&window.__modRecoveryHistoryV498);
    markComplete('Bereiche werden geprüft');
  }

  function iconSources(){
    const launcher=window.__modHubLauncherV517;
    const sources=launcher?.sources?Object.values(launcher.sources):[];
    return [...new Set(sources)];
  }

  function countTasks(){
    const scripts=new Set();
    Object.values(GROUPS).flat().forEach(src=>scripts.add(abs(src)));
    for(const key of [...scripts]){
      if([...document.scripts].some(s=>s.src===key)){scripts.delete(key);loaded.add(key);}
    }
    const images=iconSources().map(src=>'image:'+abs(src)).filter(key=>!loaded.has(key));
    return scripts.size+images.length+1;
  }

  async function preloadAll(){
    if(ready)return true;
    if(running)return running;
    running=(async()=>{
      try{
        progressState={loaded:0,total:Math.max(1,countTasks()),percent:0,label:'Grundsystem',ready:false,error:null};
        notify();
        for(const src of iconSources())await preloadImage(src);
        for(const id of ['todo','sport','food','kistology','finance','backstage'])await loadGroup(id);
        await verifyCurrentModules();
        ready=true;
        progressState.loaded=progressState.total;
        notify({label:'Alle Bereiche bereit',ready:true,error:null});
        document.documentElement.classList.remove('mod-bootstrap-pending-v603');
        document.documentElement.classList.add('mod-bootstrap-ready-v603');
        window.dispatchEvent(new CustomEvent('mod:bootstrap-v603-ready',{detail:{version:VERSION}}));
        try{window.__modHubLauncherV517?.render?.();}catch(_){}
        try{window.__modSurfaceHeaderV603?.apply?.();}catch(_){}
        try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
        return true;
      }catch(error){
        console.error('V603 Bootstrap:',error);
        notify({label:'Laden fehlgeschlagen · Tippen zum Wiederholen',ready:false,error:error?.message||String(error)});
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
    for(const src of list){await loadScript(src,'Backstage '+String(section).toUpperCase());await tick();}
    return true;
  }

  async function openArea(id){
    if(!ACTIVE_AREAS.has(id))return false;
    if(!ready)await preloadAll();
    if(!ready)return false;
    if(id==='todo'){
      try{window.render();}catch(_){}
      return window.__modAppHubV515?.open?.('todo',{source:'v603-ready'});
    }
    if(id==='sport'){
      return window.__modAppHubV515?.open?.('sport',{source:'v603-ready'});
    }
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
      openArea(id).catch?.(error=>console.error('V603 Bereich:',id,error));
      return;
    }

    const sectionButton=event.target?.closest?.('[data-backstage-section-v531]');
    if(!sectionButton||!document.body.classList.contains('mod-backstage-v530'))return;
    const section=sectionButton.dataset.backstageSectionV531;
    if(section==='log'){
      event.preventDefault();
      event.stopImmediatePropagation();
      window.__modBackstageV531?.setSection?.('log');
      Promise.resolve(window.__modRecoveryHistoryV498?.renderEnhancedLog?.()).catch(error=>console.error('V603 Log:',error));
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
    }).catch(error=>console.error('V603 Backstage:',section,error))
      .finally(()=>sectionButton.removeAttribute('aria-busy'));
  },true);

  const api={
    version:VERSION,
    groups:Object.fromEntries(Object.entries(GROUPS).map(([key,value])=>[key,[...value]])),
    preloadAll,retry,openArea,loadSection,
    loadArea:async()=>preloadAll(),
    loadBackstageSection:loadSection,
    get ready(){return ready;},
    get progress(){return {...progressState};},
    get readyAreas(){return [...readyAreas];}
  };
  window.__modAreaRuntimeV603=api;
  /* Namespace alias only: old callers reach the current runtime, not legacy code. */
  window.__modAreaRuntimeV591=api;

  setTimeout(preloadAll,80);
})();