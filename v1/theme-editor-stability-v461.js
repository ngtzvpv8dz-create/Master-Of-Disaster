/* V461 · THEME-EDITOR STABILITAET
   V460 beobachtete #viewContainer zu aggressiv. V461 entkoppelt den alten
   Observer nach dem Laden und synchronisiert den Editor nur noch bei echten
   Render-/Bedienereignissen. Dadurch werden Buttons beim Antippen nicht mehr
   laufend aus dem DOM ersetzt.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V461';
  let stabilized=false;
  let refreshTimer=null;

  function scheduleThemeRefresh(delay=24){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{
      if(typeof currentTab==='undefined'||currentTab!=='theme')return;
      try{if(typeof render==='function')render();}catch(error){console.warn('V461 Theme refresh:',error);}
    },delay);
  }

  function replaceObservedHostAfterLegacyObserversAttached(){
    if(stabilized)return true;
    const oldHost=document.getElementById('viewContainer');
    if(!oldHost||!oldHost.parentNode)return false;
    const fresh=document.createElement('div');
    fresh.id='viewContainer';
    fresh.className=oldHost.className||'';
    for(const attr of [...oldHost.attributes]){
      if(attr.name!=='id'&&attr.name!=='class')fresh.setAttribute(attr.name,attr.value);
    }
    oldHost.replaceWith(fresh);
    stabilized=true;
    window.__modThemeStabilityV461HostReplaced=true;
    try{if(typeof render==='function')render();}catch(error){console.warn('V461 initial render:',error);}
    return true;
  }

  function isLegacyThemeRerenderControl(target){
    const button=target?.closest?.('.theme-editor-v458 button');
    if(!button)return false;
    if(button.closest('.theme-state-position-v460'))return false;
    if(button.matches('[data-theme-role-select],[data-preset],#themeResetV458,#themeLoadSnapshotV458,#themeSaveSnapshotV458'))return true;
    return false;
  }

  document.addEventListener('click',event=>{
    if(typeof currentTab==='undefined'||currentTab!=='theme')return;
    if(isLegacyThemeRerenderControl(event.target))scheduleThemeRefresh();
  });

  document.addEventListener('change',event=>{
    if(typeof currentTab==='undefined'||currentTab!=='theme')return;
    if(event.target?.matches?.('#themeImportFileV458'))scheduleThemeRefresh(40);
  });

  // V460/V459 registrieren ihre load-Observer vor diesem Modul. Da dieser
  // Listener spaeter registriert wird, ersetzen wir den Host erst danach.
  window.addEventListener('load',()=>{
    setTimeout(()=>{
      replaceObservedHostAfterLegacyObserversAttached();
      scheduleThemeRefresh(60);
    },0);
  });

  window.__modThemeStabilityV461={
    version:BUILD_VERSION,
    stabilize:replaceObservedHostAfterLegacyObserversAttached,
    scheduleThemeRefresh,
    get stabilized(){return stabilized;}
  };
})();
