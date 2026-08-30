/* V447 · HEUTE-AKTION AUCH BEI PAUSIERTEN AUFGABEN */
(function(){
  function patchPausedTodayButtons(){
    const today=typeof getBerlinDateKey==='function'?getBerlinDateKey():null;
    document.querySelectorAll('#viewContainer .task:not(.archive-task)').forEach(card=>{
      const resume=card.querySelector('button[onclick*="resumeTask("]');
      if(!resume)return;
      const match=String(resume.getAttribute('onclick')||'').match(/resumeTask\((\d+)\)/);
      if(!match)return;
      const id=Number(match[1]);
      const task=typeof getTask==='function'?getTask(id):null;
      if(!task||task.status!=='paused')return;
      const actions=resume.closest('.icon-actions');
      if(!actions)return;
      let btn=actions.querySelector('.paused-today-v447');
      if(!btn){
        const timeBtn=actions.querySelector('button[onclick*="askManualTimes("]');
        if(!timeBtn)return;
        btn=timeBtn.cloneNode(true);
        btn.classList.add('paused-today-v447','today-button');
        timeBtn.insertAdjacentElement('afterend',btn);
      }
      const selected=!!(today&&task.todayDate===today);
      btn.setAttribute('onclick',`toggleToday(${id})`);
      btn.setAttribute('title',selected?'Aus Heute entfernen':'Für heute markieren');
      btn.setAttribute('aria-label',selected?'Aus Heute entfernen':'Für heute markieren');
      btn.classList.toggle('selected',selected);
      btn.dataset.iconV416='';
      btn.innerHTML=selected?'📌':'📅';
    });
  }
  const previousRender=typeof render==='function'?render:null;
  if(previousRender){
    window.render=function(){
      const result=previousRender.apply(this,arguments);
      patchPausedTodayButtons();
      setTimeout(patchPausedTodayButtons,0);
      return result;
    };
  }
  window.__modPausedTodayV447={version:'V447',patch:patchPausedTodayButtons};
  window.addEventListener('load',()=>setTimeout(patchPausedTodayButtons,350));
})();

/* V496 · PWA RECOVERY LOADER */
(function(){
  function loadRecoveryV496(){
    if(window.__modAccidentalCompletionRecoveryV496){try{window.__modAccidentalCompletionRecoveryV496.poll?.();}catch(_){}return true;}
    if(document.querySelector('script[data-recovery-v496-loader="1"]'))return false;
    const s=document.createElement('script');
    s.src='./remote-accidental-completion-recovery-v496.js?v=496-pwa-0952';
    s.dataset.recoveryV496Loader='1';
    s.onload=()=>{try{window.__modAccidentalCompletionRecoveryV496?.poll?.();}catch(_){}};
    s.onerror=()=>{try{s.remove();}catch(_){}};
    document.head.appendChild(s);
    return false;
  }
  loadRecoveryV496();
  window.addEventListener('load',()=>setTimeout(loadRecoveryV496,300));
  window.addEventListener('focus',()=>setTimeout(loadRecoveryV496,80));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(loadRecoveryV496,80);});
  setTimeout(loadRecoveryV496,700);
})();

/* V497 · PWA SEGMENT REPAIR LOADER */
(function(){
  function loadSegmentRepairV497(){
    if(window.__modTaskSegmentRepairV497){try{window.__modTaskSegmentRepairV497.poll?.();}catch(_){}return true;}
    if(document.querySelector('script[data-segment-repair-v497-loader="1"]'))return false;
    const s=document.createElement('script');
    s.src='./remote-task-segment-repair-v497.js?v=497-pwa-1003';
    s.dataset.segmentRepairV497Loader='1';
    s.onload=()=>{try{window.__modTaskSegmentRepairV497?.poll?.();}catch(_){}};
    s.onerror=()=>{try{s.remove();}catch(_){}};
    document.head.appendChild(s);
    return false;
  }
  loadSegmentRepairV497();
  window.addEventListener('load',()=>setTimeout(loadSegmentRepairV497,340));
  window.addEventListener('focus',()=>setTimeout(loadSegmentRepairV497,90));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(loadSegmentRepairV497,90);});
  setTimeout(loadSegmentRepairV497,760);
})();

