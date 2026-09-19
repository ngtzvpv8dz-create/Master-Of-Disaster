/* V431 CONSOLIDATED UI/FEATURE BUNDLE. Source order preserved from V430. */

/* ===== tab-visibility-v415.js ===== */
/* V415 · INPUT PANEL NUR IM TAB ALLE */
(function(){
  const BUILD_VERSION="V415";
  function syncInputPanel(){
    const panel=document.getElementById("inputPanel");
    if(!panel)return;
    panel.style.display=(typeof currentTab!=="undefined"&&currentTab==="all")?"":"none";
  }
  const previousRender=typeof render==="function"?render:null;
  if(previousRender){render=function(){const result=previousRender.apply(this,arguments);syncInputPanel();return result;};}
  const previousSwitchTab=typeof switchTab==="function"?switchTab:null;
  if(previousSwitchTab){switchTab=function(tab){const result=previousSwitchTab.apply(this,arguments);syncInputPanel();return result;};}
  window.__modTabVisibilityV415={version:BUILD_VERSION,syncInputPanel};
  window.addEventListener("load",()=>setTimeout(syncInputPanel,100));
})();


/* ===== action-icons-v416.js ===== */
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


/* ===== dev-cleanup-v401.js ===== */
/* V406 · DEV CLEANUP
   Force-rendered simplified DEV area for the iPhone-local-master build.
*/
(function(){
  const BUILD_VERSION="V406";
  const BUILD_LABEL="20.08.2026 · 11:45 Uhr";

  function loggedIn(){ return Boolean(supabaseDevState && supabaseDevState.email); }

  function buildDevHtml(){
    const integrity=collectDataIntegrityReport();
    const ok=loggedIn();
    const auth=`<div class="supabase-dev-card" style="margin-top:14px;">
      <div class="supabase-dev-title">☁️ CLOUD-SICHERUNG</div>
      <div class="supabase-status-line"><span class="supabase-status-dot ${ok?"ok":"warn"}"></span><span>${ok?"SUPABASE-ZUGANG AKTIV ✅":"SUPABASE-LOGIN ERFORDERLICH ⚠️"}</span></div>
      <div class="supabase-status-detail">${ok
        ? `Angemeldet${supabaseDevState.email?" als "+escapeHtml(supabaseDevState.email):""}. Die Sitzung wird auf diesem iPhone gespeichert und automatisch erneuert. Im normalen Betrieb musst du dich nicht erneut anmelden.`
        : `Aktuell ist keine gespeicherte Supabase-Sitzung erkannt. Lokal funktioniert die App weiter; Cloud-Backups warten, bis du dich einmal anmeldest.`}</div>
      ${ok?"":`<div class="supabase-dev-actions"><button class="supabase-dev-button primary" onclick="showSupabaseLoginModal()">🔐 SUPABASE ANMELDEN</button></div>`}
    </div>`;

    return `<div class="dev-panel">
      <div class="dev-title">🧪 DEVELOPER / DIAGNOSE</div>
      <div class="dev-build-card" style="margin-bottom:14px;padding:12px;border:1px solid #3a2a2a;border-radius:12px;background:#171313;">
        <div class="dev-build-title" style="margin-bottom:10px;font-size:10px;font-weight:900;letter-spacing:.8px;color:#f0e9e9;">APP-INFO</div>
        <div class="dev-build-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;">
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">VERSION</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">${BUILD_VERSION}</div></div>
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">BUILD</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">${BUILD_LABEL}</div></div>
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">ARCHIVSTAND</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">A${String(Math.max(0,nextArchiveNumber-1)).padStart(3,"0")}</div></div>
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">NÄCHSTE ARCHIVNR.</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">A${String(nextArchiveNumber).padStart(3,"0")}</div></div>
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">AUFGABENBESTAND</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">${tasks.length}</div></div>
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">DATENPRÜFUNG</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">${integrity.ok?"✅ SAUBER":"❌ FEHLER"}</div></div>
        </div>
      </div>
      ${auth}
      <div class="dev-build-card" style="margin-top:14px;">
        <div class="dev-build-title">📱 IPHONE / CLOUD-BACKUP</div>
        <div class="supabase-status-detail" style="margin-bottom:10px;">Das iPhone ist Master. Änderungen werden lokal sofort gespeichert und nach 10 Sekunden Ruhe automatisch als verifiziertes Komplett-Backup nach Supabase gesichert.</div>
        <div class="dev-buttons"><button class="dev-button" onclick="runSupabaseLiveSync(true)">☁️ JETZT SICHERN · SOFORT</button><button class="dev-button" onclick="selectBackupForRestore()">♻️ LOKALES BACKUP WIEDERHERSTELLEN</button></div>
      </div>
      <div class="dev-build-card" style="margin-top:14px;">
        <div class="dev-build-title">🔧 DIAGNOSE / TEST</div>
        <div class="dev-buttons"><button class="dev-button" onclick="runDataIntegrityCheck(true)">🔍 DATEN PRÜFEN</button><button class="dev-button" onclick="simulateDayTransitionForTesting()">🕛 TAGESWECHSEL SIMULIEREN</button></div>
      </div>
    </div>`;
  }

  function forceCleanDev(){
    if(currentTab!=="dev") return;
    const container=document.getElementById("viewContainer");
    if(!container) return;
    container.innerHTML=buildDevHtml();
  }

  const previousRender=render;
  render=function(){
    previousRender();
    forceCleanDev();
  };

  let authRefreshBusy=false;
  async function refreshAuthQuiet(){
    if(authRefreshBusy) return;
    authRefreshBusy=true;
    try{ await refreshSupabaseSessionStatus(); }
    catch(e){ console.warn("V406 auth refresh:",e); }
    finally{ authRefreshBusy=false; }
  }

  window.addEventListener("load",()=>setTimeout(()=>{refreshAuthQuiet();forceCleanDev();},300));
  window.addEventListener("focus",()=>setTimeout(refreshAuthQuiet,250));
})();


