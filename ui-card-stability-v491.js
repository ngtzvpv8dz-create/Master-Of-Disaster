/* V491 · STABILE KARTEN + HEUTE-PFEILE + EINHEITLICHE AKTIONEN */
(function(){
  'use strict';

  const BUILD_VERSION='V491';
  const BERLIN='Europe/Berlin';
  let queued=false;
  let observer=null;

  function today(){
    try{return typeof getBerlinDateKey==='function'?getBerlinDateKey():new Intl.DateTimeFormat('sv-SE',{timeZone:BERLIN,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
    catch(_){return new Date().toISOString().slice(0,10);}
  }
  function rows(){try{return Array.isArray(tasks)?tasks:[];}catch(_){return [];}}
  function taskById(id){return rows().find(row=>String(row?.id)===String(id))||null;}
  function current(){try{return String(currentTab||'all');}catch(_){return 'all';}}

  function rowForCard(card){
    if(!card)return null;
    try{const row=window.__modCategoriesV412?.rowForCard?.(card);if(row)return row;}catch(_){}
    for(const key of ['v490TaskId','id']){
      const id=card.dataset?.[key];if(id!=null){const row=taskById(id);if(row)return row;}
    }
    const candidate=card.querySelector('button[onclick*="toggleToday("],button[onclick*="askManualTimes("],button[onclick*="startTask("],button[onclick*="resumeTask("]');
    const hit=String(candidate?.getAttribute('onclick')||'').match(/\((\d+)\)/);
    if(hit){const row=taskById(hit[1]);if(row)return row;}
    const text=String(card.querySelector('.task-text')?.textContent||'').trim().toLowerCase().replace(/\s+/g,' ');
    return rows().find(row=>String(row?.text||'').trim().toLowerCase().replace(/\s+/g,' ')===text)||null;
  }

  function clearThemePosition(el){
    if(!el)return;
    for(const prop of ['position','transform','top','right','bottom','left','z-index','width']){
      try{el.style.removeProperty(prop);}catch(_){}
    }
  }

  function todayButtons(card){
    return [...card.querySelectorAll('button')].filter(btn=>{
      const onclick=String(btn.getAttribute('onclick')||'');
      const label=`${btn.getAttribute('title')||''} ${btn.getAttribute('aria-label')||''}`.toLowerCase();
      return /toggleToday\(/.test(onclick)||btn.dataset.v480TodayAction==='1'||/heute-zuweisung|heute zuweisen|aus heute/.test(label);
    });
  }

  function normalizeTodayAction(card,row){
    const buttons=todayButtons(card);
    if(!buttons.length||!row)return false;
    const actions=card.querySelector('.icon-actions');
    if(!actions)return false;

    const button=buttons[0];
    buttons.slice(1).forEach(extra=>extra.remove());
    const selected=String(row.todayDate||'')===today();
    const icons=window.__modActionIconsV416?.ICONS||{};
    const key=selected?'calendarPin':'calendar';
    const svg=icons[key]||icons.calendar;

    button.dataset.v480TodayAction='1';
    button.dataset.iconV416=key;
    button.classList.add('mono-action-v416','v491-today-action');
    button.classList.toggle('today-selected-v480',selected);
    button.setAttribute('aria-pressed',selected?'true':'false');
    button.setAttribute('aria-label',selected?'Heute-Zuweisung entfernen':'Heute zuweisen');
    button.setAttribute('title',selected?'Heute-Zuweisung entfernen':'Heute zuweisen');
    if(!/toggleToday\(/.test(String(button.getAttribute('onclick')||'')))button.setAttribute('onclick',`toggleToday(${row.id})`);
    if(svg&&button.innerHTML!==svg)button.innerHTML=svg;

    const clock=[...actions.querySelectorAll('button')].find(btn=>{
      const onclick=String(btn.getAttribute('onclick')||'');
      const label=`${btn.getAttribute('title')||''} ${btn.getAttribute('aria-label')||''}`.toLowerCase();
      return btn.dataset.iconV416==='clock'||/askManualTimes\(/.test(onclick)||/uhrzeit|zeiten bearbeiten|zeit bearbeiten/.test(label);
    });
    if(clock&&clock.nextElementSibling!==button)clock.insertAdjacentElement('afterend',button);
    else if(!clock&&button.parentElement!==actions)actions.appendChild(button);
    return true;
  }

  function orderInfo(row){
    const api=window.__modTodayWorkBlocksV474;
    if(!api||!row)return null;
    const date=today();
    const blocks=api.getBlocks?.(date)||[];
    const ordered=api.orderedByBlocks?.(date)?.rows||[];
    const overallIndex=ordered.findIndex(item=>String(item?.id)===String(row.id));
    const blockIndex=blocks.findIndex(block=>block.id===row.todayWorkBlockId);
    if(overallIndex<0||blockIndex<0)return null;
    const group=ordered.filter(item=>item.todayWorkBlockId===row.todayWorkBlockId);
    const groupIndex=group.findIndex(item=>String(item?.id)===String(row.id));
    return {api,date,blocks,ordered,overallIndex,blockIndex,group,groupIndex};
  }

  function moveTodayTask(id,direction){
    const row=taskById(id);const info=orderInfo(row);if(!info)return false;
    const dir=direction<0?-1:1;
    let targetBlockId=row.todayWorkBlockId,targetIndex=null;
    if(dir<0){
      if(info.groupIndex>0)targetIndex=info.groupIndex-1;
      else if(info.blockIndex>0){
        const targetBlock=info.blocks[info.blockIndex-1];
        const targetRows=info.ordered.filter(item=>item.todayWorkBlockId===targetBlock.id);
        targetBlockId=targetBlock.id;targetIndex=targetRows.length;
      }else return false;
    }else{
      if(info.groupIndex>=0&&info.groupIndex<info.group.length-1)targetIndex=info.groupIndex+1;
      else if(info.blockIndex<info.blocks.length-1){targetBlockId=info.blocks[info.blockIndex+1].id;targetIndex=0;}
      else return false;
    }
    return !!info.api.moveTaskToBlock?.(row.id,targetBlockId,targetIndex,{date:info.date,render:true});
  }

  function makeOrderButton(row,direction,disabled){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className=`icon-action v491-order-button ${direction<0?'v491-order-up':'v491-order-down'}`;
    btn.textContent=direction<0?'▲':'▼';
    btn.title=direction<0?'Aufgabe nach oben verschieben':'Aufgabe nach unten verschieben';
    btn.setAttribute('aria-label',btn.title);
    btn.disabled=!!disabled;
    btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();moveTodayTask(row.id,direction);});
    return btn;
  }

  function ensureOrderButtons(card,row){
    card.querySelectorAll('.drag-handle').forEach(handle=>handle.remove());
    const actions=card.querySelector('.icon-actions');if(!actions)return false;
    actions.querySelectorAll('.v491-order-button').forEach(btn=>btn.remove());
    if(current()!=='today'||!card.classList.contains('today-task-active')||!row||!['open','running','paused'].includes(String(row.status||'')))return false;
    const info=orderInfo(row);if(!info)return false;
    const up=makeOrderButton(row,-1,info.overallIndex<=0);
    const down=makeOrderButton(row,1,info.overallIndex>=info.ordered.length-1);
    actions.prepend(down);actions.prepend(up);
    return true;
  }

  function actionsToBottom(card){
    const actions=card.querySelector('.icon-actions');
    const host=card.querySelector('.task-content');
    if(!actions||!host)return false;
    clearThemePosition(actions);
    actions.classList.add('v491-action-row');
    if(host.lastElementChild!==actions)host.appendChild(actions);
    return true;
  }

  function cleanCard(card){
    if(!card||card.classList.contains('archive-task'))return false;
    const row=rowForCard(card);if(!row)return false;
    normalizeTodayAction(card,row);
    ensureOrderButtons(card,row);
    actionsToBottom(card);
    return true;
  }

  function injectStyle(){
    if(document.getElementById('uiCardStabilityV491Style'))return;
    const style=document.createElement('style');style.id='uiCardStabilityV491Style';style.textContent=`
      #viewContainer .task:not(.archive-task) .icon-actions.v491-action-row{
        position:static!important;transform:none!important;inset:auto!important;z-index:auto!important;
        width:100%!important;max-width:100%;display:flex!important;align-items:center!important;justify-content:flex-start!important;
        flex-wrap:wrap!important;gap:4px!important;margin:7px 0 0!important;padding:0!important;
      }
      #viewContainer .today-task-active>.drag-handle,#viewContainer .today-task-active .drag-handle{display:none!important}
      #viewContainer .v491-order-button{width:26px!important;height:26px!important;min-width:26px!important;padding:0!important;font-size:9px!important;font-weight:950!important;line-height:1!important}
      #viewContainer .v491-order-button:disabled{opacity:.22!important;cursor:default!important}
      #viewContainer .v491-today-action.today-selected-v480::after{content:'';position:absolute;top:3px;right:3px;width:5px;height:5px;border-radius:50%;background:currentColor;box-shadow:0 0 0 1px rgba(0,0,0,.55);pointer-events:none}
      #viewContainer .today-task-active{align-items:flex-start!important}
      #viewContainer .today-task-active>.task-number{align-self:flex-start!important;margin-top:4px!important}
      #viewContainer .today-task-active>.status-symbol{align-self:flex-start!important;margin-top:2px!important}
    `;document.head.appendChild(style);
  }

  function enhanceAll(){
    queued=false;injectStyle();
    document.querySelectorAll('#viewContainer .task:not(.archive-task)').forEach(cleanCard);
    return true;
  }
  function queue(){if(queued)return;queued=true;requestAnimationFrame(enhanceAll);}
  function observe(){
    if(observer)return;
    const root=document.getElementById('viewContainer');if(!root)return;
    observer=new MutationObserver(queue);observer.observe(root,{childList:true,subtree:true});
  }

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){
    window.render=function(){const result=previousRender.apply(this,arguments);enhanceAll();setTimeout(enhanceAll,0);return result;};
  }

  injectStyle();observe();setTimeout(enhanceAll,0);
  window.addEventListener('load',()=>setTimeout(()=>{observe();enhanceAll();},0));

  window.moveTodayTaskV491=moveTodayTask;
  window.__modUiCardStabilityV491={
    version:BUILD_VERSION,
    enhanceAll,
    normalizeTodayAction,
    actionsToBottom,
    moveTodayTask,
    dragHandleReplacedByArrows:true,
    actionsAlwaysBottom:true,
    todayActionAfterClock:true,
    todayIconConsistentAcrossStatuses:true,
    selectedTodayUsesCalendarPin:true,
    stableCardLayout:true
  };
})();
