/* V488 · HISTORISCHE + SEGMENTIERTE AKTIVZEIT TRANSPARENT DARSTELLEN */
(function(){
  'use strict';

  const BUILD_VERSION='V488';
  const baseRefreshSegmentTotal=window.refreshSegmentTotalV443;

  const style=document.createElement('style');
  style.textContent=`
    .historical-segment-duration-v488{display:flex!important;flex-direction:column;gap:3px;align-items:flex-start}
    .historical-segment-duration-v488 .v488-main{font-weight:800}
    .historical-segment-duration-v488 .v488-sub{font-size:.72rem;opacity:.78;letter-spacing:.035em}
    .historical-segment-duration-v488 .v488-pause{font-size:.69rem;opacity:.62;letter-spacing:.03em}
    .segment-total-v443.v488-breakdown{display:flex;flex-direction:column;gap:4px}
    .segment-total-v443.v488-breakdown .v488-total{font-weight:900}
    .segment-total-v443.v488-breakdown .v488-pause{opacity:.72;font-size:.82em}
  `;
  document.head.appendChild(style);

  function historicalMs(task){
    return Math.max(0,Number(task&&task.importedHistoricalProgressDurationMs)||0);
  }

  function validSegments(taskOrSegments){
    const segments=Array.isArray(taskOrSegments)
      ? taskOrSegments
      : Array.isArray(taskOrSegments&&taskOrSegments.activeSegments)
        ? taskOrSegments.activeSegments
        : [];
    return segments
      .filter(segment=>segment&&segment.startedAt)
      .map(segment=>({startedAt:segment.startedAt,endedAt:segment.endedAt||null}))
      .sort((a,b)=>new Date(a.startedAt).getTime()-new Date(b.startedAt).getTime());
  }

  function segmentMetrics(task,segmentsInput=null,nowMs=Date.now()){
    const segments=validSegments(segmentsInput||task);
    let activeMs=0;
    let gapMs=0;
    let previousEnd=null;

    for(const segment of segments){
      const start=new Date(segment.startedAt).getTime();
      if(!Number.isFinite(start))continue;

      if(previousEnd!==null&&start>previousEnd){
        gapMs+=start-previousEnd;
      }

      let end=null;
      if(segment.endedAt){
        const parsed=new Date(segment.endedAt).getTime();
        if(Number.isFinite(parsed))end=parsed;
      }else if(task&&task.status==='running'){
        end=nowMs;
      }

      if(end!==null&&end>=start){
        activeMs+=end-start;
        previousEnd=end;
      }else{
        previousEnd=null;
      }
    }

    return {
      activeMs,
      gapMs,
      historicalMs:historicalMs(task),
      totalActiveMs:activeMs+historicalMs(task),
      segmentCount:segments.length
    };
  }

  function breakdownHtml(metrics){
    const pauseLine=metrics.gapMs>0
      ? `<span class="v488-pause">PAUSEN ZWISCHEN SEGMENTEN · ${formatDuration(metrics.gapMs)} · NICHT ENTHALTEN</span>`
      : '';
    return `
      <span class="v488-main">AKTIV · ${formatDuration(metrics.activeMs)}</span>
      <span class="v488-sub">+ HISTORISCH · ${formatDuration(metrics.historicalMs)}</span>
      <span class="v488-sub">= GESAMT AKTIV · ${formatDuration(metrics.totalActiveMs)}</span>
      ${pauseLine}
    `;
  }

  function patchVisibleCards(){
    if(typeof getTask!=='function'||typeof formatDuration!=='function')return 0;
    let patched=0;
    document.querySelectorAll('.duration[data-task-id][data-live-kind="work"],.duration.historical-segment-duration-v488[data-task-id]').forEach(el=>{
      const id=Number(el.dataset.taskId);
      const task=getTask(id);
      if(!task)return;
      const history=historicalMs(task);
      const segments=validSegments(task);
      if(!(history>0&&segments.length>0))return;
      const metrics=segmentMetrics(task,segments,Date.now());
      el.classList.remove('live-duration');
      el.classList.add('historical-segment-duration-v488');
      el.removeAttribute('data-live-kind');
      el.dataset.v488Breakdown='true';
      el.innerHTML=breakdownHtml(metrics);
      patched+=1;
    });
    return patched;
  }

  function readEditorSegments(){
    try{
      if(typeof window.readSegmentsFromDomV443==='function'){
        return window.readSegmentsFromDomV443(false)||[];
      }
    }catch(_){ }
    return Array.isArray(window.__manualSegmentsV443&&window.__manualSegmentsV443.segments)
      ? window.__manualSegmentsV443.segments
      : [];
  }

  window.refreshSegmentTotalV443=function(){
    const state=window.__manualSegmentsV443;
    if(!state||state.isCookingV460){
      return typeof baseRefreshSegmentTotal==='function'
        ? baseRefreshSegmentTotal.apply(this,arguments)
        : undefined;
    }

    const task=typeof getTask==='function'?getTask(state.taskId):null;
    const history=historicalMs(task);
    if(!(history>0)){
      return typeof baseRefreshSegmentTotal==='function'
        ? baseRefreshSegmentTotal.apply(this,arguments)
        : undefined;
    }

    const segments=readEditorSegments();
    const metrics=segmentMetrics(task,segments,Date.now());
    const el=document.getElementById('segmentTotalV443');
    if(!el)return;
    el.classList.add('v488-breakdown');
    el.innerHTML=`
      <span>AKTIVE SEGMENTE · ${formatDuration(metrics.activeMs)}</span>
      <span>HISTORISCHER FORTSCHRITT · ${formatDuration(metrics.historicalMs)}</span>
      <span class="v488-total">AKTIVE GESAMTZEIT · ${formatDuration(metrics.totalActiveMs)}</span>
      ${metrics.gapMs>0?`<span class="v488-pause">PAUSEN ZWISCHEN SEGMENTEN · ${formatDuration(metrics.gapMs)} · NICHT ENTHALTEN</span>`:''}
    `;
  };

  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=function(){
      const result=baseRender.apply(this,arguments);
      patchVisibleCards();
      return result;
    };
  }

  window.addEventListener('load',()=>setTimeout(patchVisibleCards,0));
  setInterval(patchVisibleCards,1000);
  setTimeout(patchVisibleCards,0);

  window.__modHistoricalSegmentBreakdownV488={
    version:BUILD_VERSION,
    historicalMs,
    segmentMetrics,
    patchVisibleCards,
    pausesExcludedFromSegmentActive:true,
    historicalProgressPreserved:true,
    legacyLiveTickerDetached:true,
    editorShowsBreakdown:true,
    cardShowsBreakdown:true
  };
})();
