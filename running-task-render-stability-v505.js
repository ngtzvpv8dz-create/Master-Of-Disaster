/* V505 · LAUFENDE AUFGABE OHNE SEKUNDEN-NEURENDER DER GESAMTEN ANSICHT
   - V489 aktualisiert pro Sekunde nur noch die tatsächlich laufende Karte.
   - Andere offene/erledigte Karten behalten ihre DOM-Instanz und Aktionsleiste.
   - Live-Zeitdetails bleiben erhalten, ohne die komplette Ansicht neu aufzubauen.
*/
(function(){
  'use strict';
  if(window.__modRunningTaskRenderStabilityV505)return;

  const BUILD_VERSION='V505';

  function verify(){
    const api=window.__modTaskTimeWeightDetailsV489;
    return !!(
      api&&
      api.periodicFullRenderRemovedV505===true&&
      api.runningCardOnlyRefreshV505===true&&
      typeof api.refreshRunningCards==='function'
    );
  }

  function refreshRunningCards(){
    const api=window.__modTaskTimeWeightDetailsV489;
    return typeof api?.refreshRunningCards==='function'?api.refreshRunningCards():0;
  }

  window.__modRunningTaskRenderStabilityV505={
    version:BUILD_VERSION,
    verify,
    refreshRunningCards,
    fullViewTickerRemoved:true,
    runningCardOnlyRefresh:true,
    unrelatedCardsKeepDom:true,
    terminalActionsStayStable:true,
    dataSemanticsUntouched:true
  };
})();

/* V510/V511 · SPORT MODE BOOTSTRAP
   V510 lädt die getrennte Sportoberfläche.
   V511 stellt die Kompatibilität zwischen blauem S und rotem V498-Recovery-R sicher.
*/
(function(){
  'use strict';
  if(window.__modSportBootstrapV510)return;
  const VERSION='V511';
  const cssHref='./sport-mode-v510.css?v=510-2254';
  const jsSrc='./sport-mode-v510.js?v=510-2254';
  const compatSrc='./sport-header-compat-v511.js?v=511-2311';

  function ensureCss(){
    if(document.querySelector('link[data-sport-v510]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=cssHref;
    link.dataset.sportV510='true';
    document.head.appendChild(link);
  }

  function ensureCompat(){
    if(window.__modSportHeaderCompatV511||document.querySelector('script[data-sport-compat-v511]'))return;
    const script=document.createElement('script');
    script.src=compatSrc;
    script.defer=true;
    script.dataset.sportCompatV511='true';
    document.head.appendChild(script);
  }

  function ensureScript(){
    if(window.__modSportModeV510){ensureCompat();return;}
    const existing=document.querySelector('script[data-sport-v510]');
    if(existing){existing.addEventListener('load',ensureCompat,{once:true});return;}
    const script=document.createElement('script');
    script.src=jsSrc;
    script.defer=true;
    script.dataset.sportV510='true';
    script.addEventListener('load',ensureCompat,{once:true});
    document.head.appendChild(script);
  }

  ensureCss();
  ensureScript();
  window.__modSportBootstrapV510={version:VERSION,ensureCss,ensureScript,ensureCompat,assetsSeparated:true,todoDataUntouched:true,recoveryRCompatibilityV511:true};
})();
