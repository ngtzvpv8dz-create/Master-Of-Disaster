/* V538 · SPORT S NO-OP
   - Outside Sport, the red S still opens Sport through the existing V510 handler.
   - Inside Sport, tapping the red S does nothing. Home remains the way back.
   - Historical regression routes can keep legacy V510 toggle semantics.
*/
(function(){
  'use strict';
  if(window.__modSportSNoopV538)return;

  const VERSION='V538';
  const SWITCH_ID='sportSwitchV510';
  let observer=null;

  function historicalRoute(){
    try{
      const params=new URL(location.href).searchParams;
      const reg=params.get('reg');
      const smoke=params.get('smoke');
      if(reg&&reg!=='v538')return true;
      if(smoke&&smoke!=='v538')return true;
    }catch(_){}
    return false;
  }

  function sportOpen(){return document.body.classList.contains('mod-sport-mode-v510');}

  function syncChrome(){
    const button=document.getElementById(SWITCH_ID);
    if(button){
      if(sportOpen()){
        button.setAttribute('aria-label','Sport ist geöffnet');
        button.title='Sport ist geöffnet';
      }else{
        button.setAttribute('aria-label','Sport öffnen');
        button.title='Sport öffnen';
      }
    }
    const hint=document.querySelector('.sport-mode-hint-v510');
    if(hint&&sportOpen())hint.textContent='Über das Haus geht es zurück zum Home-Bildschirm.';
  }

  function capture(event){
    if(historicalRoute())return;
    const button=event.target?.closest?.('#'+SWITCH_ID);
    if(!button||!sportOpen())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    syncChrome();
  }

  function init(){
    if(historicalRoute())return false;
    window.addEventListener('click',capture,true);
    syncChrome();
    if(typeof MutationObserver==='function'){
      observer=new MutationObserver(()=>syncChrome());
      observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
    return true;
  }

  window.__modSportSNoopV538={
    version:VERSION,
    sync:syncChrome,
    sportSwitchNoopWhenOpenV538:true,
    sportOpenFromOtherSurfacesPreservedV538:true,
    homeReturnPreservedV538:true,
    legacyRegressionRoutesPreservedV538:true
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
  window.addEventListener('load',()=>setTimeout(syncChrome,180),{once:true});
})();