/* ===== dev-version.js ===== */
/* V431 · consolidated DEV build label */
(function(){
  function patch(){
    if(typeof currentTab!=="undefined"&&currentTab!=="dev")return;
    const vals=document.querySelectorAll(".dev-build-value");
    if(vals[0])vals[0].textContent="V431";
    if(vals[1])vals[1].textContent="21.08.2026 · 00:07 Uhr";
  }
  const prev=typeof render==="function"?render:null;
  if(prev){render=function(){const r=prev.apply(this,arguments);setTimeout(patch,0);return r;};}
  window.addEventListener("load",()=>setTimeout(patch,400));
  window.__modDevVersion={version:"V431",build:"21.08.2026 · 00:07 Uhr",patch};
})();

/* ===== unified-icons-v419.js ===== */
/* V419 · EINHEITLICHE LINE-ICONS IN DER GESAMTEN APP */
(function(){
 const svg=b=>`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true">${b}</svg></span>`;
 const I={
 work:svg('<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2M4 11h16M10 11v2h4v-2"/>'),
 leisure:svg('<circle cx="12" cy="7" r="3"/><path d="M6.5 20c.6-4.4 2.4-6.5 5.5-6.5s4.9 2.1 5.5 6.5"/>'),
 selfrunner:svg('<rect x="5" y="7" width="14" height="11" rx="3"/><path d="M9 12h.01M15 12h.01M9 15h6M12 7V4M10.5 4h3"/>'),
 cooking:svg('<path d="M7 4v7M10 4v7M7 8h3M8.5 11v9M16 4c-2 3-2 6 0 8v8"/>'),
 category:svg('<path d="M4 7.5h6l2 2h8v10H4Z"/><path d="M4 7.5V5h6l2 2h8v2.5"/>'),
 edit:svg('<path d="m5 17.5-.8 3.3 3.3-.8L18 9.5l-2.5-2.5Z"/><path d="m14.5 8 2.5 2.5"/>'),
 trash:svg('<path d="M7 8v11h10V8M5.5 8h13M9.5 8V5.5h5V8M10 11v5M14 11v5"/>'),
 coffee:svg('<path d="M6 10h10v5.5A3.5 3.5 0 0 1 12.5 19h-3A3.5 3.5 0 0 1 6 15.5Z"/><path d="M16 11h1.5a2 2 0 0 1 0 4H16M8 7c0-1 1-1.3 1-2.3M12 7c0-1 1-1.3 1-2.3M4.5 21h14"/>'),
 play:svg('<path d="M8 5.5 18 12 8 18.5Z"/>'), check:svg('<path d="m5 12.5 4.2 4.2L19 7"/>'),
 chart:svg('<path d="M5 19V11h3v8M10.5 19V6h3v13M16 19V9h3v10M4 19.5h16"/>'),
 clock:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.5 2"/>'),
 calendar:svg('<rect x="4.5" y="6.5" width="15" height="13" rx="2"/><path d="M8 4v5M16 4v5M4.5 10.5h15"/>'),
 cloud:svg('<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11-1.5A4.5 4.5 0 0 0 7 18Z"/><path d="M12 9v6M9.5 12l2.5-3 2.5 3"/>'),
 search:svg('<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>'),
 phone:svg('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 6h4M11 18h2"/>'),
 box:svg('<path d="M4 8h16v11H4ZM6 5h12l2 3H4Z"/><path d="M9 12h6"/>'),
 diagnostic:svg('<path d="M4 14h4l2-7 3 11 2-7 2 3h3"/>'),
 database:svg('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'),
 refresh:svg('<path d="M19 8a8 8 0 0 0-13-2L4 8M5 16a8 8 0 0 0 13 2l2-2"/><path d="M4 4v4h4M20 20v-4h-4"/>'),
 lock:svg('<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3"/>'),
 tag:svg('<path d="M4 5h7l9 9-6 6-9-9Z"/><circle cx="8" cy="9" r="1"/>')
 };
 const esc=s=>String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const rules=[['🔧','work'],['🎮','leisure'],['🤖','selfrunner'],['🍳','cooking'],['🏷️','category'],['🏷','category'],['✏️','edit'],['✏','edit'],['🗑️','trash'],['🗑','trash'],['☕','coffee'],['▶️','play'],['▶','play'],['✅','check'],['✔️','check'],['📊','chart'],['⏱️','clock'],['⏱','clock'],['🕒','clock'],['📅','calendar'],['🗓️','calendar'],['☁️','cloud'],['☁','cloud'],['🔍','search'],['📱','phone'],['📦','box'],['🧪','diagnostic'],['🔧','work'],['💾','database'],['♻️','refresh'],['♻','refresh'],['🕛','refresh'],['🔐','lock']];
 function replaceTextNode(n){if(!n.nodeValue||!rules.some(([e])=>n.nodeValue.includes(e)))return;let html=n.nodeValue;let changed=false;for(const[e,k]of rules){if(html.includes(e)){html=html.replace(new RegExp(esc(e),'g'),I[k]);changed=true;}}if(changed){const s=document.createElement('span');s.className='v419-iconized';s.innerHTML=html;n.replaceWith(s);}}
 function walk(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('script,style,svg')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});const a=[];while(w.nextNode())a.push(w.currentNode);a.forEach(replaceTextNode);}
 function typeBadges(root){root.querySelectorAll('.task-type-badge').forEach(b=>{if(b.querySelector('.ui-icon-v419'))return;const t=(b.textContent||'').toUpperCase();const k=/FREIZEIT/.test(t)?'leisure':/SELBSTLÄUFER/.test(t)?'selfrunner':/KOCHEN/.test(t)?'cooking':/KATEGOR/.test(t)?'category':'work';b.insertAdjacentHTML('afterbegin',I[k]);});}
 function archiveDone(root){root.querySelectorAll('.archive-task').forEach(c=>{[...c.querySelectorAll('span,div')].filter(x=>/^[\s]*[✅✔✓][\s]*$/.test(x.textContent||'')).forEach(x=>{x.classList.add('archive-done-v419');x.innerHTML=I.check;});});}
 function weightEdit(root){root.querySelectorAll('#weightContainer button').forEach(b=>{if(/✏|bearbeiten/i.test((b.textContent||'')+' '+(b.title||''))){b.classList.add('weight-edit-v419');b.innerHTML=I.edit;}});}
 function patch(root=document){walk(root);typeBadges(root);archiveDone(root);weightEdit(root);}
 let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;patch(document);});}).observe(document.documentElement,{subtree:true,childList:true});
 const oldRenderDue=typeof window.renderDue==='function'?window.renderDue:null;
 if(oldRenderDue)window.renderDue=function(container){const active=(tasks||[]).filter(t=>['open','running','paused'].includes(t.status)&&t.dueDate&&t.dueMode!=='none').sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))||Number(a.id)-Number(b.id));if(typeof section==='function'){container.appendChild(section('FÄLLIGKEIT · NACH DATUM',active,{cardOptions:{compactOnly:true,filterTodayOnly:true}}));}else oldRenderDue(container);};
 window.__modUnifiedIconsV419={version:'V419',icons:I,patch};window.addEventListener('load',()=>setTimeout(()=>patch(document),250));patch(document);
})();

