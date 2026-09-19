/* V467 · THEME PACKAGE STABILITY
   Keeps V466 attached after the legacy Theme editor rebuilds its DOM.
   No new design storage: this only re-runs the V466 patch at safe lifecycle points.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V467';
  let patching=false;
  let timer=null;
  let observer=null;

  function inTheme(){return typeof currentTab!=='undefined'&&currentTab==='theme';}
  function state(){return window.__modUxCookingEditorV460?.getLayout?.()?.selectedState||'open';}
  function expectedActions(s){return ({open:5,running:4,paused:4,cooking:4,completed:2,aborted:2})[s]||0;}
  function needsPatch(){
    if(!inTheme())return false;
    const editor=document.querySelector('.theme-editor-v458');
    if(!editor)return false;
    const toolbarOk=document.getElementById('themeSaveSnapshotV458')?.textContent?.includes('SPEICHERN');
    const panel=editor.querySelector('.v466-action-panel');
    const panelOk=!!panel&&panel.dataset.state===state();
    const sticky=document.querySelector('#themeStickyPreviewV460 .theme-sticky-cardwrap-v460 .task');
    const actions=sticky?.querySelectorAll('.icon-actions .icon-action,.icon-actions .repeat-button').length||0;
    const previewOk=!sticky||actions>=expectedActions(state());
    return !(toolbarOk&&panelOk&&previewOk);
  }
  function runPatch(){
    if(!inTheme()||patching)return false;
    const api=window.__modThemePackageActionsV466;if(!api?.patch)return false;
    patching=true;
    try{api.patch();}catch(e){console.warn('V467 Theme package patch:',e);}finally{setTimeout(()=>{patching=false;},0);}
    return true;
  }
  function schedule(delay=0,force=false){
    clearTimeout(timer);
    timer=setTimeout(()=>{if(force||needsPatch())runPatch();},delay);
  }
  function burst(){
    schedule(0,true);
    setTimeout(()=>{if(needsPatch())runPatch();},35);
    setTimeout(()=>{if(needsPatch())runPatch();},95);
    setTimeout(()=>{if(needsPatch())runPatch();},180);
  }

  const baseRender=window.render;
  if(typeof baseRender==='function')window.render=function(){const out=baseRender.apply(this,arguments);if(inTheme())setTimeout(burst,0);return out;};
  const baseSwitch=window.switchTab;
  if(typeof baseSwitch==='function')window.switchTab=function(){const out=baseSwitch.apply(this,arguments);setTimeout(burst,0);return out;};

  function wrapState(){
    const api=window.__modUxCookingEditorV460;
    if(!api||typeof api.setState!=='function'||api.__v467Wrapped)return false;
    const base=api.setState.bind(api);
    api.setState=function(s){const out=base(s);setTimeout(burst,0);return out;};
    api.__v467Wrapped=true;return true;
  }
  function ensureState(){if(!wrapState())setTimeout(ensureState,60);}

  function attachObserver(){
    observer?.disconnect();
    const host=document.getElementById('viewContainer');if(!host)return false;
    observer=new MutationObserver(()=>{if(inTheme()&&!patching&&needsPatch())schedule(25);});
    observer.observe(host,{childList:true,subtree:true});return true;
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('[data-sticky-state-v460],[data-position-state-v460],[data-theme-role-select],[data-v466-select],[data-preset],#themeSaveSnapshotV458,#themeLoadSnapshotV458,#themeResetV458'))setTimeout(burst,0);
  },true);
  window.addEventListener('load',()=>{ensureState();attachObserver();setTimeout(burst,120);});
  ensureState();setTimeout(()=>{attachObserver();burst();},0);

  window.__modThemePackageStabilityV467={version:BUILD_VERSION,burst,needsPatch,get patching(){return patching;},lifecyclePatch:true};
})();