/* V498 · GLOBAL HISTORY / BACKUP SAFETY-NET LOADER */
(function(){
  function loadSafetyNetV498(){
    if(window.__modRecoveryHistoryV498)return true;
    if(document.querySelector('script[data-safety-net-v498-loader="1"]'))return false;
    const s=document.createElement('script');
    s.src='./history-safety-net-v498.js?v=506-backup-1131';
    s.dataset.safetyNetV498Loader='1';
    s.onerror=()=>{try{s.remove();}catch(_){}};
    document.head.appendChild(s);
    return false;
  }
  loadSafetyNetV498();
  window.addEventListener('load',()=>setTimeout(loadSafetyNetV498,420));
  window.addEventListener('focus',()=>setTimeout(loadSafetyNetV498,120));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(loadSafetyNetV498,120);});
  setTimeout(loadSafetyNetV498,820);
})();

/* V499 · LOG-STABILITÄTSFIX LOADER */
(function(){
  function loadLogStabilityV499(){
    if(window.__modLogStabilityV499)return true;
    if(document.querySelector('script[data-log-stability-v499-loader="1"]'))return false;
    const s=document.createElement('script');
    s.src='./log-stability-v499.js?v=499-1105';
    s.dataset.logStabilityV499Loader='1';
    s.onerror=()=>{try{s.remove();}catch(_){}};
    document.head.appendChild(s);
    return false;
  }
  loadLogStabilityV499();
  window.addEventListener('load',()=>setTimeout(loadLogStabilityV499,500));
  window.addEventListener('focus',()=>setTimeout(loadLogStabilityV499,150));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(loadLogStabilityV499,150);});
  setTimeout(loadLogStabilityV499,900);
})();

/* V500 · RELEVANTE HISTORY / KOMPAKTER LOG LOADER */
(function(){
  function loadMeaningfulHistoryV500(){
    if(window.__modMeaningfulHistoryV500)return true;
    if(document.querySelector('script[data-meaningful-history-v500-loader="1"]'))return false;
    const s=document.createElement('script');
    s.src='./meaningful-history-v500.js?v=500-1123';
    s.dataset.meaningfulHistoryV500Loader='1';
    s.onerror=()=>{try{s.remove();}catch(_){}};
    document.head.appendChild(s);
    return false;
  }
  loadMeaningfulHistoryV500();
  window.addEventListener('load',()=>setTimeout(loadMeaningfulHistoryV500,580));
  window.addEventListener('focus',()=>setTimeout(loadMeaningfulHistoryV500,180));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(loadMeaningfulHistoryV500,180);});
  setTimeout(loadMeaningfulHistoryV500,980);
})();

/* V501 · HEUTE-AKTIONSREIHENFOLGE / MARKER-FIX LOADER */
(function(){
  function loadTodayActionOrderV501(){
    if(window.__modTodayActionOrderV501)return true;
    if(document.querySelector('script[data-today-action-order-v501-loader="1"]'))return false;
    const s=document.createElement('script');
    s.src='./today-action-order-v501.js?v=501-1210';
    s.dataset.todayActionOrderV501Loader='1';
    s.onerror=()=>{try{s.remove();}catch(_){}};
    document.head.appendChild(s);
    return false;
  }
  loadTodayActionOrderV501();
  window.addEventListener('load',()=>setTimeout(loadTodayActionOrderV501,650));
  window.addEventListener('focus',()=>setTimeout(loadTodayActionOrderV501,200));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(loadTodayActionOrderV501,200);});
  setTimeout(loadTodayActionOrderV501,1100);
})();
