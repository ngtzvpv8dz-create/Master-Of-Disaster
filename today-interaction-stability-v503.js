/* V503 · HEUTE-INTERAKTIONEN STABIL
   - Bearbeiten innerhalb HEUTE bewahrt Arbeitsblock + exakte Reihenfolge,
     solange der Arbeitsblock nicht ausdrücklich geändert wird.
   - Die HEUTE-Aktion entfernt eine bereits zugewiesene Aufgabe zuverlässig
     aus dem Tagesplan, ohne sie versehentlich neu einzusortieren.
   - Pause wird im HEUTE-Tab direkt auf die laufende Aufgabe delegiert, damit
     der erste Tastendruck auch während nachgelagerter UI-Patches wirksam ist.
*/
(function(){
  'use strict';
  if(window.__modTodayInteractionStabilityV503)return;

  const BUILD_VERSION='V503';
  let saveEditWrapped=false;
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
    if(!row||String(row.todayDate||'')!==String(today()))return false;
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
    bindCapture();
  }

  ensure();
  window.addEventListener('load',()=>setTimeout(ensure,0));

  window.__modTodayInteractionStabilityV503={
    version:BUILD_VERSION,
    wrapSaveEdit,
    snapshotTodayPlan,
    restoreTodayPlan,
    removeFromToday,
    pauseImmediately,
    editKeepsExactTodayPosition:true,
    explicitBlockChangeStillMoves:true,
    todayRemovalDirect:true,
    firstPauseClickDirect:true,
    dataSemanticsUntouched:true
  };
})();
