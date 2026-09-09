/* V516 · HUB ICON BUTTONS
   - Turns the V515 hub cards into non-interactive shells.
   - The icon tile itself becomes the primary launcher button.
   - Uses the existing To-do app icon and the final Sport icon asset.
   - Keeps V515 navigation, Health hook and data behavior untouched.
*/
(function(){
  'use strict';
  if(window.__modHubIconButtonsV516)return;

  const VERSION='V516';
  const ROOT_ID='modAppHubV515';
  const TYPES=['todo','sport','food'];
  const sources={
    todo:'./apple-touch-icon.png?v=516-1155',
    sport:'./sport-icon-v516.webp?v=516-1155',
    food:''
  };
  let observer=null;
  let patching=false;

  function api(){return window.__modAppHubV515||null;}
  function validType(type){return TYPES.includes(type)?type:null;}

  function sourceFor(type){
    type=validType(type);
    if(!type)return '';
    try{
      const configured=window.__MOD_HUB_ICON_SOURCES__?.[type];
      if(typeof configured==='string'&&configured.trim())return configured.trim();
    }catch(_){}
    return sources[type]||'';
  }

  function fallbackLabel(type){
    if(type==='todo')return '✓';
    if(type==='sport')return 'S';
    return 'F';
  }

  function fallbackClass(type){
    if(type==='todo')return 'mod-hub-icon-check';
    if(type==='sport')return 'mod-hub-icon-sport';
    return 'mod-hub-icon-food';
  }

  function applyIconVisual(button,type){
    const tile=button.querySelector('.mod-hub-icon-v515');
    if(!tile)return;
    const src=sourceFor(type);
    if(src){
      tile.innerHTML=`<img class="mod-hub-icon-image-v516" src="${src.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}" alt="" draggable="false">`;
      button.dataset.modHubIconAsset='image';
      return;
    }
    tile.innerHTML=`<span class="mod-hub-icon-line ${fallbackClass(type)}">${fallbackLabel(type)}</span>`;
    button.dataset.modHubIconAsset='fallback';
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

  function setIconSource(type,src){
    type=validType(type);
    if(!type)return false;
    sources[type]=typeof src==='string'?src.trim():'';
    refreshIcons();
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
    setIconSource,
    sourceFor,
    primaryAreaIconsBundled:true,
    exactAreaIconAssetsBundled:true,
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
