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
