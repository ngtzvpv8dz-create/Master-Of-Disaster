/* V466 · COMPLETE THEME PACKAGE + INDIVIDUAL ACTION BUTTONS
   - presets/reset cover V458 + V464 state design instead of leaving stale gradients behind
   - My Theme / Load / Export / Import operate on one complete package
   - action buttons are selectable, positionable and gradient-editable per state/button
   - preview gets representative full action sets instead of the V464 two-button fallbacks
*/
(function(){
  'use strict';
  const BUILD_VERSION='V466';
  const PACKAGE_KEY='masterOfDisasterThemePackageV466';
  const BUTTON_KEY='masterOfDisasterActionButtonDesignV466';
  const BASE_KEY='masterOfDisasterThemeLayoutV458';
  const STATE_KEY='masterOfDisasterThemeStateDesignV464';
  const LAYOUT_KEY='masterOfDisasterThemeStateLayoutV460';
  const STATES=['open','running','paused','cooking','completed','aborted'];
  const STATE_LABEL={open:'OFFEN',running:'LÄUFT',paused:'PAUSIERT',cooking:'KOCHEN',completed:'ERLEDIGT',aborted:'ABGEBROCHEN'};
  const PREVIEW_ACTIONS={
    open:[['▶️','Start'],['✏️','Bearbeiten'],['🗑️','Löschen'],['❌','Abbruch'],['📅','Heute']],
    running:[['☕','Pause'],['🕒','Zeit'],['✅','Fertig'],['❌','Abbruch']],
    paused:[['▶️','Weiter'],['🕒','Zeit'],['✅','Fertig'],['❌','Abbruch']],
    cooking:[['☕','Pause'],['🕒','Zeit'],['✅','Fertig'],['❌','Abbruch']],
    completed:[['✏️','Bearbeiten'],['↩️','Wiederholen']],
    aborted:[['✏️','Bearbeiten'],['↩️','Wiederholen']]
  };
  const MAX_ACTIONS=6;
  let selectedByState={open:0,running:0,paused:0,cooking:0,completed:0,aborted:0};
  let patchTimer=null;

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function safeGet(k){try{return localStorage.getItem(k);}catch(_){return null;}}
  function safeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(_){return false;}}
  function safeRemove(k){try{localStorage.removeItem(k);return true;}catch(_){return false;}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function clamp(v,min,max){const n=Number(v);return Math.min(max,Math.max(min,Number.isFinite(n)?n:min));}
  function hex(v,f='#101315'){const s=String(v||'');return /^#[0-9a-f]{6}$/i.test(s)?s.toLowerCase():f;}
  function currentState(){const s=window.__modUxCookingEditorV460?.getLayout?.()?.selectedState;return STATES.includes(s)?s:'open';}
  function groupStyle(state){const s=window.__modThemeStateDesignV464?.getConfig?.()?.states?.[state]?.actions||{};return {start:hex(s.start),end:hex(s.end),angle:clamp(s.angle??135,0,360),border:hex(s.border,'#30363b')};}
  function defaultButton(state){const g=groupStyle(state);return {start:g.start,end:g.end,angle:g.angle,border:g.border,anchor:'free',x:0,y:0};}
  function makeDefaults(){const states={};for(const s of STATES){states[s]=Array.from({length:MAX_ACTIONS},()=>defaultButton(s));}return {states};}
  function sanitize(raw){const d=makeDefaults();for(const s of STATES){for(let i=0;i<MAX_ACTIONS;i++){const src=raw?.states?.[s]?.[i];if(!src)continue;const x=d.states[s][i];x.start=hex(src.start,x.start);x.end=hex(src.end,x.end);x.angle=clamp(src.angle,0,360);x.border=hex(src.border,x.border);x.anchor=['free','tl','tr','bl','br'].includes(src.anchor)?src.anchor:'free';x.x=clamp(src.x,-100,100);x.y=clamp(src.y,-100,100);}}return d;}
  let buttonCfg=(()=>{try{const r=safeGet(BUTTON_KEY);return sanitize(r?JSON.parse(r):null);}catch(_){return makeDefaults();}})();
  function saveButtons(){safeSet(BUTTON_KEY,JSON.stringify(buttonCfg));applyButtonStyles();}

  function capturePackage(){
    return {
      schema:'master-of-disaster-theme-package',schemaVersion:466,createdAt:new Date().toISOString(),
      base:window.__modThemeLayoutV458?.getConfig?.()||JSON.parse(safeGet(BASE_KEY)||'{}'),
      state:window.__modThemeStateDesignV464?.getConfig?.()||JSON.parse(safeGet(STATE_KEY)||'{}'),
      layout:window.__modUxCookingEditorV460?.getLayout?.()||JSON.parse(safeGet(LAYOUT_KEY)||'{}'),
      actionButtons:clone(buttonCfg)
    };
  }
  function writePackage(pkg){
    if(pkg?.base)safeSet(BASE_KEY,JSON.stringify(pkg.base));
    if(pkg?.state)safeSet(STATE_KEY,JSON.stringify(pkg.state));else safeRemove(STATE_KEY);
    if(pkg?.layout)safeSet(LAYOUT_KEY,JSON.stringify(pkg.layout));
    if(pkg?.actionButtons)safeSet(BUTTON_KEY,JSON.stringify(sanitize(pkg.actionButtons)));else safeRemove(BUTTON_KEY);
  }
  function reloadSoon(){setTimeout(()=>location.reload(),45);}
  function message(text){try{if(typeof showInfoModal==='function'){showInfoModal(text);return;}}catch(_){} try{alert(text);}catch(_){}}
  function saveMyTheme(){const pkg=capturePackage();safeSet(PACKAGE_KEY,JSON.stringify(pkg));flashButton('themeSaveSnapshotV458','✅ GESPEICHERT');}
  function loadMyTheme(){const raw=safeGet(PACKAGE_KEY);if(!raw){message('Noch kein „MEIN THEME“ gespeichert.');return;}try{writePackage(JSON.parse(raw));reloadSoon();}catch(_){message('Gespeichertes Theme konnte nicht gelesen werden.');}}
  function resetAll(){window.__modThemeLayoutV458?.reset?.();safeRemove(STATE_KEY);safeRemove(LAYOUT_KEY);safeRemove(BUTTON_KEY);reloadSoon();}
  function presetApplied(){safeRemove(STATE_KEY);safeRemove(BUTTON_KEY);reloadSoon();}
  function exportTheme(){
    const pkg=capturePackage(),blob=new Blob([JSON.stringify(pkg,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='master-of-disaster-theme-v466.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function importTheme(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(String(reader.result||''));if(data?.schema==='master-of-disaster-theme-package'){writePackage(data);}else{safeSet(BASE_KEY,JSON.stringify(data));safeRemove(STATE_KEY);safeRemove(BUTTON_KEY);}reloadSoon();}catch(_){message('Die Theme-Datei ist kein gültiges JSON-Theme.');}};reader.readAsText(file);}
  function flashButton(id,text){const b=document.getElementById(id);if(!b)return;const old=b.textContent;b.textContent=text;setTimeout(()=>{if(document.contains(b))b.textContent=old;},1200);}

  function relabelToolbar(){
    const labels={themeSaveSnapshotV458:'💾 MEIN THEME SPEICHERN',themeLoadSnapshotV458:'↩︎ MEIN THEME LADEN',themeExportV458:'⬇︎ THEME EXPORTIEREN',themeImportV458:'⬆︎ THEME IMPORTIEREN',themeResetV458:'↺ ALLES AUF STANDARD'};
    for(const [id,text] of Object.entries(labels)){const b=document.getElementById(id);if(b){b.textContent=text;b.title=text;}}
  }

  function previewButtons(card,state){
    if(!card)return;let host=card.querySelector('.icon-actions');if(!host){host=document.createElement('div');host.className='icon-actions';(card.querySelector('.task-content')||card).appendChild(host);}
    host.innerHTML='';
    PREVIEW_ACTIONS[state].forEach(([icon,title],i)=>{const b=document.createElement('button');b.type='button';b.className='icon-action v466-preview-action';b.textContent=icon;b.title=title;b.dataset.v466Action=String(i);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectedByState[state]=i;patchEditor();});host.appendChild(b);});
    card.querySelectorAll('[onclick]').forEach(n=>n.removeAttribute('onclick'));
  }
  function repairPreviewActions(){
    if(typeof currentTab==='undefined'||currentTab!=='theme')return;
    for(const s of STATES){document.querySelectorAll(`.theme-preview-v458 .task[data-v464-preview-source="${s}"],.theme-preview-v458 .task.${s}`).forEach(card=>previewButtons(card,s));}
    const sticky=document.querySelector('#themeStickyPreviewV460 .theme-sticky-cardwrap-v460 .task');if(sticky)previewButtons(sticky,currentState());
  }

  function buttonCss(s,i,x){
    const n=i+1,q=`body .task[data-theme-state-v460="${s}"] .icon-actions > :nth-child(${n})`;
    let pos='position:relative!important;transform:translate('+x.x+'px,'+x.y+'px)!important;';
    if(x.anchor!=='free'){
      pos='position:absolute!important;z-index:8!important;transform:none!important;';
      const px='var(--mod-card-padding-x,8px)',py='var(--mod-card-padding-y,8px)';
      pos+=(x.anchor==='tl'||x.anchor==='bl')?`left:calc(${px} + ${x.x}px)!important;`:`right:calc(${px} - ${x.x}px)!important;`;
      pos+=(x.anchor==='tl'||x.anchor==='tr')?`top:calc(${py} + ${x.y}px)!important;`:`bottom:calc(${py} - ${x.y}px)!important;`;
    }
    return `${q}{background:linear-gradient(${x.angle}deg,${x.start},${x.end})!important;border-color:${x.border}!important;${pos}}`;
  }
  function applyButtonStyles(){
    let st=document.getElementById('themeActionButtonsV466Runtime');if(!st){st=document.createElement('style');st.id='themeActionButtonsV466Runtime';document.head.appendChild(st);}
    let css='body .task[data-theme-state-v460] .icon-actions{position:static!important;transform:none!important;}';
    for(const s of STATES)for(let i=0;i<MAX_ACTIONS;i++)css+=buttonCss(s,i,buttonCfg.states[s][i]);
    st.textContent=css;
  }

  function fieldColor(label,path,value){return `<label class="theme-field-v458"><div class="theme-label-v458"><span>${esc(label)}</span><span>${esc(value)}</span></div><input type="color" data-v466-path="${path}" data-v466-kind="color" value="${value}"></label>`;}
  function fieldRange(label,path,value,min,max,step,suffix=''){return `<label class="theme-field-v458"><div class="theme-label-v458"><span>${esc(label)}</span><span data-v466-value="${path}">${value}${suffix}</span></div><input type="range" data-v466-path="${path}" data-v466-kind="number" min="${min}" max="${max}" step="${step}" value="${value}" data-suffix="${suffix}"></label>`;}
  function setButtonPath(path,value){const [s,idx,key]=path.split('.');buttonCfg.states[s][Number(idx)][key]=value;saveButtons();repairPreviewActions();}
  function bindFields(root){root.querySelectorAll('[data-v466-path]').forEach(inp=>inp.addEventListener('input',()=>{const v=inp.dataset.v466Kind==='color'?inp.value:Number(inp.value);setButtonPath(inp.dataset.v466Path,v);const out=root.querySelector(`[data-v466-value="${CSS.escape(inp.dataset.v466Path)}"]`);if(out)out.textContent=`${v}${inp.dataset.suffix||''}`;}));}
  function dpadHtml(){return `<div class="theme-dpad-v460" style="margin-top:8px"><button class="theme-pad-v460 blank"></button><button class="theme-pad-v460" data-v466-dir="up">▲</button><button class="theme-pad-v460 blank"></button><button class="theme-pad-v460" data-v466-dir="left">◀</button><button class="theme-pad-v460 ok" data-v466-ok>OK</button><button class="theme-pad-v460" data-v466-dir="right">▶</button><button class="theme-pad-v460 blank"></button><button class="theme-pad-v460" data-v466-dir="down">▼</button><button class="theme-pad-v460 blank"></button></div>`;}
  function actionPanelHtml(state){
    const count=PREVIEW_ACTIONS[state].length,sel=Math.min(selectedByState[state]||0,count-1);selectedByState[state]=sel;const x=buttonCfg.states[state][sel];
    const picks=PREVIEW_ACTIONS[state].map(([icon,title],i)=>`<button class="theme-state-btn-v460 ${i===sel?'active':''}" data-v466-select="${i}" title="${esc(title)}">${i+1} · ${icon}</button>`).join('');
    const anchors=[['free','FREI'],['tl','↖ OBEN LINKS'],['tr','↗ OBEN RECHTS'],['bl','↙ UNTEN LINKS'],['br','↘ UNTEN RECHTS']].map(([k,l])=>`<button class="theme-anchor-btn-v460 ${x.anchor===k?'active':''}" data-v466-anchor="${k}">${l}</button>`).join('');
    return `<div class="theme-panel-v458 v466-action-panel"><div class="theme-panel-title-v458">AKTIONSTASTEN EINZELN · ${STATE_LABEL[state]}</div><div class="theme-help-v458">Jede Taste hat ihren eigenen Verlauf und ihre eigene Position. Die Nummer entspricht der Taste in der festen Vorschau.</div><div class="theme-state-select-v460">${picks}</div><div class="theme-grid-v458" style="margin-top:9px">${fieldColor('TASTE VERLAUF START',`${state}.${sel}.start`,x.start)}${fieldColor('TASTE VERLAUF ENDE',`${state}.${sel}.end`,x.end)}${fieldRange('TASTE VERLAUF WINKEL',`${state}.${sel}.angle`,x.angle,0,360,1,'°')}${fieldColor('TASTE RAHMEN',`${state}.${sel}.border`,x.border)}</div><div class="theme-state-position-title-v460" style="margin-top:10px">POSITION · TASTE ${sel+1}</div><div class="theme-anchor-select-v460">${anchors}</div><div class="theme-pos-coords-v460" style="margin-top:8px">X ${x.x}px · Y ${x.y}px</div>${dpadHtml()}</div>`;
  }
  function bindActionPanel(panel,state){
    bindFields(panel);
    panel.querySelectorAll('[data-v466-select]').forEach(b=>b.onclick=()=>{selectedByState[state]=Number(b.dataset.v466Select);patchEditor();});
    panel.querySelectorAll('[data-v466-anchor]').forEach(b=>b.onclick=()=>{buttonCfg.states[state][selectedByState[state]].anchor=b.dataset.v466Anchor;saveButtons();patchEditor();});
    panel.querySelectorAll('[data-v466-dir]').forEach(b=>b.onclick=()=>{const x=buttonCfg.states[state][selectedByState[state]],step=window.__modUxCookingEditorV460?.getLayout?.()?.gridStep||2,d=b.dataset.v466Dir;if(d==='left')x.x-=step;if(d==='right')x.x+=step;if(d==='up')x.y-=step;if(d==='down')x.y+=step;x.x=clamp(x.x,-100,100);x.y=clamp(x.y,-100,100);saveButtons();patchEditor();});
    panel.querySelector('[data-v466-ok]')?.addEventListener('click',()=>flashButton('themeSaveSnapshotV458','✓ POSITION')); 
  }

  function patchEditor(){
    if(typeof currentTab==='undefined'||currentTab!=='theme')return;
    relabelToolbar();repairPreviewActions();applyButtonStyles();
    document.querySelectorAll('.theme-role-v458[data-theme-role-select="actions"]').forEach(n=>n.style.display='none');
    const editor=document.querySelector('.theme-editor-v458');if(!editor)return;const state=currentState();let panel=editor.querySelector('.v466-action-panel');if(panel?.dataset.state!==state){panel?.remove();const box=document.createElement('div');box.innerHTML=actionPanelHtml(state);panel=box.firstElementChild;panel.dataset.state=state;const statePanel=editor.querySelector('.v464-state-card-panel');if(statePanel)statePanel.after(panel);else editor.appendChild(panel);bindActionPanel(panel,state);}else{const wanted=selectedByState[state];if(Number(panel.dataset.selected)!==wanted){panel.remove();patchEditor();return;}}
    panel.dataset.selected=String(selectedByState[state]);
  }
  function schedulePatch(ms=50){clearTimeout(patchTimer);patchTimer=setTimeout(patchEditor,ms);}

  document.addEventListener('click',e=>{
    const t=e.target?.closest?.('button');if(!t)return;
    if(t.id==='themeSaveSnapshotV458'){e.preventDefault();e.stopImmediatePropagation();saveMyTheme();return;}
    if(t.id==='themeLoadSnapshotV458'){e.preventDefault();e.stopImmediatePropagation();loadMyTheme();return;}
    if(t.id==='themeExportV458'){e.preventDefault();e.stopImmediatePropagation();exportTheme();return;}
    if(t.id==='themeImportV458'){e.preventDefault();e.stopImmediatePropagation();document.getElementById('themeImportFileV458')?.click();return;}
    if(t.id==='themeResetV458'){e.preventDefault();e.stopImmediatePropagation();resetAll();return;}
  },true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-preset]'))setTimeout(presetApplied,0);if(e.target?.closest?.('[data-sticky-state-v460],[data-position-state-v460]'))schedulePatch(95);});
  document.addEventListener('change',e=>{if(e.target?.id==='themeImportFileV458'){e.preventDefault();e.stopImmediatePropagation();importTheme(e.target.files?.[0]);}},true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-theme-role-select],#themeStickyPreviewV460 [data-theme-role]'))schedulePatch(80);},true);

  function wrapStateSetter(){const api=window.__modUxCookingEditorV460;if(!api||api.__v466Wrapped)return false;const base=api.setState?.bind(api);if(typeof base!=='function')return false;api.setState=function(s){const out=base(s);schedulePatch(105);return out;};api.__v466Wrapped=true;return true;}
  function init(){if(!wrapStateSetter())setTimeout(init,80);applyButtonStyles();schedulePatch(120);}
  window.addEventListener('load',()=>setTimeout(init,0));init();

  window.__modThemePackageActionsV466={version:BUILD_VERSION,packageKey:PACKAGE_KEY,buttonKey:BUTTON_KEY,fullPackage:true,individualActions:true,capturePackage,getButtonConfig:()=>clone(buttonCfg),resetAll,patch:patchEditor};
})();
