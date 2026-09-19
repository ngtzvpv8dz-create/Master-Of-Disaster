/* V464 · ZUSTANDSDESIGN
   - Karten- und Elementdesign je Aufgabenzustand statt doppelter globaler Zustandsregler
   - Aktionsbutton-Verlauf mit frei einstellbarem Winkel
   - repariert fehlende OFFEN/LÄUFT-Quellen der festen Vorschau
*/
(function(){
  'use strict';
  const BUILD_VERSION='V464';
  const STORAGE_KEY='masterOfDisasterThemeStateDesignV464';
  const STATES=[['open','OFFEN'],['running','LÄUFT'],['paused','PAUSIERT'],['cooking','KOCHEN'],['completed','ERLEDIGT'],['aborted','ABGEBROCHEN']];
  const STATE_LABEL=Object.fromEntries(STATES);
  const ROLES=['number','status','title','flags','type','meta','actions','cooking'];
  const ROLE_LABEL={number:'NUMMER',status:'STATUS',title:'TITEL',flags:'FLAGS',type:'TYP-BADGE',meta:'ZEIT / META',actions:'AKTIONSTASTEN',cooking:'KOCHMODUS'};
  const ROLE_SELECTOR={
    number:'.task-number',status:'.status-symbol',title:'.task-text',flags:'.mini-flag',type:'.task-type-badge',
    meta:'.task-meta,.duration,.task-leisure-duration,.task-cooking-active,.task-cooking-passive,.status-meta,.abort-meta',
    actions:'.icon-action,.repeat-button',cooking:'.cooking-mode-button'
  };
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function safeGet(k){try{return localStorage.getItem(k);}catch(_){return null;}}
  function safeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(_){return false;}}
  function clamp(v,min,max){const n=Number(v);return Math.min(max,Math.max(min,Number.isFinite(n)?n:min));}
  function hex(v,f){const s=String(v||'');return /^#[0-9a-f]{6}$/i.test(s)?s.toLowerCase():f;}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function baseTheme(){return window.__modThemeLayoutV458?.getConfig?.()||{};}
  function defaultForState(state){
    const b=baseTheme(),p=b.palette||{},c=b.card||{},e=b.elements||{};
    let border=p.cardBorder||'#292f34';
    if(state==='running')border=p.runningBorder||'#55775f';
    if(state==='paused')border=p.pausedBorder||'#776d36';
    if(state==='aborted')border=p.danger||'#6b3f3f';
    return {
      card:{start:p.cardStart||'#1c2125',end:p.cardEnd||'#14181b',angle:135,border,borderWidth:c.borderWidth??1,radius:c.radius??13,shadow:c.shadow??14,minHeight:c.minHeight??50,paddingX:c.paddingX??8,paddingY:c.paddingY??8,gap:c.gap??5},
      actions:{start:p.control||'#101315',end:p.control||'#101315',angle:135,border:p.border||'#30363b',size:c.actionSize??31,gap:c.actionGap??4},
      elements:Object.fromEntries(ROLES.map(role=>[role,{fontSize:e[role]?.fontSize??12,fontWeight:e[role]?.fontWeight??700,lineHeight:e[role]?.lineHeight??1.2,color:e[role]?.color||p.text||'#f3f3f3'}]))
    };
  }
  function makeDefaults(){return {states:Object.fromEntries(STATES.map(([s])=>[s,defaultForState(s)]))};}
  function sanitize(raw){
    const d=makeDefaults();
    for(const [s] of STATES){const src=raw?.states?.[s];if(!src)continue;const x=d.states[s];
      x.card.start=hex(src.card?.start,x.card.start);x.card.end=hex(src.card?.end,x.card.end);x.card.angle=clamp(src.card?.angle,0,360);x.card.border=hex(src.card?.border,x.card.border);x.card.borderWidth=clamp(src.card?.borderWidth,0,6);x.card.radius=clamp(src.card?.radius,0,32);x.card.shadow=clamp(src.card?.shadow,0,45);x.card.minHeight=clamp(src.card?.minHeight,44,160);x.card.paddingX=clamp(src.card?.paddingX,2,32);x.card.paddingY=clamp(src.card?.paddingY,2,32);x.card.gap=clamp(src.card?.gap,0,20);
      x.actions.start=hex(src.actions?.start,x.actions.start);x.actions.end=hex(src.actions?.end,x.actions.end);x.actions.angle=clamp(src.actions?.angle,0,360);x.actions.border=hex(src.actions?.border,x.actions.border);x.actions.size=clamp(src.actions?.size,24,52);x.actions.gap=clamp(src.actions?.gap,0,16);
      for(const role of ROLES){const se=src.elements?.[role];if(!se)continue;const de=x.elements[role];de.fontSize=clamp(se.fontSize,6,32);de.fontWeight=Math.round(clamp(se.fontWeight,300,950)/50)*50;de.lineHeight=clamp(se.lineHeight,.8,2);de.color=hex(se.color,de.color);}
    }
    return d;
  }
  let cfg=(()=>{try{const r=safeGet(STORAGE_KEY);return sanitize(r?JSON.parse(r):null);}catch(_){return makeDefaults();}})();
  let patchTimer=null,previewRepairQueued=false;
  function state(){const s=window.__modUxCookingEditorV460?.getLayout?.()?.selectedState;return STATE_LABEL[s]?s:'open';}
  function role(){const r=document.querySelector('.theme-role-v458.active[data-theme-role-select]')?.dataset?.themeRoleSelect;return ROLES.includes(r)?r:'title';}
  function save(){safeSet(STORAGE_KEY,JSON.stringify(cfg));applyStyles();}
  function cssState(s,x){
    const q=`body .task[data-theme-state-v460="${s}"]`,c=x.card,a=x.actions;
    let out=`${q}{background:linear-gradient(${c.angle}deg,${c.start},${c.end})!important;border-color:${c.border}!important;border-width:${c.borderWidth}px!important;border-radius:${c.radius}px!important;box-shadow:0 7px ${c.shadow}px rgba(0,0,0,.18)!important;min-height:${c.minHeight}px!important;padding:${c.paddingY}px ${c.paddingX}px!important;gap:${c.gap}px!important}`;
    out+=`${q} .icon-actions{gap:${a.gap}px!important}${q} .icon-action,${q} .repeat-button{background:linear-gradient(${a.angle}deg,${a.start},${a.end})!important;border-color:${a.border}!important;width:${a.size}px!important;height:${a.size}px!important;flex-basis:${a.size}px!important}`;
    for(const r of ROLES){const e=x.elements[r],sel=ROLE_SELECTOR[r];out+=sel.split(',').map(part=>`${q} ${part.trim()}`).join(',')+`{font-size:${e.fontSize}px!important;font-weight:${e.fontWeight}!important;line-height:${e.lineHeight}!important;color:${e.color}!important}`;}
    return out;
  }
  function applyStyles(){let st=document.getElementById('themeStateDesignV464Runtime');if(!st){st=document.createElement('style');st.id='themeStateDesignV464Runtime';document.head.appendChild(st);}st.textContent=STATES.map(([s])=>cssState(s,cfg.states[s])).join('\n');}
  function fieldColor(label,path,value){return `<label class="theme-field-v458 v464-field"><div class="theme-label-v458"><span>${esc(label)}</span><span class="theme-value-v458">${esc(value)}</span></div><input type="color" data-v464-path="${path}" data-v464-kind="color" value="${value}"></label>`;}
  function fieldRange(label,path,value,min,max,step,suffix=''){return `<label class="theme-field-v458 v464-field"><div class="theme-label-v458"><span>${esc(label)}</span><span class="theme-value-v458" data-v464-value="${path}">${value}${suffix}</span></div><input type="range" data-v464-path="${path}" data-v464-kind="number" min="${min}" max="${max}" step="${step}" value="${value}" data-suffix="${suffix}"></label>`;}
  function setPath(path,value){const parts=path.split('.');let o=cfg;for(let i=0;i<parts.length-1;i++)o=o[parts[i]];o[parts.at(-1)]=value;save();}
  function bindFields(root){root.querySelectorAll('[data-v464-path]').forEach(inp=>inp.addEventListener('input',()=>{const v=inp.dataset.v464Kind==='color'?inp.value:Number(inp.value);setPath(inp.dataset.v464Path,v);const d=root.querySelector(`[data-v464-value="${CSS.escape(inp.dataset.v464Path)}"]`);if(d)d.textContent=`${v}${inp.dataset.suffix||''}`;repairSticky();}));}
  function hideLegacyCardPanel(){for(const p of document.querySelectorAll('.theme-panel-v458')){const t=(p.querySelector('.theme-panel-title-v458')?.textContent||'').trim();if(t.includes('AUFGABENKARTE · FARBEN & FORM'))p.style.display='none';}}
  function hideLegacyElementFields(panel){const grid=panel?.querySelector(':scope > .theme-grid-v458');if(grid)grid.style.display='none';const d=panel?.querySelector(':scope > .theme-dpad-wrap-v458');if(d)d.style.display='none';}
  function cardPanelHtml(s){const x=cfg.states[s],c=x.card,a=x.actions;return `<div class="theme-panel-v458 v464-state-card-panel"><div class="theme-panel-title-v458">ZUSTANDSDESIGN · ${STATE_LABEL[s]}</div><div class="theme-help-v458" style="margin-bottom:9px">Diese Werte gelten nur für <strong>${STATE_LABEL[s]}</strong>. Kein zweiter „Rahmen läuft/pausiert“-Regler mehr.</div><div class="theme-grid-v458">${fieldColor('KARTE VERLAUF START',`states.${s}.card.start`,c.start)}${fieldColor('KARTE VERLAUF ENDE',`states.${s}.card.end`,c.end)}${fieldRange('KARTE VERLAUF WINKEL',`states.${s}.card.angle`,c.angle,0,360,1,'°')}${fieldColor('KARTENRAHMEN',`states.${s}.card.border`,c.border)}${fieldRange('RAHMENDICKE',`states.${s}.card.borderWidth`,c.borderWidth,0,6,.5,' px')}${fieldRange('RUNDUNG',`states.${s}.card.radius`,c.radius,0,32,1,' px')}${fieldRange('SCHATTEN',`states.${s}.card.shadow`,c.shadow,0,45,1,' px')}${fieldRange('MINDESTHÖHE',`states.${s}.card.minHeight`,c.minHeight,44,160,1,' px')}${fieldRange('INNENABSTAND X',`states.${s}.card.paddingX`,c.paddingX,2,32,1,' px')}${fieldRange('INNENABSTAND Y',`states.${s}.card.paddingY`,c.paddingY,2,32,1,' px')}${fieldRange('ABSTAND ELEMENTE',`states.${s}.card.gap`,c.gap,0,20,1,' px')}${fieldColor('AKTION VERLAUF START',`states.${s}.actions.start`,a.start)}${fieldColor('AKTION VERLAUF ENDE',`states.${s}.actions.end`,a.end)}${fieldRange('AKTION VERLAUF WINKEL',`states.${s}.actions.angle`,a.angle,0,360,1,'°')}${fieldColor('AKTION RAHMEN',`states.${s}.actions.border`,a.border)}${fieldRange('AKTION GRÖSSE',`states.${s}.actions.size`,a.size,24,52,1,' px')}${fieldRange('AKTION ABSTAND',`states.${s}.actions.gap`,a.gap,0,16,1,' px')}</div></div>`;}
  function elementPanelHtml(s,r){const e=cfg.states[s].elements[r];return `<div class="v464-state-element"><div class="theme-state-position-title-v460">TYPOGRAFIE · ${STATE_LABEL[s]} · ${ROLE_LABEL[r]}</div><div class="theme-grid-v458" style="margin-top:8px">${fieldRange('SCHRIFTGRÖSSE',`states.${s}.elements.${r}.fontSize`,e.fontSize,6,32,1,' px')}${fieldRange('SCHRIFTSTÄRKE',`states.${s}.elements.${r}.fontWeight`,e.fontWeight,300,950,50)}${fieldRange('ZEILENABSTAND',`states.${s}.elements.${r}.lineHeight`,e.lineHeight,.8,2,.05)}${fieldColor('SCHRIFTFARBE',`states.${s}.elements.${r}.color`,e.color)}</div></div>`;}
  function ensureFallbackSources(){const host=document.querySelector('.theme-preview-v458');if(!host)return false;for(const s of ['open','running']){if(host.querySelector(`[data-v464-preview-source="${s}"]`))continue;const running=s==='running';const card=document.createElement('div');card.className=`task ${s} theme-preview-card-v458`;card.dataset.v464PreviewSource=s;card.innerHTML=`<div class="task-number" data-theme-role="number">248</div><div class="status-symbol" data-theme-role="status">${running?'▶':'○'}</div><div class="task-content"><div class="task-text" data-theme-role="title">${running?'Wohnzimmer aufräumen':'Arbeitsflächen abwischen'}</div><div class="compact-flags" data-theme-role="flags"><span class="mini-flag">${running?'🔴':'🟡'}</span></div><span class="task-type-badge" data-theme-role="type">🔧 ARBEIT</span><div class="task-meta" data-theme-role="meta">${running?'AKTIV · 00:07:42':'OFFEN'}</div><div class="icon-actions" data-theme-role="actions"><button class="icon-action">${running?'⏸':'▶'}</button><button class="icon-action">✎</button></div></div>`;host.prepend(card);}return true;}
  function repairSticky(){if(typeof currentTab==='undefined'||currentTab!=='theme')return;applyStyles();ensureFallbackSources();const wrap=document.querySelector('#themeStickyPreviewV460 .theme-sticky-cardwrap-v460');if(wrap&&(wrap.textContent||'').includes('Vorschau wird aufgebaut')&&!previewRepairQueued){previewRepairQueued=true;setTimeout(()=>{previewRepairQueued=false;const s=state();window.__modUxCookingEditorV460?.setState?.(s);setTimeout(applyStyles,40);},20);}}
  function patchEditor(){if(typeof currentTab==='undefined'||currentTab!=='theme')return;const editor=document.querySelector('.theme-editor-v458');if(!editor)return;hideLegacyCardPanel();const s=state(),r=role();let cardPanel=editor.querySelector('.v464-state-card-panel');if(!cardPanel||cardPanel.dataset.state!==s){cardPanel?.remove();cardPanel=document.createElement('div');cardPanel.innerHTML=cardPanelHtml(s);const node=cardPanel.firstElementChild;node.dataset.state=s;const appPanel=[...editor.querySelectorAll('.theme-panel-v458')].find(p=>(p.querySelector('.theme-panel-title-v458')?.textContent||'').includes('APP-FARBEN'));appPanel?.after(node);bindFields(node);}
    const elementPanel=[...editor.querySelectorAll('.theme-panel-v458')].find(p=>(p.querySelector('.theme-panel-title-v458')?.textContent||'').includes('ELEMENT AUSWÄHLEN'));
    if(elementPanel){hideLegacyElementFields(elementPanel);let ep=elementPanel.querySelector('.v464-state-element');const key=`${s}:${r}`;if(!ep||ep.dataset.key!==key){ep?.remove();const box=document.createElement('div');box.innerHTML=elementPanelHtml(s,r);ep=box.firstElementChild;ep.dataset.key=key;const pos=elementPanel.querySelector('.theme-state-position-v460');if(pos)pos.before(ep);else elementPanel.appendChild(ep);bindFields(ep);}}
    repairSticky();
  }
  function schedulePatch(delay=30){clearTimeout(patchTimer);patchTimer=setTimeout(patchEditor,delay);}
  const baseRender=window.render;if(typeof baseRender==='function')window.render=function(){const out=baseRender.apply(this,arguments);schedulePatch();return out;};
  const baseSwitch=window.switchTab;if(typeof baseSwitch==='function')window.switchTab=function(){const out=baseSwitch.apply(this,arguments);schedulePatch(60);return out;};
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-sticky-state-v460],[data-theme-role-select],#themeStickyPreviewV460 [data-theme-role]'))schedulePatch(55);},true);
  document.addEventListener('input',e=>{if(e.target?.closest?.('.theme-editor-v458'))setTimeout(repairSticky,0);},true);
  window.addEventListener('load',()=>schedulePatch(120));
  applyStyles();schedulePatch();
  window.__modThemeStateDesignV464={version:BUILD_VERSION,storageKey:STORAGE_KEY,perState:true,actionGradient:true,gradientAngle:true,previewRepair:true,getConfig:()=>clone(cfg),apply:applyStyles,patch:patchEditor};
})();
