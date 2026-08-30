/* V506 · BACKUP- UND DATENSICHERHEITS-STABILITÄT
   - V498 öffnet eine geschlossene IndexedDB-Verbindung automatisch neu.
   - iPhone-Vollbackup wird nach dem ZIP-Bau bewusst per zweitem Tipp an iOS übergeben.
   - V498 bleibt die Modul-Generation des Sicherheitsnetzes; der App-Build ist V506.
*/
(function(){
  'use strict';
  if(window.__modBackupStabilityV506)return;

  const BUILD_VERSION='V506';
  let tries=0;

  function verify(){
    const api=window.__modRecoveryHistoryV498;
    return !!(
      api&&
      api.dbReconnectV506===true&&
      api.iosBackupHandoffV506===true&&
      typeof api.resetDbConnection==='function'&&
      typeof api.deliverFullBackupBlob==='function'
    );
  }

  function install(){
    if(!window.__modRecoveryHistoryV498)return false;
    window.__modBackupStabilityV506={
      version:BUILD_VERSION,
      verify,
      indexedDbReconnect:true,
      iphoneZipUsesExplicitHandoff:true,
      safetyModuleRemainsV498:true,
      dataSemanticsUntouched:true
    };
    return true;
  }

  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>150)clearInterval(timer);
  },100);
  window.addEventListener('load',()=>setTimeout(install,400));
  window.addEventListener('focus',()=>setTimeout(install,100));
})();
