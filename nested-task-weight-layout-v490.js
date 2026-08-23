/* V490 · KOMPAKTE SEGMENT-/ZUSATZGEWICHT-HIERARCHIE */
(function(){
  'use strict';

  const BUILD_VERSION='V490';
  const BERLIN='Europe/Berlin';
  const EPSILON_MS=1000;

  function api(){return window.__modTaskTimeWeightDetailsV489||null;}
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function ownDuration(value){
    const ms=Math.max(0,Number(value)||0),total=Math.floor(ms/1000);
    const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function duration(value){try{return typeof formatDuration==='function'?formatDuration(value):ownDuration(value);}catch(_){return ownDuration(value);}}
  function toMs(value){const n=new Date(value).getTime();return Number.isFinite(n)?n:null;}
  function dateKey(value){
    const t=toMs(value);if(t===null)return '';
    try{return new Intl.DateTimeFormat('sv-SE',{timeZone:BERLIN,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));}catch(_){return new Date(t).toISOString().slice(0,10);}
  }
  function clock(value){
    const t=toMs(value);if(t===null)return '--:--:--';
    try{return new Intl.DateTimeFormat('de-DE',{timeZone:BERLIN,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(t));}catch(_){return new Date(t).toLocaleTimeString('de-DE');}
  }
  function shortDate(value){
    const t=toMs(value);if(t===null)return '';
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
    const n=Number(value);if(!(n>0))return '';
    return `${String(Math.round(n*10)/10).replace('.',',')} kg`;
  }

  function terminalEnd(item,now=Date.now()){
    if(!item)return null;
    return item.completedAt||item.abortedAt||item.pausedAt||(item.status==='running'?new Date(now).toISOString():null);
  }

  function detailData(item,archived=false,now=Date.now()){
    const base=api();
    if(!base||typeof base.timeDetail!=='function'||typeof base.weightDetail!=='function')return null;
    const timeInfo=base.timeDetail(item,archived,now);
    const weightInfo=base.weightDetail(item,timeInfo,archived,now);
    return {timeInfo,weightInfo,now};
  }

  function clippedWeightRows(data){
    if(!data)return [];
    const segments=Array.isArray(data.timeInfo.exactSegments)?data.timeInfo.exactSegments:[];
    const overlaps=Array.isArray(data.weightInfo.overlaps)?data.weightInfo.overlaps:[];
    const rows=[];
    segments.forEach((segment,segmentIndex)=>{
      overlaps.forEach(weight=>{
        const start=Math.max(Number(segment.startMs)||0,Number(weight.startMs)||0);
        const end=Math.min(Number(segment.endMs)||0,Number(weight.endMs)||0);
        if(end<=start)return;
        rows.push({
          segmentIndex,
          startMs:start,
          endMs:end,
          startedAt:new Date(start).toISOString(),
          endedAt:new Date(end).toISOString(),
          durationMs:end-start,
          weightKg:Number(weight.weightKg)||0
        });
      });
    });
    return rows;
  }

  function knownWeightTotal(data){
    if(!data)return 0;
    const clipped=clippedWeightRows(data);
    if(clipped.length)return clipped.reduce((sum,row)=>sum+row.durationMs,0);
    return Math.max(0,Number(data.weightInfo.totalMs)||0);
  }

  function overallWeightText(data){
    const weighted=knownWeightTotal(data);
    if(!(weighted>0))return '';
    const total=Math.max(0,Number(data.timeInfo.knownTotalMs)||0);
    if(total>0&&Math.abs(weighted-total)<=EPSILON_MS)return 'KOMPLETT INKL. ZUSATZGEWICHT';
    return `DAVON ${duration(weighted)} MIT ZUSATZGEWICHT`;
  }

  function segmentWeightRows(segment,segmentIndex,data){
    const rows=clippedWeightRows(data).filter(row=>row.segmentIndex===segmentIndex);
    if(!rows.length)return '';
    return rows.map(row=>{
      const sameStart=Math.abs(row.startMs-segment.startMs)<=EPSILON_MS;
      const sameEnd=Math.abs(row.endMs-segment.endMs)<=EPSILON_MS;
      const kg=kgText(row.weightKg);
      if(sameStart&&sameEnd){
        return `<div class="v490-weight-nested v490-weight-full">↳ 🏋️ INKL. ZUSATZGEWICHT${kg?` · ${esc(kg)}`:''}</div>`;
      }
      return `<div class="v490-weight-nested v490-weight-partial">↳ 🏋️ INKL. ZUSATZGEWICHT · ${esc(rangeText(row.startedAt,row.endedAt))}</div>`+
        `<div class="v490-weight-subline">${esc(duration(row.durationMs))}${kg?` · ${esc(kg)}`:''}</div>`;
    }).join('');
  }

  function makeDetailBlock(item,archived=false){
    const data=detailData(item,archived,Date.now());
    if(!data)return null;
    const block=document.createElement('div');
    block.className='task-detail-v490';
    block.dataset.v490Detail='true';

    const segments=Array.isArray(data.timeInfo.exactSegments)?data.timeInfo.exactSegments:[];
    const parts=[];

    if(archived){
      const overall=overallWeightText(data);
      if(overall)parts.push(`<div class="v490-overall-weight v490-overall-weight-archive">↳ 🏋️ ${esc(overall)}</div>`);
    }

    if(segments.length){
      segments.forEach((segment,index)=>{
        parts.push(`<div class="v490-segment">🕒 ${esc(rangeText(segment.startedAt,segment.endedAt))} · ${esc(duration(segment.durationMs))}</div>`);
        const nested=segmentWeightRows(segment,index,data);
        if(nested)parts.push(nested);
      });
    }else if(item&&item.startedAt){
      const end=terminalEnd(item,data.now);
      if(end){
        const total=Math.max(0,Number(data.timeInfo.knownTotalMs)||0);
        parts.push(`<div class="v490-segment">🕒 ${esc(rangeText(item.startedAt,end))}${total>0?` · ${esc(duration(total))}`:''}</div>`);
      }
    }

    const history=Math.max(0,Number(data.timeInfo.historicalMs)||0);
    if(history>0)parts.push(`<div class="v490-historical">🕒 HISTORISCH · ${esc(duration(history))}</div>`);

    if(!parts.length)return null;
    block.innerHTML=parts.join('');
    return block;
  }

  function removeOldDetails(card){
    if(!card)return;
    card.querySelectorAll('.task-detail-v489,.task-detail-v490,.v490-overall-weight').forEach(el=>el.remove());
    if(card.classList.contains('archive-task')){
      card.querySelectorAll('.archive-task-weight-details,.archive-task-weight').forEach(el=>el.remove());
    }
  }

  function insertOverallWeight(card,item,archived,data){
    if(archived||!card||!data)return false;
    const text=overallWeightText(data);if(!text)return false;
    const line=document.createElement('div');
    line.className='v490-overall-weight';
    line.innerHTML=`↳ 🏋️ ${esc(text)}`;

    const historical=card.querySelector('.historical-segment-duration-v488');
    if(historical){
      const total=[...historical.querySelectorAll('.v488-sub')].find(el=>/^=\s*GESAMT AKTIV/i.test(String(el.textContent||'').trim()));
      const pause=historical.querySelector('.v488-pause');
      if(total){historical.insertBefore(line,pause||total.nextSibling);return true;}
    }

    const anchor=card.querySelector('.duration,.task-leisure-duration,.task-cooking-active');
    if(anchor){anchor.insertAdjacentElement('afterend',line);return true;}
    return false;
  }

  function attach(card,item,archived=false){
    if(!card||!item)return card;
    removeOldDetails(card);
    const host=card.querySelector('.task-content')||card;
    const data=detailData(item,archived,Date.now());
    insertOverallWeight(card,item,archived,data);
    const block=makeDetailBlock(item,archived);
    if(block)host.appendChild(block);
    if(archived){
      if(item.archiveId!=null)card.dataset.v490ArchiveId=String(item.archiveId);
      if(item.archiveNumber!=null)card.dataset.v490ArchiveNumber=String(item.archiveNumber);
    }else if(item.id!=null){
      card.dataset.v490TaskId=String(item.id);
    }
    return card;
  }

  function findTask(id){
    try{if(typeof getTask==='function')return getTask(Number(id));}catch(_){ }
    try{return (Array.isArray(tasks)?tasks:[]).find(row=>String(row&&row.id)===String(id))||null;}catch(_){return null;}
  }
  function findArchive(card){
    try{
      const id=card.dataset.v490ArchiveId;
      if(id!=null){const row=(Array.isArray(archive)?archive:[]).find(x=>String(x&&x.archiveId)===String(id));if(row)return row;}
      const number=card.dataset.v490ArchiveNumber;
      if(number!=null){const row=(Array.isArray(archive)?archive:[]).find(x=>Number(x&&x.archiveNumber)===Number(number));if(row)return row;}
    }catch(_){ }
    return null;
  }

  function enhanceVisibleCards(){
    document.querySelectorAll('.task[data-v490-task-id]').forEach(card=>{
      const row=findTask(card.dataset.v490TaskId);if(row)attach(card,row,false);
    });
    document.querySelectorAll('.archive-task').forEach(card=>{
      const row=findArchive(card);if(row)attach(card,row,true);
    });
  }

  function wrapCards(){
    if(typeof window.taskCard==='function'&&!window.taskCard.__v490Wrapped){
      const base=window.taskCard;
      const wrapped=function(task){const card=base.apply(this,arguments);return attach(card,task,false);};
      wrapped.__v490Wrapped=true;
      wrapped.__v489Wrapped=true;
      window.taskCard=wrapped;
    }
    if(typeof window.archiveCard==='function'&&!window.archiveCard.__v490Wrapped){
      const base=window.archiveCard;
      const wrapped=function(item){const card=base.apply(this,arguments);return attach(card,item,true);};
      wrapped.__v490Wrapped=true;
      wrapped.__v489Wrapped=true;
      window.archiveCard=wrapped;
    }
  }

  function injectStyle(){
    if(document.getElementById('nestedTaskWeightLayoutV490Style'))return;
    const style=document.createElement('style');
    style.id='nestedTaskWeightLayoutV490Style';
    style.textContent=`
      .task-detail-v489{display:none!important}
      .task-detail-v490{margin-top:5px;display:block;width:100%;min-width:0;font-size:8.5px!important;line-height:1.28!important;letter-spacing:.025em;font-weight:760;font-variant-numeric:tabular-nums}
      .task-detail-v490>div{font-size:8.5px!important;line-height:1.28!important}
      .v490-segment{color:#7895a8;opacity:.94;margin-top:2px;white-space:normal}
      .v490-historical{color:#7895a8;opacity:.72;margin-top:3px}
      .v490-overall-weight,.v490-weight-nested,.v490-weight-subline{color:#d7b56d!important;font-size:8.5px!important;line-height:1.28!important;font-weight:820;font-variant-numeric:tabular-nums}
      .v490-overall-weight{margin-top:1px;padding-left:12px;max-width:100%;white-space:normal}
      .historical-segment-duration-v488 .v490-overall-weight{align-self:stretch;padding-left:12px}
      .v490-overall-weight-archive{padding-left:12px;margin:1px 0 4px}
      .v490-weight-nested{padding-left:12px;margin-top:1px;white-space:normal}
      .v490-weight-subline{padding-left:31px;opacity:.82;margin-top:0;white-space:normal}
      .archive-task .task-detail-v490,.archive-task .task-detail-v490>div,.archive-task .v490-overall-weight,.archive-task .v490-weight-nested,.archive-task .v490-weight-subline{font-size:8.5px!important;line-height:1.28!important}
      .archive-task .archive-task-weight-details,.archive-task .archive-task-weight{display:none!important}
      .archive-task .task-detail-v490{overflow:visible!important;word-break:normal!important;overflow-wrap:normal!important}
    `;
    document.head.appendChild(style);
  }

  function refresh(){wrapCards();injectStyle();enhanceVisibleCards();}

  wrapCards();
  injectStyle();

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender&&!previousRender.__v490Wrapped){
    const wrappedRender=function(){const result=previousRender.apply(this,arguments);setTimeout(enhanceVisibleCards,0);return result;};
    wrappedRender.__v490Wrapped=true;
    window.render=wrappedRender;
  }

  window.addEventListener('load',()=>setTimeout(refresh,0));
  setTimeout(refresh,0);
  setInterval(()=>{try{enhanceVisibleCards();}catch(_){ }},1000);

  window.__modNestedTaskWeightLayoutV490={
    version:BUILD_VERSION,
    detailData,
    clippedWeightRows,
    knownWeightTotal,
    overallWeightText,
    makeDetailBlock,
    attach,
    enhanceVisibleCards,
    nestedSegmentWeight:true,
    partialWeightTwoLines:true,
    fullSegmentWeightCompact:true,
    overallWeightIndented:true,
    duplicateTotalRemoved:true,
    historicalNoteRemoved:true,
    archiveMatchesTaskLayout:true,
    archiveDetailFontPx:8.5,
    historicalUnknownsStayBlank:true
  };
})();
