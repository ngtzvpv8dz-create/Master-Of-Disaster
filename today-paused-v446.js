/* V446 · HEUTE = PLANUNG + TATSAECHLICHE TAGESAKTIVITAET · AKTIV -> PAUSIERT · ERLEDIGT ENTFERNT */
(function(){
  const BUILD_VERSION='V446';
  const originalRenderToday=typeof renderToday==='function'?renderToday:null;

  function berlinDayFromIso(value){
    if(!value)return null;
    try{
      if(typeof getBerlinDateKeyFromISO==='function')return getBerlinDateKeyFromISO(value);
      return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
    }catch(_){return null;}
  }

  function segmentTouchesDay(segment,day){
    if(!segment||!segment.startedAt)return false;
    if(berlinDayFromIso(segment.startedAt)===day)return true;
    if(segment.endedAt&&berlinDayFromIso(segment.endedAt)===day)return true;
    const start=new Date(segment.startedAt).getTime();
    const end=segment.endedAt?new Date(segment.endedAt).getTime():Date.now();
    if(!Number.isFinite(start)||!Number.isFinite(end))return false;
    const dayStart=new Date(day+'T00:00:00+02:00').getTime();
    const dayEnd=new Date(day+'T23:59:59.999+02:00').getTime();
    return start<=dayEnd&&end>=dayStart;
  }

  function taskRelevantToday(task,day){
    if(!task)return false;
    const active=['open','running','paused'].includes(String(task.status||''));
    if(active&&String(task.todayHiddenDate||'')===String(day))return false;
    if(task.todayDate===day)return true;
    if(berlinDayFromIso(task.startedAt)===day)return true;
    if(berlinDayFromIso(task.completedAt)===day)return true;
    if(berlinDayFromIso(task.abortedAt)===day)return true;
    return Array.isArray(task.activeSegments)&&task.activeSegments.some(seg=>segmentTouchesDay(seg,day));
  }

  window.renderToday=function(container){
    const today=typeof getBerlinDateKey==='function'?getBerlinDateKey():berlinDayFromIso(new Date().toISOString());
    const all=(Array.isArray(tasks)?tasks:[]).filter(task=>taskRelevantToday(task,today));
    const active=all.filter(task=>['open','running','paused'].includes(task.status)).sort((a,b)=>{
      const aPlanned=a.todayDate===today?0:1,bPlanned=b.todayDate===today?0:1;
      if(aPlanned!==bPlanned)return aPlanned-bPlanned;
      if(!aPlanned)return (a.todayOrder||0)-(b.todayOrder||0);
      return new Date(a.startedAt||a.createdAt||0)-new Date(b.startedAt||b.createdAt||0);
    });
    const completed=all.filter(task=>task.status==='completed').sort((a,b)=>new Date(b.completedAt||0)-new Date(a.completedAt||0));
    const total=active.length+completed.length;
    const percent=total?Math.round(completed.length/total*100):0;
    const summary=document.createElement('div');summary.className='today-summary';summary.innerHTML=`<div class="today-progress"><span>HEUTE · ${completed.length}/${total} ERLEDIGT</span><span class="today-percentage">${percent} %</span></div><div class="today-progress-bar"><div class="today-progress-fill" style="width:${percent}%"></div></div>`;container.appendChild(summary);
    const running=active.find(task=>task.status==='running');
    const planned=active.find(task=>task.todayDate===today);
    const next=running||planned||active[0];
    const nextPanel=document.createElement('div');nextPanel.className='next-task-panel';
    nextPanel.innerHTML=next?`<div class="next-task-label">${next.status==='running'?'AKTUELL LAUFENDE AUFGABE':'NÄCHSTE AUFGABE'}</div><div class="next-task-content"><div class="next-task-number">${dynamicNumber(next)}</div><div class="next-task-status">${statusSymbol(next)}</div><div class="next-task-name">${escapeHtml(next.text)}</div></div>`:`<div class="next-task-label">NÄCHSTE AUFGABE</div><div class="next-task-empty">Keine offene Aufgabe für heute.</div>`;
    container.appendChild(nextPanel);
    container.appendChild(section('OFFEN / LAUFEND / PAUSIERT',active,{cardOptions:{todayDrag:true}}));
    container.appendChild(section('ERLEDIGT HEUTE',completed));
  };

  window.renderActive=function(container){
    const paused=(Array.isArray(tasks)?tasks:[]).filter(task=>task.status==='paused').sort((a,b)=>new Date(b.pausedAt||b.startedAt||0)-new Date(a.pausedAt||a.startedAt||0));
    container.appendChild(section('PAUSIERTE AUFGABEN',paused,{empty:'Keine pausierten Aufgaben.'}));
  };

  function patchTabs(){
    const nav=document.querySelector('.tabs');if(!nav)return;
    const activeBtn=nav.querySelector('[data-tab="active"]');if(activeBtn){activeBtn.textContent='PAUSIERT';activeBtn.setAttribute('aria-label','Pausierte Aufgaben');}
    const completedBtn=nav.querySelector('[data-tab="completed"]');if(completedBtn)completedBtn.remove();
    if(typeof currentTab!=='undefined'&&currentTab==='completed'){
      currentTab='today';
      try{if(typeof safeStorageSet==='function')safeStorageSet('masterOfDisasterCurrentTab','today');}catch(_){}
    }
  }

  const previousRender=typeof render==='function'?render:null;
  if(previousRender){window.render=function(){patchTabs();const result=previousRender.apply(this,arguments);patchTabs();return result;};}
  const previousSwitch=typeof switchTab==='function'?switchTab:null;
  if(previousSwitch){window.switchTab=function(tab){return previousSwitch.call(this,tab==='completed'?'today':tab);};}
  window.addEventListener('load',()=>{patchTabs();setTimeout(patchTabs,100);});
  patchTabs();
  window.__modTodayPausedV446={version:BUILD_VERSION,taskRelevantToday};
})();
