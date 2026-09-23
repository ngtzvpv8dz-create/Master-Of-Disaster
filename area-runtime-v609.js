/* V609 · STAGED HEAVY AREA LOADER
   To Do und Backstage werden beim Öffnen wirklich Modul für Modul ausgeführt.
   Zwischen den Modulen bekommt WebKit bewusst Luft für DOM, Observer und Rendering.
   Recovery/Log/Backup werden erst bei tatsächlichem Bedarf geladen.
*/
(function(){
  'use strict';
  if(window.__modAreaRuntimeV609)return;

  const VERSION='V609';
  const CACHE_NAME='master-of-disaster-v607-static';
  const SUPABASE='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  const GROUPS={
    todo:[
      SUPABASE,
      './supabase-config.js?v=609',
      './app.js?v=609',
      './segment-active-duration-v487.js?v=487-1528',
      './segment-duration-v444.js?v=446-1228',
      './time-segments-v443.js?v=446-1228',
      './retroactive-complete-v445.js?v=446-1228',
      './categories.js?v=609-category-refresh',
      './ui.js?v=446-1228',
      './historical-segment-breakdown-v488.js?v=493-2035',
      './task-time-weight-details-v489.js?v=489-1825',
      './nested-task-weight-layout-v490.js?v=490-1853',
      './ui-card-stability-v491.js?v=491-1926',
      './task-card-rail-polish-v492.js?v=492-1954',
      './ui-alignment-v493.js?v=493-2035',
      './summary-weight-due-polish-v494.js?v=494-2103',
      './today-paused-v446.js?v=609-current',
      './render-stability-v479.js?v=609-current',
      './today-work-blocks-v474.js?v=628-today-blocks',
      './today-create-render-v480.js?v=628-today-create',
      './terminal-delete-v485.js?v=609-current',
      './time-segment-scroll-v486.js?v=609-current',
      './task-title-library-v507.js?v=507-1345',
      './archive-weight-layout-v508.js?v=508-0709',
      './todo-stability-v603.js?v=609-current'
    ],
    sport:[
      SUPABASE,
      './supabase-config.js?v=609',
      './supabase-client-lite-v593.js?v=593',
      './sport-v616.js?v=619-course-plan'
    ],
    food:[
      SUPABASE,
      './supabase-config.js?v=609',
      './supabase-client-lite-v593.js?v=593',
      './food-v544.js?v=627-recipe-allrounder'
    ],
    kistology:[
      SUPABASE,
      './supabase-config.js?v=609',
      './supabase-client-lite-v593.js?v=593',
      './kistology-v603.js?v=609-current'
    ],
    finance:[
      SUPABASE,
      './supabase-config.js?v=609',
      './supabase-client-lite-v593.js?v=593',
      './finance-v552.js?v=552-finance',
      './finance-data-v553.js?v=617-finance-balance'
    ],
    backstage:[
      SUPABASE,
      './supabase-config.js?v=609',
      './app.js?v=609',
      './development-stats-current-v476.js?v=476-1419',
      './development-stats-v451.js?v=451-1431',
      './build-freshness-v502.js?v=609',
      './project-history-v452.js?v=452-1501',
      './backstage-v531.js?v=609',
      './backstage-size-v532.js?v=532-system-size'
    ]
  };

  const HISTORY_GROUP=[
    './log-core-v603.js?v=609-current',
    './history-safety-net-v498.js?v=609-current'
  ];

  const OPTIONAL_HISTORY_GROUP=[
    './background-log-v454.js?v=609-current',
    './meaningful-history-v500.js?v=609-current'
  ];

  const SECTION_GROUPS={
    log:[...HISTORY_GROUP],
    history:[...HISTORY_GROUP],
    backup:[
      ...HISTORY_GROUP,
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
      ...HISTORY_GROUP,
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
      './app.js?v=609',
      './categories.js?v=609-category-refresh',
      './ui.js?v=609',
      './todo-stability-v603.js?v=609-current'
    ],
    sport:['./sport-v616.js?v=619-course-plan'],
    food:['./food-v544.js?v=627-recipe-allrounder'],
    kistology:['./kistology-v603.js?v=609-current'],
    finance:['./finance-v552.js?v=609-current','./finance-data-v553.js?v=617-finance-balance'],
    backstage:['./backstage-v531.js?v=609','./project-history-v452.js?v=452-1501']
  };

  const LABELS={
    todo:'To Do',
    sport:'Sport',
    food:'Food',
    kistology:'Kistologie',
    finance:'Finanzen',
    backstage:'Backstage'
  };

  const SECTION_LABELS={
    log:'LOG',
    history:'HISTORY',
    backup:'BACKUP',
    restore:'RESTORE'
  };

  const HEAVY_AREAS=new Set(['todo','backstage']);
  const ACTIVE_AREAS=new Set(['todo','sport','food','kistology','finance','backstage']);
  const executed=new Set();
  const executing=new Map();
  const readyAreas=new Set();
  const readySections=new Set();

  let ready=false;
  let running=null;
  let loadingArea=null;
  let areaLoadPromise=null;
  let lastFailedArea=null;
  let loadingSection=null;
  let sectionLoadPromise=null;
  let lastFailedSection=null;
  let progressState={loaded:0,total:1,percent:0,label:'App wird geprüft',ready:false,error:null};

  const abs=src=>{try{return new URL(src,location.href).href}catch(_){return src}};
  const tick=(ms=10)=>new Promise(resolve=>setTimeout(resolve,ms));

  function emit(name,detail){
    try{window.dispatchEvent(new CustomEvent(name,{detail}));}catch(_){}
  }

  function emitProgress(detail){
    emit('mod:bootstrap-v609-progress',detail);
    emit('mod:bootstrap-v607-progress',detail);
    emit('mod:bootstrap-v603-progress',detail);
  }

  function notify(extra={}){
    progressState={...progressState,...extra};
    progressState.percent=Math.max(0,Math.min(100,Math.round(progressState.loaded/progressState.total*100)));
    emitProgress({...progressState,version:VERSION});
  }

  function homeReadyProgress(){
    emitProgress({
      loaded:1,total:1,percent:100,ready:true,error:null,
      label:'Alle Bereiche bereit',version:VERSION,phase:'home',areaLoading:null
    });
  }

  function moduleName(src){
    try{
      const u=new URL(src,location.href);
      return (u.pathname.split('/').pop()||'Modul').replace(/.js$/i,'');
    }catch(_){
      return String(src).split('/').pop()?.split('?')[0]?.replace(/.js$/i,'')||'Modul';
    }
  }

  function heavyDelay(context,src){
    const file=moduleName(src).toLowerCase();
    if(context==='todo'){
      if(file==='app')return 850;
      if(file==='ui')return 520;
      if(file.includes('todo-stability'))return 520;
      if(file.includes('categories'))return 360;
      if(file.includes('archive-weight')||file.includes('task-title'))return 320;
      return 260;
    }
    if(context==='backstage'){
      if(file==='app')return 850;
      if(file.includes('backstage-v531'))return 620;
      if(file.includes('project-history'))return 420;
      if(file.includes('development-stats'))return 360;
      return 300;
    }
    if(context==='log'||context==='history'){
      if(file.includes('history-safety'))return 950;
      if(file.includes('meaningful-history'))return 720;
      if(file.includes('background-log'))return 620;
      if(file.includes('log-core'))return 520;
      return 460;
    }
    if(context==='backup'||context==='restore'){
      if(file.includes('backup-stability'))return 950;
      if(file.includes('backup-model'))return 860;
      if(file.includes('backstage-backup-v533'))return 920;
      if(file.includes('backstage-backup-v534'))return 680;
      if(file.includes('full-backup'))return 760;
      if(file.includes('cloud-backup'))return 680;
      if(file.includes('backup-source'))return 640;
      if(file.includes('jszip'))return 620;
      return 520;
    }
    return 28;
  }

  async function browserBreather(context,src){
    try{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }catch(_){}
    await tick(heavyDelay(context,src));
  }

  function loadScript(src){
    const key=abs(src);
    if(executed.has(key))return Promise.resolve({src,already:true});
    const existing=[...document.scripts].find(script=>script.src===key);
    if(existing){
      executed.add(key);
      return Promise.resolve({src,already:true});
    }
    if(executing.has(key))return executing.get(key);

    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      script.dataset.modAreaRuntimeV609='true';
      script.onload=()=>{
        executed.add(key);
        executing.delete(key);
        resolve({src,already:false});
      };
      script.onerror=()=>{
        executing.delete(key);
        reject(new Error('Ausführen fehlgeschlagen: '+src));
      };
      document.body.appendChild(script);
    });

    executing.set(key,promise);
    return promise;
  }

  function waitFor(test,timeout=24000){
    const started=Date.now();
    return new Promise((resolve,reject)=>{
      const poll=()=>{
        try{const value=test();if(value)return resolve(value);}catch(_){}
        if(Date.now()-started>=timeout)return reject(new Error('Bereitschaftsprüfung abgelaufen.'));
        setTimeout(poll,60);
      };
      poll();
    });
  }

  async function verifyArea(id){
    if(id==='todo'){
      await waitFor(()=>typeof window.render==='function'&&typeof window.switchTab==='function');
      await waitFor(()=>window.__modTodoStabilityV603&&window.__modTaskTitleLibraryV507&&window.__modArchiveWeightLayoutV508&&window.__modTodayWorkBlocksV474&&window.__modTodayCreateRenderV480);
    }else if(id==='sport'){
      await waitFor(()=>window.__modSportV568||window.__modSportModeV510);
    }else if(id==='food'){
      await waitFor(()=>window.__modFoodV544);
    }else if(id==='kistology'){
      await waitFor(()=>window.__modKistologyV603);
    }else if(id==='finance'){
      await waitFor(()=>window.__modFinanceV552||window.__modFinanceV553);
    }else if(id==='backstage'){
      await waitFor(()=>window.__modBackstageV531);
    }
    return true;
  }

  function beginAreaProgress(id,total){
    loadingArea=id;
    lastFailedArea=null;
    document.documentElement.classList.add('mod-area-loading-v609');
    document.documentElement.dataset.modAreaLoadingV609=id;
    emitProgress({
      loaded:0,total,percent:0,ready:false,error:null,
      label:(LABELS[id]||id)+' wird vorbereitet',
      version:VERSION,phase:'area',areaLoading:id
    });
  }

  function stepAreaProgress(id,current,total,src,loaded){
    emitProgress({
      loaded,total,percent:Math.round(loaded/Math.max(1,total)*100),ready:false,error:null,
      label:(LABELS[id]||id)+' wird geladen · Modul '+current+' von '+total,
      module:moduleName(src),version:VERSION,phase:'area',areaLoading:id
    });
  }

  function finishAreaProgress(id,total){
    emitProgress({
      loaded:total,total,percent:100,ready:true,error:null,
      label:(LABELS[id]||id)+' bereit',
      version:VERSION,phase:'area',areaLoading:null
    });
    loadingArea=null;
    document.documentElement.classList.remove('mod-area-loading-v609');
    delete document.documentElement.dataset.modAreaLoadingV609;
  }

  function failAreaProgress(id,total,error){
    lastFailedArea=id;
    loadingArea=null;
    document.documentElement.classList.remove('mod-area-loading-v609');
    delete document.documentElement.dataset.modAreaLoadingV609;
    emitProgress({
      loaded:0,total:Math.max(1,total),percent:0,ready:false,
      error:error?.message||String(error),
      label:(LABELS[id]||id)+' konnte nicht vollständig geladen werden · antippen zum Wiederholen',
      version:VERSION,phase:'area-error',areaLoading:null
    });
  }

  async function loadListSequential(context,list,{showProgress=false}={}){
    const total=list.length;
    if(showProgress)beginAreaProgress(context,total);

    for(let i=0;i<list.length;i++){
      const src=list[i];
      if(showProgress)stepAreaProgress(context,i+1,total,src,i);
      await loadScript(src);
      await browserBreather(context,src);
    }

    if(showProgress){
      finishAreaProgress(context,total);
      await tick(180);
    }
    return true;
  }

  function sectionView(){
    return document.getElementById('viewContainer');
  }

  function sectionLoaderMarkup(section,current,total,src,loaded,errorMessage=''){
    const label=SECTION_LABELS[section]||String(section||'SEKTOR').toUpperCase();
    const percent=Math.max(0,Math.min(100,Math.round((loaded/Math.max(1,total))*100)));
    const module=src?moduleName(src):'Vorbereitung';
    const error=Boolean(errorMessage);
    return '<section class="mod-backstage-section-loader-v609" data-section="'+section+'" data-state="'+(error?'error':'loading')+'">'+
      '<div class="mod-backstage-section-loader-kicker-v609">BACKSTAGE · '+label+'</div>'+
      '<h3>'+(error?label+' konnte nicht geladen werden':label+' wird geladen')+'</h3>'+
      '<p class="mod-backstage-section-loader-step-v609">'+(error?errorMessage:('Modul '+current+' von '+total))+'</p>'+
      '<div class="mod-backstage-section-loader-track-v609" aria-hidden="true"><i style="width:'+percent+'%"></i></div>'+
      '<div class="mod-backstage-section-loader-meta-v609"><span>'+percent+' %</span><span>'+module+'</span></div>'+
      (error?'<button type="button" data-mod-section-retry-v609="'+section+'">ERNEUT VERSUCHEN</button>':'')+
    '</section>';
  }

  function renderSectionLoader(section,current,total,src,loaded,errorMessage=''){
    const view=sectionView();
    if(!view)return false;
    view.innerHTML=sectionLoaderMarkup(section,current,total,src,loaded,errorMessage);
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return true;
  }

  async function loadSectionSequential(section,list){
    const total=list.length;
    const showUi=document.body.classList.contains('mod-backstage-v530');
    loadingSection=section;
    lastFailedSection=null;
    if(showUi){
      document.documentElement.classList.add('mod-backstage-section-loading-v609');
      document.documentElement.dataset.modBackstageSectionLoadingV609=section;
      renderSectionLoader(section,0,total,null,0);
    }

    try{
      for(let i=0;i<list.length;i++){
        const src=list[i];
        if(showUi)renderSectionLoader(section,i+1,total,src,i);
        const result=await loadScript(src);
        if(result?.already)await tick(90);
        else await browserBreather(section,src);
        if(showUi)renderSectionLoader(section,i+1,total,src,i+1);
        if(!result?.already)await tick(120);
      }
      if(showUi){
        renderSectionLoader(section,total,total,null,total);
        await tick(380);
      }
      return true;
    }catch(error){
      lastFailedSection=section;
      if(showUi)renderSectionLoader(section,0,total,null,0,error?.message||String(error));
      throw error;
    }finally{
      loadingSection=null;
      if(showUi){
        document.documentElement.classList.remove('mod-backstage-section-loading-v609');
        delete document.documentElement.dataset.modBackstageSectionLoadingV609;
      }
    }
  }

  async function loadGroup(id){
    if(readyAreas.has(id))return true;
    if(areaLoadPromise&&loadingArea===id)return areaLoadPromise;
    if(areaLoadPromise)return areaLoadPromise.then(()=>loadGroup(id));

    const heavy=HEAVY_AREAS.has(id);
    areaLoadPromise=(async()=>{
      try{
        await loadListSequential(id,GROUPS[id]||[],{showProgress:heavy});
        await verifyArea(id);
        readyAreas.add(id);
        return true;
      }catch(error){
        if(heavy)failAreaProgress(id,(GROUPS[id]||[]).length,error);
        throw error;
      }finally{
        areaLoadPromise=null;
        if(!heavy){
          loadingArea=null;
          document.documentElement.classList.remove('mod-area-loading-v609');
          delete document.documentElement.dataset.modAreaLoadingV609;
        }
      }
    })();

    return areaLoadPromise;
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
        console.warn('V609 optional warmup:',entry.url,error);
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
    const gate=window.__modWorkerGateV611||window.__modWorkerGateV607;
    if(!gate?.ready)return {version:'V611',mode:'no-gate'};
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
          if('serviceWorker' in navigator&&navigator.serviceWorker.controller){
            warmed=await warmViaWorker(entries).catch(error=>{
              console.warn('V609 Worker-Warmup fallback:',error);
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
        emit('mod:bootstrap-v609-ready',detail);
        emit('mod:bootstrap-v607-ready',detail);
        emit('mod:bootstrap-v603-ready',detail);

        try{(window.__modHubLauncherV603||window.__modHubLauncherV517)?.render?.();}catch(_){}
        try{window.__modSurfaceHeaderV603?.apply?.();}catch(_){}
        try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
        return true;
      }catch(error){
        console.error('V609 Bootstrap:',error);
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
    if(lastFailedSection){
      const section=lastFailedSection;
      lastFailedSection=null;
      return loadSection(section);
    }
    if(lastFailedArea){
      const id=lastFailedArea;
      lastFailedArea=null;
      return openArea(id);
    }
    return preloadAll();
  }

  let optionalHistoryScheduled=false;
  function scheduleOptionalHistory(){
    if(optionalHistoryScheduled)return;
    optionalHistoryScheduled=true;

    const runWhenSafe=async()=>{
      /* Keine optionalen Logger parallel zu Backstage-Sektoren starten.
         Sie warten, bis Backstage wieder verlassen wurde und kein Sektor lädt. */
      if(document.body.classList.contains('mod-backstage-v530')||sectionLoadPromise||loadingSection){
        setTimeout(runWhenSafe,3000);
        return;
      }
      await tick(1200);
      for(const src of OPTIONAL_HISTORY_GROUP){
        try{
          const result=await loadScript(src);
          if(!result?.already)await browserBreather('history',src);
          else await tick(90);
        }catch(error){
          console.warn('V609 optional history module:',src,error);
        }
      }
    };

    setTimeout(runWhenSafe,5000);
  }

  async function loadSection(section){
    if(readySections.has(section))return true;
    if(sectionLoadPromise&&loadingSection===section)return sectionLoadPromise;
    if(sectionLoadPromise)return sectionLoadPromise.then(()=>loadSection(section));

    const list=SECTION_GROUPS[section]||[];
    sectionLoadPromise=(async()=>{
      try{
        await loadSectionSequential(section,list);
        readySections.add(section);
        if(section==='log'||section==='history'||section==='backup'||section==='restore')scheduleOptionalHistory();
        return true;
      }finally{
        sectionLoadPromise=null;
      }
    })();
    return sectionLoadPromise;
  }

  async function openArea(id){
    if(!ACTIVE_AREAS.has(id))return false;
    if(areaLoadPromise)return areaLoadPromise;
    if(!ready)await preloadAll();
    if(!ready)return false;

    await loadGroup(id);

    let result=false;
    if(id==='todo'){
      try{window.render();}catch(_){}
      result=window.__modAppHubV515?.open?.('todo',{source:'v609-ready'});
    }else if(id==='sport'){
      result=window.__modAppHubV515?.open?.('sport',{source:'v609-ready'});
    }else if(id==='food'){
      result=window.__modFoodV544?.open?.();
    }else if(id==='finance'){
      result=(window.__modFinanceV553||window.__modFinanceV552)?.open?.();
    }else if(id==='kistology'){
      result=window.__modKistologyV603?.open?.();
    }else if(id==='backstage'){
      result=window.__modBackstageV531?.open?.({section:'dev'});
    }

    setTimeout(homeReadyProgress,360);
    return result;
  }

  document.addEventListener('click',event=>{
    const sectionRetry=event.target?.closest?.('[data-mod-section-retry-v609]');
    if(sectionRetry){
      event.preventDefault();
      event.stopImmediatePropagation();
      const section=sectionRetry.dataset.modSectionRetryV609;
      loadSection(section).catch(error=>console.error('V609 Backstage-Retry:',section,error));
      return;
    }

    const retryButton=event.target?.closest?.('[data-mod-bootstrap-retry-v603]');
    if(retryButton){
      event.preventDefault();
      event.stopImmediatePropagation();
      retry();
      return;
    }

    const launcher=event.target?.closest?.('[data-mod-hub-launch-v517]');
    if(launcher){
      const id=launcher.dataset.modHubLaunchV517;
      if(!ACTIVE_AREAS.has(id))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(!ready||areaLoadPromise)return;
      openArea(id).catch(error=>console.error('V609 Bereich:',id,error));
      return;
    }

    const historyButton=event.target?.closest?.('.mod-undo-r-v498');
    if(historyButton&&!window.__modRecoveryHistoryV498){
      event.preventDefault();
      event.stopImmediatePropagation();
      loadSection('history')
        .then(()=>window.__modRecoveryHistoryV498?.openQuickHistory?.())
        .catch(error=>console.error('V609 History:',error));
      return;
    }

    const sectionButton=event.target?.closest?.('[data-backstage-section-v531]');
    if(!sectionButton||!document.body.classList.contains('mod-backstage-v530'))return;
    const section=sectionButton.dataset.backstageSectionV531;

    if(section==='log'){
      event.preventDefault();
      event.stopImmediatePropagation();
      sectionButton.setAttribute('aria-busy','true');
      loadSection('log').then(()=>{
        window.__modBackstageV531?.setSection?.('log');
        return window.__modRecoveryHistoryV498?.renderEnhancedLog?.();
      }).catch(error=>console.error('V609 Log:',error))
        .finally(()=>sectionButton.removeAttribute('aria-busy'));
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
    }).catch(error=>console.error('V609 Backstage:',section,error))
      .finally(()=>sectionButton.removeAttribute('aria-busy'));
  },true);

  const api={
    version:VERSION,
    cacheName:CACHE_NAME,
    preloadMode:'worker-warm-staged-heavy-execution',
    groups:Object.fromEntries(Object.entries(GROUPS).map(([key,value])=>[key,[...value]])),
    sectionGroups:Object.fromEntries(Object.entries(SECTION_GROUPS).map(([key,value])=>[key,[...value]])),
    optionalHistoryGroup:[...OPTIONAL_HISTORY_GROUP],
    warmGroups:Object.fromEntries(Object.entries(WARM_GROUPS).map(([key,value])=>[key,[...value]])),
    preloadAll,retry,openArea,loadSection,loadGroup,
    loadArea:async id=>id?loadGroup(id):preloadAll(),
    loadBackstageSection:loadSection,
    restoreHomeProgress:homeReadyProgress,
    get ready(){return ready;},
    get progress(){return {...progressState};},
    get readyAreas(){return [...readyAreas];},
    get readySections(){return [...readySections];},
    get loadingArea(){return loadingArea;},
    get loadingSection(){return loadingSection;},
    get executedCount(){return executed.size;},
    get warmAssetCount(){return warmEntries().length;},
    stagedHeavyAreas:[...HEAVY_AREAS],
    recoveryDeferred:true,
    backstageLogDeferred:true,
    stagedBackstageSections:['log','history','backup','restore'],
    sectionProgressUi:true,
    optionalHistoryDeferred:true
  };

  window.__modAreaRuntimeV609=api;
  window.__modAreaRuntimeV608=api;
  window.__modAreaRuntimeV607=api;
  window.__modAreaRuntimeV606=api;
  window.__modAreaRuntimeV605=api;
  window.__modAreaRuntimeV604=api;
  window.__modAreaRuntimeV603=api;
  window.__modAreaRuntimeV591=api;

  setTimeout(preloadAll,140);
})();