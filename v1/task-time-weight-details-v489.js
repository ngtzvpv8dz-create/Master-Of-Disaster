/* V489 · AUFGABEN-ZEITVERLAUF + ZUSATZGEWICHT JE KARTE + KOMPAKTER LOG */
(function(){
  'use strict';

  const BUILD_VERSION='V489';
  const BERLIN='Europe/Berlin';
  const EPSILON_MS=1000;

  function ownDuration(ms){
    ms=Math.max(0,Number(ms)||0);
    const total=Math.floor(ms/1000);
    const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function duration(ms){
    try{return typeof formatDuration==='function'?formatDuration(ms):ownDuration(ms);}catch(_){return ownDuration(ms);}
  }
  function esc(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function ms(value){
    const t=new Date(value).getTime();
    return Number.isFinite(t)?t:null;
  }
  function dateKey(value){
    const t=ms(value);if(t===null)return '';
    try{return new Intl.DateTimeFormat('sv-SE',{timeZone:BERLIN,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));}catch(_){return new Date(t).toISOString().slice(0,10);}
  }
  function clock(value){
    const t=ms(value);if(t===null)return '--:--:--';
    try{return new Intl.DateTimeFormat('de-DE',{timeZone:BERLIN,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(t));}catch(_){return new Date(t).toLocaleTimeString('de-DE');}
  }
  function shortDate(value){
    const t=ms(value);if(t===null)return '';
    try{return new Intl.DateTimeFormat('de-DE',{timeZone:BERLIN,day:'2-digit',month:'2-digit'}).format(new Date(t));}catch(_){return '';}
  }
  function rangeText(start,end){
    if(!start)return '';
    if(!end)return `${clock(start)}–…`;
    return dateKey(start)===dateKey(end)
      ? `${clock(start)}–${clock(end)}`
      : `${shortDate(start)} ${clock(start)}–${shortDate(end)} ${clock(end)}`;
  }
  function kgText(value){
    const n=Number(value);if(!Number.isFinite(n)||n<=0)return '';
    return `${String(Math.round(n*10)/10).replace('.',',')} kg`;
  }

  function exactActiveSegments(item,now=Date.now()){
    const rows=[];
    const list=Array.isArray(item&&item.activeSegments)?item.activeSegments:[];
    list.forEach(segment=>{
      if(!segment||!segment.startedAt)return;
      const start=ms(segment.startedAt);if(start===null)return;
      let end=ms(segment.endedAt);
      if(end===null&&item&&item.status==='running')end=now;
      if(end===null||end<start)return;
      rows.push({startedAt:segment.startedAt,endedAt:new Date(end).toISOString(),startMs:start,endMs:end,durationMs:end-start,exact:true});
    });
    return rows.sort((a,b)=>a.startMs-b.startMs);
  }

  function terminalEnd(item,now=Date.now()){
    if(!item)return null;
    return item.completedAt||item.abortedAt||item.pausedAt||(item.status==='running'?new Date(now).toISOString():null);
  }

  function knownActiveTotal(item,now=Date.now(),archived=false){
    if(!item)return 0;
    if(!archived&&typeof calculateActiveDuration==='function'){
      try{return Math.max(0,Number(calculateActiveDuration(item,now))||0);}catch(_){ }
    }
    if(item.type==='leisure'&&Number.isFinite(Number(item.leisureDurationMs)))return Math.max(0,Number(item.leisureDurationMs));
    if(item.type==='cooking'&&Number.isFinite(Number(item.cookingActiveDurationMs)))return Math.max(0,Number(item.cookingActiveDurationMs));
    if(Number.isFinite(Number(item.activeDurationMs)))return Math.max(0,Number(item.activeDurationMs));
    if(Number.isFinite(Number(item.actualDurationMs)))return Math.max(0,Number(item.actualDurationMs));
    return 0;
  }

  function historicalProgressMs(item){
    return Math.max(0,Number(item&&item.importedHistoricalProgressDurationMs)||0);
  }

  function timeDetail(item,archived=false,now=Date.now()){
    const exact=exactActiveSegments(item,now);
    const knownTotal=knownActiveTotal(item,now,archived);
    const history=historicalProgressMs(item);
    const rows=[];
    let exactTotal=0;

    if(exact.length){
      exact.forEach(segment=>{
        exactTotal+=segment.durationMs;
        rows.push({kind:'segment',text:`${rangeText(segment.startedAt,segment.endedAt)} · ${duration(segment.durationMs)}`});
      });
      if(history>0){
        rows.push({kind:'historical',text:`HISTORISCH · ${duration(history)} · keine exakten Segmentzeiten dokumentiert`});
      }
    }else if(item&&item.startedAt){
      const end=terminalEnd(item,now);
      if(end){
        const wallStart=ms(item.startedAt),wallEnd=ms(end);
        const wall=wallStart!==null&&wallEnd!==null&&wallEnd>=wallStart?wallEnd-wallStart:null;
        if(Number(item.pauseTotalMs)>0&&knownTotal>0){
          rows.push({kind:'range',text:`ZEITRAUM · ${rangeText(item.startedAt,end)} · aktiv ${duration(knownTotal)} · Pause ${duration(item.pauseTotalMs)}`});
        }else{
          const shown=knownTotal>0?knownTotal:wall;
          rows.push({kind:'segment',text:`${rangeText(item.startedAt,end)}${shown!==null?` · ${duration(shown)}`:''}`});
        }
      }else{
        rows.push({kind:'range',text:`START · ${clock(item.startedAt)} · Ende nicht dokumentiert`});
      }
    }

    if(rows.length&&knownTotal>0){
      rows.push({kind:'total',text:`GESAMT AKTIV · ${duration(knownTotal)}`});
    }else if(!rows.length&&knownTotal>0){
      rows.push({kind:'total-only',text:`DAUER · ${duration(knownTotal)} · keine exakten Uhrzeiten dokumentiert`});
    }

    return {rows,exactSegments:exact,exactTotalMs:exactTotal,knownTotalMs:knownTotal,historicalMs:history};
  }

  function phaseKg(phase){return Number(phase&&(phase.weightKg??phase.historicalWeightKg))||0;}
  function allWeightPhases(now=Date.now()){
    const list=typeof weightPhases!=='undefined'&&Array.isArray(weightPhases)?weightPhases:[];
    return list.map(phase=>{
      if(!phase||!phase.startedAt)return null;
      const start=ms(phase.startedAt);if(start===null)return null;
      let end=ms(phase.endedAt);
      if(end===null){
        let open=false;
        try{open=!!(typeof weightState!=='undefined'&&weightState&&weightState.isWearing);}catch(_){ }
        if(open)end=now;
      }
      if(end===null||end<start)return null;
      const kg=phaseKg(phase);if(!(kg>0))return null;
      return {startMs:start,endMs:end,startedAt:phase.startedAt,endedAt:new Date(end).toISOString(),weightKg:kg};
    }).filter(Boolean);
  }

  function mergeWeightRows(rows){
    const sorted=[...rows].sort((a,b)=>a.startMs-b.startMs||a.endMs-b.endMs);
    const merged=[];
    sorted.forEach(row=>{
      const last=merged[merged.length-1];
      if(last&&Math.abs(last.weightKg-row.weightKg)<0.001&&row.startMs<=last.endMs+EPSILON_MS){
        last.endMs=Math.max(last.endMs,row.endMs);
        last.endedAt=new Date(last.endMs).toISOString();
        last.durationMs=last.endMs-last.startMs;
      }else merged.push({...row});
    });
    return merged;
  }

  function exactHistoricalWeightRows(item){
    const list=Array.isArray(item&&item.weightActiveSegments)?item.weightActiveSegments:[];
    return list.map(segment=>{
      if(!segment||!segment.startedAt||!segment.endedAt)return null;
      const start=ms(segment.startedAt),end=ms(segment.endedAt);
      if(start===null||end===null||end<start)return null;
      const kg=Number(segment.weightKg??segment.historicalWeightKg??item.historicalWeightKg)||0;
      if(!(kg>0))return null;
      return {startMs:start,endMs:end,startedAt:segment.startedAt,endedAt:segment.endedAt,durationMs:end-start,weightKg:kg,source:'stored'};
    }).filter(Boolean);
  }

  function overlapWeightRows(item,timeInfo,now=Date.now()){
    const stored=exactHistoricalWeightRows(item);
    if(stored.length)return mergeWeightRows(stored);
    if(!timeInfo.exactSegments.length)return [];
    const phases=allWeightPhases(now),rows=[];
    timeInfo.exactSegments.forEach(segment=>{
      phases.forEach(phase=>{
        const start=Math.max(segment.startMs,phase.startMs),end=Math.min(segment.endMs,phase.endMs);
        if(end<=start)return;
        rows.push({startMs:start,endMs:end,startedAt:new Date(start).toISOString(),endedAt:new Date(end).toISOString(),durationMs:end-start,weightKg:phase.weightKg,source:'overlap'});
      });
    });
    return mergeWeightRows(rows);
  }

  function fallbackWeight(item,archived=false){
    if(!item)return null;
    let kg=Number(item.historicalWeightKg)||0;
    let weighted=null;
    if(Number.isFinite(Number(item.weightedActiveDurationMs)))weighted=Math.max(0,Number(item.weightedActiveDurationMs));
    else if(item.weightInfo&&Number.isFinite(Number(item.weightInfo.knownWeightedActiveDurationMs)))weighted=Math.max(0,Number(item.weightInfo.knownWeightedActiveDurationMs));
    if(weighted===null&&kg>0){
      if(archived&&Number.isFinite(Number(item.archiveAccountingActiveDurationMs)))weighted=Math.max(0,Number(item.archiveAccountingActiveDurationMs));
      else if(Number.isFinite(Number(item.activeDurationMs)))weighted=Math.max(0,Number(item.activeDurationMs));
    }
    if(!(weighted>0))return null;
    return {durationMs:weighted,weightKg:kg,note:item.historicalWeightNote||null};
  }

  function weightDetail(item,timeInfo,archived=false,now=Date.now()){
    const overlaps=overlapWeightRows(item,timeInfo,now);
    if(overlaps.length){
      const total=overlaps.reduce((sum,row)=>sum+row.durationMs,0);
      const rows=[{kind:'weight-total',text:`MIT ZUSATZGEWICHT · ${duration(total)}${timeInfo.knownTotalMs>0?` VON ${duration(timeInfo.knownTotalMs)}`:''}`}];
      overlaps.forEach(row=>rows.push({kind:'weight-range',text:`${rangeText(row.startedAt,row.endedAt)} · ${duration(row.durationMs)} · ${kgText(row.weightKg)}`}));
      return {rows,totalMs:total,overlaps,exact:true};
    }
    const fallback=fallbackWeight(item,archived);
    if(fallback){
      const suffix=fallback.weightKg>0?` · ${kgText(fallback.weightKg)}`:'';
      return {rows:[{kind:'weight-total',text:`MIT ZUSATZGEWICHT · ${duration(fallback.durationMs)}${timeInfo.knownTotalMs>0?` VON ${duration(timeInfo.knownTotalMs)}`:''}${suffix}`},{kind:'weight-note',text:`Uhrzeit der Gewichtsnutzung nicht exakt dokumentiert${fallback.note?` · ${fallback.note}`:''}`}],totalMs:fallback.durationMs,overlaps:[],exact:false};
    }
    return {rows:[],totalMs:0,overlaps:[],exact:false};
  }

  function makeBlock(item,archived=false){
    const now=Date.now();
    const timeInfo=timeDetail(item,archived,now);
    const weightInfo=weightDetail(item,timeInfo,archived,now);
    if(!timeInfo.rows.length&&!weightInfo.rows.length)return null;
    const block=document.createElement('div');
    block.className='task-detail-v489';
    block.dataset.v489Detail='true';
    const timeHtml=timeInfo.rows.map(row=>`<div class="v489-time v489-${esc(row.kind)}">🕒 ${esc(row.text)}</div>`).join('');
    const weightHtml=weightInfo.rows.map(row=>`<div class="v489-weight v489-${esc(row.kind)}">🏋️ ${esc(row.text)}</div>`).join('');
    block.innerHTML=timeHtml+weightHtml;
    return block;
  }

  function attachDetail(card,item,archived=false){
    if(!card||!item)return card;
    const host=card.querySelector('.task-content')||card;
    host.querySelectorAll('.task-detail-v489').forEach(el=>el.remove());
    const block=makeBlock(item,archived);
    if(block)host.appendChild(block);
    return card;
  }

  function wrapCards(){
    if(typeof window.taskCard==='function'&&!window.taskCard.__v489Wrapped){
      const base=window.taskCard;
      const wrapped=function(task){const card=base.apply(this,arguments);return attachDetail(card,task,false);};
      wrapped.__v489Wrapped=true;window.taskCard=wrapped;
    }
    if(typeof window.archiveCard==='function'&&!window.archiveCard.__v489Wrapped){
      const base=window.archiveCard;
      const wrapped=function(item){const card=base.apply(this,arguments);return attachDetail(card,item,true);};
      wrapped.__v489Wrapped=true;window.archiveCard=wrapped;
    }
  }

  function injectStyle(){
    if(document.getElementById('taskTimeWeightDetailsV489Style'))return;
    const style=document.createElement('style');
    style.id='taskTimeWeightDetailsV489Style';
    style.textContent=`
      .task-detail-v489{margin-top:4px;display:grid;gap:1px;font-size:8.5px;line-height:1.25;letter-spacing:.025em;font-weight:760}
      .task-detail-v489 .v489-time{color:#7895a8;opacity:.9}
      .task-detail-v489 .v489-total,.task-detail-v489 .v489-total-only{font-weight:900;color:#8da9ba}
      .task-detail-v489 .v489-historical,.task-detail-v489 .v489-range{opacity:.72}
      .task-detail-v489 .v489-weight{color:#d7b56d;opacity:.92}
      .task-detail-v489 .v489-weight-total{font-weight:900}
      .task-detail-v489 .v489-weight-range,.task-detail-v489 .v489-weight-note{opacity:.76}
      .archive-task .task-detail-v489{font-size:8.5px;margin-top:3px}

      /* V489: Log bewusst auf Archiv-Metadaten-Größe verdichten. */
      .live-log-v453,.live-log-v453 button,.live-log-v453 input,.live-log-v453 select,
      .live-log-v453 .log-row-v453,.live-log-v453 .log-time-v453,.live-log-v453 .log-area-v453,
      .live-log-v453 .log-message-v453,.live-log-v453 .log-meta-v453,.live-log-v453 .log-empty-v453{
        font-size:8.5px!important;line-height:1.25!important;
      }
      .live-log-v453{gap:7px!important}
      .live-log-v453 .log-toolbar-v453{gap:4px!important}
      .live-log-v453 .log-chip-v453{padding:4px 7px!important}
      .live-log-v453 .log-list-v453{gap:3px!important}
      .live-log-v453 .log-row-v453{grid-template-columns:64px 60px 1fr!important;gap:4px!important;padding:5px 6px!important;border-radius:7px!important}
      @media(max-width:540px){.live-log-v453 .log-row-v453{grid-template-columns:58px 1fr!important}.live-log-v453 .log-area-v453{grid-column:2}.live-log-v453 .log-message-v453{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function refresh(){
    wrapCards();
    injectStyle();
  }

  function refreshRunningCards(){
    const layout=window.__modNestedTaskWeightLayoutV490;
    if(!layout||typeof layout.attach!=='function')return 0;
    let refreshed=0;
    document.querySelectorAll('#viewContainer .task.running').forEach(card=>{
      const rawId=card.dataset.v490TaskId||card.dataset.id||card.querySelector('[data-task-id]')?.dataset.taskId;
      if(rawId==null)return;
      let row=null;
      try{
        row=typeof getTask==='function'
          ? getTask(Number(rawId))
          : (Array.isArray(tasks)?tasks:[]).find(item=>String(item&&item.id)===String(rawId))||null;
      }catch(_){row=null;}
      if(!row||String(row.status||'')!=='running')return;
      layout.attach(card,row,false);
      refreshed+=1;
    });
    return refreshed;
  }

  refresh();
  window.addEventListener('load',()=>{refresh();setTimeout(()=>{try{if(typeof render==='function')render();}catch(_){ }},0);});
  setInterval(()=>{
    try{
      refresh();
      if(typeof currentTab!=='undefined'&&['all','today','priority','due','active','completed','archive'].includes(currentTab)&&document.querySelector('.task.running')){
        refreshRunningCards();
      }
    }catch(_){ }
  },1000);

  window.__modTaskTimeWeightDetailsV489={
    version:BUILD_VERSION,
    exactActiveSegments,
    timeDetail,
    weightDetail,
    overlapWeightRows,
    attachDetail,
    refresh,
    refreshRunningCards,
    perTaskTimeRanges:true,
    perTaskWeightOverlap:true,
    appliesToPausedCompletedAbortedAndArchive:true,
    historicalTimesNeverInvented:true,
    compactLogFontPx:8.5,
    detailFontPx:8.5,
    periodicFullRenderRemovedV505:true,
    runningCardOnlyRefreshV505:true
  };
})();