/* ===== unified-icons-v420.js ===== */
/* V420 · RESTLICHE ALT-SYMBOLE SEMANTISCH BEREINIGEN */
(function(){
  const base=window.__modUnifiedIconsV419;
  if(!base||!base.icons)return;
  const I=base.icons;
  const ring=(kind)=>`<span class="priority-header-ring-v420 ${kind}" aria-hidden="true"></span>`;
  const extra={
    weight:`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8.5h8l1.5 11h-11Z"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0"/><path d="M12 12v4M10 14h4"/></svg></span>`,
    trophy:`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/></svg></span>`,
    fire:`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21c4 0 7-2.8 7-6.5 0-3-1.8-5.3-4.3-7.5.2 2.2-.8 3.4-2 4.2.1-3.6-2-6.2-4.4-8.2.3 3.3-3.3 5.3-3.3 10.7C5 18 8 21 12 21Z"/><path d="M9.5 16.5c0 2 1.2 3.3 2.7 3.3 1.7 0 2.8-1.2 2.8-2.8 0-1.4-.8-2.5-2-3.4.1 1-.4 1.7-1 2.2-.2-1.3-.9-2.3-1.8-3.1.1 1.4-.7 2.2-.7 3.8Z"/></svg></span>`,
    repeat:`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10l2 2-2 2M17 17H7l-2-2 2-2"/></svg></span>`,
    layers:`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/></svg></span>`
  };
  function cleanPrefix(el){
    if(!el)return;
    const txt=(el.textContent||'').replace(/^[\s\uFE0F]*(?:[\u{1F300}-\u{1FAFF}]|[\u2600-\u27BF])+[\s\uFE0F]*/u,'').trim();
    if(txt)el.textContent=txt;
  }
  function prepend(el,html,cls){if(!el||el.querySelector('.'+cls))return;cleanPrefix(el);el.classList.add('v420-semantic-icon-label');el.insertAdjacentHTML('afterbegin',`<span class="${cls}">${html}</span>`);}
  function patchPriorityHeaders(root){
    root.querySelectorAll('.section-title,.section-header,.statistics-section-title').forEach(el=>{
      const t=(el.textContent||'').trim().toUpperCase();
      let k=null;if(t.includes('HOHE PRIORIT'))k='high';else if(t.includes('MITTLERE PRIORIT'))k='medium';else if(t.includes('NORMALE PRIORIT'))k='normal';else if(t==='OPTIONAL'||t.includes(' OPTIONAL'))k='optional';
      if(k){cleanPrefix(el);if(!el.querySelector('.priority-header-ring-v420'))el.insertAdjacentHTML('afterbegin',ring(k));}
    });
  }
  function patchLabels(root){
    root.querySelectorAll('.statistics-label,.statistics-section-title,.archive-meta,.archive-details,.section-title,.weight-label,.weight-title').forEach(el=>{
      const t=(el.textContent||'').trim().toUpperCase();
      if(/ZUSATZGEWICHT|TRAGEZEIT|KG-STUNDEN/.test(t))prepend(el,extra.weight,'v420-weight-icon');
      else if(/PRODUKTIVSTER TAG|LÄNGSTER EINSATZTAG|REKORD · ZEIT\/TAG/.test(t))prepend(el,extra.fire,'v420-fire-icon');
      else if(/HÄUFIGSTE AUFGABE|WIEDERKEHRENDE AUFGABEN/.test(t))prepend(el,extra.repeat,'v420-repeat-icon');
      else if(/AUFGABEN-REKORDE|REKORD · AUFGABEN\/TAG|REKORDE/.test(t))prepend(el,extra.trophy,'v420-trophy-icon');
      else if(/REPORT-BASIS|REPORTBASIS/.test(t))prepend(el,extra.layers,'v420-layers-icon');
    });
  }
  function patchArchive(root){
    root.querySelectorAll('.archive-task').forEach(card=>{
      card.querySelectorAll('*').forEach(el=>{const t=(el.textContent||'').trim().toUpperCase();if(t&&/ZUSATZGEWICHT/.test(t))prepend(el,extra.weight,'v420-weight-icon');});
    });
  }
  function patch(root=document){patchPriorityHeaders(root);patchLabels(root);patchArchive(root);}
  let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;patch(document);});}).observe(document.documentElement,{childList:true,subtree:true});
  const oldRenderPriority=window.renderPriority;if(typeof oldRenderPriority==='function')window.renderPriority=function(container){const r=oldRenderPriority.apply(this,arguments);setTimeout(()=>patchPriorityHeaders(container||document),0);return r;};
  const oldRenderStatistics=window.renderStatistics;if(typeof oldRenderStatistics==='function')window.renderStatistics=function(container){const r=oldRenderStatistics.apply(this,arguments);setTimeout(()=>patchLabels(container||document),0);return r;};
  window.__modUnifiedIconsV420={version:'V420',patch};window.addEventListener('load',()=>setTimeout(()=>patch(document),300));patch(document);
})();

