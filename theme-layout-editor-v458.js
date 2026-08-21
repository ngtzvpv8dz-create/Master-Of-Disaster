/* V458 · THEME & LAYOUT EDITOR
   - zentralisierte App-/Kartenfarben
   - Live-Vorschau verschiedener Aufgabenzustaende
   - elementgenaue Typografie und begrenzte X/Y-Offsets innerhalb der Aufgabenkarte
   - Kartenbreite bleibt responsiv; nur Mindesthoehe/Innenabstaende/Form werden editiert
*/
(function(){
  'use strict';

  const BUILD_VERSION='V458';
  const STORAGE_KEY='masterOfDisasterThemeLayoutV458';
  const SNAPSHOT_KEY='masterOfDisasterThemeLayoutSnapshotV458';
  const ROLE_ORDER=['number','status','title','flags','type','meta','actions','cooking','note'];
  const ROLE_LABELS={
    number:'NUMMER',status:'STATUS',title:'TITEL',flags:'FLAGS',type:'TYP-BADGE',meta:'ZEIT / META',actions:'AKTIONSTASTEN',cooking:'KOCHMODUS',note:'NOTIZ'
  };
  const ROLE_SELECTORS={
    number:'.task-number',status:'.status-symbol',title:'.task-text',flags:'.compact-flags',type:'.task-type-badge',
    meta:'.task-meta,.duration,.task-leisure-duration,.task-cooking-active,.task-cooking-passive,.status-meta,.abort-meta',
    actions:'.icon-actions',cooking:'.cooking-mode-row',note:'.task-note-v456'
  };

  const DEFAULTS={
    palette:{
      bgTop:'#15191d',bgMid:'#0b0d0f',bgBottom:'#070809',surface:'#171b1f',surface2:'#111416',control:'#101315',
      border:'#30363b',text:'#f3f3f3',muted:'#87949c',accent:'#e8ecef',accentText:'#101214',success:'#55775f',warning:'#776d36',danger:'#6b3f3f',
      cardStart:'#1c2125',cardEnd:'#14181b',cardBorder:'#292f34',runningBorder:'#55775f',pausedBorder:'#776d36',
      noteBg:'#142029',noteBorder:'#4f86ad',noteText:'#b8c7d2'
    },
    card:{minHeight:50,paddingX:8,paddingY:8,gap:5,borderWidth:1,radius:13,shadow:14,actionSize:31,actionGap:4,noteLines:2},
    elements:{
      number:{fontSize:9,fontWeight:900,lineHeight:1,color:'#647887',x:0,y:0},
      status:{fontSize:17,fontWeight:700,lineHeight:1,color:'#f3f3f3',x:0,y:0},
      title:{fontSize:15,fontWeight:650,lineHeight:1.25,color:'#f3f3f3',x:0,y:0},
      flags:{fontSize:10,fontWeight:700,lineHeight:1,color:'#f3f3f3',x:0,y:0},
      type:{fontSize:7,fontWeight:900,lineHeight:1,color:'#7d8b94',x:0,y:0},
      meta:{fontSize:8,fontWeight:800,lineHeight:1.2,color:'#70a5cf',x:0,y:0},
      actions:{fontSize:13,fontWeight:700,lineHeight:1,color:'#d1d6d9',x:0,y:0},
      cooking:{fontSize:10,fontWeight:900,lineHeight:1,color:'#d3b487',x:0,y:0},
      note:{fontSize:10,fontWeight:650,lineHeight:1.25,color:'#b8c7d2',x:0,y:0}
    },
    gridStep:2
  };

  const PRESETS={
    master:{label:'MASTER DARK',palette:DEFAULTS.palette},
    graphite:{label:'GRAPHITE',palette:{...DEFAULTS.palette,bgTop:'#181818',bgMid:'#0d0d0e',bgBottom:'#070708',surface:'#1b1b1c',surface2:'#121213',control:'#151516',border:'#38383a',muted:'#929296',accent:'#f1f1f2',accentText:'#111112',cardStart:'#232325',cardEnd:'#171719',cardBorder:'#363639',noteBg:'#1b1c1f',noteBorder:'#696b73',noteText:'#c7c8cc'}},
    blue:{label:'BLUE NIGHT',palette:{...DEFAULTS.palette,bgTop:'#111923',bgMid:'#09111a',bgBottom:'#05090e',surface:'#121d27',surface2:'#0d151d',control:'#0e1821',border:'#2b4152',muted:'#7f9bad',accent:'#cfe8f7',accentText:'#0b141b',cardStart:'#172633',cardEnd:'#0f1820',cardBorder:'#294358',runningBorder:'#4d8269',pausedBorder:'#8d783f',noteBg:'#0d2231',noteBorder:'#3f82ad',noteText:'#b8d3e4'}},
    forest:{label:'FOREST',palette:{...DEFAULTS.palette,bgTop:'#121b18',bgMid:'#09110f',bgBottom:'#050907',surface:'#15201c',surface2:'#0f1714',control:'#101914',border:'#31483d',muted:'#88a093',accent:'#dce9e1',accentText:'#0c1511',cardStart:'#1a2923',cardEnd:'#111b17',cardBorder:'#304a3d',runningBorder:'#5c8a69',pausedBorder:'#927942',noteBg:'#13251d',noteBorder:'#4b8266',noteText:'#bad0c4'}}
  };

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function isObject(value){return value&&typeof value==='object'&&!Array.isArray(value);}
  function merge(base,extra){
    const out=clone(base);if(!isObject(extra))return out;
    Object.keys(extra).forEach(key=>{if(isObject(out[key])&&isObject(extra[key]))out[key]=merge(out[key],extra[key]);else if(extra[key]!==undefined)out[key]=extra[key];});
    return out;
  }
  function clamp(value,min,max){const n=Number(value);return Math.min(max,Math.max(min,Number.isFinite(n)?n:min));}
  function cleanHex(value,fallback){const v=String(value||'').trim();return /^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():fallback;}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));}
  function safeGet(key){try{return localStorage.getItem(key);}catch(_){return null;}}
  function safeSet(key,value){try{localStorage.setItem(key,value);return true;}catch(_){return false;}}
  function readConfig(){try{const raw=safeGet(STORAGE_KEY);return raw?sanitize(merge(DEFAULTS,JSON.parse(raw))):clone(DEFAULTS);}catch(_){return clone(DEFAULTS);}}
  function sanitize(raw){
    const c=merge(DEFAULTS,raw);
    Object.keys(DEFAULTS.palette).forEach(k=>{c.palette[k]=cleanHex(c.palette[k],DEFAULTS.palette[k]);});
    c.card.minHeight=clamp(c.card.minHeight,44,140);c.card.paddingX=clamp(c.card.paddingX,2,28);c.card.paddingY=clamp(c.card.paddingY,2,28);
    c.card.gap=clamp(c.card.gap,0,18);c.card.borderWidth=clamp(c.card.borderWidth,0,5);c.card.radius=clamp(c.card.radius,0,28);c.card.shadow=clamp(c.card.shadow,0,40);
    c.card.actionSize=clamp(c.card.actionSize,24,48);c.card.actionGap=clamp(c.card.actionGap,0,14);c.card.noteLines=Math.round(clamp(c.card.noteLines,1,6));
    ROLE_ORDER.forEach(role=>{
      const e=c.elements[role]=merge(DEFAULTS.elements[role],c.elements[role]);
      e.fontSize=clamp(e.fontSize,6,30);e.fontWeight=Math.round(clamp(e.fontWeight,300,950)/50)*50;e.lineHeight=clamp(e.lineHeight,.8,2);
      e.color=cleanHex(e.color,DEFAULTS.elements[role].color);e.x=clamp(e.x,-48,48);e.y=clamp(e.y,-48,48);
    });
    c.gridStep=[1,2,4,8].includes(Number(c.gridStep))?Number(c.gridStep):2;
    return c;
  }

  let config=readConfig();
  let selectedRole='title';
  let positionDraft={x:config.elements.title.x,y:config.elements.title.y};
  let draftDirty=false;

  function cssPx(v){return `${Number(v)||0}px`;}
  function setVar(name,value){document.documentElement.style.setProperty(name,String(value));}
  function applyVars(){
    const p=config.palette,c=config.card;
    Object.entries(p).forEach(([k,v])=>setVar(`--mod-${k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}`,v));
    Object.entries(c).forEach(([k,v])=>setVar(`--mod-card-${k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}`,typeof v==='number'?`${v}px`:v));
    setVar('--mod-card-note-lines',c.noteLines);
    ROLE_ORDER.forEach(role=>{
      const e=config.elements[role];
      setVar(`--mod-${role}-size`,cssPx(e.fontSize));setVar(`--mod-${role}-weight`,e.fontWeight);setVar(`--mod-${role}-line`,e.lineHeight);setVar(`--mod-${role}-color`,e.color);
      setVar(`--mod-${role}-x`,cssPx(e.x));setVar(`--mod-${role}-y`,cssPx(e.y));
    });
  }

  function injectRuntimeStyle(){
    let style=document.getElementById('themeLayoutV458RuntimeStyle');if(style)return style;
    style=document.createElement('style');style.id='themeLayoutV458RuntimeStyle';style.textContent=`
      body{background:linear-gradient(180deg,var(--mod-bg-top) 0%,var(--mod-bg-mid) 45%,var(--mod-bg-bottom) 100%)!important;color:var(--mod-text)!important}
      .tabs-wrapper,.input-panel,.weight-panel,.archive-summary,.today-summary,.next-task-panel,.statistics-group,.statistics-card,.modal,.category-page-panel-v412,.dev-card,.log-shell-v453{border-color:var(--mod-border)!important;color:var(--mod-text)!important}
      .input-panel,.archive-summary,.today-summary,.statistics-group,.modal{background:var(--mod-surface)!important}
      input,textarea,select,.edit-input,.weight-input{background:var(--mod-surface2)!important;color:var(--mod-text)!important;border-color:var(--mod-border)!important}
      .tab-button,.option-button,.edit-button,.modal-button,.weight-edit-button,.weight-save-button,.repeat-button,.drag-handle{background:var(--mod-control)!important;color:var(--mod-text)!important;border-color:var(--mod-border)!important}
      .tab-button.active,.add-button{background:var(--mod-accent)!important;color:var(--mod-accent-text)!important;border-color:var(--mod-accent)!important}
      .eyebrow,.section-title,.option-label,.empty-message,.task-suggestion-source{color:var(--mod-muted)!important}

      body .task{min-height:var(--mod-card-min-height)!important;padding:var(--mod-card-padding-y) var(--mod-card-padding-x)!important;gap:var(--mod-card-gap)!important;background:linear-gradient(135deg,var(--mod-card-start),var(--mod-card-end))!important;border-width:var(--mod-card-border-width)!important;border-style:solid!important;border-color:var(--mod-card-border)!important;border-radius:var(--mod-card-radius)!important;box-shadow:0 7px var(--mod-card-shadow) rgba(0,0,0,.18);color:var(--mod-text)!important;overflow:visible}
      body .task.running{border-color:var(--mod-running-border)!important}body .task.paused{border-color:var(--mod-paused-border)!important}
      body .task .task-number{font-size:var(--mod-number-size)!important;font-weight:var(--mod-number-weight)!important;line-height:var(--mod-number-line)!important;color:var(--mod-number-color)!important;transform:translate(var(--mod-number-x),var(--mod-number-y))}
      body .task .status-symbol{font-size:var(--mod-status-size)!important;font-weight:var(--mod-status-weight)!important;line-height:var(--mod-status-line)!important;color:var(--mod-status-color)!important;transform:translate(var(--mod-status-x),var(--mod-status-y))}
      body .task .task-text{font-size:var(--mod-title-size)!important;font-weight:var(--mod-title-weight)!important;line-height:var(--mod-title-line)!important;color:var(--mod-title-color)!important;transform:translate(var(--mod-title-x),var(--mod-title-y))}
      body .task .compact-flags{transform:translate(var(--mod-flags-x),var(--mod-flags-y))}body .task .mini-flag{font-size:var(--mod-flags-size)!important;font-weight:var(--mod-flags-weight)!important;line-height:var(--mod-flags-line)!important;color:var(--mod-flags-color)!important}
      body .task .task-type-badge{font-size:var(--mod-type-size)!important;font-weight:var(--mod-type-weight)!important;line-height:var(--mod-type-line)!important;color:var(--mod-type-color)!important;transform:translate(var(--mod-type-x),var(--mod-type-y))}
      body .task .task-meta,body .task .duration,body .task .task-leisure-duration,body .task .task-cooking-active,body .task .task-cooking-passive,body .task .status-meta,body .task .abort-meta{font-size:var(--mod-meta-size)!important;font-weight:var(--mod-meta-weight)!important;line-height:var(--mod-meta-line)!important;color:var(--mod-meta-color)!important;transform:translate(var(--mod-meta-x),var(--mod-meta-y))}
      body .task .icon-actions{gap:var(--mod-card-action-gap)!important;transform:translate(var(--mod-actions-x),var(--mod-actions-y))}
      body .task .icon-action,body .task .repeat-button{width:var(--mod-card-action-size)!important;height:var(--mod-card-action-size)!important;flex-basis:var(--mod-card-action-size)!important;font-size:var(--mod-actions-size)!important;color:var(--mod-actions-color)!important;background:var(--mod-control)!important;border-color:var(--mod-border)!important}
      body .task .start-button,body .task .finish-button{border-color:var(--mod-success)!important}body .task .pause-button{border-color:var(--mod-warning)!important}body .task .abort-button{border-color:var(--mod-danger)!important}
      body .task .cooking-mode-row{transform:translate(var(--mod-cooking-x),var(--mod-cooking-y))}body .task .cooking-mode-button{font-size:var(--mod-cooking-size)!important;font-weight:var(--mod-cooking-weight)!important;line-height:var(--mod-cooking-line)!important;color:var(--mod-cooking-color)!important;border-color:var(--mod-border)!important;background:var(--mod-control)!important}
      body .task .task-note-v456{font-size:var(--mod-note-size)!important;font-weight:var(--mod-note-weight)!important;line-height:var(--mod-note-line)!important;color:var(--mod-note-color)!important;transform:translate(var(--mod-note-x),var(--mod-note-y));margin:4px 0 0!important;padding:3px 6px!important;background:var(--mod-note-bg)!important;border-left:2px solid var(--mod-note-border)!important;border-radius:0 6px 6px 0!important;display:-webkit-box!important;-webkit-box-orient:vertical;-webkit-line-clamp:var(--mod-card-note-lines);overflow:hidden!important}
    `;document.head.appendChild(style);return style;
  }

  function injectEditorStyle(){
    if(document.getElementById('themeLayoutV458EditorStyle'))return;
    const style=document.createElement('style');style.id='themeLayoutV458EditorStyle';style.textContent=`
      .theme-editor-v458{padding-bottom:40px}.theme-head-v458{margin-bottom:14px}.theme-title-v458{font-size:20px;font-weight:950;letter-spacing:-.4px}.theme-help-v458{margin-top:5px;font-size:11px;line-height:1.45;color:var(--mod-muted)}
      .theme-toolbar-v458{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px}.theme-btn-v458{border:1px solid var(--mod-border);background:var(--mod-control);color:var(--mod-text);border-radius:9px;padding:8px 9px;font-size:9px;font-weight:900}.theme-btn-v458.primary{background:var(--mod-accent);color:var(--mod-accent-text);border-color:var(--mod-accent)}.theme-btn-v458.danger{border-color:var(--mod-danger)}
      .theme-panel-v458{background:var(--mod-surface);border:1px solid var(--mod-border);border-radius:14px;padding:12px;margin-bottom:12px}.theme-panel-title-v458{font-size:10px;font-weight:950;letter-spacing:1.1px;color:var(--mod-muted);margin-bottom:9px}.theme-grid-v458{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.theme-field-v458{background:var(--mod-surface2);border:1px solid var(--mod-border);border-radius:10px;padding:8px;min-width:0}.theme-label-v458{display:flex;justify-content:space-between;gap:6px;align-items:center;font-size:8px;font-weight:900;color:var(--mod-muted);margin-bottom:6px}.theme-value-v458{color:var(--mod-text);font-variant-numeric:tabular-nums}.theme-field-v458 input[type=color]{width:100%;height:32px;border:0;padding:0;background:transparent}.theme-field-v458 input[type=range]{width:100%}.theme-field-v458 select{width:100%;padding:7px;border-radius:7px}
      .theme-role-list-v458{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px}.theme-role-v458{border:1px solid var(--mod-border);background:var(--mod-control);color:var(--mod-muted);border-radius:999px;padding:7px 8px;font-size:8px;font-weight:900}.theme-role-v458.active{border-color:var(--mod-accent);color:var(--mod-text);box-shadow:inset 0 0 0 1px var(--mod-accent)}
      .theme-dpad-wrap-v458{display:grid;grid-template-columns:1fr 132px;gap:12px;align-items:center}.theme-dpad-v458{width:132px;display:grid;grid-template-columns:repeat(3,40px);grid-template-rows:repeat(3,40px);gap:5px;justify-content:center}.theme-pad-v458{border:1px solid var(--mod-border);border-radius:9px;background:var(--mod-control);color:var(--mod-text);font-size:17px;font-weight:950}.theme-pad-v458.ok{font-size:10px;background:var(--mod-accent);color:var(--mod-accent-text);border-color:var(--mod-accent)}.theme-pad-v458.blank{visibility:hidden}.theme-coords-v458{font-size:12px;font-weight:900;font-variant-numeric:tabular-nums}.theme-gridstep-v458{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.theme-gridstep-v458 button{min-width:34px}.theme-gridstep-v458 button.active{border-color:var(--mod-accent);color:var(--mod-text)}
      .theme-preview-v458{display:grid;gap:8px}.theme-preview-card-v458{cursor:pointer}.theme-preview-card-v458 [data-theme-role]{cursor:pointer}.theme-preview-card-v458 [data-theme-role].theme-selected-v458{outline:1px dashed var(--mod-accent);outline-offset:2px;border-radius:3px}.theme-preview-caption-v458{font-size:8px;font-weight:950;letter-spacing:.8px;color:var(--mod-muted);margin:2px 2px -2px}
      .theme-preview-card-v458.task{margin-bottom:0}.theme-preview-card-v458 .task-number{width:27px}.theme-preview-card-v458 .status-symbol{width:25px}.theme-preview-card-v458 .task-content{flex:1;min-width:0}.theme-preview-card-v458 .task-main-row{display:flex;align-items:center;gap:6px}.theme-preview-card-v458 .compact-flags{display:flex;gap:3px;margin-top:3px}.theme-preview-card-v458 .task-type-badge{display:inline-flex;margin-top:3px;padding:2px 5px;border:1px solid var(--mod-border);border-radius:999px}.theme-preview-card-v458 .icon-actions{display:flex;align-items:center;margin-top:5px;flex-wrap:nowrap}.theme-preview-card-v458 .icon-action{display:flex;align-items:center;justify-content:center;padding:0;border-radius:8px;border-style:solid;border-width:1px}.theme-preview-card-v458 .cooking-mode-row{display:flex;gap:5px;margin-top:5px}.theme-preview-card-v458 .cooking-mode-button{height:29px;border-radius:8px;border-style:solid;border-width:1px;padding:0 8px}.theme-preview-card-v458 .task-note-v456{white-space:pre-wrap}
      .theme-save-note-v458{font-size:9px;line-height:1.4;color:var(--mod-muted);margin-top:7px}.theme-file-v458{display:none}@media(max-width:420px){.theme-grid-v458{grid-template-columns:1fr}.theme-dpad-wrap-v458{grid-template-columns:1fr}.theme-dpad-v458{justify-self:center}}
    `;document.head.appendChild(style);
  }

  function persist(){config=sanitize(config);safeSet(STORAGE_KEY,JSON.stringify(config));applyVars();return config;}
  function logEvent(message){try{window.__modLiveLogV453?.append?.('SYSTEM','INFO',message);}catch(_){} }

  function getPath(path){return path.split('.').reduce((obj,key)=>obj&&obj[key],config);}
  function setPath(path,value){const parts=path.split('.');let obj=config;for(let i=0;i<parts.length-1;i++)obj=obj[parts[i]];obj[parts.at(-1)]=value;}

  function fieldColor(label,path){const value=getPath(path);return `<div class="theme-field-v458"><div class="theme-label-v458"><span>${esc(label)}</span><span class="theme-value-v458" data-value-for="${esc(path)}">${esc(value)}</span></div><input type="color" value="${esc(value)}" data-theme-setting="${esc(path)}" data-kind="color"></div>`;}
  function fieldRange(label,path,min,max,step,suffix=''){const value=getPath(path);return `<div class="theme-field-v458"><div class="theme-label-v458"><span>${esc(label)}</span><span class="theme-value-v458" data-value-for="${esc(path)}">${esc(value)}${esc(suffix)}</span></div><input type="range" min="${min}" max="${max}" step="${step}" value="${esc(value)}" data-theme-setting="${esc(path)}" data-kind="number" data-suffix="${esc(suffix)}"></div>`;}

  function previewCard(state,title,opts={}){
    const statusSymbol={open:'⬜',running:'▶️',paused:'☕',completed:'✅'}[state]||'⬜';
    const cooking=!!opts.cooking,note=opts.note!==false;
    const meta=state==='running'?(cooking?`<div class="task-cooking-active" data-theme-role="meta">AKTIV KOCHEN · 00:18:24</div><div class="task-cooking-passive" data-theme-role="meta">WARTE-/GARZEIT · 00:11:07</div>`:`<div class="duration" data-theme-role="meta">AKTIV · 00:32:18</div>`):state==='paused'?`<div class="status-meta" data-theme-role="meta">PAUSIERT · 00:18:42</div>`:state==='completed'?`<div class="task-meta" data-theme-role="meta">ERLEDIGT · HEUTE 21:32</div><div class="duration" data-theme-role="meta">DAUER · 00:27:13</div>`:'';
    const buttons=state==='open'?['▶️','🕒','📅','✏️','🗑️']:state==='running'?['☕','🕒','✅','❌']:state==='paused'?['▶️','🕒','✅','❌']:['🔁'];
    const cookingControls=cooking&&state==='running'?`<div class="cooking-mode-row" data-theme-role="cooking"><button class="cooking-mode-button active">🔥 AKTIV</button><button class="cooking-mode-button">⏳ GARZEIT</button></div>`:'';
    return `<div class="theme-preview-caption-v458">${esc(opts.caption||state.toUpperCase())}</div><div class="task ${esc(state)} theme-preview-card-v458"><div class="task-number" data-theme-role="number">${esc(opts.number||'248')}</div><div class="status-symbol" data-theme-role="status">${statusSymbol}</div><div class="task-content"><div class="task-main-row"><div class="task-text" data-theme-role="title">${esc(title)}</div></div><div class="compact-flags" data-theme-role="flags"><span class="mini-flag">${opts.priority||'🟡'}</span>${opts.optional?'<span class="mini-flag">🟣</span>':''}</div><span class="task-type-badge ${cooking?'cooking':''}" data-theme-role="type">${cooking?'🍳 KOCHEN':'🔧 ARBEIT'}</span>${meta}${note?`<div class="task-note-v456" data-theme-role="note"><strong>📝</strong> ${esc(opts.noteText||'Kleine Zusatzinfo zur Aufgabe.')}</div>`:''}<div class="icon-actions" data-theme-role="actions">${buttons.map(icon=>`<button class="icon-action">${icon}</button>`).join('')}</div>${cookingControls}</div></div>`;
  }

  function elementPanel(){
    const e=config.elements[selectedRole];
    return `<div class="theme-role-list-v458">${ROLE_ORDER.map(role=>`<button class="theme-role-v458 ${role===selectedRole?'active':''}" data-theme-role-select="${role}">${ROLE_LABELS[role]}</button>`).join('')}</div><div class="theme-grid-v458">${fieldRange('SCHRIFTGRÖSSE',`elements.${selectedRole}.fontSize`,6,30,1,' px')}${fieldRange('SCHRIFTSTÄRKE',`elements.${selectedRole}.fontWeight`,300,950,50)}${fieldRange('ZEILENABSTAND',`elements.${selectedRole}.lineHeight`,.8,2,.05)}${fieldColor('SCHRIFTFARBE',`elements.${selectedRole}.color`)}</div><div class="theme-dpad-wrap-v458" style="margin-top:12px"><div><div class="theme-coords-v458">POSITION · X <span id="themeXValueV458">${e.x}</span> / Y <span id="themeYValueV458">${e.y}</span> px</div><div class="theme-save-note-v458">Pfeile verschieben nur das ausgewählte Element innerhalb der Aufgabenkarte. Erst <strong>OK</strong> speichert die Position dauerhaft.</div><div class="theme-gridstep-v458">${[1,2,4,8].map(step=>`<button class="theme-btn-v458 ${config.gridStep===step?'active':''}" data-grid-step="${step}">${step}px</button>`).join('')}<button class="theme-btn-v458" id="themePositionZeroV458">↺ 0/0</button></div></div><div class="theme-dpad-v458"><span class="theme-pad-v458 blank"></span><button class="theme-pad-v458" data-move="up">▲</button><span class="theme-pad-v458 blank"></span><button class="theme-pad-v458" data-move="left">◀</button><button class="theme-pad-v458 ok" id="themePositionOkV458">OK</button><button class="theme-pad-v458" data-move="right">▶</button><span class="theme-pad-v458 blank"></span><button class="theme-pad-v458" data-move="down">▼</button><span class="theme-pad-v458 blank"></span></div></div>`;
  }

  function renderEditor(){
    const host=document.getElementById('viewContainer');if(!host)return;
    injectEditorStyle();applyVars();
    positionDraft={x:config.elements[selectedRole].x,y:config.elements[selectedRole].y};draftDirty=false;
    host.innerHTML=`<div class="theme-editor-v458"><div class="theme-head-v458"><div class="theme-title-v458">🎛️ THEME & LAYOUT EDITOR</div><div class="theme-help-v458">Farben zentral statt CSS-Schnitzeljagd. Die Aufgabenkarte bleibt an ihrem Platz und in der Bildschirmbreite. Du veränderst nur ihr Aussehen, ihre Mindesthöhe und die Elemente <strong>innerhalb</strong> der Karte.</div></div>
      <div class="theme-toolbar-v458">${Object.entries(PRESETS).map(([key,p])=>`<button class="theme-btn-v458" data-preset="${key}">${esc(p.label)}</button>`).join('')}<button class="theme-btn-v458" id="themeSaveSnapshotV458">💾 MEIN THEME</button><button class="theme-btn-v458" id="themeLoadSnapshotV458">↩︎ LADEN</button><button class="theme-btn-v458" id="themeExportV458">⬇︎ EXPORT</button><button class="theme-btn-v458" id="themeImportV458">⬆︎ IMPORT</button><input class="theme-file-v458" id="themeImportFileV458" type="file" accept="application/json,.json"><button class="theme-btn-v458 danger" id="themeResetV458">RESET</button></div>
      <div class="theme-panel-v458"><div class="theme-panel-title-v458">APP-FARBEN · ZENTRALE PALETTE</div><div class="theme-grid-v458">${fieldColor('HINTERGRUND OBEN','palette.bgTop')}${fieldColor('HINTERGRUND MITTE','palette.bgMid')}${fieldColor('HINTERGRUND UNTEN','palette.bgBottom')}${fieldColor('FLÄCHE','palette.surface')}${fieldColor('FLÄCHE DUNKEL','palette.surface2')}${fieldColor('BEDIENELEMENTE','palette.control')}${fieldColor('RAHMEN','palette.border')}${fieldColor('TEXT','palette.text')}${fieldColor('TEXT GEDÄMPFT','palette.muted')}${fieldColor('AKZENT','palette.accent')}${fieldColor('AKZENT-TEXT','palette.accentText')}${fieldColor('ERFOLG / START','palette.success')}${fieldColor('PAUSE / WARNUNG','palette.warning')}${fieldColor('ABBRUCH / FEHLER','palette.danger')}</div></div>
      <div class="theme-panel-v458"><div class="theme-panel-title-v458">AUFGABENKARTE · FARBEN & FORM</div><div class="theme-grid-v458">${fieldColor('VERLAUF START','palette.cardStart')}${fieldColor('VERLAUF ENDE','palette.cardEnd')}${fieldColor('KARTENRAHMEN','palette.cardBorder')}${fieldColor('RAHMEN LÄUFT','palette.runningBorder')}${fieldColor('RAHMEN PAUSIERT','palette.pausedBorder')}${fieldColor('NOTIZ HINTERGRUND','palette.noteBg')}${fieldColor('NOTIZ LINIE','palette.noteBorder')}${fieldColor('NOTIZ TEXT','palette.noteText')}${fieldRange('MINDESTHÖHE','card.minHeight',44,140,1,' px')}${fieldRange('INNENABSTAND X','card.paddingX',2,28,1,' px')}${fieldRange('INNENABSTAND Y','card.paddingY',2,28,1,' px')}${fieldRange('ABSTAND ELEMENTE','card.gap',0,18,1,' px')}${fieldRange('RAHMENDICKE','card.borderWidth',0,5,.5,' px')}${fieldRange('RUNDUNG','card.radius',0,28,1,' px')}${fieldRange('SCHATTEN','card.shadow',0,40,1,' px')}${fieldRange('AKTIONSTASTE GRÖSSE','card.actionSize',24,48,1,' px')}${fieldRange('AKTIONSTASTEN ABSTAND','card.actionGap',0,14,1,' px')}${fieldRange('NOTIZ MAX. ZEILEN','card.noteLines',1,6,1)}</div></div>
      <div class="theme-panel-v458"><div class="theme-panel-title-v458">ELEMENT AUSWÄHLEN & FEINPOSITIONIEREN</div>${elementPanel()}</div>
      <div class="theme-panel-v458"><div class="theme-panel-title-v458">LIVE-VORSCHAU · VERSCHIEDENE ZUSTÄNDE</div><div class="theme-preview-v458">${previewCard('open','Arbeitsflächen abwischen',{caption:'OFFEN · MIT NOTIZ',noteText:'Nach dem Kochen noch einmal trocken nachwischen.',optional:true})}${previewCard('running','Wohnzimmer aufräumen',{caption:'LÄUFT · NORMALE ARBEIT',note:false,priority:'🔴'})}${previewCard('paused','Werkzeug sortieren',{caption:'PAUSIERT',noteText:'Schraubendreher nach Größen trennen.'})}${previewCard('running','Chicken Mac & Cheese',{caption:'KOCHEN · AKTIV/GARZEIT',cooking:true,noteText:'Ofen auf 180 °C vorheizen.'})}${previewCard('completed','Geschirrspüler ausräumen',{caption:'ERLEDIGT',note:false,priority:'⚪'})}</div></div>
    </div>`;
    bindEditor();markSelectedPreview();
  }

  function markSelectedPreview(){
    document.querySelectorAll('.theme-preview-v458 [data-theme-role]').forEach(el=>el.classList.toggle('theme-selected-v458',el.dataset.themeRole===selectedRole));
    applyPreviewDraft();
  }
  function applyPreviewDraft(){
    document.querySelectorAll(`.theme-preview-v458 [data-theme-role="${selectedRole}"]`).forEach(el=>{el.style.transform=`translate(${positionDraft.x}px,${positionDraft.y}px)`;});
    const x=document.getElementById('themeXValueV458'),y=document.getElementById('themeYValueV458');if(x)x.textContent=positionDraft.x;if(y)y.textContent=positionDraft.y;
  }

  function bindEditor(){
    document.querySelectorAll('[data-theme-setting]').forEach(input=>input.addEventListener('input',()=>{
      const path=input.dataset.themeSetting,kind=input.dataset.kind;let value=kind==='color'?input.value:Number(input.value);
      if(path==='card.noteLines')value=Math.round(value);setPath(path,value);persist();
      const display=document.querySelector(`[data-value-for="${CSS.escape(path)}"]`);if(display)display.textContent=`${value}${input.dataset.suffix||''}`;
    }));
    document.querySelectorAll('[data-theme-role-select]').forEach(button=>button.addEventListener('click',()=>{selectedRole=button.dataset.themeRoleSelect;renderEditor();}));
    document.querySelectorAll('.theme-preview-v458 [data-theme-role]').forEach(el=>el.addEventListener('click',event=>{event.stopPropagation();selectedRole=el.dataset.themeRole;renderEditor();}));
    document.querySelectorAll('[data-move]').forEach(button=>button.addEventListener('click',()=>moveDraft(button.dataset.move)));
    document.querySelectorAll('[data-grid-step]').forEach(button=>button.addEventListener('click',()=>{config.gridStep=Number(button.dataset.gridStep);persist();document.querySelectorAll('[data-grid-step]').forEach(b=>b.classList.toggle('active',Number(b.dataset.gridStep)===config.gridStep));}));
    document.getElementById('themePositionZeroV458')?.addEventListener('click',()=>{positionDraft={x:0,y:0};draftDirty=true;applyPreviewDraft();});
    document.getElementById('themePositionOkV458')?.addEventListener('click',commitPosition);
    document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>applyPreset(button.dataset.preset)));
    document.getElementById('themeResetV458')?.addEventListener('click',()=>{if(confirm('Theme & Kartenlayout wirklich komplett auf Standard zurücksetzen?')){config=clone(DEFAULTS);persist();logEvent('Theme/Layout auf Standard zurückgesetzt');renderEditor();}});
    document.getElementById('themeSaveSnapshotV458')?.addEventListener('click',()=>{safeSet(SNAPSHOT_KEY,JSON.stringify(config));logEvent('Eigenes Theme als Snapshot gespeichert');flashButton('themeSaveSnapshotV458','✅ GESPEICHERT');});
    document.getElementById('themeLoadSnapshotV458')?.addEventListener('click',()=>{try{const raw=safeGet(SNAPSHOT_KEY);if(!raw){alert('Noch kein eigenes Theme gespeichert.');return;}config=sanitize(JSON.parse(raw));persist();logEvent('Eigenes Theme aus Snapshot geladen');renderEditor();}catch(_){alert('Gespeicherter Theme-Snapshot ist ungültig.');}});
    document.getElementById('themeExportV458')?.addEventListener('click',exportConfig);
    document.getElementById('themeImportV458')?.addEventListener('click',()=>document.getElementById('themeImportFileV458')?.click());
    document.getElementById('themeImportFileV458')?.addEventListener('change',importConfig);
  }

  function flashButton(id,text){const b=document.getElementById(id);if(!b)return;const old=b.textContent;b.textContent=text;setTimeout(()=>{if(b)b.textContent=old;},1200);}
  function moveDraft(direction){
    const s=config.gridStep||2;if(direction==='up')positionDraft.y-=s;if(direction==='down')positionDraft.y+=s;if(direction==='left')positionDraft.x-=s;if(direction==='right')positionDraft.x+=s;
    positionDraft.x=clamp(positionDraft.x,-48,48);positionDraft.y=clamp(positionDraft.y,-48,48);draftDirty=true;applyPreviewDraft();
  }
  function commitPosition(){
    config.elements[selectedRole].x=positionDraft.x;config.elements[selectedRole].y=positionDraft.y;persist();draftDirty=false;logEvent(`Theme-Position gespeichert: ${ROLE_LABELS[selectedRole]} · X ${positionDraft.x} / Y ${positionDraft.y}`);flashButton('themePositionOkV458','✓');
  }
  function applyPreset(key){const preset=PRESETS[key];if(!preset)return;config.palette=merge(DEFAULTS.palette,preset.palette);persist();logEvent(`Theme-Preset geladen: ${preset.label}`);renderEditor();}
  function exportConfig(){
    const payload={format:'Master of Disaster Theme & Layout',version:1,exportedAt:new Date().toISOString(),config};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Master-of-Disaster-THEME-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);logEvent('Theme/Layout exportiert');
  }
  async function importConfig(event){
    const file=event.target.files&&event.target.files[0];event.target.value='';if(!file)return;
    try{const payload=JSON.parse(await file.text());const incoming=payload&&payload.format==='Master of Disaster Theme & Layout'?payload.config:payload;if(!incoming||!incoming.palette||!incoming.card||!incoming.elements)throw new Error('Struktur');config=sanitize(incoming);persist();logEvent('Theme/Layout importiert');renderEditor();}catch(_){alert('Die ausgewählte Datei ist kein gültiges Master-of-Disaster-Theme.');}
  }

  function ensureThemeTab(){
    const nav=document.querySelector('.tabs');if(!nav||nav.querySelector('[data-tab="theme"]'))return;
    const button=document.createElement('button');button.className='tab-button';button.dataset.tab='theme';button.textContent='THEME';button.addEventListener('click',()=>window.switchTab?.('theme'));
    const dev=nav.querySelector('[data-tab="dev"]');if(dev)nav.insertBefore(button,dev);else nav.appendChild(button);
  }
  function syncThemeVisibility(){
    const isTheme=typeof currentTab!=='undefined'&&currentTab==='theme';const weight=document.getElementById('weightContainer');if(weight)weight.style.display=isTheme?'none':'';
    if(isTheme)renderEditor();
  }

  injectRuntimeStyle();applyVars();injectEditorStyle();ensureThemeTab();
  const baseSwitch=typeof switchTab==='function'?switchTab:null;
  if(baseSwitch){window.switchTab=function(tab){const result=baseSwitch.apply(this,arguments);setTimeout(syncThemeVisibility,0);return result;};}
  const baseRender=typeof render==='function'?render:null;
  if(baseRender){window.render=function(){const result=baseRender.apply(this,arguments);if(typeof currentTab!=='undefined'&&currentTab==='theme')setTimeout(renderEditor,0);return result;};}
  window.addEventListener('load',()=>{ensureThemeTab();applyVars();setTimeout(syncThemeVisibility,250);});

  window.__modThemeLayoutV458={
    version:BUILD_VERSION,storageKey:STORAGE_KEY,defaults:clone(DEFAULTS),getConfig:()=>clone(config),setConfig:value=>{config=sanitize(value);persist();if(typeof currentTab!=='undefined'&&currentTab==='theme')renderEditor();return clone(config);},
    reset:()=>{config=clone(DEFAULTS);persist();return clone(config);},renderEditor,applyVars,roles:clone(ROLE_LABELS)
  };
})();
