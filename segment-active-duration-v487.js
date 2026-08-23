/* V487 · AKTIVE AUFGABENZEIT AUS ZEITSEGMENTEN */
(function(){
  'use strict';

  const BUILD_VERSION='V487';
  const baseCalculateActiveDuration=window.calculateActiveDuration;

  function validSegments(task){
    return Array.isArray(task?.activeSegments)
      ? task.activeSegments.filter(segment=>segment&&segment.startedAt)
      : [];
  }

  function endMs(value){
    if(value instanceof Date)return value.getTime();
    const numeric=Number(value);
    if(Number.isFinite(numeric))return numeric;
    const parsed=new Date(value).getTime();
    return Number.isFinite(parsed)?parsed:Date.now();
  }

  function sumActiveSegments(task,end){
    const segments=validSegments(task);
    if(!segments.length)return null;
    const fallbackEnd=endMs(end);
    let total=0;
    for(const segment of segments){
      const start=new Date(segment.startedAt).getTime();
      if(!Number.isFinite(start))continue;
      let stop=null;
      if(segment.endedAt){
        const parsed=new Date(segment.endedAt).getTime();
        if(Number.isFinite(parsed))stop=parsed;
      }else if(task?.status==='running'){
        stop=fallbackEnd;
      }
      if(stop===null)continue;
      total+=Math.max(0,stop-start);
    }
    return total;
  }

  window.calculateActiveDuration=function(task,end){
    const segmented=sumActiveSegments(task,end);
    if(segmented!==null){
      const historicalProgressMs=(task&&typeof task.importedHistoricalProgressDurationMs!=='undefined')
        ? (Number(task.importedHistoricalProgressDurationMs)||0)
        : 0;
      return historicalProgressMs+segmented;
    }
    return typeof baseCalculateActiveDuration==='function'
      ? baseCalculateActiveDuration(task,end)
      : 0;
  };

  window.__modSegmentActiveDurationV487={
    version:BUILD_VERSION,
    sourceOfTruth:'activeSegments',
    segmentGapsCountAsPause:true,
    legacyFallbackPreserved:true,
    sumActiveSegments
  };
})();