/* ===== ui-polish-v421.js ===== */
/* V421 · PRIORITAETS-HEADER + STATISTIK-RESTPOLISH */
(function(){
  const base=window.__modUnifiedIconsV419;
  if(!base||!base.icons)return;
  const I=base.icons;
  const icon=(body)=>`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg></span>`;
  const X={
    weight:icon('<path d="M8 8.5h8l1.5 11h-11Z"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0"/><path d="M12 12v4M10 14h4"/>'),
    trophy:icon('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/>'),
    clock:I.clock,
    repeat:icon('<path d="M7 7h10l2 2-2 2M17 17H7l-2-2 2-2"/>'),
    active:icon('<path d="M6 5h12v14H6Z"/><path d="m9 10 1.7 1.7L14.5 8M9 15h6"/>'),
    home:icon('<path d="m4 11 8-7 8 7v9H7v-7h10v7"/>'),
    report:icon('<path d="M6 3h9l3 3v15H6Z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>')
  };
  const colors={high:'#d85b5b',medium:'#d3aa45',normal:'#d8dde1',optional:'#a66ad8'};
  const labels={high:'HOHE PRIORITÄT',medium:'MITTLERE PRIORITÄT',normal:'NORMALE PRIORITÄT',optional:'OPTIONAL'};

  function priorityKind(text){const t=String(text||'').toUpperCase();if(t.includes('HOHE PRIORIT'))return'high';if(t.includes('MITTLERE PRIORIT'))return'medium';if(t.includes('NORMALE PRIORIT'))return'normal';if(/\bOPTIONAL\b/.test(t))return'optional';return null;}
  function patchPriority(root=document){
    if(typeof currentTab!=='undefined'&&currentTab!=='priority')return;
    root.querySelectorAll('.section').forEach(sec=>{
      const head=sec.querySelector(':scope > .section-header');const title=head?.querySelector('.section-title');const count=head?.querySelector('.counter');if(!head||!title||!count)return;
      const kind=priorityKind(title.textContent);if(!kind)return;
      head.classList.add('priority-section-header-v421');title.classList.add('priority-section-title-v421');title.dataset.priorityKind=kind;
      title.innerHTML=`<span class="priority-ring-slot-v421"><span class="priority-ring-v421 ${kind}"></span></span><span class="priority-title-spacer-v421"></span><span class="priority-title-text-v421">${labels[kind]}</span>`;
      title.style.setProperty('--priority-color-v421',colors[kind]);count.classList.add('priority-counter-v421');count.style.setProperty('--priority-color-v421',colors[kind]);
    });
  }
  function stripOldPrefix(el){
    if(!el)return;const txt=(el.textContent||'').replace(/^[\s\uFE0F]*(?:[\u{1F300}-\u{1FAFF}]|[\u2600-\u27BF])+[\s\uFE0F]*/u,'').trim();if(txt)el.textContent=txt;
  }
  function addIcon(el,html,cls){if(!el||el.querySelector('.'+cls))return;stripOldPrefix(el);el.classList.add('v421-stat-icon-label');el.insertAdjacentHTML('afterbegin',`<span class="${cls}">${html}</span>`);}
  function patchStatistics(root=document){
    root.querySelectorAll('.statistics-label,.statistics-section-title,.statistics-topname').forEach(el=>{
      const t=(el.textContent||'').trim().toUpperCase();
      if(/AKTIV MIT GEWICHT|MIT ZUSATZGEWICHT|TRAGEZEIT GESAMT|KG-STUNDEN/.test(t))addIcon(el,X.weight,'v421-weight-icon');
      else if(/PRODUKTIVSTER TAG|AUFGABEN-REKORDE|REKORDE/.test(t))addIcon(el,X.trophy,'v421-trophy-icon');
      else if(/LÄNGSTER EINSATZTAG|REKORD · ZEIT\/TAG/.test(t))addIcon(el,X.clock,'v421-clock-icon');
      else if(/HÄUFIGSTE AUFGABE|WIEDERKEHRENDE AUFGABEN/.test(t))addIcon(el,X.repeat,'v421-repeat-icon');
      else if(/AKTIVE AUFGABEN/.test(t))addIcon(el,X.active,'v421-active-icon');
      else if(/AUSSERHALB|INNERHALB/.test(t))addIcon(el,X.home,'v421-home-icon');
      else if(/REPORT-BASIS|REPORTBASIS/.test(t))addIcon(el,X.report,'v421-report-icon');
    });
    root.querySelectorAll('.statistics-group').forEach(g=>{
      const title=(g.querySelector('.statistics-section-title')?.textContent||'').toUpperCase();
      if(/ZUSATZGEWICHT|GEWICHTSSTUFEN/.test(title))g.classList.add('v421-neutral-weight-stats');
    });
  }
  function patch(root=document){patchPriority(root);patchStatistics(root);}
  let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch(document);});}).observe(document.documentElement,{childList:true,subtree:true});
  const oldRenderPriority=window.renderPriority;if(typeof oldRenderPriority==='function')window.renderPriority=function(container){const r=oldRenderPriority.apply(this,arguments);setTimeout(()=>patchPriority(container||document),0);return r;};
  const oldRenderStatistics=window.renderStatistics;if(typeof oldRenderStatistics==='function')window.renderStatistics=function(container){const r=oldRenderStatistics.apply(this,arguments);setTimeout(()=>patchStatistics(container||document),0);return r;};
  window.__modUiPolishV421={version:'V421',patch};window.addEventListener('load',()=>setTimeout(()=>patch(document),300));patch(document);
})();


