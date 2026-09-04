/* V508 · KOMPAKTES ARCHIV-GEWICHTSLAYOUT + DATUM PRO ARBEITSSEGMENT */
(function(){
  'use strict';

  const BUILD_VERSION='V508';
  const BERLIN='Europe/Berlin';
  let repairQueued=false;

  function base(){return window.__modNestedTaskWeightLayoutV490||null;}
  function polish(){return window.__modSummaryWeightDuePolishV494||null;}
  function rail(){return window.__modTaskCardRailPolishV492||null;}
  function toMs(value){const n=new Date(value).getTime();return Number.isFinite(n)?n:null;}
  function duration(value){
    try{return typeof formatDuration==='function'?formatDuration(Math.max(0,Number(value)||0)):String(value??'');}
    catch(_){return String(value??'');}
  }
  function clock(value){
    const t=toMs(value);if(t===null)return '--:--:--';
    try{return new Intl.DateTimeFormat('de-DE',{timeZone:BERLIN,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(t));}
    catch(_){return new Date(t).toLocaleTimeString('de-DE');}
  }
  function shortDateYY(value){
    const t=toMs(value);if(t===null)return '';
    try{return new Intl.DateTimeFormat('de-DE',{timeZone:BERLIN,day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date(t));}
    catch(_){
      const d=new Date(t);
      return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(-2)}`;
    }
  }
  function dateText(start,end){
    const a=shortDateYY(start),b=shortDateYY(end||start);
    if(!a)return '';
    return b&&b!==a?`${a}–${b}`:a;
  }
  function segmentText(start,end,durationMs){
    if(!start)return '';
    const range=end?`${clock(start)}–${clock(end)}`:`${clock(start)}–…`;
    const date=dateText(start,end||start);
    const time=Number.isFinite(Number(durationMs))&&Number(durationMs)>=0?` · ${duration(durationMs)}`:'';
    return `🕒 ${range}${time}${date?` · ${date}`:''}`;
  }
  function terminalEnd(item,now=Date.now()){
    if(!item)return null;
    return item.completedAt||item.abortedAt||item.pausedAt||(item.status==='running'?new Date(now).toISOString():null);
  }
  function taskById(id){
    try{
      if(typeof getTask==='function')return getTask(Number(id));
      return (Array.isArray(tasks)?tasks:[]).find(row=>String(row?.id)===String(id))||null;
    }catch(_){return null;}
  }
  function archiveByCard(card){
    if(!card)return null;
    try{
      const id=card.dataset.v490ArchiveId;
      if(id!=null){
        const hit=(Array.isArray(archive)?archive:[]).find(row=>String(row?.archiveId)===String(id));
        if(hit)return hit;
      }
      const number=card.dataset.v490ArchiveNumber;
      if(number!=null){
        const hit=(Array.isArray(archive)?archive:[]).find(row=>Number(row?.archiveNumber)===Number(number));
        if(hit)return hit;
      }
      const raw=String(card.querySelector('.archive-number')?.textContent||'').match(/A\s*0*(\d+)/i);
      if(raw){
        const hit=(Array.isArray(archive)?archive:[]).find(row=>Number(row?.archiveNumber)===Number(raw[1]));
        if(hit)return hit;
      }
    }catch(_){ }
    return null;
  }
  function taskByCard(card){
    if(!card)return null;
    const id=card.dataset.v490TaskId||card.dataset.id||card.querySelector('[data-task-id]')?.dataset.taskId;
    return id==null?null:taskById(id);
  }

  function ensureV420Guard(host){
    if(!host||host.querySelector(':scope > .v508-v420-guard'))return false;
    const marker=document.createElement('span');
    marker.className='v420-weight-icon v508-v420-guard';
    marker.setAttribute('aria-hidden','true');
    marker.dataset.v508V420Guard='true';
    host.appendChild(marker);
    return true;
  }

  function protectFromLegacyV420(card,block=null){
    if(card){
      const title=card.querySelector('.task-text');
      if(title)ensureV420Guard(title);
    }
    const detail=block||card?.querySelector('.task-detail-v490.v508-archive-detail');
    if(detail){
      ensureV420Guard(detail);
      detail.querySelectorAll('.v490-weight-nested,.v490-overall-weight-archive').forEach(ensureV420Guard);
    }
    return true;
  }

  function setTextIfChanged(node,text){
    if(!node)return false;
    const wanted=String(text??'');
    if(String(node.textContent||'')===wanted)return false;
    node.textContent=wanted;
    return true;
  }

  function patchSegmentDates(block,item,archived=false){
    if(!block||!item)return false;
    const api=base();
    const data=api?.detailData?.(item,archived,Date.now())||null;
    const source=Array.isArray(data?.timeInfo?.exactSegments)?data.timeInfo.exactSegments:[];
    const segments=source.filter(segment=>(Number(segment?.durationMs)||0)>=1000);
    const rows=[...block.querySelectorAll(':scope > .v490-segment')];

    if(segments.length){
      rows.forEach((row,index)=>{
        const segment=segments[index];
        if(!segment)return;
        setTextIfChanged(row,segmentText(segment.startedAt,segment.endedAt,segment.durationMs));
        row.dataset.v508SegmentDate='true';
      });
    }else if(rows.length&&item.startedAt){
      const end=terminalEnd(item,data?.now||Date.now());
      const total=Math.max(0,Number(data?.timeInfo?.knownTotalMs)||0);
      setTextIfChanged(rows[0],segmentText(item.startedAt,end,total||null));
      rows[0].dataset.v508SegmentDate='true';
    }
    return rows.some(row=>row.dataset.v508SegmentDate==='true');
  }

  function normalizeNestedWeight(block){
    if(!block)return false;
    const p=polish();
    block.querySelectorAll('.v490-weight-partial').forEach(line=>{
      try{p?.reorderPartialWeight?.(line);}catch(_){ }
    });
    const r=rail();
    block.querySelectorAll('.v490-weight-partial,.v490-weight-full').forEach(line=>{
      try{r?.splitWeightLine?.(line);}catch(_){ }
    });
    return true;
  }

  function finalizeArchiveDetail(block,item){
    if(!block||!item)return block;
    block.classList.add('v508-archive-detail');
    block.dataset.v508ArchiveDetail='true';
    patchSegmentDates(block,item,true);

    const nested=block.querySelector('.v490-weight-nested');
    const overall=block.querySelector('.v490-overall-weight-archive');
    if(nested&&overall){
      overall.remove();
    }else if(overall){
      const firstSegment=block.querySelector('.v490-segment');
      if(firstSegment&&firstSegment.nextElementSibling!==overall)firstSegment.insertAdjacentElement('afterend',overall);
    }

    normalizeNestedWeight(block);
    protectFromLegacyV420(null,block);
    return block;
  }

  function prepareArchiveDetail(item){
    const api=base();
    if(!api?.makeDetailBlock)return null;
    const block=api.makeDetailBlock(item,true);
    if(!block)return null;
    return finalizeArchiveDetail(block,item);
  }

  function compactArchive(card,item){
    if(!card||!item)return card;
    card.classList.add('v508-archive-card');
    if(item.archiveId!=null)card.dataset.v490ArchiveId=String(item.archiveId);
    if(item.archiveNumber!=null)card.dataset.v490ArchiveNumber=String(item.archiveNumber);
    protectFromLegacyV420(card);

    card.querySelectorAll('.archive-task-weight-details,.archive-task-weight,.task-detail-v489').forEach(el=>el.remove());
    const host=card.querySelector('.task-content')||card;
    const existing=[...host.querySelectorAll(':scope > .task-detail-v490')];
    const stable=existing.find(el=>el.classList.contains('v508-archive-detail'))||null;

    if(stable){
      existing.forEach(el=>{if(el!==stable)el.remove();});
      finalizeArchiveDetail(stable,item);
      protectFromLegacyV420(card,stable);
      return card;
    }

    existing.forEach(el=>el.remove());
    const block=prepareArchiveDetail(item);
    if(block)host.appendChild(block);
    protectFromLegacyV420(card,block);
    return card;
  }

  function dateCurrentTask(card,item){
    if(!card||!item)return card;
    const block=card.querySelector('.task-detail-v490');
    if(block)patchSegmentDates(block,item,false);
    return card;
  }

  function enhanceCard(card,item,archived=false){
    if(!card||!item)return card;
    return archived?compactArchive(card,item):dateCurrentTask(card,item);
  }

  function enhanceVisible(){
    document.querySelectorAll('#viewContainer .archive-task').forEach(card=>{
      const item=archiveByCard(card);if(item)compactArchive(card,item);
    });
    document.querySelectorAll('#viewContainer .task:not(.archive-task)').forEach(card=>{
      const item=taskByCard(card);if(item)dateCurrentTask(card,item);
    });
    return true;
  }

  function queueRepair(delay=0){
    if(repairQueued)return false;
    repairQueued=true;
    setTimeout(()=>{
      repairQueued=false;
      try{enhanceVisible();}catch(_){ }
    },Math.max(0,Number(delay)||0));
    return true;
  }

  function scheduleBoundedRepairs(){
    queueRepair(0);
    setTimeout(()=>{try{enhanceVisible();}catch(_){ }},60);
    return true;
  }

  function wrapCards(){
    if(typeof window.taskCard==='function'&&!window.taskCard.__v508Wrapped){
      const previous=window.taskCard;
      const wrapped=function(task){const card=previous.apply(this,arguments);return enhanceCard(card,task,false);};
      wrapped.__v508Wrapped=true;
      window.taskCard=wrapped;
    }
    if(typeof window.archiveCard==='function'&&!window.archiveCard.__v508Wrapped){
      const previous=window.archiveCard;
      const wrapped=function(item){const card=previous.apply(this,arguments);return enhanceCard(card,item,true);};
      wrapped.__v508Wrapped=true;
      window.archiveCard=wrapped;
    }
  }

  function wrapRunningRefresh(){
    const api=base();
    if(!api||typeof api.attach!=='function'||api.attach.__v508Wrapped)return false;
    const previous=api.attach;
    const wrapped=function(card,item,archived=false){
      const result=previous.apply(this,arguments);
      return enhanceCard(result||card,item,!!archived);
    };
    wrapped.__v508Wrapped=true;
    api.attach=wrapped;
    return true;
  }

  function wrapLegacyEnhancer(){
    const api=base();
    if(!api||typeof api.enhanceVisibleCards!=='function'||api.enhanceVisibleCards.__v508Wrapped)return false;
    const previous=api.enhanceVisibleCards;
    const wrapped=function(){
      const result=previous.apply(this,arguments);
      try{enhanceVisible();}catch(_){ }
      return result;
    };
    wrapped.__v508Wrapped=true;
    api.enhanceVisibleCards=wrapped;
    return true;
  }

  function injectStyle(){
    if(document.getElementById('archiveWeightLayoutV508Style'))return;
    const style=document.createElement('style');
    style.id='archiveWeightLayoutV508Style';
    style.textContent=`
      .v508-v420-guard{display:none!important}
      /* V508: iOS darf einzelne gewichtete Archivkarten nicht selbständig aufblasen. */
      #viewContainer .archive-task.v508-archive-card,
      #viewContainer .archive-task.v508-archive-card>.task-content,
      #viewContainer .archive-task.v508-archive-card .task-main-row,
      #viewContainer .archive-task.v508-archive-card .task-detail-v490{
        -webkit-text-size-adjust:100%!important;
        text-size-adjust:100%!important;
      }
      #viewContainer .archive-task.v508-archive-card>.task-content{
        flex:1 1 auto!important;
        width:auto!important;
        min-width:0!important;
        max-width:100%!important;
      }
      #viewContainer .archive-task.v508-archive-card .task-main-row{
        width:100%!important;
        min-width:0!important;
        display:flex!important;
        align-items:flex-start!important;
        gap:4px!important;
      }
      #viewContainer .archive-task.v508-archive-card .task-text{
        min-width:0!important;
        font-size:10.5px!important;
        line-height:1.1!important;
        font-weight:650!important;
      }
      #viewContainer .archive-task.v508-archive-card .task-type-badge{
        font-size:6.5px!important;
        line-height:1.15!important;
      }
      #viewContainer .archive-task.v508-archive-card .task-meta{
        font-size:7px!important;
        line-height:1.2!important;
      }
      #viewContainer .archive-task.v508-archive-card .duration,
      #viewContainer .archive-task.v508-archive-card .task-leisure-duration,
      #viewContainer .archive-task.v508-archive-card .task-cooking-active,
      #viewContainer .archive-task.v508-archive-card .task-cooking-passive{
        font-size:8.5px!important;
        line-height:1.2!important;
      }
      #viewContainer .archive-task.v508-archive-card .task-detail-v490{
        display:block!important;
        width:100%!important;
        min-width:0!important;
        max-width:100%!important;
        margin-top:5px!important;
        padding-top:4px!important;
        font-size:8.5px!important;
        line-height:1.28!important;
        overflow:visible!important;
        word-break:normal!important;
        overflow-wrap:normal!important;
        font-variant-numeric:tabular-nums!important;
      }
      #viewContainer .archive-task.v508-archive-card .task-detail-v490>div{
        width:100%!important;
        max-width:100%!important;
        font-size:8.5px!important;
        line-height:1.28!important;
      }
      #viewContainer .archive-task.v508-archive-card .v490-segment{
        display:block!important;
        margin-top:2px!important;
        white-space:normal!important;
      }
      #viewContainer .archive-task.v508-archive-card .v490-weight-nested{
        margin-top:1px!important;
        white-space:normal!important;
      }
      #viewContainer .archive-task.v508-archive-card .v490-weight-subline{
        margin-top:0!important;
        white-space:normal!important;
      }
      #viewContainer .archive-task.v508-archive-card .v490-overall-weight-archive{
        margin:1px 0 2px!important;
        padding-left:12px!important;
        font-size:8.5px!important;
        line-height:1.28!important;
      }
      #viewContainer .archive-task.v508-archive-card .archive-task-weight-details,
      #viewContainer .archive-task.v508-archive-card .archive-task-weight{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function verify(){
    const api=base();
    return !!(
      api&&
      typeof api.makeDetailBlock==='function'&&
      typeof api.enhanceVisibleCards==='function'&&
      shortDateYY('2026-08-15T12:00:00+02:00')==='15.08.26'&&
      segmentText('2026-08-15T10:00:00+02:00','2026-08-15T10:01:00+02:00',60000).includes('15.08.26')&&
      !segmentText('2026-08-15T10:00:00+02:00','2026-08-15T10:01:00+02:00',60000).includes('2026')
    );
  }

  function refresh(){
    injectStyle();
    wrapCards();
    wrapRunningRefresh();
    wrapLegacyEnhancer();
    enhanceVisible();
  }

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender&&!previousRender.__v508Wrapped){
    const wrappedRender=function(){
      const result=previousRender.apply(this,arguments);
      scheduleBoundedRepairs();
      return result;
    };
    wrappedRender.__v508Wrapped=true;
    window.render=wrappedRender;
  }

  injectStyle();
  wrapCards();
  wrapRunningRefresh();
  wrapLegacyEnhancer();
  scheduleBoundedRepairs();
  window.addEventListener('load',()=>setTimeout(()=>{try{refresh();scheduleBoundedRepairs();}catch(_){ }},0));

  window.__modArchiveWeightLayoutV508={
    version:BUILD_VERSION,
    shortDateYY,
    dateText,
    segmentText,
    patchSegmentDates,
    prepareArchiveDetail,
    compactArchive,
    enhanceVisible,
    protectFromLegacyV420,
    queueRepair,
    scheduleBoundedRepairs,
    verify,
    archiveUsesTaskSegmentHierarchy:true,
    archivedExactWeightSummaryDeduplicated:true,
    mainSegmentDateYY:true,
    nestedWeightDateNotDuplicated:true,
    existingArchiveRenderOnly:true,
    iosTextAutosizeGuard:true,
    lateV490OverwriteHealed:true,
    legacyV420StructuralGuard:true,
    observerLoopRemoved:true,
    boundedLateRepair:true,
    dataSemanticsUntouched:true,
    backupModulesUntouched:true
  };
})();
