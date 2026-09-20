/* V603 · MODULAR APP HUB CORE
   Nur noch der aktuelle Homescreen-Shell und die Navigation.
   Die frühere V515→V516→V517 DOM-Umbaukette ist entfernt.
*/
(function(){
  'use strict';
  if(window.__modAppHubV603)return;

  const VERSION='V603';
  const ROOT_ID='modAppHubV515';
  const HUB_CLASS='mod-app-hub-v515';
  const HEALTH_EVENT='mod:health-sync-request';

  function sportApi(){return window.__modSportModeV510||window.__modSportV568||null;}

  function shouldAutoStartHub(){
    try{
      const params=new URL(location.href).searchParams;
      if(params.has('reg')||params.has('smoke'))return false;
    }catch(_){}
    return true;
  }

  function dispatchHealthSync(source){
    const detail={source:String(source||'sport-entry'),requestedAt:new Date().toISOString(),version:VERSION};
    window.dispatchEvent(new CustomEvent(HEALTH_EVENT,{detail}));
    return detail;
  }

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(root)return root;
    const app=document.querySelector('.app');
    if(!app)return null;
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='mod-app-hub-v515';
    root.setAttribute('aria-label','Master of Disaster Bereiche');
    const input=document.getElementById('inputPanel');
    app.insertBefore(root,input||app.firstChild?.nextSibling||null);
    return root;
  }

  function render(){
    const root=ensureRoot();
    if(!root)return false;
    root.innerHTML='<div class="mod-hub-backdrop-v515" aria-hidden="true"><span class="mod-hub-glow-v515 mod-hub-glow-todo-v515"></span><span class="mod-hub-glow-v515 mod-hub-glow-sport-v515"></span><span class="mod-hub-grid-v515"></span></div><div class="mod-hub-shell-v515"></div>';
    try{window.__modHubLauncherV603?.render?.();}catch(_){}
    return true;
  }

  function show(){
    render();
    try{sportApi()?.setMode?.('todo',{persist:false,animate:false});}catch(_){}
    document.body.classList.add(HUB_CLASS);
    document.body.dataset.modAppSurfaceV515='hub';
    const root=document.getElementById(ROOT_ID);
    root?.setAttribute('aria-hidden','false');
    try{window.__modSurfaceHeaderV603?.apply?.();}catch(_){}
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return 'hub';
  }

  function hide(){
    document.body.classList.remove(HUB_CLASS);
    document.getElementById(ROOT_ID)?.setAttribute('aria-hidden','true');
  }

  function open(target,{source='hub'}={}){
    if(target!=='todo'&&target!=='sport')return false;
    hide();
    document.body.dataset.modAppSurfaceV515=target;
    if(target==='sport')dispatchHealthSync(source==='switch'?'sport-switch':'hub-sport');
    try{sportApi()?.setMode?.(target,{persist:true,animate:false});}catch(_){}
    try{window.__modSurfaceHeaderV603?.apply?.();}catch(_){}
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return target;
  }

  function init(){
    ensureRoot();
    render();
    if(shouldAutoStartHub())show();
  }

  const api={
    version:VERSION,show,hide,open,render,renderCurrentHub:render,dispatchHealthSync,shouldAutoStartHub,
    healthEvent:HEALTH_EVENT,rootId:ROOT_ID,hubClass:HUB_CLASS,currentShellV603:true,legacyCardChainRemovedV603:true
  };
  window.__modAppHubV603=api;
  window.__modAppHubV515=api;

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();