/* ===== ui-video-fixes-v422.js ===== */
/* V422 · VIDEO-BASIERTE STATISTIK-ICON-VEREINHEITLICHUNG */
(function(){
  const base=window.__modUnifiedIconsV419;
  if(!base||!base.icons)return;
  const I=base.icons;
  const icon=(body)=>`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg></span>`;
  const X={
    weight:icon('<path d="M8 8.5h8l1.5 11h-11Z"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0"/><path d="M12 12v4M10 14h4"/>'),
    trophy:icon('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/>'),
    clock:I.clock,
    repeat:icon('<path d="M7 7h10l2 2-2 2M17 17H7l-2-2 2-2"/>'),
    active:icon('<circle cx="12" cy="12" r="8"/><path d="m9 12 2 2 4-5"/>'),
    rest:icon('<path d="M5 15h14v4H5Z"/><path d="M7 15v-3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M8 19v2M16 19v2"/>'),
    report:icon('<path d="M6 3h9l3 3v15H6Z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>')
  };
  const map=[
    [/PRODUKTIVSTER TAG|REKORDE|AUFGABEN-REKORDE/,X.trophy,'v422-trophy'],
    [/LÄNGSTER EINSATZTAG/,X.clock,'v422-clock'],
    [/HÄUFIGSTE AUFGABE|WIEDERKEHRENDE AUFGABEN/,X.repeat,'v422-repeat'],
    [/AKTIV MIT GEWICHT|AKTIVE AUFGABEN|MIT ZUSATZGEWICHT/,X.active,'v422-active'],
    [/AUSSERHALB|INNERHALB/,X.rest,'v422-rest'],
    [/TRAGEZEIT GESAMT|GEWICHTSSTUFEN|ZUSATZGEWICHT|KG-STUNDEN/,X.weight,'v422-weight'],
    [/REPORT-BASIS|REPORTBASIS/,X.report,'v422-report']
  ];
  function textOnly(el){return (el.textContent||'').replace(/\s+/g,' ').trim();}
  function clean(el){
    if(!el)return;
    el.querySelectorAll('.v419-iconized,.v420-weight-icon,.v420-fire-icon,.v420-repeat-icon,.v420-trophy-icon,.v420-layers-icon,.v421-weight-icon,.v421-trophy-icon,.v421-clock-icon,.v421-repeat-icon,.v421-active-icon,.v421-home-icon,.v421-report-icon').forEach(n=>n.remove());
    [...el.childNodes].filter(n=>n.nodeType===3).forEach(n=>{n.nodeValue=n.nodeValue.replace(/[🏆🏋️‍♂️🏋️‍♀️🏋️💪🛋️🕒⏱️🔁📊🧱⚖️🎖️]+/gu,'');});
  }
  function semanticIcon(el){
    if(!el||el.dataset.v422Done==='1')return;
    const t=textOnly(el).toUpperCase();
    const m=map.find(([re])=>re.test(t));if(!m)return;
    clean(el);el.dataset.v422Done='1';el.classList.add('v422-stat-label');
    el.insertAdjacentHTML('afterbegin',`<span class="${m[2]}">${m[1]}</span>`);
  }
  function patchStats(root=document){
    if(typeof currentTab!=='undefined'&&currentTab!=='statistics')return;
    root.querySelectorAll('.statistics-label,.statistics-section-title,.statistics-topname,.statistics-card').forEach(el=>{
      if(el.classList.contains('statistics-card')){
        const label=el.querySelector('.statistics-label');if(label)semanticIcon(label);
      }else semanticIcon(el);
    });
    root.querySelectorAll('.statistics-wrapper,.statistics-group,.statistics-card,.statistics-section-title,.statistics-label,.statistics-value,.statistics-sub').forEach(el=>{
      el.classList.add('v422-neutral-stats');
    });
  }
  function patch(root=document){patchStats(root);}
  let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;patch(document);});}).observe(document.documentElement,{childList:true,subtree:true});
  const old=window.renderStatistics;if(typeof old==='function')window.renderStatistics=function(container){const r=old.apply(this,arguments);setTimeout(()=>patchStats(container||document),0);return r;};
  window.__modVideoFixesV422={version:'V422',patch};window.addEventListener('load',()=>setTimeout(()=>patch(document),350));patch(document);
})();


