/* V603 · TO-DO STABILITY CORE
   Konsolidiert die weiterhin benötigten UI-Stabilitätskorrekturen aus V501/V503/V504/V505.
   Historische Sport-/Hub-Bootstrapper aus der alten V505-Datei sind ausdrücklich entfernt.
*/

/* V501 · EINHEITLICHE AKTIONSREIHENFOLGE + HEUTE-PUNKT */
(function(){
  'use strict';
  const BUILD_VERSION='V501';
  let observer=null,queued=false;

  function label(btn){return `${btn?.getAttribute('title')||''} ${btn?.getAttribute('aria-label')||''} ${btn?.textContent||''}`.toLowerCase().replace(/\s+/g,' ').trim();}
  function call(btn){return String(btn?.getAttribute('onclick')||'');}
  function rank(btn,index){
    const c=call(btn),l=label(btn),cl=btn.classList;
    if(cl.contains('v491-order-up'))return 0;
    if(cl.contains('v491-order-down'))return 10;
    if(/completeSelfrunner\(|startTask\(|resumeTask\(|pauseTask\(/.test(c)||/selbstläufer auslösen|\bstart\b|\bweiter\b|fortsetzen|dingsi-pause|\bpause\b/.test(l))return 20;
    if(/complete|finish|done/i.test(c)||/erledigt|abschließen|abschliessen|fertig|beenden/.test(l))return 30;
    if(/askManualTimes\(/.test(c)||btn.dataset.iconV416==='clock'||/zeit bearbeiten|zeiten bearbeiten|uhrzeit|startzeit|endzeit/.test(l))return 40;
    if(/toggleToday\(/.test(c)||btn.dataset.v480TodayAction==='1'||cl.contains('today-button')||cl.contains('v491-today-action')||/heute-zuweisung|heute zuweisen|aus heute|für heute/.test(l))return 50;
    if(/edit/i.test(c)||btn.dataset.iconV416==='edit'||/bearbeiten|editieren/.test(l))return 60;
    if(/abort|cancel/i.test(c)||cl.contains('abort-button')||/abbrechen|abbruch/.test(l))return 70;
    if(/delete|removeTask/i.test(c)||btn.dataset.iconV416==='trash'||/löschen|loeschen/.test(l))return 80;
    return 1000+index;
  }

  function isToday(btn){
    const c=call(btn),l=label(btn),cl=btn.classList;
    return /toggleToday\(/.test(c)||btn.dataset.v480TodayAction==='1'||cl.contains('today-button')||cl.contains('v491-today-action')||/heute-zuweisung|heute zuweisen|aus heute|für heute/.test(l);
  }

  function orderActions(actions){
    if(!actions)return false;
    const buttons=[...actions.children].filter(el=>el instanceof HTMLButtonElement);
    const desired=buttons.map((button,index)=>({button,index,rank:rank(button,index)})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(x=>x.button);
    const changed=desired.some((button,index)=>buttons[index]!==button);
    if(changed)desired.forEach(button=>actions.appendChild(button));
    desired.forEach((button,index)=>{
      button.dataset.v501ActionOrder=String(rank(button,index));
      if(isToday(button))button.classList.add('v501-today-action');
    });
    actions.dataset.v501Ordered='true';
    return changed;
  }

  function injectStyle(){
    if(document.getElementById('todayActionOrderV501Style'))return;
    const style=document.createElement('style');
    style.id='todayActionOrderV501Style';
    style.textContent=`
      #viewContainer .icon-actions .v501-today-action{position:relative!important;inset:auto!important;transform:none!important}
      #viewContainer .icon-actions .v501-today-action.today-selected-v480::after{content:''!important;position:absolute!important;top:3px!important;right:3px!important;bottom:auto!important;left:auto!important;width:5px!important;height:5px!important;border-radius:50%!important;background:currentColor!important;box-shadow:0 0 0 1px rgba(0,0,0,.55)!important;pointer-events:none!important}
    `;
    document.head.appendChild(style);
  }

  function enhanceAll(){
    queued=false;injectStyle();
    document.querySelectorAll('#viewContainer .task:not(.archive-task) .icon-actions').forEach(orderActions);
    return true;
  }
  function queue(){if(queued)return;queued=true;requestAnimationFrame(enhanceAll);}
  function observe(){if(observer)return;const root=document.getElementById('viewContainer');if(!root)return;observer=new MutationObserver(queue);observer.observe(root,{childList:true,subtree:true});}

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){window.render=function(){const result=previousRender.apply(this,arguments);enhanceAll();setTimeout(enhanceAll,0);return result;};}
  injectStyle();observe();setTimeout(enhanceAll,0);
  window.addEventListener('load',()=>setTimeout(()=>{observe();enhanceAll();},0));
  window.addEventListener('focus',()=>setTimeout(enhanceAll,50));
  window.__modTodayActionOrderV501={version:BUILD_VERSION,enhanceAll,orderActions,todayMarkerBoundToButton:true,semanticOrder:['up','down','run','complete','time','today','edit','abort','delete'],dataSemanticsUntouched:true};
})();


/* V503 · HEUTE-INTERAKTIONEN STABIL
   - Bearbeiten innerhalb HEUTE bewahrt Arbeitsblock + exakte Reihenfolge,
     solange der Arbeitsblock nicht ausdrücklich geändert wird.
   - Die HEUTE-Aktion entfernt eine bereits zugewiesene Aufgabe zuverlässig
     aus dem Tagesplan, ohne sie versehentlich neu einzusortieren.
   - Bereits gestartete/pausierte Aufgaben können bewusst aus HEUTE ausgeblendet
     werden, ohne ihre Zeit- oder Verlaufsdaten anzutasten.
   - Pause wird im HEUTE-Tab direkt auf die laufende Aufgabe delegiert, damit
     der erste Tastendruck auch während nachgelagerter UI-Patches wirksam ist.
*/
(function(){
  'use strict';
  if(window.__modTodayInteractionStabilityV503)return;

  const BUILD_VERSION='V503';
  let saveEditWrapped=false;
  let toggleTodayWrapped=false;
  let captureBound=false;
  let handlingClick=false;

  function tab(){
    try{return String(currentTab||'all');}catch(_){return 'all';}
  }

  function today(){
    try{return typeof getBerlinDateKey==='function'?getBerlinDateKey():new Date().toISOString().slice(0,10);}
    catch(_){return new Date().toISOString().slice(0,10);}
  }

  function rows(){
    try{return Array.isArray(tasks)?tasks:[];}catch(_){return [];}
  }

  function taskById(id){
    return rows().find(row=>String(row?.id)===String(id))||null;
  }

  function isActive(row){
    return !!row&&['open','running','paused'].includes(String(row.status||''));
  }

  function taskIdFromButton(button){
    if(!button)return null;
    const onclick=String(button.getAttribute('onclick')||'');
    const hit=onclick.match(/(?:toggleToday|pauseTask)\((\d+)\)/);
    if(hit)return Number(hit[1]);
    const card=button.closest?.('.task[data-id]');
    const id=Number(card?.dataset?.id);
    return Number.isFinite(id)?id:null;
  }

  function save(){
    try{if(typeof saveTasks==='function')saveTasks();}catch(error){console.warn('V503 saveTasks:',error);}
  }

  function rerender(){
    try{if(typeof render==='function')render();}catch(error){console.warn('V503 render:',error);}
  }

  function snapshotTodayPlan(date=today()){
    return rows()
      .filter(row=>isActive(row)&&String(row.todayDate||'')===String(date))
      .map(row=>({
        id:row.id,
        todayDate:row.todayDate||null,
        todayOrder:Number.isFinite(Number(row.todayOrder))?Number(row.todayOrder):null,
        todayWorkBlockId:row.todayWorkBlockId||null
      }));
  }

  function restoreTodayPlan(snapshot){
    let changed=false;
    (Array.isArray(snapshot)?snapshot:[]).forEach(saved=>{
      const row=taskById(saved.id);
      if(!row||!isActive(row))return;
      if(row.todayDate!==saved.todayDate){row.todayDate=saved.todayDate;changed=true;}
      if(row.todayWorkBlockId!==saved.todayWorkBlockId){row.todayWorkBlockId=saved.todayWorkBlockId;changed=true;}
      const currentOrder=Number.isFinite(Number(row.todayOrder))?Number(row.todayOrder):null;
      if(currentOrder!==saved.todayOrder){row.todayOrder=saved.todayOrder;changed=true;}
    });
    return changed;
  }

  function wrapSaveEdit(){
    if(saveEditWrapped||typeof window.saveEdit!=='function')return saveEditWrapped;
    const base=window.saveEdit;

    window.saveEdit=function(id){
      const row=taskById(id);
      const date=today();
      const editingToday=tab()==='today'&&row&&isActive(row)&&String(row.todayDate||'')===String(date);
      const plan=editingToday?snapshotTodayPlan(date):null;
      const originalBlock=editingToday?(row.todayWorkBlockId||null):null;
      const select=editingToday?document.getElementById('editWorkBlockV474'):null;
      const requestedBlock=select?String(select.value||''):String(originalBlock||'');
      const explicitBlockChange=!!select&&requestedBlock!==String(originalBlock||'')&&requestedBlock!=='__create__';
      const createBlockRequested=!!select&&requestedBlock==='__create__';

      const result=base.apply(this,arguments);

      if(editingToday&&!explicitBlockChange&&!createBlockRequested&&plan){
        if(restoreTodayPlan(plan))save();
        rerender();
      }
      return result;
    };

    saveEditWrapped=true;
    return true;
  }

  function wrapToggleToday(){
    if(toggleTodayWrapped||typeof window.toggleToday!=='function')return toggleTodayWrapped;
    const base=window.toggleToday;

    window.toggleToday=function(id){
      const date=today();
      const before=taskById(id);
      const wasToday=before&&String(before.todayDate||'')===String(date);
      const result=base.apply(this,arguments);
      const row=taskById(id);
      if(!wasToday&&row&&String(row.todayDate||'')===String(date)&&row.todayHiddenDate){
        row.todayHiddenDate=null;
        save();
        rerender();
      }
      return result;
    };

    toggleTodayWrapped=true;
    return true;
  }

  function isTodayAction(button){
    if(!button)return false;
    const onclick=String(button.getAttribute('onclick')||'');
    return /toggleToday\(/.test(onclick)||
      button.dataset?.v480TodayAction==='1'||
      button.classList?.contains('v491-today-action')||
      button.classList?.contains('today-button');
  }

  function removeFromToday(id){
    const row=taskById(id);
    const date=today();
    if(!row||String(row.todayDate||'')!==String(date))return false;
    if(['running','paused'].includes(String(row.status||'')))row.todayHiddenDate=date;
    row.todayDate=null;
    row.todayOrder=null;
    row.todayWorkBlockId=null;
    save();
    rerender();
    return true;
  }

  function pauseImmediately(id){
    const row=taskById(id);
    if(!row||String(row.status||'')!=='running'||typeof window.pauseTask!=='function')return false;
    window.pauseTask(id);
    return true;
  }

  function onCapturedClick(event){
    if(handlingClick||tab()!=='today')return;
    const button=event.target?.closest?.('button');
    if(!button||!document.getElementById('viewContainer')?.contains(button))return;

    const onclick=String(button.getAttribute('onclick')||'');
    const id=taskIdFromButton(button);
    if(id===null)return;

    let handled=false;
    handlingClick=true;
    try{
      if(isTodayAction(button)){
        const row=taskById(id);
        if(row&&String(row.todayDate||'')===String(today()))handled=removeFromToday(id);
      }else if(/pauseTask\(/.test(onclick)||button.classList.contains('pause-button')){
        handled=pauseImmediately(id);
      }
    }finally{
      handlingClick=false;
    }

    if(handled){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function bindCapture(){
    if(captureBound)return true;
    document.addEventListener('click',onCapturedClick,true);
    captureBound=true;
    return true;
  }

  function ensure(){
    if(!wrapSaveEdit())setTimeout(ensure,40);
    if(!wrapToggleToday())setTimeout(ensure,40);
    bindCapture();
  }

  ensure();
  window.addEventListener('load',()=>setTimeout(ensure,0));

  window.__modTodayInteractionStabilityV503={
    version:BUILD_VERSION,
    wrapSaveEdit,
    wrapToggleToday,
    snapshotTodayPlan,
    restoreTodayPlan,
    removeFromToday,
    pauseImmediately,
    editKeepsExactTodayPosition:true,
    explicitBlockChangeStillMoves:true,
    todayRemovalDirect:true,
    pausedTodayManualHide:true,
    firstPauseClickDirect:true,
    dataSemanticsUntouched:true
  };
})();


/* V504 · KATEGORIE BEIM ERSTELLEN STABIL
   - Eine im Neuanlage-Formular ausdrücklich gewählte Kategorie hat Vorrang.
   - Historie/Autovervollständigung darf die Auswahl nicht nachträglich überschreiben.
   - Ist keine Kategorie ausgewählt, bleibt die bisherige Vorschlags-/Lernlogik erhalten.
*/
(function(){
  'use strict';
  if(window.__modCategoryCreateStabilityV504)return;

  const BUILD_VERSION='V504';
  const MAP_KEY='masterOfDisasterCategoryNameMapV405';
  let addTaskWrapped=false;

  function clean(value){
    return String(value??'').trim().replace(/\s+/g,' ');
  }

  function norm(value){
    return clean(value).toLocaleLowerCase('de-DE');
  }

  function rows(){
    try{return Array.isArray(tasks)?tasks:[];}catch(_){return [];}
  }

  function selectedCategory(){
    try{return clean(document.getElementById('newCategoryV412')?.value||'');}
    catch(_){return '';}
  }

  function rememberCategory(task,category){
    if(!task||!category)return;
    try{
      const map=JSON.parse(localStorage.getItem(MAP_KEY)||'{}')||{};
      map[norm(task.text)]=category;
      localStorage.setItem(MAP_KEY,JSON.stringify(map));
    }catch(error){
      console.warn('V504 category map:',error);
    }
  }

  function persist(){
    try{
      if(typeof saveTasks==='function')saveTasks();
      else if(typeof saveAll==='function')saveAll();
    }catch(error){
      console.warn('V504 category save:',error);
    }
  }

  function rerender(){
    try{if(typeof render==='function')render();}
    catch(error){console.warn('V504 category render:',error);}
  }

  function enforceSelectedCategory(beforeIds,category){
    if(!category)return [];
    const fresh=rows().filter(task=>task&&!beforeIds.has(task.id));
    if(!fresh.length)return fresh;
    fresh.forEach(task=>{
      task.category=category;
      rememberCategory(task,category);
    });
    persist();
    rerender();
    return fresh;
  }

  function wrapAddTask(){
    if(addTaskWrapped||typeof window.addTask!=='function')return addTaskWrapped;
    const base=window.addTask;

    window.addTask=function(){
      const explicitCategory=selectedCategory();
      const beforeIds=new Set(rows().map(task=>task&&task.id));
      const result=base.apply(this,arguments);
      if(explicitCategory)enforceSelectedCategory(beforeIds,explicitCategory);
      return result;
    };

    addTaskWrapped=true;
    return true;
  }

  function ensure(){
    if(!wrapAddTask())setTimeout(ensure,40);
  }

  ensure();
  window.addEventListener('load',()=>setTimeout(ensure,0));

  window.__modCategoryCreateStabilityV504={
    version:BUILD_VERSION,
    wrapAddTask,
    selectedCategory,
    enforceSelectedCategory,
    explicitNewCategoryWins:true,
    suggestionCategoryFallbackOnly:true,
    dataSemanticsUntouched:true
  };
})();


/* V505 · LAUFENDE AUFGABE OHNE SEKUNDEN-NEURENDER DER GESAMTEN ANSICHT
   - V489 aktualisiert pro Sekunde nur noch die tatsächlich laufende Karte.
   - Andere offene/erledigte Karten behalten ihre DOM-Instanz und Aktionsleiste.
   - Live-Zeitdetails bleiben erhalten, ohne die komplette Ansicht neu aufzubauen.
*/
(function(){
  'use strict';
  if(window.__modRunningTaskRenderStabilityV505)return;

  const BUILD_VERSION='V505';

  function verify(){
    const api=window.__modTaskTimeWeightDetailsV489;
    return !!(
      api&&
      api.periodicFullRenderRemovedV505===true&&
      api.runningCardOnlyRefreshV505===true&&
      typeof api.refreshRunningCards==='function'
    );
  }

  function refreshRunningCards(){
    const api=window.__modTaskTimeWeightDetailsV489;
    return typeof api?.refreshRunningCards==='function'?api.refreshRunningCards():0;
  }

  window.__modRunningTaskRenderStabilityV505={
    version:BUILD_VERSION,
    verify,
    refreshRunningCards,
    fullViewTickerRemoved:true,
    runningCardOnlyRefresh:true,
    unrelatedCardsKeepDom:true,
    terminalActionsStayStable:true,
    dataSemanticsUntouched:true
  };
})();

(function(){
  'use strict';
  window.__modTodoStabilityV603={
    version:'V603',
    actionOrder:window.__modTodayActionOrderV501?.version||null,
    todayInteractions:window.__modTodayInteractionStabilityV503?.version||null,
    categoryCreate:window.__modCategoryCreateStabilityV504?.version||null,
    runningRender:window.__modRunningTaskRenderStabilityV505?.version||null,
    legacySportHubBootstrapRemoved:true
  };
})();
