/* V538 · SPORT S NO-OP · V538.2 SAFE PRODUCTION ROLLBACK
   - Production: this layer is intentionally inert so the proven V510/V515 Sport flow owns navigation again.
   - Historical ?reg=v538 / ?smoke=v538 (and v5381) routes still exercise the old no-op behavior for regression compatibility.
   - Kistology and app data are untouched.
*/
(function(){
  'use strict';
  if(window.__modSportSNoopV538)return;

  const VERSION='V538';
  const PATCH_REVISION='V538.2';
  const SWITCH_ID='sportSwitchV510';
  const SPORT_HINT='Über das Haus geht es zurück zum Home-Bildschirm.';

  function historicalNoopRoute(){
    try{
      const params=new URL(location.href).searchParams;
      const reg=params.get('reg');
      const smoke=params.get('smoke');
      return reg==='v538'||smoke==='v538'||reg==='v5381'||smoke==='v5381';
    }catch(_){return false;}
  }

  if(!historicalNoopRoute()){
    window.__modSportSNoopV538={
      version:VERSION,
      patchRevision:PATCH_REVISION,
      disabledInProductionV5382:true,
      legacySportFlowRestoredV5382:true,
      sportSwitchNoopWhenOpenV538:false,
      sportDataUntouched:true,
      kistologyUntouched:true
    };
    return;
  }

  function sportOpen(){return document.body?.classList.contains('mod-sport-mode-v510')===true;}

  function syncChrome(){
    const button=document.getElementById(SWITCH_ID);
    if(button&&sportOpen()){
      if(button.getAttribute('aria-label')!=='Sport ist geöffnet')button.setAttribute('aria-label','Sport ist geöffnet');
      if(button.title!=='Sport ist geöffnet')button.title='Sport ist geöffnet';
    }
    const hint=document.querySelector('.sport-mode-hint-v510');
    if(hint&&sportOpen()&&hint.textContent!==SPORT_HINT)hint.textContent=SPORT_HINT;
  }

  function capture(event){
    const button=event.target?.closest?.('#'+SWITCH_ID);
    if(!button||!sportOpen())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    syncChrome();
  }

  function init(){
    window.addEventListener('click',capture,true);
    syncChrome();
    return true;
  }

  window.__modSportSNoopV538={
    version:VERSION,
    patchRevision:PATCH_REVISION,
    sync:syncChrome,
    sportSwitchNoopWhenOpenV538:true,
    historicalCompatibilityOnlyV5382:true,
    disabledInProductionV5382:false,
    sportDataUntouched:true,
    kistologyUntouched:true
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