/* ===== visible-icon-fix-v423.js ===== */
/* V423 · ECHTE SICHTBARE ALT-ICONS DIREKT ERSETZEN */
(function(){
  const icon=body=>`<span class="ui-icon-v419 v423-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg></span>`;
  const X={
    weight:icon('<path d="M8 8.5h8l1.5 11h-11Z"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0"/><path d="M12 12v4M10 14h4"/>'),
    trophy:icon('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/>'),
    clock:icon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.5 2"/>'),
    repeat:icon('<path d="M7 7h10l2 2-2 2M17 17H7l-2-2 2-2"/>'),
    active:icon('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m14.5 15 1.5 1.5 3-3"/>'),
    rest:icon('<path d="M5 15h14v4H5Z"/><path d="M7 15v-3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M8 19v2M16 19v2"/>'),
    report:icon('<path d="M6 3h9l3 3v15H6Z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>')
  };
  const emoji=/[🏆🏋️‍♂️🏋️‍♀️🏋️💪🛋️🕒⏱️🔁📊🧱⚖️🎖️🥇🏅]+/gu;
  function plain(el){return (el.textContent||'').replace(emoji,'').replace(/\s+/g,' ').trim();}
  function set(el,svg,text){if(!el)return;el.innerHTML=`${svg}<span class="v423-label-text">${text}</span>`;el.classList.add('v423-fixed-label');}
  function patchStats(root=document){
    root.querySelectorAll('.statistics-record-label').forEach(el=>{
      const t=plain(el).toUpperCase();
      if(t.includes('PRODUKTIVSTER TAG'))set(el,X.trophy,'PRODUKTIVSTER TAG');
      else if(t.includes('LÄNGSTER EINSATZTAG'))set(el,X.clock,'LÄNGSTER EINSATZTAG');
      else if(t.includes('HÄUFIGSTE AUFGABE'))set(el,X.repeat,'HÄUFIGSTE AUFGABE');
    });
    root.querySelectorAll('.statistics-section-title').forEach(el=>{
      const t=plain(el).toUpperCase();
      if(t==='REKORDE'||t==='AUFGABEN-REKORDE')set(el,X.trophy,t);
      else if(t.includes('ZUSATZGEWICHT'))set(el,X.weight,t);
      else if(t.includes('GEWICHTSSTUFEN'))set(el,X.weight,t);
      else if(t.includes('REPORT-BASIS'))set(el,X.report,t);
    });
    root.querySelectorAll('.statistics-label').forEach(el=>{
      const t=plain(el).toUpperCase();
      if(/AKTIV MIT GEWICHT|MIT ZUSATZGEWICHT/.test(t))set(el,X.active,t);
      else if(/TRAGEZEIT|KG-STUNDEN|\d+[,.]?\d*\s*KG/.test(t))set(el,X.weight,t);
      else if(/AKTIVE AUFGABEN/.test(t))set(el,X.active,t);
      else if(/AUSSERHALB|INNERHALB/.test(t))set(el,X.rest,t);
    });
  }
  function patchArchive(root=document){
    root.querySelectorAll('.archive-task-weight-details').forEach(el=>{const t=plain(el);if(t)set(el,X.weight,t);});
    root.querySelectorAll('.archive-weight-total').forEach(el=>{const t=plain(el);if(t)set(el,X.weight,t);});
  }
  function patch(root=document){patchStats(root);patchArchive(root);}
  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch(document);});}).observe(document.documentElement,{childList:true,subtree:true});
  const oldStats=window.renderStatistics;if(typeof oldStats==='function')window.renderStatistics=function(){const r=oldStats.apply(this,arguments);setTimeout(()=>patchStats(document),0);return r;};
  const oldArchive=window.renderArchive;if(typeof oldArchive==='function')window.renderArchive=function(){const r=oldArchive.apply(this,arguments);setTimeout(()=>patchArchive(document),0);return r;};
  window.__modVisibleIconFixV423={version:'V423',patch};
  window.addEventListener('load',()=>setTimeout(()=>patch(document),350));
  patch(document);
})();


/* ===== priority-header-v424.js ===== */
/* V426 · PRIORITY TAB HEADER CLEAN REBUILD */
(function(){
  const defs=[
    {key:'high',label:'HOHE PRIORITÄT',color:'#d85b5b'},
    {key:'medium',label:'MITTLERE PRIORITÄT',color:'#d3aa45'},
    {key:'normal',label:'NORMALE PRIORITÄT',color:'#f3f3f3'},
    {key:'optional',label:'OPTIONAL',color:'#a66ad8'}
  ];

  function patch(){
    if(typeof currentTab!=='undefined'&&currentTab!=='priority')return;
    const root=document.getElementById('viewContainer')||document;
    const sections=[...root.querySelectorAll(':scope > .section')].slice(0,4);
    if(sections.length<4)return;

    const anyTaskText=root.querySelector('.task .task-text');
    const fallbackOffset=67;

    sections.forEach((sec,index)=>{
      const def=defs[index];
      const head=sec.querySelector(':scope > .section-header');
      if(!head)return;

      const oldCounter=head.querySelector('.counter,.priority-count-v425,.priority-count-v424,.priority-counter-v421');
      const countText=(oldCounter?.textContent||String(sec.querySelectorAll('.task').length)).trim();
      const taskText=sec.querySelector('.task .task-text')||anyTaskText;
      const headLeft=head.getBoundingClientRect().left;
      const taskLeft=taskText?taskText.getBoundingClientRect().left:headLeft+fallbackOffset;
      const offset=Math.max(54,Math.round(taskLeft-headLeft));

      head.className='section-header priority-header-v426 '+def.key;
      head.style.setProperty('--priority-color-v426',def.color);
      head.style.setProperty('--priority-label-offset-v426',offset+'px');
      head.innerHTML='<span class="priority-ring-v426" aria-hidden="true"></span><span class="priority-label-v426">'+def.label+'</span><span class="counter priority-count-v426">'+countText+'</span>';
    });
  }

  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch();});};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  const oldSwitch=window.switchTab;
  if(typeof oldSwitch==='function')window.switchTab=function(tab){const r=oldSwitch.apply(this,arguments);if(tab==='priority')setTimeout(patch,30);return r;};
  window.__modPriorityHeaderV424={version:'V426',patch};
  addEventListener('load',()=>setTimeout(patch,350));
  patch();
})();


