/* V603 · CURRENT HOMESCREEN LAUNCHER
   Zeigt nur die finalen Bereichsicons und den echten Bootstrap-Fortschritt.
   Keine historischen Kistology-/Sport-Kompatibilitätsloader mehr.
*/
(function(){
  'use strict';
  if(window.__modHubLauncherV603)return;

  const VERSION='V603';
  const ROOT_ID='modAppHubV515';
  const SOURCES={
    todo:'./assets/icons/todo-v524-192.png?v=603',
    sport:'./assets/icons/sport-v524-192.png?v=603',
    kistology:'./assets/icons/kistology-v524-192.png?v=603',
    food:'./assets/icons/food-v524-192.png?v=603',
    shopping:'./assets/icons/shopping-v584-192.png?v=643',
    finance:'./assets/icons/finance-v584-192.png?v=603',
    progress:'./assets/icons/progress-v540-192.png?v=603',
    backstage:'./assets/icons/backstage-v524-192.png?v=603',
    denkfabrik:'./assets/icons/denkfabrik-v634-192.jpg?v=634'
  };
  const MODULES=[
    {id:'todo',label:'TO-DO',active:true},
    {id:'sport',label:'SPORT',active:true},
    {id:'kistology',label:'KISTOLOGY',active:true},
    {id:'food',label:'FOOD',active:true},
    {id:'shopping',label:'EINKAUFSLISTE',active:true},
    {id:'finance',label:'FINANZEN',active:true},
    {id:'progress',label:'PROGRESS',active:false},
    {id:'backstage',label:'BACKSTAGE',active:true},
    {id:'denkfabrik',label:'DENKFABRIK',active:true}
  ];
  let observer=null;
  let patching=false;
  let lastProgress={loaded:0,total:1,percent:0,label:'Bereiche werden geladen',ready:false,error:null};

  function hubApi(){return window.__modAppHubV603||window.__modAppHubV515||null;}
  function runtime(){return window.__modAreaRuntimeV603||null;}
  function isReady(){return runtime()?.ready===true;}

  function iconMarkup(item){
    if(item.id==='denkfabrik'){
      return '<svg class="mod-hub-app-denk-art-v752" viewBox="0 0 192 192" aria-hidden="true">'
        +'<defs>'
          +'<linearGradient id="hubDenkBg752" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#294d67"/><stop offset=".5" stop-color="#183247"/><stop offset="1" stop-color="#0e2231"/></linearGradient>'
          +'<linearGradient id="hubDenkRim752" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d6a5"/><stop offset=".5" stop-color="#92b5cc"/><stop offset="1" stop-color="#b07b45"/></linearGradient>'
          +'<radialGradient id="hubDenkBrain752" cx=".38" cy=".28" r=".8"><stop offset="0" stop-color="#fff8e8"/><stop offset=".68" stop-color="#eadcc5"/><stop offset="1" stop-color="#bda98d"/></radialGradient>'
        +'</defs>'
        +'<rect x="6" y="6" width="180" height="180" rx="40" fill="url(#hubDenkBg752)" stroke="url(#hubDenkRim752)" stroke-width="5"/>'
        +'<g opacity=".9" fill="none" stroke="#c89b61" stroke-width="4" stroke-linecap="round"><path d="M26 80h26l14 12"/><path d="M24 116h31l13-11"/><path d="M166 76h-27l-13 13"/><path d="M168 120h-31l-12-12"/></g>'
        +'<g fill="#e8c995" stroke="#8d6338" stroke-width="3"><circle cx="25" cy="80" r="7"/><circle cx="23" cy="116" r="7"/><circle cx="167" cy="76" r="7"/><circle cx="169" cy="120" r="7"/></g>'
        +'<g transform="translate(96 97)">'
          +'<path d="M0-65 13-62 18-49 31-43 42-49 52-38 48-25 55-13 68-10 69 4 57 10 52 23 57 35 47 46 34 42 22 50 18 64 3 66-4 54-18 50-30 57-42 47-38 33-46 22-60 18-61 3-49-4-45-18-52-29-41-41-28-37-17-46-13-60Z" fill="#7da1ba" stroke="#e3c48f" stroke-width="4"/>'
          +'<circle cx="4" cy="1" r="47" fill="#132b3e" stroke="#9bb8ca" stroke-width="3"/>'
          +'<path d="M3-37c-15-14-37-2-33 16-14 6-13 28 4 32-6 17 10 31 26 23V-37Z" fill="url(#hubDenkBrain752)" stroke="#8d7b66" stroke-width="3"/>'
          +'<path d="M5-37c15-14 37-2 33 16 14 6 13 28-4 32 6 17-10 31-26 23V-37Z" fill="url(#hubDenkBrain752)" stroke="#8d7b66" stroke-width="3"/>'
          +'<g fill="none" stroke="#a4937c" stroke-width="3" stroke-linecap="round"><path d="M-8-27c-11 4-12 14-5 21"/><path d="M-28-13c11 2 15 11 10 20"/><path d="M-22 16c8-7 17-6 22 1"/><path d="M16-27c11 4 12 14 5 21"/><path d="M36-13c-11 2-15 11-10 20"/><path d="M30 16c-8-7-17-6-22 1"/></g>'
          +'<path d="M4-38v76" stroke="#8a7359" stroke-width="3"/>'
        +'</g>'
        +'</svg>';
    }
    if(item.id==='shopping'){
      return '<svg class="mod-hub-app-shopping-art-v647" viewBox="0 0 192 192" aria-hidden="true">'
        +'<defs>'
          +'<linearGradient id="shopBg647" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11161f"/><stop offset=".48" stop-color="#121923"/><stop offset="1" stop-color="#0d1218"/></linearGradient>'
          +'<linearGradient id="shopRim647" x1="0" y1=".2" x2="1" y2=".8"><stop offset="0" stop-color="#e7a34b"/><stop offset=".42" stop-color="#f2d2a5"/><stop offset=".72" stop-color="#466f9f"/><stop offset="1" stop-color="#233f65"/></linearGradient>'
          +'<linearGradient id="shopBasket647" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5ead7"/><stop offset="1" stop-color="#d5b696"/></linearGradient>'
          +'<linearGradient id="shopBlue647" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#77b6df"/><stop offset="1" stop-color="#2a476c"/></linearGradient>'
          +'<linearGradient id="shopGreen647" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9dcf55"/><stop offset="1" stop-color="#5d9d08"/></linearGradient>'
        +'</defs>'
        +'<rect x="7" y="7" width="178" height="178" rx="39" fill="url(#shopBg647)" stroke="url(#shopRim647)" stroke-width="4"/>'
        +'<path d="M53 70c-1-17 7-31 21-39 9 14 8 28-4 42" fill="url(#shopGreen647)"/>'
        +'<path d="M69 67c2-19 13-31 30-34 5 17-2 31-18 42" fill="#7fba2f"/>'
        +'<path d="M87 68c8-16 20-24 35-22-1 15-10 26-26 31" fill="#6aa323"/>'
        +'<path d="M103 66c7-13 16-19 27-18-1 11-7 19-19 25" fill="#5d9d08"/>'
        +'<path d="m105 64 5-17" fill="none" stroke="#668f25" stroke-width="3.5" stroke-linecap="round"/>'
        +'<path d="M93 58c11 2 17 10 17 21-9 2-16-3-22-12Z" fill="#f0a34c"/>'
        +'<path d="M97 55c3-5 7-8 11-10M99 56c0-5 1-9 3-12" fill="none" stroke="#6aa323" stroke-width="3" stroke-linecap="round"/>'
        +'<g transform="translate(116 42) rotate(8)">'
          +'<rect x="0" y="8" width="26" height="52" rx="7" fill="#f5ead7"/>'
          +'<rect x="2" y="14" width="22" height="34" rx="5" fill="url(#shopBlue647)"/>'
          +'<rect x="6" y="0" width="14" height="12" rx="3" fill="#4d90c2"/>'
          +'<rect x="8" y="18" width="10" height="17" rx="3" fill="#d8edf8" opacity=".95"/>'
        +'</g>'
        +'<path d="M36 79 28 59H17" fill="none" stroke="#f2d2a5" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
        +'<path d="M35 80h108l-10 58H47Z" fill="url(#shopBasket647)" stroke="#a77748" stroke-width="4" stroke-linejoin="round"/>'
        +'<path d="M49 94h81M60 84l6 44M84 84l2 44M108 84l-2 44M132 84l-7 44" fill="none" stroke="#8b6a4a" stroke-width="5" stroke-linecap="round"/>'
        +'<circle cx="62" cy="151" r="10" fill="#5f5952" stroke="#e0bc89" stroke-width="4"/><circle cx="118" cy="151" r="10" fill="#5f5952" stroke="#e0bc89" stroke-width="4"/>'
        +'<circle cx="62" cy="151" r="3" fill="#f5ead7"/><circle cx="118" cy="151" r="3" fill="#f5ead7"/>'
        +'</svg>';
    }
    return '<img class="mod-hub-app-icon-v517" src="'+SOURCES[item.id]+'" alt="" draggable="false" decoding="async" width="192" height="192">';
  }
  function labelMarkup(item){return '<span class="mod-hub-app-label-v517">'+item.label+'</span>';}
  function ariaLabel(item){
    const names={todo:'To-do',sport:'Sport',kistology:'Kistology',food:'Food',shopping:'Einkaufsliste',finance:'Finanzen',progress:'Progress',backstage:'Backstage',denkfabrik:'Denkfabrik'};
    return (names[item.id]||item.label)+(item.active?' öffnen':' noch nicht aktiv');
  }
  function progressMarkup(){
    const p=lastProgress;
    const state=p.error?'error':p.ready?'ready':'loading';
    const label=p.ready?'Bereiche bereit':p.error?'Laden fehlgeschlagen · tippen zum Wiederholen':(p.label||'Bereiche werden geladen');
    return '<div class="mod-hub-preload-v603" data-state="'+state+'" '+(p.error?'data-mod-bootstrap-retry-v603 role="button" tabindex="0"':'')+'>'+
      '<span>'+label+'</span><strong>'+Math.max(0,Math.min(100,Number(p.percent)||0))+' %</strong>'+
      '<span class="mod-hub-preload-track-v603" aria-hidden="true"><i style="--mod-bootstrap-percent-v603:'+Math.max(0,Math.min(100,Number(p.percent)||0))+'%"></i></span>'+
    '</div>';
  }

  function pulse(button){
    button.classList.remove('mod-hub-app-pulse-v517');
    void button.offsetWidth;
    button.classList.add('mod-hub-app-pulse-v517');
    setTimeout(()=>button.classList.remove('mod-hub-app-pulse-v517'),420);
  }

  function activate(item,button){
    if(!item?.active||!isReady()){pulse(button);return false;}
    return runtime()?.openArea?.(item.id)??false;
  }

  function render(){
    if(patching)return false;
    const root=document.getElementById(ROOT_ID);
    const shell=root?.querySelector('.mod-hub-shell-v515');
    if(!root||!shell)return false;
    patching=true;
    try{
      const ready=isReady();
      shell.innerHTML=progressMarkup()+'<div class="mod-hub-app-grid-v517" role="group" aria-label="Bereiche auswählen">'+
        MODULES.map(item=>'<div class="mod-hub-app-slot-v517 mod-hub-app-slot-'+item.id+'-v517">'+
          '<button type="button" class="mod-hub-app-button-v517 mod-hub-app-button-'+item.id+'-v517" data-mod-hub-launch-v517="'+item.id+'" aria-label="'+ariaLabel(item)+'" '+((ready&&item.active)?'':'aria-disabled="true"')+'>'+
            '<span class="mod-hub-app-face-v517">'+iconMarkup(item)+'</span>'+
          '</button>'+labelMarkup(item)+'</div>').join('')+
        '</div>';
      shell.querySelectorAll('[data-mod-hub-launch-v517]').forEach(button=>{
        const item=MODULES.find(entry=>entry.id===button.dataset.modHubLaunchV517);
        button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();activate(item,button);});
      });
      const retry=shell.querySelector('[data-mod-bootstrap-retry-v603]');
      retry?.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();runtime()?.retry?.();}});
      root.dataset.modHubLauncherV603='ready';
      return true;
    }finally{patching=false;}
  }

  function updateProgress(detail){
    if(detail&&typeof detail==='object')lastProgress={...lastProgress,...detail};
    render();
  }

  function startObserver(){
    const root=document.getElementById(ROOT_ID);
    if(!root||observer)return;
    observer=new MutationObserver(()=>queueMicrotask(render));
    observer.observe(root,{childList:true,subtree:false});
  }

  function init(){
    if(!hubApi()||!document.getElementById(ROOT_ID))return false;
    if(runtime()?.progress)lastProgress={...lastProgress,...runtime().progress};
    render();
    startObserver();
    return true;
  }

  const api={
    version:VERSION,render,sources:{...SOURCES},modules:MODULES.map(item=>({...item})),
    updateProgress,homescreenStyle:true,nineTileGrid:true,denkfabrikTileV634:true,denkfabrikVectorV752:true,shoppingActiveV643:true,realBootstrapProgress:true,legacyLoadersRemoved:true
  };
  window.__modHubLauncherV603=api;
  /* Namespace aliases keep existing feature modules/tests pointed at the one current launcher. */
  for(const key of ['__modHubLauncherV517','__modHubLauncherV518','__modHubLauncherV519','__modHubLauncherV520','__modHubLauncherV524','__modHubLauncherV540','__modHubLauncherV543','__modHubLauncherV552','__modHubLauncherV582','__modHubLauncherV584'])window[key]=api;

  window.addEventListener('mod:bootstrap-v603-progress',event=>updateProgress(event.detail));
  window.addEventListener('mod:bootstrap-v603-ready',event=>{lastProgress={...lastProgress,percent:100,ready:true,error:null,label:'Alle Bereiche bereit'};render();});
  let tries=0;const timer=setInterval(()=>{tries++;if(init()||tries>120)clearInterval(timer);},50);
  if(document.readyState!=='loading')setTimeout(init,0);
  window.addEventListener('load',()=>setTimeout(init,80),{once:true});
})();