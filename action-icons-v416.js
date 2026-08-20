/* V417 · MONOCHROME ACTION ICONS + STATUS POLISH */
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
  function formatDue(date){
    const p=String(date||'').split('-');return p.length===3?`${p[2]}.${p[1]}.` : String(date||'');
  }
  function patchFlags(card,task){
    const flags=card.querySelector('.compact-flags');if(!flags||!task)return;
    [...flags.querySelectorAll('.mini-flag')].forEach(el=>{
      const t=(el.textContent||'').trim();
      if(/[⚪🟡🔴⚠️🔷]/.test(t))el.style.display='none';
    });
    let ring=flags.querySelector('.priority-ring-v417');
    if(!ring){ring=document.createElement('span');ring.className='priority-ring-v417';flags.prepend(ring);}
    ring.className=`priority-ring-v417 ${task.priority==='high'?'high':task.priority==='medium'?'medium':'normal'}`;
    ring.title=task.priority==='high'?'Hohe Priorität':task.priority==='medium'?'Mittlere Priorität':'Normale Priorität';

    let due=flags.querySelector('.due-ring-v417');
    const hasDue=!!(task.dueDate&&task.dueMode!=='none');
    if(!hasDue){if(due)due.remove();return;}
    const today=typeof getBerlinDateKey==='function'?getBerlinDateKey():new Date().toISOString().slice(0,10);
    const overdue=String(task.dueDate)<=String(today);
    if(!due){due=document.createElement('span');due.className='due-ring-v417';flags.appendChild(due);}
    due.className=`due-ring-v417 ${overdue?'overdue':'upcoming'}`;
    due.innerHTML=`<span class="due-ring-mark-v417">!</span><span class="due-date-v417">${formatDue(task.dueDate)}</span>`;
    due.title=overdue?'Fälligkeit erreicht/überschritten':'Fälligkeit hinterlegt';
  }
  function patchStatus(card,task){
    const s=card.querySelector('.status-symbol');if(!s)return;
    if(task&&task.status==='open'){
      s.classList.remove('mono-status-v416');
      if(/⬜|□/.test(s.textContent||''))s.textContent='';
      return;
    }
    if((task&&task.status==='paused')||/☕/.test(s.textContent||'')){
      if(s.classList.contains('mono-status-v416')&&s.querySelector('.action-svg-v416'))return;
      s.classList.add('mono-status-v416');s.innerHTML=ICONS.coffee;
    }
  }
  function patch(){document.querySelectorAll('#viewContainer .task:not(.archive-task)').forEach(card=>{const task=taskForCard(card);patchStatus(card,task);patchFlags(card,task);card.querySelectorAll('button').forEach(btn=>replaceButton(btn,task));});}
  const prev=typeof render==='function'?render:null;if(prev){render=function(){const r=prev.apply(this,arguments);setTimeout(patch,0);return r;};}
  let queued=false;const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch();});};
  new MutationObserver(queue).observe(document.getElementById('viewContainer')||document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(patch,250));
  window.__modActionIconsV416={version:'V417',patch,ICONS};
})();
