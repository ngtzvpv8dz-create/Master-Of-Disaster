/* V460 · THEME-EDITOR 2 + ABBRUCH-SICHTBARKEIT + KOCHSEGMENTE
   - Notiz-UI deaktiviert (Daten bleiben aus Sicherheitsgruenden unangetastet)
   - feste Live-Vorschau am unteren Bildschirmrand
   - Positionen je Aufgabenzustand, inkl. Eck-Anker
   - abgebrochene Aufgaben in ALLE und HEUTE sichtbar
   - Kochen: aktive/passive Segmente manuell typisierbar
   - passive Garzeit blockiert keine andere aktive Aufgabe
*/
(function(){
  'use strict';

  const BUILD_VERSION='V460';
  const LAYOUT_KEY='masterOfDisasterThemeStateLayoutV460';
  const STATES=[
    ['open','OFFEN'],['running','LÄUFT'],['paused','PAUSIERT'],['cooking','KOCHEN'],['completed','ERLEDIGT'],['aborted','ABGEBROCHEN']
  ];
  const STATE_LABEL=Object.fromEntries(STATES);
  const ROLES=['number','status','title','flags','type','meta','actions','cooking'];
  const ROLE_SELECTORS={
    number:'.task-number',status:'.status-symbol',title:'.task-text',flags:'.compact-flags',type:'.task-type-badge',
    meta:'.task-meta,.duration,.task-leisure-duration,.task-cooking-active,.task-cooking-passive,.status-meta,.abort-meta',
    actions:'.icon-actions',cooking:'.cooking-mode-row'
  };
  const ANCHORS=[['free','FREI'],['tl','↖ OBEN LINKS'],['tr','↗ OBEN RECHTS'],['bl','↙ UNTEN LINKS'],['br','↘ UNTEN RECHTS']];

  const themeApi=window.__modThemeLayoutV458;
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function safeGet(k){try{return localStorage.getItem(k);}catch(_){return null;}}
  function safeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(_){return false;}}
  function clamp(v,min,max){const n=Number(v);return Math.min(max,Math.max(min,Number.isFinite(n)?n:0));}

  function makeLayoutDefaults(){
    const base=themeApi?.getConfig?.()||{};
    const positions={};
    for(const [state] of STATES){
      positions[state]={};
      for(const role of ROLES){
        const e=base.elements?.[role]||{};
        positions[state][role]={anchor:'free',x:clamp(e.x||0,-80,80),y:clamp(e.y||0,-80,80)};
      }
    }
    return {gridStep:2,selectedState:'open',positions};
  }
  function sanitizeLayout(raw){
    const d=makeLayoutDefaults();
    if(raw&&[1,2,4,8].includes(Number(raw.gridStep)))d.gridStep=Number(raw.gridStep);
    if(raw&&STATE_LABEL[raw.selectedState])d.selectedState=raw.selectedState;
    for(const [state] of STATES){
      for(const role of ROLES){
        const src=raw?.positions?.[state]?.[role];
        if(!src)continue;
        d.positions[state][role]={
          anchor:['free','tl','tr','bl','br'].includes(src.anchor)?src.anchor:'free',
          x:clamp(src.x,-80,80),y:clamp(src.y,-80,80)
        };
      }
    }
    return d;
  }
  let layout=(()=>{try{const raw=safeGet(LAYOUT_KEY);return sanitizeLayout(raw?JSON.parse(raw):null);}catch(_){return makeLayoutDefaults();}})();
  let selectedState=layout.selectedState;
  let draft=null;
  let draftRole=null;
  let collapsed=false;
  let patchScheduled=false;

  function persistLayout(){layout.selectedState=selectedState;safeSet(LAYOUT_KEY,JSON.stringify(layout));}
  function selectedRole(){const active=document.querySelector('.theme-role-v458.active[data-theme-role-select]');const role=active?.dataset?.themeRoleSelect;return ROLES.includes(role)?role:'title';}
  function currentSaved(role=selectedRole()){return clone(layout.positions[selectedState][role]);}
  function resetDraft(){draftRole=selectedRole();draft=currentSaved(draftRole);}

  function isCooking(task){return !!task&&task.type==='cooking';}
  function isPassiveCooking(task){return !!task&&task.status==='running'&&task.type==='cooking'&&task.cookingMode==='passive';}
  function isBlockingRunning(task){return !!task&&task.status==='running'&&!isPassiveCooking(task);}
  function otherBlocking(id){return (Array.isArray(tasks)?tasks:[]).find(t=>t&&t.id!==id&&isBlockingRunning(t));}

  function stateForTask(task){
    if(!task)return 'open';
    if(task.type==='cooking'&&['open','running','paused'].includes(task.status))return 'cooking';
    return STATE_LABEL[task.status]?task.status:'open';
  }
  function stateForCard(card){
    try{const row=window.__modCategoriesV412?.rowForCard?.(card);if(row)return stateForTask(row);}catch(_){}
    if(card.querySelector('.cooking-mode-row')||card.querySelector('.task-type-badge.cooking'))return 'cooking';
    if(card.classList.contains('aborted'))return 'aborted';
    if(card.classList.contains('completed'))return 'completed';
    if(card.classList.contains('paused'))return 'paused';
    if(card.classList.contains('running'))return 'running';
    return 'open';
  }

  function clearImportant(el,name){el.style.removeProperty(name);}
  function applyElementPosition(el,pos){
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
  function applyCardLayout(card,state,useDraft=false){
    if(!card)return;
    card.dataset.themeStateV460=state;
    card.style.setProperty('position','relative','important');
    for(const role of ROLES){
      const pos=(useDraft&&state===selectedState&&role===draftRole&&draft)?draft:layout.positions[state][role];
      if(!pos)continue;
      card.querySelectorAll(ROLE_SELECTORS[role]).forEach(el=>applyElementPosition(el,pos));
    }
  }
  function applyVisibleLayouts(){document.querySelectorAll('#viewContainer .task').forEach(card=>applyCardLayout(card,stateForCard(card),false));}

  function disableNotesUi(){
    document.querySelectorAll('.task-note-editor-v456,.task-note-v456').forEach(node=>{if(!node.closest('.theme-preview-v458'))node.remove();});
    document.querySelectorAll('.theme-role-v458[data-theme-role-select="note"]').forEach(node=>node.remove());
    document.querySelectorAll('.theme-field-v458').forEach(field=>{
      const label=(field.querySelector('.theme-label-v458 span')?.textContent||'').trim().toUpperCase();
      if(label.startsWith('NOTIZ'))field.remove();
    });
  }

  function injectStyle(){
    if(document.getElementById('uxCookingEditorV460Style'))return;
    const style=document.createElement('style');style.id='uxCookingEditorV460Style';style.textContent=`
      .task-note-v456,.task-note-editor-v456,.theme-note-preview-v459{display:none!important}
      body.theme-sticky-v460{padding-bottom:300px!important}body.theme-sticky-v460.theme-sticky-collapsed-v460{padding-bottom:112px!important}
      #themeStickyPreviewV460{position:fixed;left:0;right:0;bottom:0;z-index:1800;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:rgba(8,10,12,.97);border-top:1px solid var(--mod-border,#30363b);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
      .theme-sticky-inner-v460{width:min(100%,600px);margin:0 auto}.theme-sticky-head-v460{display:flex;align-items:center;gap:6px}.theme-state-scroll-v460{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;flex:1}.theme-state-scroll-v460::-webkit-scrollbar{display:none}.theme-state-btn-v460,.theme-anchor-btn-v460,.theme-step-btn-v460{flex:0 0 auto;border:1px solid var(--mod-border,#30363b);border-radius:8px;background:var(--mod-control,#101315);color:var(--mod-muted,#87949c);padding:7px 8px;font-size:8px;font-weight:900}.theme-state-btn-v460.active,.theme-anchor-btn-v460.active,.theme-step-btn-v460.active{border-color:var(--mod-accent,#e8ecef);color:var(--mod-text,#f3f3f3);box-shadow:inset 0 0 0 1px var(--mod-accent,#e8ecef)}
      .theme-sticky-toggle-v460{width:34px;height:31px;border:1px solid var(--mod-border,#30363b);border-radius:8px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-weight:900}.theme-sticky-cardwrap-v460{margin-top:7px}.theme-sticky-cardwrap-v460 .theme-preview-caption-v458{display:none}.theme-sticky-cardwrap-v460 .task{margin:0!important;max-height:190px;overflow:visible}.theme-sticky-collapsed-v460 #themeStickyPreviewV460 .theme-sticky-cardwrap-v460{display:none}
      .theme-state-position-v460{margin:10px 0 0;padding:10px;border:1px solid var(--mod-border,#30363b);border-radius:11px;background:var(--mod-surface2,#111416)}.theme-state-position-title-v460{font-size:9px;font-weight:950;letter-spacing:.8px;color:var(--mod-muted,#87949c)}.theme-state-position-sub-v460{margin-top:4px;font-size:9px;line-height:1.35;color:var(--mod-muted,#87949c)}.theme-state-select-v460,.theme-anchor-select-v460,.theme-step-select-v460{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;margin-top:8px}.theme-state-select-v460::-webkit-scrollbar,.theme-anchor-select-v460::-webkit-scrollbar,.theme-step-select-v460::-webkit-scrollbar{display:none}.theme-pos-row-v460{display:grid;grid-template-columns:1fr 132px;gap:10px;align-items:center;margin-top:10px}.theme-pos-coords-v460{font-size:12px;font-weight:900}.theme-dpad-v460{width:132px;display:grid;grid-template-columns:repeat(3,40px);grid-template-rows:repeat(3,40px);gap:5px;justify-content:center}.theme-pad-v460{border:1px solid var(--mod-border,#30363b);border-radius:9px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:17px;font-weight:950}.theme-pad-v460.ok{font-size:10px;background:var(--mod-accent,#e8ecef);color:var(--mod-accent-text,#101214);border-color:var(--mod-accent,#e8ecef)}.theme-pad-v460.blank{visibility:hidden}
      .segment-mode-v460{width:100%;min-height:38px;margin-bottom:8px;padding:7px 9px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:#101315;color:#f3f3f3;font:inherit;font-size:12px;font-weight:800;color-scheme:dark}.cooking-total-v460{display:grid;gap:3px}.cooking-total-v460 span{font-size:11px}
      @media(max-width:430px){body.theme-sticky-v460{padding-bottom:275px!important}.theme-pos-row-v460{grid-template-columns:1fr}.theme-dpad-v460{justify-self:center}}
    `;document.head.appendChild(style);
  }

  function findPreviewPanel(){return [...document.querySelectorAll('.theme-panel-v458')].find(p=>(p.querySelector('.theme-panel-title-v458')?.textContent||'').includes('LIVE-VORSCHAU'));}
  function sourcePreviewCard(state){
    const cards=[...document.querySelectorAll('.theme-preview-v458 .theme-preview-card-v458')];
    return cards.find(card=>stateForCard(card)===state)||null;
  }
  function buildAbortedPreview(){
    const base=sourcePreviewCard('completed')||sourcePreviewCard('open');if(!base)return null;
    const card=base.cloneNode(true);card.classList.remove('completed','open','running','paused');card.classList.add('aborted');
    const s=card.querySelector('.status-symbol');if(s)s.textContent='❌';
    const t=card.querySelector('.task-text');if(t)t.textContent='Kochen abgebrochen';
    const m=card.querySelector('.task-meta');if(m)m.textContent='ABGEBROCHEN · HEUTE 22:17';
    return card;
  }
  function bindPreviewRoleClicks(card){
    card.querySelectorAll('[data-theme-role]').forEach(el=>{
      const role=el.dataset.themeRole;if(!ROLES.includes(role))return;
      el.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();document.querySelector(`.theme-role-v458[data-theme-role-select="${role}"]`)?.click();});
    });
  }
  function renderStickyPreview(){
    let root=document.getElementById('themeStickyPreviewV460');
    if(typeof currentTab==='undefined'||currentTab!=='theme'){
      root?.remove();document.body.classList.remove('theme-sticky-v460','theme-sticky-collapsed-v460');return;
    }
    document.body.classList.add('theme-sticky-v460');document.body.classList.toggle('theme-sticky-collapsed-v460',collapsed);
    if(!root){root=document.createElement('div');root.id='themeStickyPreviewV460';document.body.appendChild(root);}
    root.innerHTML=`<div class="theme-sticky-inner-v460"><div class="theme-sticky-head-v460"><div class="theme-state-scroll-v460">${STATES.map(([key,label])=>`<button class="theme-state-btn-v460 ${key===selectedState?'active':''}" data-sticky-state-v460="${key}">${label}</button>`).join('')}</div><button class="theme-sticky-toggle-v460" title="Vorschau ein-/ausklappen">${collapsed?'▲':'▼'}</button></div><div class="theme-sticky-cardwrap-v460"></div></div>`;
    root.querySelectorAll('[data-sticky-state-v460]').forEach(btn=>btn.onclick=()=>{selectedState=btn.dataset.stickyStateV460;persistLayout();resetDraft();renderStickyPreview();renderStatePositionControls();});
    root.querySelector('.theme-sticky-toggle-v460').onclick=()=>{collapsed=!collapsed;renderStickyPreview();};
    if(collapsed)return;
    const wrap=root.querySelector('.theme-sticky-cardwrap-v460');
    let card=selectedState==='aborted'?buildAbortedPreview():sourcePreviewCard(selectedState)?.cloneNode(true);
    if(!card){wrap.innerHTML='<div style="padding:12px;color:var(--mod-muted)">Vorschau wird aufgebaut …</div>';return;}
    card.querySelectorAll('.task-note-v456,.theme-note-preview-v459').forEach(n=>n.remove());
    card.dataset.themeStateV460=selectedState;wrap.appendChild(card);bindPreviewRoleClicks(card);
    const role=selectedRole();card.querySelectorAll(ROLE_SELECTORS[role]).forEach(n=>{n.style.outline='1px dashed var(--mod-accent)';n.style.outlineOffset='2px';});
    applyCardLayout(card,selectedState,true);
  }

  function renderStatePositionControls(){
    if(typeof currentTab==='undefined'||currentTab!=='theme')return;
    disableNotesUi();
    const panel=[...document.querySelectorAll('.theme-panel-v458')].find(p=>(p.querySelector('.theme-panel-title-v458')?.textContent||'').includes('ELEMENT AUSWÄHLEN'));
    if(!panel)return;
    panel.querySelector('.theme-dpad-wrap-v458')?.remove();
    panel.querySelector('.theme-state-position-v460')?.remove();
    const role=selectedRole();if(!draft||draftRole!==role)resetDraft();
    const box=document.createElement('div');box.className='theme-state-position-v460';
    box.innerHTML=`<div class="theme-state-position-title-v460">POSITION NUR FÜR ZUSTAND · ${STATE_LABEL[selectedState]}</div><div class="theme-state-position-sub-v460">Typografie bleibt allgemein. Position und Eck-Anker gelten nur für diesen Aufgabenzustand. Pfeile ändern die Vorschau, <strong>OK</strong> speichert.</div><div class="theme-state-select-v460">${STATES.map(([key,label])=>`<button class="theme-state-btn-v460 ${key===selectedState?'active':''}" data-position-state-v460="${key}">${label}</button>`).join('')}</div><div class="theme-anchor-select-v460">${ANCHORS.map(([key,label])=>`<button class="theme-anchor-btn-v460 ${key===draft.anchor?'active':''}" data-anchor-v460="${key}">${label}</button>`).join('')}</div><div class="theme-pos-row-v460"><div><div class="theme-pos-coords-v460">X <span id="themePosXV460">${draft.x}</span> / Y <span id="themePosYV460">${draft.y}</span> px</div><div class="theme-step-select-v460">${[1,2,4,8].map(step=>`<button class="theme-step-btn-v460 ${layout.gridStep===step?'active':''}" data-step-v460="${step}">${step}px</button>`).join('')}<button class="theme-step-btn-v460" data-zero-v460>↺ 0/0</button></div></div><div class="theme-dpad-v460"><span class="theme-pad-v460 blank"></span><button class="theme-pad-v460" data-dir-v460="up">▲</button><span class="theme-pad-v460 blank"></span><button class="theme-pad-v460" data-dir-v460="left">◀</button><button class="theme-pad-v460 ok" data-ok-v460>OK</button><button class="theme-pad-v460" data-dir-v460="right">▶</button><span class="theme-pad-v460 blank"></span><button class="theme-pad-v460" data-dir-v460="down">▼</button><span class="theme-pad-v460 blank"></span></div></div>`;
    panel.appendChild(box);
    box.querySelectorAll('[data-position-state-v460]').forEach(btn=>btn.onclick=()=>{selectedState=btn.dataset.positionStateV460;persistLayout();resetDraft();renderStatePositionControls();renderStickyPreview();});
    box.querySelectorAll('[data-anchor-v460]').forEach(btn=>btn.onclick=()=>{draft.anchor=btn.dataset.anchorV460;renderStatePositionControls();renderStickyPreview();});
    box.querySelectorAll('[data-step-v460]').forEach(btn=>btn.onclick=()=>{layout.gridStep=Number(btn.dataset.stepV460);persistLayout();renderStatePositionControls();});
    box.querySelector('[data-zero-v460]').onclick=()=>{draft.x=0;draft.y=0;renderStatePositionControls();renderStickyPreview();};
    box.querySelectorAll('[data-dir-v460]').forEach(btn=>btn.onclick=()=>{
      const step=layout.gridStep,dir=btn.dataset.dirV460;
      if(dir==='left')draft.x=clamp(draft.x-step,-80,80);if(dir==='right')draft.x=clamp(draft.x+step,-80,80);if(dir==='up')draft.y=clamp(draft.y-step,-80,80);if(dir==='down')draft.y=clamp(draft.y+step,-80,80);
      const x=box.querySelector('#themePosXV460'),y=box.querySelector('#themePosYV460');if(x)x.textContent=draft.x;if(y)y.textContent=draft.y;renderStickyPreview();
    });
    box.querySelector('[data-ok-v460]').onclick=()=>{layout.positions[selectedState][role]=clone(draft);persistLayout();applyVisibleLayouts();renderStickyPreview();};
  }

  function patchThemeEditor(){
    if(typeof currentTab==='undefined'||currentTab!=='theme'){renderStickyPreview();return;}
    disableNotesUi();
    const originalPreview=findPreviewPanel();if(originalPreview)originalPreview.style.display='none';
    renderStatePositionControls();renderStickyPreview();
  }

  let observer=null,observedHost=null;
  function schedulePatch(){if(patchScheduled)return;patchScheduled=true;setTimeout(()=>{patchScheduled=false;observer?.disconnect();injectStyle();disableNotesUi();applyVisibleLayouts();patchThemeEditor();if(observedHost)observer?.observe(observedHost,{childList:true,subtree:true});},0);}

  // -------- ABBRUCH IN ALLE + HEUTE --------
  function terminalTime(task){return new Date(task?.completedAt||task?.abortedAt||0).getTime()||0;}
  window.renderAll=function(container){
    const active=(Array.isArray(tasks)?tasks:[]).filter(task=>['open','running','paused'].includes(task.status));
    const terminal=(Array.isArray(tasks)?tasks:[]).filter(task=>['completed','aborted'].includes(task.status)).sort((a,b)=>terminalTime(b)-terminalTime(a));
    container.appendChild(section('OFFENE UND LAUFENDE AUFGABEN',active,{counter:active.length,cardOptions:{showTodayButton:true}}));
    container.appendChild(section('ERLEDIGT / ABGEBROCHEN',terminal,{empty:'Noch keine erledigten oder abgebrochenen Aufgaben.'}));
  };
  function relevantToday(task,today){
    try{if(window.__modTodayPausedV446?.taskRelevantToday)return window.__modTodayPausedV446.taskRelevantToday(task,today);}catch(_){}
    if(task?.todayDate===today)return true;
    for(const v of [task?.startedAt,task?.completedAt,task?.abortedAt]){if(v&&typeof getBerlinDateKeyFromISO==='function'&&getBerlinDateKeyFromISO(v)===today)return true;}
    return false;
  }
  window.renderToday=function(container){
    const today=getBerlinDateKey();
    const all=(Array.isArray(tasks)?tasks:[]).filter(task=>relevantToday(task,today));
    const active=all.filter(task=>['open','running','paused'].includes(task.status)).sort((a,b)=>{const ap=a.todayDate===today?0:1,bp=b.todayDate===today?0:1;if(ap!==bp)return ap-bp;if(!ap)return(a.todayOrder||0)-(b.todayOrder||0);return new Date(a.startedAt||a.createdAt||0)-new Date(b.startedAt||b.createdAt||0);});
    const completed=all.filter(task=>task.status==='completed').sort((a,b)=>terminalTime(b)-terminalTime(a));
    const aborted=all.filter(task=>task.status==='aborted').sort((a,b)=>terminalTime(b)-terminalTime(a));
    const terminal=[...completed,...aborted].sort((a,b)=>terminalTime(b)-terminalTime(a));
    const total=active.length+terminal.length,percent=total?Math.round(completed.length/total*100):0;
    const summary=document.createElement('div');summary.className='today-summary';summary.innerHTML=`<div class="today-progress"><span>HEUTE · ${completed.length}/${total} ERLEDIGT${aborted.length?` · ${aborted.length} ABGEBROCHEN`:''}</span><span class="today-percentage">${percent} %</span></div><div class="today-progress-bar"><div class="today-progress-fill" style="width:${percent}%"></div></div>`;container.appendChild(summary);
    const running=active.find(isBlockingRunning)||active.find(task=>task.status==='running');const planned=active.find(task=>task.todayDate===today);const next=running||planned||active[0];
    const nextPanel=document.createElement('div');nextPanel.className='next-task-panel';nextPanel.innerHTML=next?`<div class="next-task-label">${isBlockingRunning(next)?'AKTUELL LAUFENDE AUFGABE':isPassiveCooking(next)?'KOCHEN · WARTE-/GARZEIT':'NÄCHSTE AUFGABE'}</div><div class="next-task-content"><div class="next-task-number">${dynamicNumber(next)}</div><div class="next-task-status">${statusSymbol(next)}</div><div class="next-task-name">${escapeHtml(next.text)}</div></div>`:`<div class="next-task-label">NÄCHSTE AUFGABE</div><div class="next-task-empty">Keine offene Aufgabe für heute.</div>`;container.appendChild(nextPanel);
    container.appendChild(section('OFFEN / LAUFEND / PAUSIERT',active,{cardOptions:{todayDrag:true}}));
    container.appendChild(section('ERLEDIGT / ABGEBROCHEN HEUTE',terminal,{empty:'Heute noch nichts erledigt oder abgebrochen.'}));
  };

  // -------- KOCHEN: PASSIVE ZEIT BLOCKIERT NICHT --------
  const baseStart=window.startTask,basePause=window.pauseTask,baseResume=window.resumeTask,baseFinish=window.finishTask,baseAbort=window.abortTask;
  const baseAskManual=window.askManualTimes,baseSaveManual=window.saveManualTimes,baseAddSegment=window.addManualSegmentV443,baseRemoveSegment=window.removeManualSegmentV443,baseReadSegments=window.readSegmentsFromDomV443,baseRefreshSegments=window.refreshSegmentTotalV443,baseCompleteSegments=window.saveManualSegmentsAndCompleteV445;

  function closeLastActive(task,iso){const segs=Array.isArray(task.activeSegments)?task.activeSegments:[];const last=segs[segs.length-1];if(last&&!last.endedAt)last.endedAt=iso;}
  function closeLastCooking(task,iso){const segs=Array.isArray(task.cookingSegments)?task.cookingSegments:[];const last=segs[segs.length-1];if(last&&!last.endedAt)last.endedAt=iso;}
  function pushActive(task,iso){if(!Array.isArray(task.activeSegments))task.activeSegments=[];task.activeSegments.push({startedAt:iso,endedAt:null});}
  function pushCooking(task,mode,iso){if(!Array.isArray(task.cookingSegments))task.cookingSegments=[];task.cookingSegments.push({mode:mode==='passive'?'passive':'active',startedAt:iso,endedAt:null});}
  function cookingTotals(segs,endIso=null){let active=0,passive=0;for(const s of Array.isArray(segs)?segs:[]){if(!s?.startedAt)continue;const end=s.endedAt||endIso;if(!end)continue;const ms=Math.max(0,new Date(end)-new Date(s.startedAt));if(s.mode==='passive')passive+=ms;else active+=ms;}return{active,passive,total:active+passive};}
  function blockingMessage(running){showInfoModal('Schon eine aktive Aufgabe','Aktuell arbeitet deine aktive Zeit bereits an „'+String(running?.text||'einer anderen Aufgabe')+'“. Eine Warte-/Garzeit darf parallel laufen, zwei aktive Arbeitsphasen aber nicht.');}

  window.startTask=function(id){
    const task=getTask(id);if(!task)return;if(task.type==='selfrunner')return baseStart?.apply(this,arguments);
    const blocker=otherBlocking(id);if(blocker){blockingMessage(blocker);return;}
    const now=new Date().toISOString();
    task.status='running';task.pausedAt=null;task.pauseTotalMs=Number(task.pauseTotalMs)||0;
    if(task.type==='cooking'){
      const hist=Array.isArray(task.cookingSegments)?task.cookingSegments.filter(s=>s?.startedAt&&s.endedAt):[];task.cookingSegments=hist;
      const activeHist=Array.isArray(task.activeSegments)?task.activeSegments.filter(s=>s?.startedAt&&s.endedAt):[];task.activeSegments=activeHist;
      if(!task.startedAt)task.startedAt=hist[0]?.startedAt||now;task.cookingMode='active';pushCooking(task,'active',now);pushActive(task,now);
    }else{
      const hist=Array.isArray(task.activeSegments)?task.activeSegments.filter(s=>s?.startedAt&&s.endedAt):[];task.activeSegments=hist;if(!task.startedAt||!hist.length)task.startedAt=hist[0]?.startedAt||now;pushActive(task,now);
    }
    saveTasks();render();
  };
  window.resumeTask=function(id){
    const task=getTask(id);if(!task)return;
    const mode=task.type==='cooking'&&task.cookingMode==='passive'?'passive':'active';
    if(mode==='active'){const blocker=otherBlocking(id);if(blocker){blockingMessage(blocker);return;}}
    const nowMs=Date.now(),now=new Date(nowMs).toISOString();if(task.pausedAt){const p=new Date(task.pausedAt).getTime();if(Number.isFinite(p))task.pauseTotalMs=(Number(task.pauseTotalMs)||0)+Math.max(0,nowMs-p);}
    task.pausedAt=null;task.status='running';
    if(task.type==='cooking'){pushCooking(task,mode,now);if(mode==='active')pushActive(task,now);}else pushActive(task,now);
    saveTasks();render();
  };
  window.pauseTask=function(id){
    const task=getTask(id);if(!task)return;if(task.type!=='cooking')return basePause?.apply(this,arguments);
    const now=new Date().toISOString();task.status='paused';task.pausedAt=now;if(task.cookingMode!=='passive')closeLastActive(task,now);closeLastCooking(task,now);saveTasks();render();
  };
  window.switchCookingMode=function(id,mode){
    const task=getTask(id);if(!task||task.type!=='cooking'||task.status!=='running')return;const next=mode==='passive'?'passive':'active';if(task.cookingMode===next)return;
    if(next==='active'){const blocker=otherBlocking(id);if(blocker){blockingMessage(blocker);return;}}
    const now=new Date().toISOString();if(task.cookingMode!=='passive')closeLastActive(task,now);closeLastCooking(task,now);task.cookingMode=next;pushCooking(task,next,now);if(next==='active')pushActive(task,now);saveTasks();render();
  };
  function finishCooking(task,status){
    const now=new Date().toISOString();if(task.status==='running'){if(task.cookingMode!=='passive')closeLastActive(task,now);closeLastCooking(task,now);}const totals=cookingTotals(task.cookingSegments);
    if(!(totals.total>0)){showMissingCompletionDuration(task);return false;}
    task.actualDurationMs=totals.total;task.cookingActiveDurationMs=totals.active;task.cookingPassiveDurationMs=totals.passive;task.activeDurationMs=totals.active;task.passiveDurationMs=totals.passive;task.leisureDurationMs=null;task.pausedAt=null;task.status=status;
    if(status==='completed'){task.completedAt=now;task.completedDate=typeof getBerlinDateKey==='function'?getBerlinDateKey():null;}else{task.abortedAt=now;task.todayDate=null;task.todayOrder=null;}
    normalizeTodayOrder();saveTasks();render();return true;
  }
  window.finishTask=function(id){const task=getTask(id);if(task?.type==='cooking')return finishCooking(task,'completed');return baseFinish?.apply(this,arguments);};
  window.abortTask=function(id){const task=getTask(id);if(task?.type==='cooking'){closeModal();return finishCooking(task,'aborted');}return baseAbort?.apply(this,arguments);};

  // -------- MANUELLE KOCHSEGMENTE MIT MODUS --------
  function editableCookingSegments(task){
    const cooking=Array.isArray(task.cookingSegments)?task.cookingSegments.filter(s=>s?.startedAt):[];if(cooking.length)return cooking.map(s=>({mode:s.mode==='passive'?'passive':'active',startedAt:s.startedAt,endedAt:s.endedAt||null}));
    const active=Array.isArray(task.activeSegments)?task.activeSegments.filter(s=>s?.startedAt):[];if(active.length)return active.map(s=>({mode:'active',startedAt:s.startedAt,endedAt:s.endedAt||null}));
    if(task.startedAt)return[{mode:'active',startedAt:task.startedAt,endedAt:task.completedAt||task.abortedAt||null}];return[{mode:'active',startedAt:new Date().toISOString(),endedAt:null}];
  }
  function cookingRowHtml(seg,index){const start=formatISOForDateTimeLocal(seg.startedAt||new Date().toISOString()),end=seg.endedAt?formatISOForDateTimeLocal(seg.endedAt):'';return `<div class="segment-edit-row" data-segment-row="${index}"><div class="segment-edit-head"><strong>ABSCHNITT ${index+1}</strong><button type="button" class="segment-delete" onclick="removeManualSegmentV443(${index})" title="Abschnitt löschen">×</button></div><select class="segment-mode-v460" aria-label="Art des Kochabschnitts"><option value="active" ${seg.mode!=='passive'?'selected':''}>🔥 AKTIV KOCHEN</option><option value="passive" ${seg.mode==='passive'?'selected':''}>⏳ WARTE-/GARZEIT</option></select><div class="time-edit-grid"><label class="time-edit-field"><span class="time-edit-label">START</span><input class="time-edit-input segment-start-v443" type="datetime-local" value="${start}"></label><label class="time-edit-field"><span class="time-edit-label">ENDE</span><input class="time-edit-input segment-end-v443" type="datetime-local" value="${end}"></label></div></div>`;}
  function readCookingDom(validate=true){
    const state=window.__manualSegmentsV443;if(!state?.isCookingV460)return null;const rows=[...document.querySelectorAll('[data-segment-row]')],segments=[];
    for(let i=0;i<rows.length;i++){const sv=rows[i].querySelector('.segment-start-v443')?.value,ev=rows[i].querySelector('.segment-end-v443')?.value,mode=rows[i].querySelector('.segment-mode-v460')?.value==='passive'?'passive':'active';const startedAt=berlinLocalInputToISO(sv),endedAt=ev?berlinLocalInputToISO(ev):null;if(validate&&!startedAt)throw new Error(`Abschnitt ${i+1}: Startzeit fehlt oder ist ungültig.`);if(startedAt&&endedAt&&new Date(endedAt)<=new Date(startedAt))throw new Error(`Abschnitt ${i+1}: Ende muss nach dem Start liegen.`);segments.push({mode,startedAt:startedAt||new Date().toISOString(),endedAt});}
    state.segments=segments;return segments;
  }
  function validateCookingSegments(segs,task,complete=false){
    segs.sort((a,b)=>new Date(a.startedAt)-new Date(b.startedAt));if(!segs.length)throw new Error('Mindestens ein Kochabschnitt ist erforderlich.');
    for(let i=0;i<segs.length;i++){if(complete&&!segs[i].endedAt)throw new Error('Zum Abschließen müssen alle Kochabschnitte eine Endzeit haben.');if(i<segs.length-1&&!segs[i].endedAt)throw new Error(`Nur der letzte Abschnitt darf ohne Endzeit sein.`);if(i<segs.length-1&&new Date(segs[i].endedAt)>new Date(segs[i+1].startedAt))throw new Error(`Abschnitt ${i+1} und ${i+2} überlappen sich.`);}
    const open=segs.filter(s=>!s.endedAt);if(open.length>1)throw new Error('Nur ein Kochabschnitt darf offen sein.');if(open.length===1&&task.status!=='running')throw new Error('Nur bei einer laufenden Kochaufgabe darf der letzte Abschnitt offen bleiben.');if(task.status==='running'&&!complete&&open.length!==1)throw new Error('Eine laufende Kochaufgabe benötigt genau einen offenen letzten Abschnitt.');
  }
  function applyCookingSegments(task,segs,terminal=null){
    const copy=segs.map(s=>({mode:s.mode==='passive'?'passive':'active',startedAt:s.startedAt,endedAt:s.endedAt||null}));task.cookingSegments=copy;task.activeSegments=copy.filter(s=>s.mode==='active').map(s=>({startedAt:s.startedAt,endedAt:s.endedAt}));task.startedAt=copy[0]?.startedAt||task.startedAt;task.cookingMode=copy.at(-1)?.mode||'active';task.pauseTotalMs=0;
    const totals=cookingTotals(copy);if(terminal){task.status=terminal;task.pausedAt=null;const end=copy.at(-1)?.endedAt;if(terminal==='completed'){task.completedAt=end;task.completedDate=typeof getBerlinDateKeyFromISO==='function'?getBerlinDateKeyFromISO(end):null;}else task.abortedAt=end;}if(terminal||['completed','aborted'].includes(task.status)){task.actualDurationMs=totals.total;task.cookingActiveDurationMs=totals.active;task.cookingPassiveDurationMs=totals.passive;task.activeDurationMs=totals.active;task.passiveDurationMs=totals.passive;task.leisureDurationMs=null;}else{task.actualDurationMs=null;task.cookingActiveDurationMs=null;task.cookingPassiveDurationMs=null;task.activeDurationMs=null;task.passiveDurationMs=null;}
  }
  window.askManualTimes=function(id){
    const task=getTask(id);if(!task||task.type!=='cooking')return baseAskManual?.apply(this,arguments);window.__manualSegmentsV443={taskId:id,isCookingV460:true,segments:editableCookingSegments(task)};document.getElementById('modalContainer').innerHTML=`<div class="modal-backdrop"><div class="modal segment-editor-modal"><h2>🍳 Kochzeiten korrigieren</h2><p>${escapeHtml(task.text)}</p><div id="segmentRowsV443">${window.__manualSegmentsV443.segments.map(cookingRowHtml).join('')}</div><button type="button" class="modal-button" onclick="addManualSegmentV443()">+ KOCHABSCHNITT HINZUFÜGEN</button><div class="time-edit-note">Jeder Abschnitt bekommt einen Typ: <strong>AKTIV KOCHEN</strong> zählt als aktive Aufgabenzeit, <strong>WARTE-/GARZEIT</strong> ist passiv und darf parallel zu einer anderen aktiven Aufgabe laufen.</div><div class="segment-total-v443 cooking-total-v460" id="segmentTotalV443"></div><div class="modal-actions" style="margin-top:14px"><button class="modal-button cancel-modal" onclick="closeModal()">Zurück</button>${!['completed','aborted'].includes(task.status)?`<button class="modal-button confirm-modal" onclick="saveManualSegmentsAndCompleteV445(${id})">SPEICHERN & ERLEDIGEN</button>`:''}<button class="modal-button confirm-modal" onclick="saveManualTimes(${id})">Speichern</button></div></div></div>`;window.refreshSegmentTotalV443();
  };
  window.addManualSegmentV443=function(){const state=window.__manualSegmentsV443;if(!state?.isCookingV460)return baseAddSegment?.apply(this,arguments);try{state.segments=readCookingDom(false)||state.segments;}catch(_){}const iso=new Date().toISOString();state.segments.push({mode:'active',startedAt:iso,endedAt:null});document.getElementById('segmentRowsV443').innerHTML=state.segments.map(cookingRowHtml).join('');window.refreshSegmentTotalV443();};
  window.removeManualSegmentV443=function(index){const state=window.__manualSegmentsV443;if(!state?.isCookingV460)return baseRemoveSegment?.apply(this,arguments);if(state.segments.length<=1){showInfoModal('Mindestens ein Abschnitt','Eine Kochaufgabe braucht mindestens einen Zeitabschnitt.');return;}try{state.segments=readCookingDom(false)||state.segments;}catch(_){}state.segments.splice(index,1);document.getElementById('segmentRowsV443').innerHTML=state.segments.map(cookingRowHtml).join('');window.refreshSegmentTotalV443();};
  window.readSegmentsFromDomV443=function(validate=true){if(window.__manualSegmentsV443?.isCookingV460)return readCookingDom(validate);return baseReadSegments?.apply(this,arguments);};
  window.refreshSegmentTotalV443=function(){if(!window.__manualSegmentsV443?.isCookingV460)return baseRefreshSegments?.apply(this,arguments);try{const totals=cookingTotals(readCookingDom(false)||[]);const el=document.getElementById('segmentTotalV443');if(el)el.innerHTML=`<span>🔥 AKTIV · ${formatDuration(totals.active)}</span><span>⏳ GARZEIT · ${formatDuration(totals.passive)}</span><span>GESAMT · ${formatDuration(totals.total)}</span>`;}catch(_){} };
  window.saveManualTimes=function(id){const task=getTask(id);if(!task||task.type!=='cooking'||!window.__manualSegmentsV443?.isCookingV460)return baseSaveManual?.apply(this,arguments);let segs;try{segs=readCookingDom(true);validateCookingSegments(segs,task,false);}catch(e){showInfoModal('Kochzeiten prüfen',e.message);return;}applyCookingSegments(task,segs,null);closeModal();saveTasks();render();try{scheduleSupabaseLiveSync?.('cooking-segments-v460');}catch(_){} };
  window.saveManualSegmentsAndCompleteV445=function(id){const task=getTask(id);if(!task||task.type!=='cooking'||!window.__manualSegmentsV443?.isCookingV460)return baseCompleteSegments?.apply(this,arguments);let segs;try{segs=readCookingDom(true);validateCookingSegments(segs,task,true);}catch(e){showInfoModal('Kochzeiten prüfen',e.message);return;}const totals=cookingTotals(segs);if(!(totals.total>0)){showMissingCompletionDuration(task);return;}applyCookingSegments(task,segs,'completed');normalizeTodayOrder();closeModal();saveTasks();render();try{scheduleSupabaseLiveSync?.('cooking-complete-v460');}catch(_){} };

  // Integritaet: passive Kochaufgaben duerfen status=running haben, ohne offenes Aktivsegment.
  const baseIntegrity=window.collectDataIntegrityReport;
  if(typeof baseIntegrity==='function')window.collectDataIntegrityReport=function(){
    const report=baseIntegrity.apply(this,arguments);if(!report||!Array.isArray(report.errors))return report;
    report.errors=report.errors.filter(msg=>!String(msg).includes('offene aktive Segmente statt genau 1')&&!String(msg).includes('Aufgaben sind gleichzeitig als laufend markiert')&&!String(msg).includes('Mehr als eine Aufgabe ist gleichzeitig als laufend gespeichert'));
    const running=(Array.isArray(tasks)?tasks:[]).filter(t=>t?.status==='running');for(const task of running){const open=(Array.isArray(task.activeSegments)?task.activeSegments:[]).filter(s=>s?.startedAt&&!s.endedAt).length;const expected=isPassiveCooking(task)?0:1;if(open!==expected)report.errors.push(`Laufende Aufgabe „${String(task.text||'ohne Namen')}“ hat ${open} offene aktive Segmente, erwartet ${expected}.`);}
    const blockers=running.filter(isBlockingRunning);if(blockers.length>1)report.errors.push(`${blockers.length} aktive Arbeitsphasen laufen gleichzeitig. Passive Warte-/Garzeiten sind davon ausgenommen.`);report.ok=report.errors.length===0;return report;
  };

  // Nach Rendern: Notizen weg, Layout anwenden, Theme-Footer nachziehen.
  injectStyle();
  const baseRender=window.render;if(typeof baseRender==='function')window.render=function(){const result=baseRender.apply(this,arguments);schedulePatch();return result;};
  const baseSwitch=window.switchTab;if(typeof baseSwitch==='function')window.switchTab=function(){const result=baseSwitch.apply(this,arguments);schedulePatch();return result;};
  observer=new MutationObserver(()=>schedulePatch());window.addEventListener('load',()=>{observedHost=document.getElementById('viewContainer');if(observedHost)observer.observe(observedHost,{childList:true,subtree:true});schedulePatch();});
  schedulePatch();

  window.__modUxCookingEditorV460={version:BUILD_VERSION,layoutKey:LAYOUT_KEY,isPassiveCooking,isBlockingRunning,getLayout:()=>clone(layout),setState:(s)=>{if(STATE_LABEL[s]){selectedState=s;persistLayout();resetDraft();schedulePatch();}},notesDisabled:true,abortedVisible:true,cookingSegmentModes:true,passiveCookingParallel:true};
})();