/* ===== completed-cleanup-v429.js ===== */
/* V429 · REMOVE REDUNDANT REPEAT ACTION FROM COMPLETED/ABORTED TASKS */
(function(){
  function normalize(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ');}
  function taskForCard(card){
    try{
      const api=window.__modCategoriesV412;
      if(api&&typeof api.rowForCard==='function'){
        const row=api.rowForCard(card);
        if(row)return row;
      }
    }catch(_){}
    const text=normalize(card.querySelector('.task-text')?.textContent);
    try{return (Array.isArray(tasks)?tasks:[]).find(t=>normalize(t?.text)===text)||null;}catch(_){return null;}
  }
  function isRepeatButton(btn){
    const hay=normalize([
      btn.getAttribute('title'),
      btn.getAttribute('aria-label'),
      btn.getAttribute('onclick'),
      btn.textContent
    ].filter(Boolean).join(' '));
    if(/wiederhol|erneut|nochmal|noch mal|neu hinzufügen|neu hinzufuegen|repeat|readd|re-add/.test(hay))return true;
    /* V416 turns the old repeat clock into a monochrome clock. On completed/aborted cards
       there is no legitimate manual-time action anymore, so that clock is the redundant repeat action. */
    return btn.dataset.iconV416==='clock';
  }
  function patch(){
    document.querySelectorAll('#viewContainer .task:not(.archive-task)').forEach(card=>{
      const task=taskForCard(card);
      if(!task||!['completed','aborted'].includes(task.status))return;
      card.querySelectorAll('button').forEach(btn=>{if(isRepeatButton(btn))btn.remove();});
    });
  }
  const previousRender=typeof render==='function'?render:null;
  if(previousRender){window.render=function(){const result=previousRender.apply(this,arguments);setTimeout(patch,0);return result;};}
  let queued=false;
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch();});};
  new MutationObserver(queue).observe(document.getElementById('viewContainer')||document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(patch,250));
  patch();
  window.__modCompletedCleanupV429={version:'V429',patch};
})();


