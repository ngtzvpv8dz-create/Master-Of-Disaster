/* V531 · BACKSTAGE / MASCHINENRAUM
   - Baut Backstage zu fünf klaren Bereichen aus: DEV, LOG, BACKUP, RESTORE, SYSTEM.
   - DEV und LOG verwenden weiterhin die bestehenden Renderer.
   - BACKUP, RESTORE und SYSTEM sind bewusst nur vorbereitete Oberflächen; bestehende Funktionen werden noch nicht umverdrahtet.
   - Kompatibilitätsalias __modBackstageV530 bleibt für ältere Tests/Module erhalten.
*/
(function(){
  'use strict';
  if(window.__modBackstageV531)return;

  const VERSION='V531';
  const BODY_CLASS='mod-backstage-v530';
  const ROOT_ID='modBackstageV530';
  const VALID_SECTIONS=new Set(['dev','log','backup','restore','system']);
  const REAL_TABS=new Set(['dev','log']);
  const SECTION_META={
    dev:{index:'01',label:'DEV',title:'DEV',text:'Build, Version und Entwicklungsdiagnose.'},
    log:{index:'02',label:'LOG',title:'LIVE-LOG',text:'Protokolle und Laufzeitereignisse der letzten Tage.'},
    backup:{index:'03',label:'BACKUP',title:'BACKUP',text:'Lokale Komplett-Backups und Cloud-Sicherungen werden hier als nächster Funktionsblock gebündelt.'},
    restore:{index:'04',label:'RESTORE',title:'RESTORE',text:'Wiederherstellungspunkte, Einzel- und Komplett-Restore werden hier zentral zusammengeführt.'},
    system:{index:'05',label:'SYSTEM',title:'SYSTEM',text:'Runtime, Service Worker, Cache und technische Diagnose bekommen hier ihren festen Maschinenraum.'}
  };

  let activeSection='dev';
  let previousTodoTab='all';
  let hubPatched=false;
  let captureInstalled=false;
  let observer=null;
  let originalHubShow=null;
  let originalHubOpen=null;
  let originalHubHide=null;

  function hubApi(){return window.__modAppHubV515||null;}
  function sportApi(){return window.__modSportModeV510||null;}

  function currentTabValue(){
    try{return typeof currentTab!=='undefined'?String(currentTab||'all'):'all';}catch(_){return 'all';}
  }

  function switchExistingTab(tab){
    try{
      if(typeof switchTab==='function'){
        switchTab(tab);
        return true;
      }
    }catch(_){}
    try{
      if(typeof window.switchTab==='function'){
        window.switchTab(tab);
        return true;
      }
    }catch(_){}
    return false;
  }

  function parkLegacyTabForPlaceholder(){
    try{
      if(typeof currentTab!=='undefined'&&REAL_TABS.has(String(currentTab))){
        currentTab='dev';
        return true;
      }
    }catch(_){}
    try{
      if('currentTab' in window&&REAL_TABS.has(String(window.currentTab))){
        window.currentTab='dev';
        return true;
      }
    }catch(_){}
    return false;
  }

  function isOpen(){return document.body.classList.contains(BODY_CLASS);}

  function tabMarkup(section){
    const meta=SECTION_META[section];
    return `<button type="button" class="mod-backstage-tab-v531" data-backstage-section-v530="${section}" data-backstage-section-v531="${section}" role="tab" aria-selected="${section==='dev'?'true':'false'}"><span class="mod-backstage-tab-index-v531">${meta.index}</span><span class="mod-backstage-tab-label-v531">${meta.label}</span></button>`;
  }

  function ensureUi(){
    let root=document.getElementById(ROOT_ID);
    if(root&&root.dataset.modBackstageShellV531==='true')return root;
    const view=document.getElementById('viewContainer');
    if(!view||!view.parentNode)return null;

    if(root)root.remove();
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='mod-backstage-nav-v531';
    root.dataset.modBackstageShellV531='true';
    root.setAttribute('aria-label','Backstage Maschinenraum');
    root.innerHTML=`
      <div class="mod-backstage-head-v531">
        <div class="mod-backstage-brand-v531">
          <div class="mod-backstage-kicker-v531">MASTER OF DISASTER // CONTROL DECK</div>
          <h2 class="mod-backstage-title-v531">BACKSTAGE</h2>
          <div class="mod-backstage-subtitle-v531">MASCHINENRAUM · SYSTEMWERKZEUGE</div>
        </div>
        <div class="mod-backstage-status-v531" aria-label="Backstage bereit"><span class="mod-backstage-status-dot-v531" aria-hidden="true"></span>READY</div>
      </div>
      <div class="mod-backstage-tabs-v531" role="tablist" aria-label="Backstage Bereiche">
        ${['dev','log','backup','restore','system'].map(tabMarkup).join('')}
      </div>`;
    view.parentNode.insertBefore(root,view);

    root.querySelectorAll('[data-backstage-section-v531]').forEach(button=>{
      button.addEventListener('click',()=>setSection(button.dataset.backstageSectionV531));
    });
    return root;
  }

  function syncNav(){
    const root=ensureUi();
    if(!root)return;
    root.querySelectorAll('[data-backstage-section-v531]').forEach(button=>{
      const selected=button.dataset.backstageSectionV531===activeSection;
      button.setAttribute('aria-selected',selected?'true':'false');
      button.tabIndex=selected?0:-1;
    });
  }

  function renderPlaceholder(section){
    const view=document.getElementById('viewContainer');
    const meta=SECTION_META[section]||SECTION_META.system;
    if(!view)return false;
    view.innerHTML=`<section class="mod-backstage-placeholder-v531" data-backstage-placeholder-v531="${section}"><div class="mod-backstage-placeholder-card-v531"><div class="mod-backstage-placeholder-code-v531">SEKTOR ${meta.index}</div><h3 class="mod-backstage-placeholder-title-v531">${meta.title}</h3><p class="mod-backstage-placeholder-text-v531">${meta.text}</p><span class="mod-backstage-placeholder-state-v531">GRUNDGERÜST · NOCH NICHT VERDRAHTET</span></div></section>`;
    return true;
  }

  function setSection(section){
    section=VALID_SECTIONS.has(section)?section:'dev';
    activeSection=section;
    if(REAL_TABS.has(section)){
      switchExistingTab(section);
      if(section==='dev'){
        try{window.__modBuildFreshnessV502?.load?.(true);}catch(_){}
        setTimeout(()=>{try{window.__modBuildFreshnessV502?.patch?.();}catch(_){}},0);
      }else{
        setTimeout(()=>{try{window.__modLiveLogV453?.renderLog?.();}catch(_){}},0);
      }
    }else{
      parkLegacyTabForPlaceholder();
      renderPlaceholder(section);
    }
    syncNav();
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return section;
  }

  function rememberTodoTab(){
    const value=currentTabValue();
    if(!REAL_TABS.has(value))previousTodoTab=value||'all';
    if(!previousTodoTab||REAL_TABS.has(previousTodoTab))previousTodoTab='all';
    return previousTodoTab;
  }

  function restoreTodoTab(){
    const target=previousTodoTab&&!REAL_TABS.has(previousTodoTab)?previousTodoTab:'all';
    switchExistingTab(target);
    return target;
  }

  function close({restoreTodo=true}={}){
    if(!isOpen())return false;
    document.body.classList.remove(BODY_CLASS);
    document.body.classList.remove('mod-backstage-v531');
    const root=document.getElementById(ROOT_ID);
    root?.setAttribute('aria-hidden','true');
    if(restoreTodo)restoreTodoTab();
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return true;
  }

  function open({section=activeSection}={}){
    patchHub();
    rememberTodoTab();
    try{originalHubHide?.();}catch(_){try{hubApi()?.hide?.();}catch(__){}}
    try{sportApi()?.setMode?.('todo',{persist:false,animate:false});}catch(_){}
    document.body.classList.add(BODY_CLASS,'mod-backstage-v531');
    document.body.dataset.modAppSurfaceV515='backstage';
    const root=ensureUi();
    root?.setAttribute('aria-hidden','false');
    setSection(section);
    try{window.scrollTo?.({top:0,left:0,behavior:'instant'});}catch(_){try{window.scrollTo?.(0,0);}catch(__){}}
    return 'backstage';
  }

  function patchLauncher(){
    const button=document.querySelector('[data-mod-hub-launch-v517="backstage"]');
    if(button){
      button.removeAttribute('aria-disabled');
      button.setAttribute('aria-label','Backstage öffnen');
      button.dataset.modBackstageActiveV530='true';
      button.dataset.modBackstageActiveV531='true';
    }
    const launcher=window.__modHubLauncherV517||window.__modHubLauncherV524;
    if(launcher){
      try{
        const item=Array.isArray(launcher.modules)?launcher.modules.find(entry=>entry.id==='backstage'):null;
        if(item)item.active=true;
        launcher.backstagePrepared=false;
        launcher.backstageActiveV530=true;
        launcher.backstageActiveV531=true;
      }catch(_){}
    }
    return !!button;
  }

  function patchHub(){
    const hub=hubApi();
    if(!hub||hubPatched)return false;
    originalHubShow=hub.show?.bind(hub)||null;
    originalHubOpen=hub.open?.bind(hub)||null;
    originalHubHide=hub.hide?.bind(hub)||null;
    if(!originalHubShow||!originalHubOpen||!originalHubHide)return false;

    hub.show=function(){
      if(isOpen())close({restoreTodo:true});
      return originalHubShow(...arguments);
    };

    hub.open=function(target,options){
      if(target==='backstage')return open({section:activeSection});
      if(isOpen())close({restoreTodo:true});
      return originalHubOpen(target,options);
    };

    hub.backstageActiveV530=true;
    hub.backstageActiveV531=true;
    hubPatched=true;
    return true;
  }

  function installCapture(){
    if(captureInstalled)return;
    captureInstalled=true;
    window.addEventListener('click',event=>{
      const launcherButton=event.target?.closest?.('[data-mod-hub-launch-v517="backstage"]');
      if(launcherButton){
        event.preventDefault();
        event.stopImmediatePropagation();
        open({section:activeSection});
        return;
      }

      if(!isOpen())return;
      const sportButton=event.target?.closest?.('#sportSwitchV510');
      if(!sportButton)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close({restoreTodo:true});
      if(originalHubOpen)originalHubOpen('sport',{source:'switch'});
      else{
        document.body.dataset.modAppSurfaceV515='sport';
        try{sportApi()?.setMode?.('sport',{persist:true,animate:true});}catch(_){}
      }
    },true);
  }

  function observeLauncher(){
    if(observer)return;
    observer=new MutationObserver(()=>patchLauncher());
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  function init(){
    ensureUi();
    installCapture();
    patchHub();
    patchLauncher();
    observeLauncher();
    if(isOpen())setSection(activeSection);
    return !!(hubApi()&&(window.__modHubLauncherV517||window.__modHubLauncherV524));
  }

  const api={
    version:VERSION,
    open,
    close,
    setSection,
    patchHub,
    patchLauncher,
    isOpen,
    get activeSection(){return activeSection;},
    get previousTodoTab(){return previousTodoTab;},
    sections:['dev','log','backup','restore','system'],
    machineRoomStyleV531:true,
    fiveSectionShellV531:true,
    placeholdersDoNotInvokeLegacyTabsV531:true,
    placeholderParksLegacyLogV531:true,
    devAndLogMoved:true,
    existingRenderersReused:true,
    todoDataUntouched:true,
    sportHealthHookPreserved:true,
    homeNavigationPreserved:true
  };
  window.__modBackstageV531=api;
  window.__modBackstageV530=api;

  let tries=0;
  const boot=setInterval(()=>{
    tries++;
    const ready=init();
    if(ready||tries>240)clearInterval(boot);
  },50);
  if(document.readyState!=='loading')setTimeout(init,0);
  else document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  window.addEventListener('load',()=>setTimeout(init,180),{once:true});
})();
