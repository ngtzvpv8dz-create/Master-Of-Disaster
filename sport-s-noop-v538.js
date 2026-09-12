/* V538 · SPORT S NO-OP · V538.1 STABILITY HOTFIX
   - Outside Sport, the red S still opens Sport through the existing V510/V515 flow.
   - Inside Sport, tapping the red S does nothing. Home remains the way back.
   - Fixes a V538 MutationObserver feedback loop that could lock the UI after Sport opened.
   - Historical regression routes keep their legacy V510 toggle semantics.
*/
(function(){
  'use strict';
  if(window.__modSportSNoopV538)return;

  const VERSION='V538';
  const PATCH_REVISION='V538.1';
  const SWITCH_ID='sportSwitchV510';
  const SPORT_ROOT_ID='sportRootV510';
  const SPORT_HINT='Über das Haus geht es zurück zum Home-Bildschirm.';
  let bodyObserver=null;
  let sportRootObserver=null;
  let captureInstalled=false;

  function historicalRoute(){
    try{
      const params=new URL(location.href).searchParams;
      const reg=params.get('reg');
      const smoke=params.get('smoke');
      if(reg&&reg!=='v538'&&reg!=='v5381')return true;
      if(smoke&&smoke!=='v538'&&smoke!=='v5381')return true;
    }catch(_){}
    return false;
  }

  function sportOpen(){return document.body?.classList.contains('mod-sport-mode-v510')===true;}

  function setAttrIfChanged(node,name,value){
    if(node&&node.getAttribute(name)!==value)node.setAttribute(name,value);
  }

  function syncChrome(){
    const open=sportOpen();
    const button=document.getElementById(SWITCH_ID);
    if(button){
      const label=open?'Sport ist geöffnet':'Sport öffnen';
      setAttrIfChanged(button,'aria-label',label);
      if(button.title!==label)button.title=label;
    }
    const hint=document.querySelector('.sport-mode-hint-v510');
    if(hint&&open&&hint.textContent!==SPORT_HINT)hint.textContent=SPORT_HINT;
  }

  function capture(event){
    if(historicalRoute())return;
    const button=event.target?.closest?.('#'+SWITCH_ID);
    if(!button||!sportOpen())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    syncChrome();
  }

  function observeSportRoot(){
    if(sportRootObserver||typeof MutationObserver!=='function')return;
    const root=document.getElementById(SPORT_ROOT_ID);
    if(!root)return;
    sportRootObserver=new MutationObserver(()=>syncChrome());
    sportRootObserver.observe(root,{childList:true,subtree:true});
  }

  function installObservers(){
    if(typeof MutationObserver!=='function')return;
    if(!bodyObserver&&document.body){
      bodyObserver=new MutationObserver(()=>{
        syncChrome();
        observeSportRoot();
      });
      bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    }
    observeSportRoot();
  }

  function init(){
    if(historicalRoute())return false;
    if(!captureInstalled){
      captureInstalled=true;
      window.addEventListener('click',capture,true);
    }
    installObservers();
    syncChrome();
    return true;
  }

  window.__modSportSNoopV538={
    version:VERSION,
    patchRevision:PATCH_REVISION,
    sync:syncChrome,
    sportSwitchNoopWhenOpenV538:true,
    sportOpenFromOtherSurfacesPreservedV538:true,
    homeReturnPreservedV538:true,
    legacyRegressionRoutesPreservedV538:true,
    observerFeedbackLoopRemovedV5381:true,
    bodyClassObserverOnlyV5381:true,
    idempotentChromeSyncV5381:true
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
  window.addEventListener('load',()=>setTimeout(()=>{installObservers();syncChrome();},180),{once:true});
})();