/* ===== weight-backfill-v430.js ===== */
/* V430 · MANUAL WEIGHT BACKFILL */
(function(){
  const VERSION='V430';

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function nowLocal(){return typeof formatISOForDateTimeLocal==='function'?formatISOForDateTimeLocal(new Date().toISOString()):'';}
  function defaultStart(){const d=new Date(Date.now()-30*60*1000);return typeof formatISOForDateTimeLocal==='function'?formatISOForDateTimeLocal(d.toISOString()):'';}
  function overlaps(startMs,endMs){
    const phases=Array.isArray(window.weightPhases)?window.weightPhases:(typeof weightPhases!=='undefined'&&Array.isArray(weightPhases)?weightPhases:[]);
    const hit=phases.find(p=>{
      if(!p||!p.startedAt||!p.endedAt)return false;
      const a=new Date(p.startedAt).getTime(),b=new Date(p.endedAt).getTime();
      return Number.isFinite(a)&&Number.isFinite(b)&&Math.max(startMs,a)<Math.min(endMs,b);
    });
    if(hit)return hit;
    try{
      if(typeof weightState!=='undefined'&&weightState?.isWearing&&weightState.currentPhaseStartedAt){
        const a=new Date(weightState.currentPhaseStartedAt).getTime(),b=Date.now();
        if(Number.isFinite(a)&&Math.max(startMs,a)<Math.min(endMs,b))return {current:true,startedAt:weightState.currentPhaseStartedAt,endedAt:new Date(b).toISOString(),weightKg:weightState.currentPhaseWeightKg};
      }
    }catch(_){}
    return null;
  }
  function close(){const el=document.getElementById('weightBackfillOverlayV430');if(el)el.remove();}
  function showError(title,msg){if(typeof showInfoModal==='function')showInfoModal(title,msg);else alert(title+'\n\n'+msg);}

  window.openWeightBackfillV430=function(){
    close();
    const current=(typeof weightState!=='undefined'&&Number(weightState.currentWeightKg)>0)?Number(weightState.currentWeightKg):0;
    const overlay=document.createElement('div');
    overlay.id='weightBackfillOverlayV430';
    overlay.className='modal-overlay weight-backfill-overlay-v430';
    overlay.innerHTML=`<div class="modal weight-backfill-modal-v430" role="dialog" aria-modal="true" aria-labelledby="weightBackfillTitleV430">
      <div class="weight-backfill-head-v430"><div><div id="weightBackfillTitleV430" class="weight-backfill-title-v430">ZUSATZGEWICHT NACHTRAGEN</div><div class="weight-backfill-sub-v430">Vergessenen Tragezeitraum nachträglich erfassen</div></div><button class="weight-backfill-close-v430" type="button" aria-label="Schließen" onclick="closeWeightBackfillV430()">×</button></div>
      <label class="weight-backfill-label-v430">GEWICHT · KG<input id="weightBackfillKgV430" class="weight-backfill-input-v430" inputmode="decimal" value="${esc(current?String(current).replace('.',','):'')}"></label>
      <label class="weight-backfill-label-v430">VON<input id="weightBackfillStartV430" class="weight-backfill-input-v430" type="datetime-local" value="${esc(defaultStart())}"></label>
      <label class="weight-backfill-label-v430">BIS<input id="weightBackfillEndV430" class="weight-backfill-input-v430" type="datetime-local" value="${esc(nowLocal())}"></label>
      <div class="weight-backfill-hint-v430">Der Zeitraum wird wie eine normale Gewichtsphase gespeichert und automatisch in Tages-, Aufgaben- und Archivstatistiken berücksichtigt.</div>
      <div class="weight-backfill-actions-v430"><button class="weight-backfill-secondary-v430" type="button" onclick="closeWeightBackfillV430()">ABBRECHEN</button><button class="weight-backfill-primary-v430" type="button" onclick="saveWeightBackfillV430()">SPEICHERN</button></div>
    </div>`;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    document.body.appendChild(overlay);
  };
  window.closeWeightBackfillV430=close;

  window.saveWeightBackfillV430=function(){
    const kgEl=document.getElementById('weightBackfillKgV430'),sEl=document.getElementById('weightBackfillStartV430'),eEl=document.getElementById('weightBackfillEndV430');
    if(!kgEl||!sEl||!eEl)return;
    const kg=Number(String(kgEl.value).replace(',','.'));
    if(!Number.isFinite(kg)||kg<=0){showError('Ungültiges Gewicht','Bitte gib ein gültiges Gewicht größer als 0 kg ein.');return;}
    const startIso=typeof berlinLocalInputToISO==='function'?berlinLocalInputToISO(sEl.value):null;
    const endIso=typeof berlinLocalInputToISO==='function'?berlinLocalInputToISO(eEl.value):null;
    const startMs=startIso?new Date(startIso).getTime():NaN,endMs=endIso?new Date(endIso).getTime():NaN;
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)){showError('Ungültiger Zeitraum','Bitte gib für Von und Bis ein gültiges Datum mit Uhrzeit ein.');return;}
    if(endMs<=startMs){showError('Ungültiger Zeitraum','„Bis“ muss nach „Von“ liegen.');return;}
    if(endMs>Date.now()+60*1000){showError('Zeitraum liegt in der Zukunft','Nachtragen ist nur für bereits vergangene Zeiträume vorgesehen.');return;}
    const hit=overlaps(startMs,endMs);
    if(hit){
      const hStart=typeof formatDateTime==='function'?formatDateTime(hit.startedAt,'VON'):String(hit.startedAt||'');
      const hEnd=typeof formatDateTime==='function'?formatDateTime(hit.endedAt,'BIS'):String(hit.endedAt||'');
      showError('Überschneidung erkannt','Für diesen Zeitraum existiert bereits eine Gewichtsphase. Bitte korrigiere Von/Bis, damit keine Tragezeit doppelt gezählt wird.\n\n'+hStart+'\n'+hEnd);
      return;
    }
    const phases=Array.isArray(window.weightPhases)?window.weightPhases:(typeof weightPhases!=='undefined'&&Array.isArray(weightPhases)?weightPhases:null);
    if(!phases){showError('Speichern nicht möglich','Die Gewichtsphasen konnten nicht geladen werden.');return;}
    const phase={id:Date.now(),weightKg:kg,startedAt:startIso,endedAt:endIso,date:typeof getBerlinDateKeyFromISO==='function'?getBerlinDateKeyFromISO(startIso):null,source:'manual-backfill',manuallyEntered:true,createdAt:new Date().toISOString()};
    phases.push(phase);
    phases.sort((a,b)=>new Date(a?.startedAt||0)-new Date(b?.startedAt||0));
    if(typeof saveWeight==='function')saveWeight();
    close();
    if(typeof renderWeightPanel==='function')renderWeightPanel();
    if(typeof render==='function')render();
    if(typeof showInfoModal==='function')showInfoModal('Zusatzgewicht nachgetragen',`${String(kg).replace('.',',')} kg wurden für den gewählten Zeitraum gespeichert.`);
  };

  function icon(){return '<svg class="weight-backfill-svg-v430" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 7.5a3.5 3.5 0 1 1 7 0"/><path d="M6.5 8.5h11l2 10h-15Z"/><path d="M9 13h6M12 10v6"/></svg>';}
  function patchPanel(){
    const panel=document.querySelector('#weightContainer .weight-panel');
    if(!panel||panel.querySelector('.weight-backfill-button-v430'))return;
    const action=panel.querySelector('.weight-action-button');
    if(!action)return;
    const btn=document.createElement('button');
    btn.type='button';btn.className='weight-backfill-button-v430';btn.innerHTML=icon()+'<span>NACHTRAGEN</span>';btn.setAttribute('aria-label','Zusatzgewicht nachtragen');btn.onclick=openWeightBackfillV430;
    action.insertAdjacentElement('beforebegin',btn);
  }
  const prev=typeof renderWeightPanel==='function'?renderWeightPanel:null;
  if(prev){window.renderWeightPanel=function(){const r=prev.apply(this,arguments);setTimeout(patchPanel,0);return r;};}
  new MutationObserver(()=>patchPanel()).observe(document.getElementById('weightContainer')||document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(patchPanel,300));
  setTimeout(patchPanel,0);
  window.__modWeightBackfillV430={version:VERSION,patchPanel,overlaps};
})();
