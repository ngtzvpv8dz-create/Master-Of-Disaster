/* V445 · RÜCKWIRKEND ERFASSEN + DIREKT ABSCHLIESSEN */
(function(){
  function totalClosedSegments(segs){
    return (Array.isArray(segs)?segs:[]).reduce((sum,s)=>{
      if(!s||!s.startedAt||!s.endedAt)return sum;
      const a=new Date(s.startedAt).getTime(),b=new Date(s.endedAt).getTime();
      return sum+(Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,b-a):0);
    },0);
  }

  function syncTaskDurations(task,total){
    task.actualDurationMs=total;
    if(task.type==='leisure'){
      task.leisureDurationMs=total;
      task.activeDurationMs=0;
      task.passiveDurationMs=null;
      task.cookingActiveDurationMs=null;
      task.cookingPassiveDurationMs=null;
    }else if(task.type==='cooking'){
      task.cookingSegments=(task.activeSegments||[]).map(s=>({mode:'active',startedAt:s.startedAt,endedAt:s.endedAt}));
      task.cookingActiveDurationMs=total;
      task.cookingPassiveDurationMs=0;
      task.activeDurationMs=total;
      task.passiveDurationMs=0;
      task.leisureDurationMs=null;
    }else{
      task.activeDurationMs=total;
      task.leisureDurationMs=null;
      task.passiveDurationMs=null;
      task.cookingActiveDurationMs=null;
      task.cookingPassiveDurationMs=null;
    }
  }

  window.saveManualSegmentsAndCompleteV445=function(id){
    const task=getTask(id);if(!task)return;
    let segs;
    try{segs=readSegmentsFromDomV443(true);}catch(e){showInfoModal('Zeitangabe prüfen',e.message);return;}
    segs.sort((a,b)=>new Date(a.startedAt)-new Date(b.startedAt));
    if(!segs.length){showInfoModal('Zeitangabe prüfen','Mindestens ein Zeitabschnitt ist erforderlich.');return;}
    for(let i=0;i<segs.length;i++){
      if(!segs[i].endedAt){showInfoModal('Zeitangabe prüfen','Zum direkten Abschließen müssen alle Zeitabschnitte eine Endzeit haben.');return;}
      if(i<segs.length-1&&new Date(segs[i].endedAt)>new Date(segs[i+1].startedAt)){
        showInfoModal('Zeitangabe prüfen',`Abschnitt ${i+1} und ${i+2} überlappen sich.`);return;
      }
    }
    const total=totalClosedSegments(segs);
    if(!(total>0)){showMissingCompletionDuration(task);return;}
    task.activeSegments=segs;
    task.startedAt=segs[0].startedAt;
    task.completedAt=segs[segs.length-1].endedAt;
    task.completedDate=typeof getBerlinDateKey==='function'?getBerlinDateKey():null;
    task.status='completed';
    task.pausedAt=null;
    task.pauseTotalMs=0;
    syncTaskDurations(task,total);
    if(typeof normalizeTodayOrder==='function')normalizeTodayOrder();
    closeModal();saveTasks();render();
    try{if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('retroactive-complete-v445');}catch(_){}
  };

  const observer=new MutationObserver(()=>{
    const modal=document.querySelector('.segment-editor-modal');
    if(!modal||modal.dataset.v445Done==='1')return;
    const state=window.__manualSegmentsV443;
    if(!state)return;
    const task=getTask(state.taskId);
    if(!task||task.status==='completed'||task.status==='aborted')return;
    const actions=modal.querySelector('.modal-actions');
    if(!actions)return;
    const btn=document.createElement('button');
    btn.className='modal-button confirm-modal';
    btn.type='button';
    btn.textContent='SPEICHERN & ERLEDIGEN';
    btn.onclick=()=>saveManualSegmentsAndCompleteV445(state.taskId);
    actions.insertBefore(btn,actions.lastElementChild);
    modal.dataset.v445Done='1';
  });
  observer.observe(document.getElementById('modalContainer'),{childList:true,subtree:true});

  const originalStartTask=window.startTask;
  window.startTask=function(id){
    const task=getTask(id);
    const segs=task&&Array.isArray(task.activeSegments)?task.activeSegments:[];
    const hasClosedHistory=task&&task.status==='open'&&segs.length>0&&segs.every(s=>s&&s.startedAt&&s.endedAt);
    if(!hasClosedHistory)return originalStartTask(id);
    const running=tasks.find(item=>item.status==='running'&&item.id!==id);
    if(running){showInfoModal('Schon eine Aufgabe aktiv','Aktuell läuft bereits „'+running.text+'“.');return;}
    const now=new Date().toISOString();
    task.status='running';
    task.pausedAt=null;
    task.startedAt=segs[0].startedAt;
    task.activeSegments.push({startedAt:now,endedAt:null});
    if(task.type==='cooking'){
      if(!Array.isArray(task.cookingSegments))task.cookingSegments=[];
      task.cookingMode='active';
      task.cookingSegments.push({mode:'active',startedAt:now,endedAt:null});
    }
    saveTasks();render();
  };

  window.__modRetroactiveV445={totalClosedSegments};
})();
