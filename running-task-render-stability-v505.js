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

/* V510 · SPORT MODE BOOTSTRAP
   Wird an einer bereits geladenen stabilen Stelle eingehängt, damit V510 keine
   bestehende To-do-Renderlogik ersetzen muss. CSS und Sportmodul bleiben getrennt.
*/
(function(){
  'use strict';
  if(window.__modSportBootstrapV510)return;
  const VERSION='V510';
  const cssHref='./sport-mode-v510.css?v=510-2254';
  const jsSrc='./sport-mode-v510.js?v=510-2254';

  function ensureCss(){
    if(document.querySelector('link[data-sport-v510]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=cssHref;
    link.dataset.sportV510='true';
    document.head.appendChild(link);
  }

  function ensureScript(){
    if(window.__modSportModeV510||document.querySelector('script[data-sport-v510]'))return;
    const script=document.createElement('script');
    script.src=jsSrc;
    script.defer=true;
    script.dataset.sportV510='true';
    document.head.appendChild(script);
  }

  ensureCss();
  ensureScript();
  window.__modSportBootstrapV510={version:VERSION,ensureCss,ensureScript,assetsSeparated:true,todoDataUntouched:true};
})();
