/* V418 · MONOCHROME ACTION ICONS + PRIORITY/OPTIONAL + FREE DUE DATE */
(function(){
  const svg=(body)=>`<svg class="action-svg-v416" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const ICONS={
    play:svg('<path d="M8 5.5 18 12 8 18.5Z"/>'),
    clock:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.5 2"/>'),
    calendar:svg('<rect x="4.5" y="6.5" width="15" height="13" rx="2"/><path d="M8 4v5M16 4v5M4.5 10.5h15M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01"/>'),
    calendarPin:svg('<rect x="4.5" y="6.5" width="13" height="12" rx="2"/><path d="M8 4v5M15 4v5M4.5 10.5h13M8 14h.01M12 14h.01"/><path d="m18.7 13.5 2 2-2 1.2-.7 3.1-1.4-1.4-2.4 2.4-.9-.9 2.4-2.4-1.4-1.4 3.1-.7Z"/>'),
    check:svg('<path d="m5 12.5 4.2 4.2L19 7"/>'),
    edit:svg('<path d="m5 17.5-.8 3.3 3.3-.8L18 9.5l-2.5-2.5Z"/><path d="m14.5 8 2.5 2.5"/>'),
    cancel:svg('<path d="M6 6 18 18M18 6 6 18"/>'),
    trash:svg('<path d="M7 8v11h10V8M5.5 8h13M9.5 8V5.5h5V8M10 11v5M14 11v5"/>'),
    coffee:svg('<path d="M6 10h10v5.5A3.5 3.5 0 0 1 12.5 19h-3A3.5 3.5 0 0 1 6 15.5Z"/><path d="M16 11h1.5a2 2 0 0 1 0 4H16M8 7c0-1 1-1.3 1-2.3M12 7c0-1 1-1.3 1-2.3M4.5 21h14"/>')
  };
  let newDueDateV418=null;
  const previousAddTask=typeof addTask==='function'?addTask:null;
  const previousRenderPriority=typeof renderPriority==='function'?renderPriority:null;

  function effectivePriority(task){return task&&((task.priority==='optional')||task.optional)?'optional':(task?.priority||'normal');}
  function formatDue(date){const p=String(date||'').split('-');return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:String(date||'');}
  function ringHtml(priority){return `<span class="priority-choice-ring-v418 ${priority}"></span>`;}

  function textOf(btn){return `${btn.getAttribute('title')||''} ${btn.getAttribute('aria-label')||''} ${btn.textContent||''} ${btn.getAttribute('onclick')||''}`.toLowerCase();}
  function keyFor(btn,task){
    const t=textOf(btn);
    if(/löschen|loeschen|delete|remove/.test(t))return'trash';
    if(/abbrechen|abbruch|abort|cancel/.test(t))return'cancel';
    if(/bearbeiten|edit/.test(t))return'edit';
    if(/abschließen|abschliessen|erledigen|beenden|complete|finish/.test(t))return'check';
    if(/heute|today/.test(t))return task&&task.todayDate?'calendarPin':'calendar';
    if(/zeit|uhrzeit|dauer|manualtime/.test(t))return'clock';
    if(/pause|pausieren/.test(t))return'coffee';
    if(/start|fortsetzen|resume|play/.test(t))return'play';
    const raw=(btn.textContent||'').trim();
    if(/[▶▷►⏵]/.test(raw))return'play';
    if(/[🕒⏱⏰🕐]/.test(raw))return'clock';
    if(/[📅🗓]/.test(raw))return task&&task.todayDate?'calendarPin':'calendar';
    if(/[✅✔✓]/.test(raw))return'check';
    if(/[✏🖉]/.test(raw))return'edit';
    if(/[❌✕✖]/.test(raw))return'cancel';
    if(/[🗑]/.test(raw))return'trash';
    if(/[☕]/.test(raw))return'coffee';
    return null;
  }
  function taskForCard(card){
    try{const api=window.__modCategoriesV412;if(api&&typeof api.rowForCard==='function')return api.rowForCard(card);}catch(_){}
    const txt=(card.querySelector('.task-text')?.textContent||'').trim().toLowerCase().replace(/\s+/g,' ');
    try{return (Array.isArray(tasks)?tasks:[]).find(x=>String(x?.text||'').trim().toLowerCase().replace(/\s+/g,' ')===txt)||null;}catch(_){return null;}
  }
  function replaceButton(btn,task){
    if(btn.closest('.modal-overlay,.dev-panel,.input-panel,.weight-panel,.edit-area'))return;
    const key=keyFor(btn,task);if(!key)return;
    if(btn.dataset.iconV416===key&&btn.querySelector('.action-svg-v416'))return;
    const label=(btn.getAttribute('title')||btn.getAttribute('aria-label')||btn.textContent||'').trim();
    btn.dataset.iconV416=key;btn.classList.add('mono-action-v416');
    if(label&&!btn.getAttribute('aria-label'))btn.setAttribute('aria-label',label.replace(/\s+/g,' '));
    btn.innerHTML=ICONS[key];
  }
  function patchFlags(card,task){
    const flags=card.querySelector('.compact-flags');if(!flags||!task)return;
    [...flags.querySelectorAll('.mini-flag')].forEach(el=>{if(/[⚪🟡🔴🟣⚠️🔷💠]/.test((el.textContent||'').trim()))el.style.display='none';});
    const p=effectivePriority(task);
    let ring=flags.querySelector('.priority-ring-v417');
    if(!ring){ring=document.createElement('span');ring.className='priority-ring-v417';flags.prepend(ring);}
    ring.className=`priority-ring-v417 ${p}`;
    ring.title=p==='high'?'Hohe Priorität':p==='medium'?'Mittlere Priorität':p==='optional'?'Optional':'Normale Priorität';
    let due=flags.querySelector('.due-ring-v417');
    const hasDue=!!(task.dueDate&&task.dueMode!=='none');
    if(!hasDue){if(due)due.remove();return;}
    const today=typeof getBerlinDateKey==='function'?getBerlinDateKey():new Date().toISOString().slice(0,10);
    const overdue=String(task.dueDate)<String(today);
    if(!due){due=document.createElement('span');flags.appendChild(due);}
    due.className=`due-ring-v417 ${overdue?'overdue':'upcoming'}`;
    due.innerHTML=`<span class="due-ring-mark-v417">${overdue?'!':''}</span><span class="due-date-v417">${formatDue(task.dueDate)}</span>`;
    due.title=overdue?'Fälligkeit überschritten':'Fälligkeit hinterlegt';
  }
  function patchStatus(card,task){
    const s=card.querySelector('.status-symbol');if(!s)return;
    if(task&&task.status==='open'){s.classList.remove('mono-status-v416');if(/⬜|□/.test(s.textContent||''))s.textContent='';return;}
    if((task&&task.status==='paused')||/☕/.test(s.textContent||'')){if(s.classList.contains('mono-status-v416')&&s.querySelector('.action-svg-v416'))return;s.classList.add('mono-status-v416');s.innerHTML=ICONS.coffee;}
  }

  window.setNewPriority=function(priority){newTaskPriority=priority;newTaskOptional=priority==='optional';updateNewOptions();};
  window.setNewDueDateV418=function(value){newDueDateV418=value||null;newTaskDueMode=newDueDateV418?'deadline':'none';updateNewOptions();};
  window.clearNewDueDateV418=function(){setNewDueDateV418('');};
  window.updateNewOptions=function(){
    ['newTypeWork','newTypeLeisure','newTypeSelfrunner','newTypeCooking'].forEach(id=>document.getElementById(id)?.classList.remove('selected'));
    const typeId=newTaskType==='leisure'?'newTypeLeisure':newTaskType==='selfrunner'?'newTypeSelfrunner':newTaskType==='cooking'?'newTypeCooking':'newTypeWork';document.getElementById(typeId)?.classList.add('selected');
    ['normal','medium','high','optional'].forEach(p=>document.getElementById('newPriority'+p[0].toUpperCase()+p.slice(1))?.classList.toggle('selected',effectivePriority({priority:newTaskPriority,optional:newTaskOptional})===p));
    const d=document.getElementById('newDueDateV418');if(d&&d.value!==(newDueDateV418||''))d.value=newDueDateV418||'';
  };
  window.resetNewOptions=function(){newTaskPriority='normal';newTaskOptional=false;newTaskDueMode='none';newTaskType='work';newDueDateV418=null;updateNewOptions();};
  if(previousAddTask){window.addTask=function(){const before=new Set((tasks||[]).map(t=>t&&t.id));const selectedDate=newDueDateV418;const p=effectivePriority({priority:newTaskPriority,optional:newTaskOptional});newTaskPriority=p;newTaskOptional=p==='optional';newTaskDueMode=selectedDate?'deadline':'none';const r=previousAddTask.apply(this,arguments);const fresh=(tasks||[]).filter(t=>!before.has(t&&t.id));fresh.forEach(t=>{t.priority=p;t.optional=p==='optional';t.dueMode=selectedDate?'deadline':'none';t.dueDate=selectedDate||null;});if(fresh.length){saveTasks();render();}return r;};}
  const oldSetPriority=typeof setPriority==='function'?setPriority:null;
  window.setPriority=function(id,priority){const task=typeof getTask==='function'?getTask(id):null;if(!task)return;if(oldSetPriority&&priority!=='optional'){}task.priority=priority;task.optional=priority==='optional';saveTasks();render();};
  window.setTaskDueDateV418=function(id,value){const task=typeof getTask==='function'?getTask(id):null;if(!task)return;task.dueDate=value||null;task.dueMode=value?'deadline':'none';saveTasks();render();};
  window.editOptions=function(task){const p=effectivePriority(task);return `
<div class="option-row"><span class="option-label">TYP</span>
<button class="option-button ${task.type==='work'?'selected':''}" onclick="setTaskType(${task.id},'work')">🔧 ARBEIT</button>
<button class="option-button ${task.type==='leisure'?'selected':''}" onclick="setTaskType(${task.id},'leisure')">🎮 FREIZEIT</button>
<button class="option-button ${task.type==='selfrunner'?'selected':''}" onclick="setTaskType(${task.id},'selfrunner')">🤖 SELBSTLÄUFER</button>
<button class="option-button ${task.type==='cooking'?'selected':''}" onclick="setTaskType(${task.id},'cooking')">🍳 KOCHEN</button></div>
<div class="option-row priority-edit-v418"><span class="option-label">PRIORITÄT</span>
${['normal','medium','high','optional'].map(x=>`<button class="option-button priority-option-v418 ${p===x?'selected':''}" onclick="setPriority(${task.id},'${x}')">${ringHtml(x)} ${x==='normal'?'NORMAL':x==='medium'?'MITTEL':x==='high'?'HOCH':'OPTIONAL'}</button>`).join('')}</div>
<div class="option-row due-edit-v418"><span class="option-label">FÄLLIG</span><input class="due-date-input-v418" type="date" value="${task.dueDate||''}" onchange="setTaskDueDateV418(${task.id},this.value)"><button class="option-button due-clear-v418" onclick="setTaskDueDateV418(${task.id},'')">KEINE</button></div>`;};
  window.renderPriority=function(container){const active=(tasks||[]).filter(t=>['open','running','paused'].includes(t.status));[['🔴 HOHE PRIORITÄT','high'],['🟡 MITTLERE PRIORITÄT','medium'],['⚪ NORMALE PRIORITÄT','normal'],['🟣 OPTIONAL','optional']].forEach(group=>{const items=active.filter(t=>effectivePriority(t)===group[1]);container.appendChild(section(group[0],items,{cardOptions:{compactOnly:true,filterTodayOnly:true}}));});};

  function patchInput(){const panel=document.getElementById('inputPanel');if(!panel)return;const rows=[...panel.querySelectorAll('.option-row')];const pri=rows.find(r=>r.querySelector('.option-label')?.textContent.trim()==='PRIORITÄT');const opt=rows.find(r=>r.querySelector('.option-label')?.textContent.trim()==='OPTIONAL');const due=rows.find(r=>r.querySelector('.option-label')?.textContent.trim()==='FÄLLIG');if(pri&&!pri.dataset.v418){pri.dataset.v418='1';pri.innerHTML=`<span class="option-label">PRIORITÄT</span>${[['Normal','normal'],['Medium','medium'],['High','high'],['Optional','optional']].map(([cap,p])=>`<button id="newPriority${cap}" class="option-button priority-option-v418" onclick="setNewPriority('${p}')">${ringHtml(p)} ${p==='normal'?'NORMAL':p==='medium'?'MITTEL':p==='high'?'HOCH':'OPTIONAL'}</button>`).join('')}`;}if(opt)opt.remove();if(due&&!due.dataset.v418){due.dataset.v418='1';due.innerHTML='<span class="option-label">FÄLLIG</span><input id="newDueDateV418" class="due-date-input-v418" type="date" onchange="setNewDueDateV418(this.value)"><button class="option-button due-clear-v418" onclick="clearNewDueDateV418()">KEINE</button>';}updateNewOptions();}
  function patch(){patchInput();document.querySelectorAll('#viewContainer .task:not(.archive-task)').forEach(card=>{const task=taskForCard(card);patchStatus(card,task);patchFlags(card,task);card.querySelectorAll('button').forEach(btn=>replaceButton(btn,task));});}
  const prev=typeof render==='function'?render:null;if(prev){render=function(){const r=prev.apply(this,arguments);setTimeout(patch,0);return r;};}
  let queued=false;const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch();});};new MutationObserver(queue).observe(document.getElementById('viewContainer')||document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(patch,250));patchInput();
  window.__modActionIconsV416={version:'V418',patch,ICONS,effectivePriority,formatDue};
})();
