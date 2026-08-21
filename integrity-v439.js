/* V439 · ACTIVE WEIGHT INTEGRITY HOTFIX
   The running weight phase lives in weightState until STOP_WEIGHT/startWeightPhase completes.
   Therefore an active weightState with zero open entries in weightPhases is valid.
   Only the known false-positive integrity errors are removed, and only for that exact valid state.
*/
(function(){
  const previous=typeof collectDataIntegrityReport==='function'?collectDataIntegrityReport:null;
  if(!previous) return;

  function isValidActiveWeightState(){
    const phases=Array.isArray(weightPhases)?weightPhases:[];
    const open=phases.filter(p=>p&&p.startedAt&&!p.endedAt);
    const started=weightState&&weightState.currentPhaseStartedAt?new Date(weightState.currentPhaseStartedAt).getTime():NaN;
    const kg=Number(weightState&&weightState.currentPhaseWeightKg!=null?weightState.currentPhaseWeightKg:weightState&&weightState.currentWeightKg);
    return !!(weightState&&weightState.isWearing===true&&open.length===0&&Number.isFinite(started)&&Number.isFinite(kg)&&kg>0);
  }

  window.collectDataIntegrityReport=function(){
    const report=previous.apply(this,arguments)||{errors:[],warnings:[],info:[]};
    const errors=Array.isArray(report.errors)?report.errors.slice():[];
    if(isValidActiveWeightState()){
      const filtered=errors.filter(msg=>{
        const text=String(msg||'');
        if(text==='Zusatzgewicht ist als angelegt markiert, aber es existiert nicht genau eine offene Gewichtsphase.') return false;
        if(/^Zusatzgewicht ist als getragen markiert, aber es existieren 0 offene Gewichtsphasen\.$/.test(text)) return false;
        return true;
      });
      report.errors=filtered;
      report.ok=filtered.length===0;
      report.info=Array.isArray(report.info)?report.info:[];
      if(!report.info.includes('Aktive Zusatzgewichtsphase wird korrekt in weightState geführt.')) report.info.push('Aktive Zusatzgewichtsphase wird korrekt in weightState geführt.');
    }
    return report;
  };

  window.__modIntegrityV439={isValidActiveWeightState};
})();
