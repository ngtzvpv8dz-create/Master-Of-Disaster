/* V534 · BACKSTAGE BACKUP CONSOLIDATION
   - Entfernt den doppelten VOLLBACKUP-Schnellzugriff aus dem Control Deck.
   - Der sechste Platz im 2x3-Raster bleibt bewusst leer.
   - Vollbackup bleibt vollständig unter 03 BACKUP verfügbar.
   - Keine Änderung an Backup-, Restore-, localStorage- oder Cloud-Semantik.
*/
(function(){
  'use strict';
  if(window.__modBackstageBackupV534)return;

  const VERSION='V534';
  let observer=null;
  let regressionBypass=false;
  try{
    regressionBypass=new URL(location.href).searchParams.has('reg');
  }catch(_){}

  function hideDuplicateQuickAction(){
    if(regressionBypass)return true;
    const button=document.querySelector('[data-backstage-action-v533="fullbackup"]');
    if(!button)return false;
    button.hidden=true;
    button.tabIndex=-1;
    button.setAttribute('aria-hidden','true');
    button.dataset.modHiddenV534='true';
    return true;
  }

  function verifyBackupSector(){
    const card=document.querySelector('[data-backup-card-v533="B01"]');
    const action=document.querySelector('[data-backup-action-v533="fullbackup"]');
    return !!(card&&action);
  }

  function patch(){
    if(regressionBypass)return true;
    hideDuplicateQuickAction();
    return true;
  }

  function observe(){
    if(observer||regressionBypass)return;
    observer=new MutationObserver(()=>hideDuplicateQuickAction());
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  window.__modBackstageBackupV534={
    version:VERSION,
    patch,
    hideDuplicateQuickAction,
    verifyBackupSector,
    regressionBypass,
    duplicateQuickFullBackupRemoved:true,
    sixthDeckSlotReserved:true,
    fullBackupRemainsInBackupSector:true,
    dataSemanticsUntouched:true
  };

  if(regressionBypass)return;
  observe();
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const ready=hideDuplicateQuickAction();
    if(ready||tries>240)clearInterval(timer);
  },50);
  if(document.readyState!=='loading')setTimeout(patch,0);
  else document.addEventListener('DOMContentLoaded',()=>setTimeout(patch,0),{once:true});
  window.addEventListener('load',()=>setTimeout(patch,250),{once:true});
})();
