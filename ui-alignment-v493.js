/* V493 · TITEL/NUMMER-AUSRICHTUNG + EINGABE-OPTIONEN + KLARE AKTIVQUELLEN */
(function(){
  'use strict';

  const BUILD_VERSION='V493';
  const EPSILON_MS=1000;
  const INPUT_LABELS=new Set(['TYP','PRIORITÄT','OPTIONAL','FÄLLIG']);
  let observer=null;
  let queued=false;

  function firstTextNode(el){
    if(!el)return null;
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      const text=String(node.textContent||'');
      if(/\S/.test(text))return node;
    }
    return null;
  }

  function firstGlyphRect(el){
    const node=firstTextNode(el);
    if(!node)return el?.getBoundingClientRect?.()||null;
    const text=String(node.textContent||'');
    const start=Math.max(0,text.search(/\S/));
    const end=Math.min(text.length,start+1);
    if(end<=start)return el.getBoundingClientRect();
    try{
      const range=document.createRange();
      range.setStart(node,start);
      range.setEnd(node,end);
      const rect=range.getBoundingClientRect();
      return rect&&rect.height?rect:el.getBoundingClientRect();
    }catch(_){return el.getBoundingClientRect();}
  }

  function alignNumberWithTitle(card){
    if(!card)return false;
    const rail=card.querySelector(':scope > .v492-number-status-rail');
    const number=rail?.querySelector('.task-number,.archive-number');
    const status=rail?.querySelector('.status-symbol');
    const title=card.querySelector('.task-text');
    if(!rail||!number||!title)return false;

    number.style.setProperty('transform','none','important');
    number.style.setProperty('margin-bottom','0px','important');

    const numberRect=firstGlyphRect(number);
    const titleRect=firstGlyphRect(title);
    if(!numberRect||!titleRect)return false;

    const delta=Math.max(-2,Math.min(9,titleRect.bottom-numberRect.bottom));
    if(Math.abs(delta)>0.1){
      number.style.setProperty('transform',`translateY(${delta.toFixed(2)}px)`,'important');
      number.style.setProperty('margin-bottom',`${Math.max(0,delta-3).toFixed(2)}px`,'important');
    }
    number.dataset.v493TitleAligned='true';
    if(status)status.dataset.v493BelowNumber='true';
    return true;
  }

  function wrapOptionRow(row){
    if(!row)return false;
    const label=row.querySelector(':scope > .option-label');
    if(!label)return false;
    const labelText=String(label.textContent||'').trim().toUpperCase();
    if(!INPUT_LABELS.has(labelText))return false;
    let buttons=row.querySelector(':scope > .v493-option-buttons');
    if(!buttons){
      buttons=document.createElement('div');
      buttons.className='v493-option-buttons';
      [...row.children].filter(el=>el!==label&&el.classList.contains('option-button')).forEach(button=>buttons.appendChild(button));
      row.appendChild(buttons);
    }
    row.dataset.v493OptionGrid='true';
    return true;
  }

  function alignInputOptions(){
    document.querySelectorAll('#inputPanel .option-row').forEach(wrapOptionRow);
    return true;
  }

  function taskForCard(card){
    if(!card||card.classList.contains('archive-task'))return null;
    const id=Number(card.dataset.v490TaskId||card.querySelector('.duration[data-task-id]')?.dataset.taskId);
    if(!Number.isFinite(id))return null;
    try{return typeof getTask==='function'?getTask(id):null;}catch(_){return null;}
  }

  function cleanupHistoricalDetail(card){
    const task=taskForCard(card);
    const history=Math.max(0,Number(task&&task.importedHistoricalProgressDurationMs)||0);
    if(!(history>0))return false;

    const detail=card.querySelector('.task-detail-v490');
    if(!detail)return false;
    detail.querySelectorAll('.v490-historical').forEach(el=>el.remove());

    const exact=Array.isArray(task.activeSegments)
      ? task.activeSegments.filter(segment=>segment&&segment.startedAt)
      : [];
    let appActiveMs=null;
    try{
      const metrics=window.__modHistoricalSegmentBreakdownV488?.segmentMetrics?.(task,exact,Date.now());
      if(metrics)appActiveMs=Math.max(0,Number(metrics.activeMs)||0);
    }catch(_){ }

    /*
      Keine modernen Segmente + kein nachweisbarer Seit-App-Anteil:
      Dann ist die alte Start/Ende-Fallback-Zeile keine eigene moderne
      Aktivphase und wird nicht noch einmal unter dem Trenner ausgegeben.
    */
    if(!exact.length&&appActiveMs!==null&&appActiveMs<=EPSILON_MS){
      detail.querySelectorAll('.v490-segment').forEach(el=>el.remove());
    }

    if(!detail.children.length)detail.remove();
    card.dataset.v493HistoricalDetailClean='true';
    return true;
  }

  function injectStyle(){
    if(document.getElementById('uiAlignmentV493Style'))return;
    const style=document.createElement('style');
    style.id='uiAlignmentV493Style';
    style.textContent=`
      #inputPanel .option-row[data-v493-option-grid="true"]{
        display:grid!important;
        grid-template-columns:62px minmax(0,1fr)!important;
        align-items:start!important;
        column-gap:5px!important;
        row-gap:0!important;
      }
      #inputPanel .option-row[data-v493-option-grid="true"]>.option-label{
        min-width:0!important;
        width:62px!important;
        padding-top:10px!important;
      }
      #inputPanel .v493-option-buttons{
        min-width:0!important;
        display:flex!important;
        flex-wrap:wrap!important;
        align-items:center!important;
        gap:5px!important;
      }
      #viewContainer .v492-number-status-rail>.task-number[data-v493-title-aligned="true"],
      #viewContainer .v492-number-status-rail>.archive-number[data-v493-title-aligned="true"]{
        transform-origin:left top!important;
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceAll(){
    queued=false;
    injectStyle();
    alignInputOptions();
    document.querySelectorAll('#viewContainer .task,#viewContainer .archive-task').forEach(card=>{
      alignNumberWithTitle(card);
      cleanupHistoricalDetail(card);
    });
    return true;
  }

  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(enhanceAll);
  }

  function observe(){
    if(observer)return;
    const roots=[document.getElementById('viewContainer'),document.getElementById('inputPanel')].filter(Boolean);
    if(!roots.length)return;
    observer=new MutationObserver(queue);
    roots.forEach(root=>observer.observe(root,{childList:true,subtree:true}));
  }

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){
    window.render=function(){
      const result=previousRender.apply(this,arguments);
      enhanceAll();
      setTimeout(enhanceAll,0);
      return result;
    };
  }

  injectStyle();
  alignInputOptions();
  observe();
  setTimeout(enhanceAll,0);
  window.addEventListener('load',()=>setTimeout(()=>{observe();enhanceAll();},0));

  window.__modUiAlignmentV493={
    version:BUILD_VERSION,
    enhanceAll,
    alignNumberWithTitle,
    alignInputOptions,
    cleanupHistoricalDetail,
    numberTitleBottomAligned:true,
    statusStillBelowNumber:true,
    fourDigitRailPreserved:true,
    wrappedOptionRowsIndented:true,
    originalInputRowsOnly:true,
    typeOptionsAligned:true,
    priorityOptionsAligned:true,
    activeSourceLabels:true,
    duplicateHistoricalDetailRemoved:true,
    historicalOnlyFallbackRangeHidden:true,
    dataSemanticsUntouched:true
  };
})();
