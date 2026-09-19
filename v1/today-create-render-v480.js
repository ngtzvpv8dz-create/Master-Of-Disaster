/* V480 · HEUTE-ERSTELLUNG + SYNCHRONE KARTENPOSITIONEN
   - schliesst den in V479 noch verbliebenen optischen Sprung: V460 setzte
     Zustands-/Elementpositionen bisher erst in setTimeout(0) nach dem Rendern.
   - stabilisiert die HEUTE-Aktion auf einem gleichbleibenden Kalender-Symbol.
   - erlaubt beim Erstellen eine direkte HEUTE-Zuweisung inklusive Arbeitsblock.
*/
(function(){
  'use strict';

  const BUILD_VERSION='V480';
  const ROLES={
    number:'.task-number',
    status:'.status-symbol',
    title:'.task-text',
    flags:'.compact-flags',
    type:'.task-type-badge',
    meta:'.task-meta,.duration,.task-leisure-duration,.task-cooking-active,.task-cooking-passive,.status-meta,.abort-meta',
    actions:'.icon-actions',
    cooking:'.cooking-mode-row'
  };
  let newTaskToday=false;
  let selectedBlockId=null;
  let renderWrapped=false;
  let addWrapped=false;
  let stabilizing=false;

  function today(){return typeof getBerlinDateKey==='function'?getBerlinDateKey():new Date().toISOString().slice(0,10);}
  function taskRows(){try{return Array.isArray(tasks)?tasks:[];}catch(_){return [];}}
  function taskById(id){return taskRows().find(row=>Number(row?.id)===Number(id))||null;}
  function blocksApi(){return window.__modTodayWorkBlocksV474||null;}
  function blocks(){try{return blocksApi()?.getBlocks?.(today())||[];}catch(_){return [];}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function injectStyle(){
    if(document.getElementById('todayCreateRenderV480Style'))return;
    const style=document.createElement('style');
    style.id='todayCreateRenderV480Style';
    style.textContent=`
      .today-create-row-v480{align-items:center}
      .today-create-toggle-v480{min-width:58px}
      .today-create-block-v480{flex:1;min-width:150px;height:31px;padding:4px 8px;border:1px solid var(--mod-border,#30363b);border-radius:8px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:9px;font-weight:850;color-scheme:dark}
      .today-create-block-v480[hidden]{display:none!important}
      .icon-action[data-v480-today-action]{overflow:visible}
      .icon-action[data-v480-today-action].today-selected-v480::after{content:'';position:absolute;top:3px;right:3px;width:5px;height:5px;border-radius:50%;background:currentColor;box-shadow:0 0 0 1px rgba(0,0,0,.55);pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function blockLabel(block,index){
    const name=String(block?.name||'').trim();
    return `ARBEITSBLOCK ${index+1}${name?' · '+name.toUpperCase():''}`;
  }

  function ensureInputControls(){
    injectStyle();
    const panel=document.getElementById('inputPanel');
    if(!panel)return false;
    let row=document.getElementById('newTodayRowV480');
    if(!row){
      row=document.createElement('div');
      row.id='newTodayRowV480';
      row.className='option-row today-create-row-v480';
      const due=[...panel.querySelectorAll('.option-row')].find(r=>(r.querySelector('.option-label')?.textContent||'').trim().toUpperCase()==='FÄLLIG');
      if(due)due.after(row);else panel.querySelector('.add-button')?.before(row);
    }
    const list=blocks();
    if(selectedBlockId&&selectedBlockId!=='__auto__'&&!list.some(b=>b.id===selectedBlockId))selectedBlockId=null;
    if(newTaskToday&&!selectedBlockId)selectedBlockId=list[0]?.id||'__auto__';
    const opts=list.length
      ? list.map((b,i)=>`<option value="${esc(b.id)}" ${selectedBlockId===b.id?'selected':''}>${esc(blockLabel(b,i))}</option>`).join('')
      : '<option value="__auto__">ARBEITSBLOCK 1 · WIRD ANGELEGT</option>';
    row.innerHTML=`<span class="option-label">HEUTE</span><button type="button" class="option-button today-create-toggle-v480 ${newTaskToday?'selected':''}" id="newTodayV480" aria-pressed="${newTaskToday?'true':'false'}">${newTaskToday?'JA':'NEIN'}</button><select id="newTodayBlockV480" class="today-create-block-v480" ${newTaskToday?'':'hidden'} ${list.length===1?'aria-label="Arbeitsblock 1"':''}>${opts}</select>`;
    row.querySelector('#newTodayV480')?.addEventListener('click',()=>setNewTaskToday(!newTaskToday));
    row.querySelector('#newTodayBlockV480')?.addEventListener('change',e=>{selectedBlockId=e.target.value||null;});
    return true;
  }

  function setNewTaskToday(value){
    newTaskToday=!!value;
    if(newTaskToday){const list=blocks();if(!selectedBlockId)selectedBlockId=list[0]?.id||'__auto__';}
    else selectedBlockId=null;
    ensureInputControls();
  }

  function rowForCard(card){
    try{const row=window.__modCategoriesV412?.rowForCard?.(card);if(row)return row;}catch(_){}
    const withId=card.querySelector('[onclick*="toggleToday("]')?.getAttribute('onclick')||'';
    const match=withId.match(/toggleToday\((\d+)\)/);
    if(match){const row=taskById(Number(match[1]));if(row)return row;}
    const dataId=Number(card.dataset?.id);if(Number.isFinite(dataId)){const row=taskById(dataId);if(row)return row;}
    const text=(card.querySelector('.task-text')?.textContent||'').trim().toLowerCase().replace(/\s+/g,' ');
    return taskRows().find(row=>String(row?.text||'').trim().toLowerCase().replace(/\s+/g,' ')===text)||null;
  }

  function stateForCard(card){
    const row=rowForCard(card);
    if(row?.type==='cooking'&&['open','running','paused'].includes(row.status))return 'cooking';
    if(row&&['open','running','paused','completed','aborted'].includes(row.status))return row.status;
    if(card.querySelector('.cooking-mode-row')||card.querySelector('.task-type-badge.cooking'))return 'cooking';
    if(card.classList.contains('aborted'))return 'aborted';
    if(card.classList.contains('completed'))return 'completed';
    if(card.classList.contains('paused'))return 'paused';
    if(card.classList.contains('running'))return 'running';
    return 'open';
  }

  function clearImportant(el,name){try{el.style.removeProperty(name);}catch(_){}}
  function applyElementPosition(el,pos){
    if(!el||!pos)return;
    const x=Number(pos.x)||0,y=Number(pos.y)||0;
    for(const prop of ['top','right','bottom','left','z-index'])clearImportant(el,prop);
    if(pos.anchor==='free'){
      el.style.setProperty('position','relative','important');
      el.style.setProperty('transform',`translate(${x}px,${y}px)`,'important');
      return;
    }
    el.style.setProperty('position','absolute','important');
    el.style.setProperty('transform','none','important');
    el.style.setProperty('z-index','4','important');
    const px='var(--mod-card-padding-x, 8px)',py='var(--mod-card-padding-y, 8px)';
    if(pos.anchor==='tl'||pos.anchor==='bl')el.style.setProperty('left',`calc(${px} + ${x}px)`,'important');
    else el.style.setProperty('right',`calc(${px} - ${x}px)`,'important');
    if(pos.anchor==='tl'||pos.anchor==='tr')el.style.setProperty('top',`calc(${py} + ${y}px)`,'important');
    else el.style.setProperty('bottom',`calc(${py} - ${y}px)`,'important');
  }

  function applyVisibleLayoutsSync(){
    const layout=window.__modUxCookingEditorV460?.getLayout?.();
    if(!layout?.positions)return false;
    document.querySelectorAll('#viewContainer .task').forEach(card=>{
      const state=stateForCard(card),positions=layout.positions[state]||{};
      card.dataset.themeStateV460=state;
      card.style.setProperty('position','relative','important');
      for(const [role,selector] of Object.entries(ROLES)){
        const pos=positions[role];if(!pos)continue;
        card.querySelectorAll(selector).forEach(el=>applyElementPosition(el,pos));
      }
    });
    return true;
  }

  function todayButtonTask(btn){
    const onclick=btn.getAttribute('onclick')||'';
    const match=onclick.match(/toggleToday\((\d+)\)/);
    if(match)return taskById(Number(match[1]));
    return rowForCard(btn.closest('.task'));
  }

  function normalizeTodayActions(){
    const calendar=window.__modActionIconsV416?.ICONS?.calendar;
    if(!calendar)return false;
    document.querySelectorAll('#viewContainer .task:not(.archive-task) .icon-actions button').forEach(btn=>{
      const onclick=btn.getAttribute('onclick')||'';
      const label=`${btn.getAttribute('title')||''} ${btn.getAttribute('aria-label')||''}`.toLowerCase();
      const isToday=/toggleToday\(/.test(onclick)||btn.dataset.iconV416==='calendar'||btn.dataset.iconV416==='calendarPin'||/\bheute\b|\btoday\b/.test(label);
      if(!isToday)return;
      const row=todayButtonTask(btn),selected=!!row&&row.todayDate===today();
      btn.dataset.v480TodayAction='1';
      btn.dataset.iconV416='calendar';
      btn.classList.add('mono-action-v416');
      btn.classList.toggle('today-selected-v480',selected);
      btn.setAttribute('aria-pressed',selected?'true':'false');
      btn.setAttribute('aria-label',selected?'Heute-Zuweisung entfernen':'Heute zuweisen');
      btn.setAttribute('title',selected?'Heute-Zuweisung entfernen':'Heute zuweisen');
      btn.innerHTML=calendar;
    });
    return true;
  }

  function stabilize(){
    if(stabilizing)return true;
    stabilizing=true;
    try{
      window.__modRenderStabilityV479?.stabilize?.();
      window.__modActionIconsV416?.patch?.();
      const layouts=applyVisibleLayoutsSync();
      window.__modThemeStateDesignV464?.apply?.();
      const todayActions=normalizeTodayActions();
      ensureInputControls();
      return !!(layouts&&todayActions);
    }catch(error){
      console.warn('V480 render stabilization:',error);
      return false;
    }finally{stabilizing=false;}
  }

  function wrapRender(){
    if(renderWrapped||typeof window.render!=='function')return renderWrapped;
    const base=window.render;
    window.render=function(){const result=base.apply(this,arguments);stabilize();return result;};
    renderWrapped=true;
    return true;
  }

  function ensureTargetBlock(){
    const api=blocksApi();if(!api)return null;
    let list=api.getBlocks?.(today())||[];
    if(!list.length){api.addBlock?.('',{date:today(),render:false});list=api.getBlocks?.(today())||[];}
    return list.find(block=>block.id===selectedBlockId)||list[0]||null;
  }

  function wrapAddTask(){
    if(addWrapped||typeof window.addTask!=='function')return addWrapped;
    const base=window.addTask;
    window.addTask=function(){
      const before=new Set(taskRows().map(row=>row?.id));
      const wantsToday=newTaskToday;
      const requestedBlock=selectedBlockId;
      const result=base.apply(this,arguments);
      const fresh=taskRows().filter(row=>!before.has(row?.id));
      if(!fresh.length)return result;
      if(wantsToday){
        selectedBlockId=requestedBlock;
        const target=ensureTargetBlock();
        if(target){
          const api=blocksApi();
          fresh.forEach(row=>api?.assignTaskToToday?.(row.id,target.id,{date:today(),render:false}));
        }
      }
      newTaskToday=false;selectedBlockId=null;
      if(typeof saveTasks==='function')saveTasks();
      if(typeof render==='function')render();else stabilize();
      ensureInputControls();
      return result;
    };
    addWrapped=true;
    return true;
  }

  function ensure(){
    injectStyle();
    if(!wrapRender())setTimeout(ensure,40);
    if(!wrapAddTask())setTimeout(ensure,40);
    ensureInputControls();
    stabilize();
  }

  window.setNewTaskTodayV480=setNewTaskToday;
  ensure();
  window.addEventListener('load',()=>setTimeout(()=>{ensureInputControls();stabilize();},0));

  window.__modTodayCreateRenderV480={
    version:BUILD_VERSION,
    stabilize,
    applyVisibleLayoutsSync,
    normalizeTodayActions,
    ensureInputControls,
    setNewTaskToday,
    get newTaskToday(){return newTaskToday;},
    get selectedBlockId(){return selectedBlockId;},
    directTodayOnCreate:true,
    createBlockSelection:true,
    synchronousStateLayout:true,
    stableTodayAction:true
  };
})();
