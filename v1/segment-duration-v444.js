/* V444: Zeitsegmente sind bei segmentierten Aufgaben die Quelle der aktiven Dauer. */
(function(){
  if(typeof calculateActiveDuration!=="function"||typeof sumTaskSegmentsMs!=="function") return;
  const legacyCalculateActiveDuration=calculateActiveDuration;
  calculateActiveDuration=function(task,end){
    const segments=task&&Array.isArray(task.activeSegments)?task.activeSegments:[];
    if(segments.length){
      const historicalProgressMs=Number(task.importedHistoricalProgressDurationMs)||0;
      const endIso=new Date(end).toISOString();
      return historicalProgressMs+sumTaskSegmentsMs(task,endIso);
    }
    return legacyCalculateActiveDuration(task,end);
  };
  window.__modV444SegmentDuration=true;
})();
