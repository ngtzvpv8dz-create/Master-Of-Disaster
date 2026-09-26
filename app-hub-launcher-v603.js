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
    if(item.id==='shopping'){
      return '<svg class="mod-hub-app-shopping-art-v646" viewBox="0 0 192 192" aria-hidden="true">'
        +'<defs>'
          +'<linearGradient id="shopBg646" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b371d"/><stop offset=".52" stop-color="#3d2818"/><stop offset="1" stop-color="#251c15"/></linearGradient>'
          +'<linearGradient id="shopBasket646" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1c477"/><stop offset="1" stop-color="#c98940"/></linearGradient>'
          +'<linearGradient id="shopPaper646" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4da"/><stop offset="1" stop-color="#e7d5ad"/></linearGradient>'
          +'<linearGradient id="shopLeaf646" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9cbd6a"/><stop offset="1" stop-color="#557a45"/></linearGradient>'
        +'</defs>'
        +'<rect x="7" y="7" width="178" height="178" rx="39" fill="url(#shopBg646)" stroke="#d79a52" stroke-width="3"/>'
        +'<path d="M118 35h39a9 9 0 0 1 9 9v56a9 9 0 0 1-9 9h-39a9 9 0 0 1-9-9V44a9 9 0 0 1 9-9Z" fill="url(#shopPaper646)" opacity=".98"/>'
        +'<path d="M120 52h12M139 52h15M120 68h12M139 68h15M120 84h12M139 84h15" fill="none" stroke="#8a6841" stroke-width="4" stroke-linecap="round"/>'
        +'<path d="m120 51 4 4 7-8M120 67l4 4 7-8M120 83l4 4 7-8" fill="none" stroke="#6c8c4f" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'
        +'<path d="M64 55c3-15 14-26 28-29 4 16-2 29-18 37" fill="url(#shopLeaf646)"/>'
        +'<path d="M80 59c8-17 21-24 36-21-1 15-11 26-28 31" fill="#72944f"/>'
        +'<path d="M45 68c0-13 7-23 18-29 8 12 7 25-4 37" fill="#89ad59"/>'
        +'<path d="M42 74 31 56c-3-5 1-11 7-11h8l14 26" fill="#e2a454"/>'
        +'<path d="M30 73h102l-9 65H42Z" fill="url(#shopBasket646)" stroke="#6d4627" stroke-width="4" stroke-linejoin="round"/>'
        +'<path d="M24 73h115M52 86l5 39M78 86l2 39M104 86l-2 39" fill="none" stroke="#7b5030" stroke-width="4" stroke-linecap="round"/>'
        +'<path d="M33 72 23 49H13" fill="none" stroke="#efc67f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        +'<circle cx="56" cy="151" r="9" fill="#2d241d" stroke="#d5a35e" stroke-width="4"/><circle cx="112" cy="151" r="9" fill="#2d241d" stroke="#d5a35e" stroke-width="4"/>'
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
    updateProgress,homescreenStyle:true,nineTileGrid:true,denkfabrikTileV634:true,shoppingActiveV643:true,realBootstrapProgress:true,legacyLoadersRemoved:true
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