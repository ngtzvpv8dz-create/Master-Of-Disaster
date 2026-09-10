/* V530 · BACKSTAGE
   - Aktiviert die vorbereitete BACKSTAGE-Kachel.
   - Verschiebt DEV und LOG logisch aus der To-do-Navigation in einen eigenen Bereich.
   - Verwendet die bestehenden DEV- und LIVE-LOG-Renderer unverändert weiter.
   - Home und Sport bleiben globale Navigation; To-do-Daten werden nicht verändert.
*/
(function(){
  'use strict';
  if(window.__modBackstageV530)return;

  const VERSION='V530';
  const BODY_CLASS='mod-backstage-v530';
  const ROOT_ID='modBackstageV530';
  const VALID_SECTIONS=new Set(['dev','log']);

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

  function isOpen(){return document.body.classList.contains(BODY_CLASS);}

  function ensureUi(){
    let root=document.getElementById(ROOT_ID);
    if(root)return root;
    const view=document.getElementById('viewContainer');
    if(!view||!view.parentNode)return null;

    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='mod-backstage-nav-v530';
    root.setAttribute('aria-label','Backstage Navigation');
    root.innerHTML=`
      <div class="mod-backstage-brand-v530">
        <div class="mod-backstage-title-v530">BACKSTAGE</div>
        <div class="mod-backstage-subtitle-v530">DIAGNOSE · LIVE-LOG</div>
      </div>
      <div class="mod-backstage-tabs-v530" role="tablist" aria-label="Backstage Bereiche">
        <button type="button" class="mod-backstage-tab-v530" data-backstage-section-v530="dev" role="tab" aria-selected="true">DEV</button>
        <button type="button" class="mod-backstage-tab-v530" data-backstage-section-v530="log" role="tab" aria-selected="false">LOG</button>
      </div>`;
    view.parentNode.insertBefore(root,view);

    root.querySelectorAll('[data-backstage-section-v530]').forEach(button=>{
      button.addEventListener('click',()=>setSection(button.dataset.backstageSectionV530));
    });
    return root;
  }

  function syncNav(){
    const root=ensureUi();
    if(!root)return;
    root.querySelectorAll('[data-backstage-section-v530]').forEach(button=>{
      const selected=button.dataset.backstageSectionV530===activeSection;
      button.setAttribute('aria-selected',selected?'true':'false');
      button.tabIndex=selected?0:-1;
    });
  }

  function setSection(section){
    section=VALID_SECTIONS.has(section)?section:'dev';
    activeSection=section;
    switchExistingTab(section);
    syncNav();
    if(section==='dev'){
      try{window.__modBuildFreshnessV502?.load?.(true);}catch(_){}
      setTimeout(()=>{try{window.__modBuildFreshnessV502?.patch?.();}catch(_){}},0);
    }else{
      setTimeout(()=>{try{window.__modLiveLogV453?.renderLog?.();}catch(_){}},0);
    }
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return section;
  }

  function rememberTodoTab(){
    const value=currentTabValue();
    if(!VALID_SECTIONS.has(value))previousTodoTab=value||'all';
    if(!previousTodoTab||VALID_SECTIONS.has(previousTodoTab))previousTodoTab='all';
    return previousTodoTab;
  }

  function restoreTodoTab(){
    const target=previousTodoTab&&!VALID_SECTIONS.has(previousTodoTab)?previousTodoTab:'all';
    switchExistingTab(target);
    return target;
  }

  function close({restoreTodo=true}={}){
    if(!isOpen())return false;
    document.body.classList.remove(BODY_CLASS);
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
    document.body.classList.add(BODY_CLASS);
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
    }
    const launcher=window.__modHubLauncherV517;
    if(launcher){
      try{
        const item=Array.isArray(launcher.modules)?launcher.modules.find(entry=>entry.id==='backstage'):null;
        if(item)item.active=true;
        launcher.backstagePrepared=false;
        launcher.backstageActiveV530=true;
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
    return !!(hubApi()&&window.__modHubLauncherV517);
  }

  window.__modBackstageV530={
    version:VERSION,
    open,
    close,
    setSection,
    patchHub,
    patchLauncher,
    isOpen,
    get activeSection(){return activeSection;},
    get previousTodoTab(){return previousTodoTab;},
    devAndLogMoved:true,
    existingRenderersReused:true,
    todoDataUntouched:true,
    sportHealthHookPreserved:true,
    homeNavigationPreserved:true
  };

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
