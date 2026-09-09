/* V515 · MODULAR APP HUB
   - App starts on a dedicated module launcher.
   - To-do and Sport remain existing independent surfaces.
   - Sport entry exposes a Health-sync hook without implementing transport yet.
   - Food is reserved as a visible future module.
*/
(function(){
  'use strict';
  if(window.__modAppHubV515)return;

  const VERSION='V515';
  const ROOT_ID='modAppHubV515';
  const HUB_CLASS='mod-app-hub-v515';
  const HEALTH_EVENT='mod:health-sync-request';
  let switchCaptureInstalled=false;

  function sportApi(){return window.__modSportModeV510||null;}

  function shouldAutoStartHub(){
    try{
      const params=new URL(location.href).searchParams;
      const reg=params.get('reg');
      if(reg==='v515')return true;
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

  function iconMarkup(type){
    if(type==='todo')return '<span class="mod-hub-icon-line mod-hub-icon-check">✓</span>';
    if(type==='sport')return '<span class="mod-hub-icon-line mod-hub-icon-sport">S</span>';
    return '<span class="mod-hub-icon-line mod-hub-icon-food">F</span>';
  }

  function render(){
    const root=ensureRoot();
    if(!root)return false;
    root.innerHTML=`
      <div class="mod-hub-backdrop-v515" aria-hidden="true">
        <span class="mod-hub-glow-v515 mod-hub-glow-todo-v515"></span>
        <span class="mod-hub-glow-v515 mod-hub-glow-sport-v515"></span>
        <span class="mod-hub-grid-v515"></span>
      </div>
      <div class="mod-hub-shell-v515">
        <div class="mod-hub-intro-v515">
          <div class="mod-hub-kicker-v515">MASTER OF DISASTER</div>
          <h2 class="mod-hub-title-v515">Was steht heute an?</h2>
          <p class="mod-hub-copy-v515">Wähle deinen Bereich.</p>
        </div>
        <div class="mod-hub-modules-v515">
          <button type="button" class="mod-hub-card-v515 mod-hub-card-todo-v515" data-mod-hub-open="todo" aria-label="To-do öffnen">
            <span class="mod-hub-card-shine-v515" aria-hidden="true"></span>
            <span class="mod-hub-icon-v515">${iconMarkup('todo')}</span>
            <span class="mod-hub-card-text-v515"><strong>TO-DO</strong><small>Planen · Erledigen · Überblick</small></span>
            <span class="mod-hub-arrow-v515" aria-hidden="true">→</span>
          </button>
          <button type="button" class="mod-hub-card-v515 mod-hub-card-sport-v515" data-mod-hub-open="sport" aria-label="Sport öffnen">
            <span class="mod-hub-card-shine-v515" aria-hidden="true"></span>
            <span class="mod-hub-icon-v515">${iconMarkup('sport')}</span>
            <span class="mod-hub-card-text-v515"><strong>SPORT</strong><small>FitX · Training · Health</small></span>
            <span class="mod-hub-arrow-v515" aria-hidden="true">→</span>
          </button>
          <button type="button" class="mod-hub-card-v515 mod-hub-card-food-v515" data-mod-hub-open="food" aria-label="Food, kommt später" aria-disabled="true">
            <span class="mod-hub-card-shine-v515" aria-hidden="true"></span>
            <span class="mod-hub-icon-v515">${iconMarkup('food')}</span>
            <span class="mod-hub-card-text-v515"><strong>FOOD</strong><small>Rezepte · Ideen · Bilder</small></span>
            <span class="mod-hub-badge-v515">SPÄTER</span>
          </button>
        </div>
        <div class="mod-hub-footer-v515">Deine Bereiche. Eine Zentrale.</div>
      </div>`;

    root.querySelectorAll('[data-mod-hub-open]').forEach(button=>button.addEventListener('click',()=>{
      const target=button.dataset.modHubOpen;
      if(target==='food'){
        button.classList.remove('mod-hub-nudge-v515');
        void button.offsetWidth;
        button.classList.add('mod-hub-nudge-v515');
        setTimeout(()=>button.classList.remove('mod-hub-nudge-v515'),420);
        return;
      }
      open(target,{source:'hub'});
    }));
    return true;
  }

  function show(){
    render();
    try{sportApi()?.setMode?.('todo',{persist:false,animate:false});}catch(_){}
    try{localStorage.setItem(sportApi()?.modeKey||'masterOfDisasterAppModeV510','todo');}catch(_){}
    document.body.classList.add(HUB_CLASS);
    document.body.dataset.modAppSurfaceV515='hub';
    const root=document.getElementById(ROOT_ID);
    root?.setAttribute('aria-hidden','false');
    return 'hub';
  }

  function hide(){
    document.body.classList.remove(HUB_CLASS);
    const root=document.getElementById(ROOT_ID);
    root?.setAttribute('aria-hidden','true');
  }

  function open(target,{source='hub'}={}){
    target=target==='sport'?'sport':'todo';
    hide();
    document.body.dataset.modAppSurfaceV515=target;
    if(target==='sport')dispatchHealthSync(source==='switch'?'sport-switch':'hub-sport');
    try{sportApi()?.setMode?.(target,{persist:true,animate:true});}catch(_){}
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return target;
  }

  function installSportSwitchCapture(){
    if(switchCaptureInstalled)return;
    switchCaptureInstalled=true;
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('#sportSwitchV510');
      if(!button)return;
      if(document.body.classList.contains(HUB_CLASS)){
        event.preventDefault();
        event.stopImmediatePropagation();
        open('sport',{source:'switch'});
        return;
      }
      const mode=sportApi()?.currentMode?.();
      if(mode==='todo')dispatchHealthSync('sport-switch');
    },true);
  }

  function init(){
    render();
    installSportSwitchCapture();
    if(shouldAutoStartHub())show();
  }

  window.__modAppHubV515={
    version:VERSION,
    show,
    hide,
    open,
    render,
    dispatchHealthSync,
    shouldAutoStartHub,
    healthEvent:HEALTH_EVENT,
    rootId:ROOT_ID,
    hubClass:HUB_CLASS,
    foodReserved:true,
    healthTransportConnected:false
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.addEventListener('load',()=>{if(shouldAutoStartHub())setTimeout(show,220);},{once:true});
})();
