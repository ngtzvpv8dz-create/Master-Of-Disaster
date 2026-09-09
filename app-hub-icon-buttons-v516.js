/* V516 · HUB ICON BUTTONS
   - Turns the V515 hub cards into non-interactive shells.
   - The icon tile itself becomes the primary launcher button.
   - Reuses the exact custom line-icon paths from V419/V420 history.
   - Keeps V515 navigation, Health hook and data behavior untouched.
*/
(function(){
  'use strict';
  if(window.__modHubIconButtonsV516)return;

  const VERSION='V516';
  const ROOT_ID='modAppHubV515';
  const TYPES=['todo','sport','food'];
  let observer=null;
  let patching=false;

  const ICONS={
    todo:{
      origin:'V419 · check',
      body:'<path d="m5 12.5 4.2 4.2L19 7"/>'
    },
    sport:{
      origin:'V420 · weight',
      body:'<path d="M8 8.5h8l1.5 11h-11Z"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0"/><path d="M12 12v4M10 14h4"/>'
    },
    food:{
      origin:'V419 · cooking',
      body:'<path d="M7 4v7M10 4v7M7 8h3M8.5 11v9M16 4c-2 3-2 6 0 8v8"/>'
    }
  };

  function api(){return window.__modAppHubV515||null;}
  function validType(type){return TYPES.includes(type)?type:null;}

  function iconMarkup(type){
    type=validType(type);
    const icon=type&&ICONS[type];
    if(!icon)return '';
    return `<span class="mod-hub-original-icon-v516 mod-hub-original-icon-${type}-v516" data-mod-hub-icon-origin="${icon.origin}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon.body}</svg></span>`;
  }

  function applyIconVisual(button,type){
    const tile=button.querySelector('.mod-hub-icon-v515');
    type=validType(type);
    if(!tile||!type)return false;
    tile.innerHTML=iconMarkup(type);
    button.dataset.modHubIconAsset='original-svg';
    button.dataset.modHubIconOrigin=ICONS[type].origin;
    return true;
  }

  function activate(type,card){
    if(type==='food'){
      card.classList.remove('mod-hub-nudge-v515');
      void card.offsetWidth;
      card.classList.add('mod-hub-nudge-v515');
      setTimeout(()=>card.classList.remove('mod-hub-nudge-v515'),420);
      return;
    }
    api()?.open?.(type,{source:'hub'});
  }

  function transformCard(oldCard){
    const type=validType(oldCard?.dataset?.modHubOpen);
    if(!type||oldCard.dataset.modHubIconButtonsV516==='done')return oldCard;

    const card=document.createElement('article');
    card.className=oldCard.className;
    card.dataset.modHubModule=type;
    card.dataset.modHubIconButtonsV516='done';
    card.setAttribute('aria-label',type==='food'?'Food, kommt später':`${type==='todo'?'To-do':'Sport'} Bereich`);

    while(oldCard.firstChild)card.appendChild(oldCard.firstChild);
    oldCard.replaceWith(card);

    const tile=card.querySelector('.mod-hub-icon-v515');
    if(tile){
      const launcher=document.createElement('button');
      launcher.type='button';
      launcher.className=`mod-hub-icon-button-v516 mod-hub-icon-button-${type}-v516`;
      launcher.dataset.modHubOpen=type;
      launcher.setAttribute('aria-label',type==='food'?'Food, kommt später':`${type==='todo'?'To-do':'Sport'} öffnen`);
      if(type==='food')launcher.setAttribute('aria-disabled','true');
      tile.replaceWith(launcher);
      launcher.appendChild(tile);
      applyIconVisual(launcher,type);
      launcher.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        activate(type,card);
      });
    }

    return card;
  }

  function patch(){
    if(patching)return false;
    const root=document.getElementById(ROOT_ID);
    if(!root)return false;
    patching=true;
    try{
      [...root.querySelectorAll('button.mod-hub-card-v515[data-mod-hub-open]')].forEach(transformCard);
      root.querySelectorAll('.mod-hub-icon-button-v516[data-mod-hub-open]').forEach(button=>{
        if(button.dataset.modHubIconAsset!=='original-svg')applyIconVisual(button,button.dataset.modHubOpen);
      });
      root.dataset.modHubIconButtonsV516='ready';
      return true;
    }finally{patching=false;}
  }

  function refreshIcons(){
    const root=document.getElementById(ROOT_ID);
    if(!root)return false;
    root.querySelectorAll('.mod-hub-icon-button-v516[data-mod-hub-open]').forEach(button=>applyIconVisual(button,button.dataset.modHubOpen));
    return true;
  }

  function startObserver(){
    const root=document.getElementById(ROOT_ID);
    if(!root||observer)return;
    observer=new MutationObserver(()=>queueMicrotask(()=>patch()));
    observer.observe(root,{childList:true,subtree:false});
  }

  function init(){
    if(!api()||!document.getElementById(ROOT_ID))return false;
    patch();
    startObserver();
    return true;
  }

  window.__modHubIconButtonsV516={
    version:VERSION,
    patch,
    refreshIcons,
    iconOrigins:Object.fromEntries(Object.entries(ICONS).map(([type,icon])=>[type,icon.origin])),
    exactAreaIconAssetsBundled:true,
    originalGitHubSvgIcons:true,
    iconTileIsPrimaryButton:true,
    wholeCardIsButton:false,
    v515NavigationPreserved:true,
    todoDataUntouched:true,
    sportDataUntouched:true
  };

  let tries=0;
  const boot=setInterval(()=>{tries++;if(init()||tries>200)clearInterval(boot);},80);
  window.addEventListener('load',()=>setTimeout(init,260));
})();
