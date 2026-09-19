/* V442 · INTEGRITY HOTFIXES
   - Active weight can validly live in weightState until stop.
   - Running/paused tasks may have activeDurationMs === null while already having closed activeSegments.
     In that state the base V374 integrity code coerces null to 0 and emits a false segment-total error.
   Only those known false positives are removed; real duration inconsistencies remain errors.
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

  function validUnfinalizedTaskLabels(){
    const list=Array.isArray(tasks)?tasks:[];
    return new Set(list.filter(task=>{
      if(!task||!['running','paused'].includes(task.status)) return false;
      if(task.activeDurationMs!==null&&typeof task.activeDurationMs!=='undefined') return false;
      if(!Array.isArray(task.activeSegments)||task.activeSegments.length===0) return false;
      return task.activeSegments.some(seg=>seg&&seg.startedAt&&seg.endedAt);
    }).map(task=>String(task.text||'ohne Namen')));
  }

  window.collectDataIntegrityReport=function(){
    const report=previous.apply(this,arguments)||{errors:[],warnings:[],info:[]};
    let errors=Array.isArray(report.errors)?report.errors.slice():[];

    if(isValidActiveWeightState()){
      errors=errors.filter(msg=>{
        const text=String(msg||'');
        if(text==='Zusatzgewicht ist als angelegt markiert, aber es existiert nicht genau eine offene Gewichtsphase.') return false;
        if(/^Zusatzgewicht ist als getragen markiert, aber es existieren 0 offene Gewichtsphasen\.$/.test(text)) return false;
        return true;
      });
      report.info=Array.isArray(report.info)?report.info:[];
      if(!report.info.includes('Aktive Zusatzgewichtsphase wird korrekt in weightState geführt.')) report.info.push('Aktive Zusatzgewichtsphase wird korrekt in weightState geführt.');
    }

    const validLabels=validUnfinalizedTaskLabels();
    if(validLabels.size){
      errors=errors.filter(msg=>{
        const text=String(msg||'');
        const m=text.match(/^Summe der Aktivsegmente ist größer als die aktive Gesamtdauer bei „(.+)“\.$/);
        return !(m&&validLabels.has(m[1]));
      });
      report.info=Array.isArray(report.info)?report.info:[];
      validLabels.forEach(label=>{
        const note='Laufende/pausierte Aufgabe „'+label+'“ hat noch keine finalisierte aktive Gesamtdauer; Segmente werden bis zum Abschluss als führend behandelt.';
        if(!report.info.includes(note)) report.info.push(note);
      });
    }

    report.errors=errors;
    report.ok=errors.length===0;
    return report;
  };

  window.__modIntegrityV442={isValidActiveWeightState,validUnfinalizedTaskLabels};
})();
