/* V499 · LOG-STABILITÄT FÜR V498
   - verhindert, dass der alte V453-Log den neuen 7-Tage-Log sichtbar überzeichnet
   - unterdrückt das 5-Sekunden-Zurückspringen nach oben, solange kein neuer Logeintrag dazukam
   - lässt echtes LIVE-Folgen bei neuen Einträgen weiterhin einmalig zu
*/
(function(){
  'use strict';

  const BUILD_VERSION='V499';
  const LIVE_LOG_KEY='masterOfDisasterLiveLogV453';
  let installed=false;
  let observer=null;
  let repairBusy=false;
  let lastSeenSignature='';
  let baseScrollIntoView=null;

  function isLogTab(){
    try{return typeof currentTab!=='undefined'&&currentTab==='log';}catch(_){return false;}
  }

  function readSignature(){
    try{
      const rows=JSON.parse(localStorage.getItem(LIVE_LOG_KEY)||'[]');
      if(!Array.isArray(rows)||!rows.length)return '0';
      const last=rows[rows.length-1]||{};
      return `${rows.length}:${last.id||''}:${last.at||''}:${last.meta&&last.meta.recoveryPointId||''}`;
    }catch(_){return 'invalid';}
  }

  function enhancedReady(){
    return !!(window.__modRecoveryHistoryV498&&typeof window.__modRecoveryHistoryV498.renderEnhancedLog==='function');
  }

  function repairOldLog(){
    if(!isLogTab()||!enhancedReady()||repairBusy)return;
    const host=document.getElementById('viewContainer');
    if(!host||!host.querySelector('.live-log-v453'))return;
    repairBusy=true;
    Promise.resolve(window.__modRecoveryHistoryV498.renderEnhancedLog())
      .catch(error=>console.warn('V499 Log-Reparatur fehlgeschlagen:',error))
      .finally(()=>{repairBusy=false;});
  }

  function patchExportedOldRenderer(){
    const api=window.__modLiveLogV453;
    if(!api||api.__v499Patched)return;
    const oldRender=api.renderLog;
    api.renderLog=function(){
      if(isLogTab()&&enhancedReady())return window.__modRecoveryHistoryV498.renderEnhancedLog();
      return typeof oldRender==='function'?oldRender.apply(this,arguments):undefined;
    };
    api.__v499Patched=true;
  }

  function patchAutoScroll(){
    if(baseScrollIntoView||typeof Element==='undefined'||typeof Element.prototype.scrollIntoView!=='function')return;
    baseScrollIntoView=Element.prototype.scrollIntoView;
    lastSeenSignature=readSignature();
    Element.prototype.scrollIntoView=function(){
      try{
        if(isLogTab()&&enhancedReady()&&this.matches&&this.matches('.mod-log-day-v498')){
          const signature=readSignature();
          if(signature===lastSeenSignature)return;
          lastSeenSignature=signature;
        }
      }catch(_){}
      return baseScrollIntoView.apply(this,arguments);
    };
  }

  function injectStyle(){
    if(document.getElementById('modLogStabilityV499Style'))return;
    const style=document.createElement('style');
    style.id='modLogStabilityV499Style';
    style.textContent='body.mod-log-stability-v499 .live-log-v453{display:none!important}';
    document.head.appendChild(style);
  }

  function installObserver(){
    if(observer)return;
    const host=document.getElementById('viewContainer');
    if(!host)return;
    observer=new MutationObserver(()=>repairOldLog());
    observer.observe(host,{childList:true,subtree:true});
  }

  function install(){
    if(installed||!enhancedReady())return false;
    installed=true;
    injectStyle();
    document.body.classList.add('mod-log-stability-v499');
    patchExportedOldRenderer();
    patchAutoScroll();
    installObserver();
    repairOldLog();
    window.__modLogStabilityV499={
      version:BUILD_VERSION,
      oldRendererGuard:true,
      repeatedAutoScrollGuard:true,
      repair:repairOldLog,
      signature:readSignature
    };
    try{window.__modLiveLogV453?.append?.('SYSTEM','PASS','Log-Stabilität V499 aktiv · 7-Tage-Ansicht bleibt stabil');}catch(_){}
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>120)clearInterval(timer);
  },100);
  window.addEventListener('load',()=>setTimeout(install,250));
  window.addEventListener('focus',()=>setTimeout(()=>{install();repairOldLog();},80));
})();
