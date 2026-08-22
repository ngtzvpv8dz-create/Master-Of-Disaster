/* V468 · THEME EDITOR POLISH
   - Theme presets return directly to THEME instead of visibly dumping the user into ALLE
   - central palette gets contextual info popups with a highlighted mini app schematic
   - duplicate group action-gradient controls are removed; size/gap live with the action-button editor
   - add-task button and next-task panel follow the dark theme language
   - root/overscroll background follows the central palette instead of exposing white iPhone bounce areas
*/
(function(){
  'use strict';
  const BUILD_VERSION='V468';
  const RETURN_THEME_KEY='modV468ReturnTheme';
  let wrapped=false;

  const INFO={
    'HINTERGRUND OBEN':{zone:'bgTop',title:'Hintergrund oben',text:'Der obere Teil des Seitenhintergrunds. Er liegt hinter Kopfbereich und Tabs und ist zugleich die Sicherheitsfarbe für den oberen iPhone-Rand.',where:'Ganz oben hinter „MASTER OF DISASTER“ und beim oberen Rand der Seite.'},
    'HINTERGRUND MITTE':{zone:'bgMid',title:'Hintergrund Mitte',text:'Die mittlere Farbe des Seitenverlaufs. Sie verbindet den oberen und unteren Hintergrund und bestimmt den größten Teil der freien Fläche.',where:'Im freien Seitenbereich zwischen den großen Inhaltsblöcken.'},
    'HINTERGRUND UNTEN':{zone:'bgBottom',title:'Hintergrund unten',text:'Die untere Farbe des Seitenverlaufs. Sie prägt das Ende langer Tabs und den Bereich unter dem letzten Inhalt.',where:'Am unteren Ende der scrollbaren Seite.'},
    'FLÄCHE':{zone:'surface',title:'Fläche',text:'Grundfarbe größerer Inhaltsflächen und Panels. Dazu gehören zum Beispiel Eingabebereich, Zusammenfassungen und Dialogflächen.',where:'Große rechteckige Blöcke, die auf dem Seitenhintergrund liegen.'},
    'FLÄCHE DUNKEL':{zone:'surface2',title:'Fläche dunkel',text:'Eine tiefere Innenfläche innerhalb von Panels. Sie wird vor allem für Eingabefelder und stärker abgesetzte Innenbereiche verwendet.',where:'Zum Beispiel das Feld „Was steht an?“ innerhalb des Eingabeblocks.'},
    'BEDIENELEMENTE':{zone:'control',title:'Bedienelemente',text:'Standard-Hintergrund für normale, nicht hervorgehobene Schaltflächen und Steuerelemente. Individuell gestaltete Aktionstasten in Aufgaben haben ihren eigenen Editor.',where:'Inaktive Tabs, Auswahlknöpfe und normale dunkle Buttons.'},
    'RAHMEN':{zone:'border',title:'Rahmen',text:'Allgemeine Rahmenfarbe für Panels, Eingaben und Standard-Steuerelemente. Aufgaben- und Aktionstasten können zusätzlich eigene Rahmen besitzen.',where:'Die feinen Linien rund um Panels, Eingabefelder und normale Buttons.'},
    'TEXT':{zone:'text',title:'Text',text:'Primäre Textfarbe der App. Sie wird für normale Überschriften, Inhalte und gut lesbare Haupttexte benutzt.',where:'Normale helle Texte innerhalb der App.'},
    'TEXT GEDÄMPFT':{zone:'muted',title:'Text gedämpft',text:'Sekundäre Textfarbe für Informationen, die sichtbar, aber weniger dominant sein sollen.',where:'Kleine Beschriftungen, Bereichstitel, Hinweise und Nebeninformationen.'},
    'AKZENT':{zone:'accent',title:'Akzent',text:'Hervorhebungsfarbe für besonders aktive oder ausgewählte UI-Zustände. Der „Aufgabe hinzufügen“-Button benutzt ab V468 bewusst nicht mehr diese helle Fläche.',where:'Vor allem der aktive Tab und andere gezielt hervorgehobene Standardzustände.'},
    'AKZENT-TEXT':{zone:'accentText',title:'Akzent-Text',text:'Textfarbe auf einer Akzentfläche. Sie sorgt dafür, dass Beschriftungen auf dem aktiven helleren Element lesbar bleiben.',where:'Text innerhalb eines hervorgehobenen Akzent-Elements, zum Beispiel im aktiven Tab.'},
    'ERFOLG / START':{zone:'success',title:'Erfolg / Start',text:'Farbe für positive bzw. Start-Zustände und Erfolgsmarkierungen, sofern das jeweilige Element nicht individuell überschrieben wurde.',where:'Positive Statuslinien und Start-/Erfolgshinweise.'},
    'PAUSE / WARNUNG':{zone:'warning',title:'Pause / Warnung',text:'Farbe für pausierte oder warnende Zustände. Sie dient als semantische Kennzeichnung, nicht als allgemeine Hintergrundfarbe.',where:'Pause- und Warnzustände sowie entsprechende Rahmen.'},
    'ABBRUCH / FEHLER':{zone:'danger',title:'Abbruch / Fehler',text:'Farbe für Abbruch, Fehler und gefährliche Aktionen. Sie markiert Dinge, bei denen Aufmerksamkeit sinnvoll ist.',where:'Abbruch- und Fehlerzustände sowie entsprechende Warnrahmen.'}
  };

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function inTheme(){return typeof currentTab!=='undefined'&&currentTab==='theme';}
  function markReturnTheme(){try{sessionStorage.setItem(RETURN_THEME_KEY,'1');}catch(_){}}
  function consumeReturnTheme(){try{if(sessionStorage.getItem(RETURN_THEME_KEY)!=='1')return false;sessionStorage.removeItem(RETURN_THEME_KEY);return true;}catch(_){return false;}}

  function injectStyle(){
    if(document.getElementById('themeEditorPolishV468Style'))return;
    const st=document.createElement('style');st.id='themeEditorPolishV468Style';st.textContent=`
      html{background:var(--mod-bg-top,#15191d)!important;overscroll-behavior-y:none!important}
      body{background-color:var(--mod-bg-top,#15191d)!important;overscroll-behavior-y:none!important;min-height:100dvh}
      .add-button{background:var(--mod-control,#101315)!important;color:var(--mod-text,#f3f3f3)!important;border:1px solid var(--mod-border,#30363b)!important;box-shadow:none!important}
      .next-task-panel{background:var(--mod-surface,#171b1f)!important;border:2px solid var(--mod-border,#30363b)!important;border-color:color-mix(in srgb,var(--mod-border,#30363b) 55%,var(--mod-text,#f3f3f3) 45%)!important;box-shadow:0 7px 18px rgba(0,0,0,.18)!important}
      .next-task-label{color:var(--mod-muted,#87949c)!important}.next-task-name,.next-task-status,.next-task-number{color:var(--mod-text,#f3f3f3)!important}
      .theme-info-v468{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-left:6px;padding:0;border:1px solid var(--mod-border,#30363b);border-radius:50%;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:10px;font-weight:950;line-height:1;vertical-align:middle;cursor:pointer}
      .theme-info-v468:active{transform:scale(.94)}
      .theme-info-backdrop-v468{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px}
      .theme-info-card-v468{width:min(430px,100%);max-height:min(760px,88dvh);overflow:auto;background:var(--mod-surface,#171b1f);color:var(--mod-text,#f3f3f3);border:1px solid var(--mod-border,#30363b);border-radius:16px;padding:15px;box-shadow:0 22px 55px rgba(0,0,0,.52)}
      .theme-info-head-v468{display:flex;align-items:center;justify-content:space-between;gap:10px}.theme-info-title-v468{font-size:16px;font-weight:950}.theme-info-close-v468{width:32px;height:32px;border:1px solid var(--mod-border);border-radius:9px;background:var(--mod-control);color:var(--mod-text);font-size:18px}
      .theme-info-text-v468{margin-top:10px;font-size:12px;line-height:1.5}.theme-info-where-v468{margin-top:8px;padding:8px 10px;border-radius:9px;background:var(--mod-surface2,#111416);font-size:11px;line-height:1.45;color:var(--mod-muted,#87949c)}
      .theme-mini-v468{position:relative;margin-top:13px;padding:8px;border:1px solid var(--mod-border);border-radius:12px;background:linear-gradient(180deg,var(--mod-bg-top) 0%,var(--mod-bg-mid) 50%,var(--mod-bg-bottom) 100%);overflow:hidden}
      .theme-mini-top-v468{height:28px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:950;color:var(--mod-text)}
      .theme-mini-tabs-v468{display:flex;gap:4px;padding:4px;border:1px solid var(--mod-border);border-radius:7px;background:var(--mod-control)}.theme-mini-tab-v468{padding:3px 6px;border-radius:5px;font-size:6px;color:var(--mod-muted)}.theme-mini-tab-v468.active{background:var(--mod-accent);color:var(--mod-accent-text)}
      .theme-mini-panel-v468{margin-top:6px;padding:7px;border:1px solid var(--mod-border);border-radius:8px;background:var(--mod-surface)}.theme-mini-input-v468{height:15px;border:1px solid var(--mod-border);border-radius:5px;background:var(--mod-surface2)}.theme-mini-add-v468{margin-top:5px;padding:4px;border:1px solid var(--mod-border);border-radius:5px;background:var(--mod-control);font-size:6px;text-align:center;color:var(--mod-text)}
      .theme-mini-next-v468{margin-top:6px;padding:6px;border:2px solid var(--mod-border);border-radius:8px;background:var(--mod-surface);font-size:6px;color:var(--mod-muted)}
      .theme-mini-card-v468{margin-top:6px;padding:6px;border:1px solid var(--mod-border);border-radius:8px;background:linear-gradient(135deg,var(--mod-card-start,#1c2125),var(--mod-card-end,#14181b));display:grid;grid-template-columns:1fr auto;gap:3px}.theme-mini-title-v468{font-size:7px;font-weight:900;color:var(--mod-text)}.theme-mini-muted-v468{font-size:5px;color:var(--mod-muted)}.theme-mini-actions-v468{grid-row:1/3;grid-column:2;display:flex;gap:3px;align-items:center}.theme-mini-action-v468{width:13px;height:13px;border:2px solid var(--mod-success);border-radius:4px;background:var(--mod-control)}.theme-mini-action-v468.warn{border-color:var(--mod-warning)}.theme-mini-action-v468.danger{border-color:var(--mod-danger)}
      .theme-mini-bottom-v468{height:16px;margin-top:4px}
      .theme-mini-v468 [data-v468-zone].hit{outline:2px solid #ffd166!important;outline-offset:2px;box-shadow:0 0 0 4px rgba(255,209,102,.18)!important}
      .v468-action-common{margin:9px 0 11px;padding:9px;border:1px solid var(--mod-border);border-radius:10px;background:var(--mod-surface2)}.v468-action-common-title,.v468-action-individual-title{font-size:8px;font-weight:950;letter-spacing:.8px;color:var(--mod-muted);margin-bottom:7px}.v468-action-common .theme-grid-v458{margin:0!important}
    `;document.head.appendChild(st);
  }

  function miniHtml(zone){
    const hit=z=>z===zone?' hit':'';
    return `<div class="theme-mini-v468" data-v468-zone="bgMid"><div class="theme-mini-top-v468${hit('bgTop')}" data-v468-zone="bgTop">MASTER OF DISASTER</div><div class="theme-mini-tabs-v468${hit('control')}" data-v468-zone="control"><div class="theme-mini-tab-v468 active${hit('accent')}" data-v468-zone="accent"><span class="${hit('accentText')}" data-v468-zone="accentText">HEUTE</span></div><div class="theme-mini-tab-v468">ALLE</div></div><div class="theme-mini-panel-v468${hit('surface')}${hit('border')}" data-v468-zone="surface"><div class="theme-mini-input-v468${hit('surface2')}" data-v468-zone="surface2"></div><div class="theme-mini-add-v468">+ AUFGABE HINZUFÜGEN</div></div><div class="theme-mini-next-v468">NÄCHSTE AUFGABE</div><div class="theme-mini-card-v468${hit('border')}" data-v468-zone="border"><div class="theme-mini-title-v468${hit('text')}" data-v468-zone="text">Aufgabentitel</div><div class="theme-mini-muted-v468${hit('muted')}" data-v468-zone="muted">ZEIT · META</div><div class="theme-mini-actions-v468"><span class="theme-mini-action-v468${hit('success')}" data-v468-zone="success"></span><span class="theme-mini-action-v468 warn${hit('warning')}" data-v468-zone="warning"></span><span class="theme-mini-action-v468 danger${hit('danger')}" data-v468-zone="danger"></span></div></div><div class="theme-mini-bottom-v468${hit('bgBottom')}" data-v468-zone="bgBottom"></div></div>`;
  }

  function closeInfo(){document.getElementById('themeInfoBackdropV468')?.remove();}
  function openInfo(label){
    const info=INFO[label];if(!info)return;
    closeInfo();
    const el=document.createElement('div');el.id='themeInfoBackdropV468';el.className='theme-info-backdrop-v468';el.innerHTML=`<div class="theme-info-card-v468" role="dialog" aria-modal="true" aria-label="${esc(info.title)}"><div class="theme-info-head-v468"><div class="theme-info-title-v468">ⓘ ${esc(info.title)}</div><button type="button" class="theme-info-close-v468" aria-label="Schließen">×</button></div><div class="theme-info-text-v468">${esc(info.text)}</div><div class="theme-info-where-v468"><strong>Wo sehe ich das?</strong><br>${esc(info.where)}</div>${miniHtml(info.zone)}</div>`;
    document.body.appendChild(el);el.querySelector('.theme-info-close-v468')?.addEventListener('click',closeInfo);el.addEventListener('click',e=>{if(e.target===el)closeInfo();});
  }

  function addPaletteHelp(){
    if(!inTheme())return;
    const panel=[...document.querySelectorAll('.theme-panel-v458')].find(p=>(p.querySelector('.theme-panel-title-v458')?.textContent||'').includes('APP-FARBEN · ZENTRALE PALETTE'));
    if(!panel)return;
    for(const field of panel.querySelectorAll('.theme-field-v458')){
      const row=field.querySelector('.theme-label-v458');const first=row?.querySelector('span');const label=(first?.textContent||'').trim();if(!INFO[label]||row.querySelector('.theme-info-v468'))continue;
      const b=document.createElement('button');b.type='button';b.className='theme-info-v468';b.textContent='i';b.title=`Info: ${label}`;b.setAttribute('aria-label',`Info zu ${label}`);b.dataset.v468Info=label;first.after(b);
    }
  }

  function unifyActionControls(){
    if(!inTheme())return;
    const statePanel=document.querySelector('.v464-state-card-panel');const actionPanel=document.querySelector('.v466-action-panel');if(!statePanel||!actionPanel)return;
    const title=actionPanel.querySelector('.theme-panel-title-v458');if(title)title.textContent=title.textContent.replace('AKTIONSTASTEN EINZELN','AKTIONSTASTEN');
    const labels={size:null,gap:null};
    for(const field of statePanel.querySelectorAll('.theme-field-v458')){
      const text=(field.querySelector('.theme-label-v458 span')?.textContent||'').trim();
      if(['AKTION VERLAUF START','AKTION VERLAUF ENDE','AKTION VERLAUF WINKEL','AKTION RAHMEN'].includes(text)){field.style.display='none';field.dataset.v468DuplicateAction='1';}
      if(text==='AKTION GRÖSSE')labels.size=field;
      if(text==='AKTION ABSTAND')labels.gap=field;
    }
    let common=actionPanel.querySelector('.v468-action-common');if(!common){common=document.createElement('div');common.className='v468-action-common';common.innerHTML='<div class="v468-action-common-title">GEMEINSAM FÜR ALLE AKTIONSTASTEN IN DIESEM ZUSTAND</div><div class="theme-grid-v458"></div>';const help=actionPanel.querySelector('.theme-help-v458');help?.after(common);}
    const grid=common.querySelector('.theme-grid-v458');
    for(const [key,field] of Object.entries(labels)){if(!field)continue;grid.querySelector(`[data-v468-moved="${key}"]`)?.remove();field.dataset.v468Moved=key;field.style.display='';grid.appendChild(field);}
    const select=actionPanel.querySelector('.theme-state-select-v460');if(select&&!actionPanel.querySelector('.v468-action-individual-title')){const h=document.createElement('div');h.className='v468-action-individual-title';h.textContent='EINZELNE TASTE AUSWÄHLEN UND GESTALTEN';select.before(h);}
  }

  function patchEditor(){injectStyle();if(!inTheme())return;addPaletteHelp();unifyActionControls();}

  function wrapV466(){
    const api=window.__modThemePackageActionsV466;if(!api||typeof api.patch!=='function')return false;if(api.__v468Wrapped)return true;
    const base=api.patch.bind(api);api.patch=function(){const out=base.apply(this,arguments);setTimeout(patchEditor,0);return out;};api.__v468Wrapped=true;wrapped=true;return true;
  }
  function ensureWrap(){if(!wrapV466())setTimeout(ensureWrap,60);else setTimeout(patchEditor,0);}

  document.addEventListener('click',e=>{const info=e.target?.closest?.('[data-v468-info]');if(info){e.preventDefault();e.stopPropagation();openInfo(info.dataset.v468Info);return;}if(e.target?.closest?.('[data-preset]'))markReturnTheme();},true);
  document.addEventListener('pointerdown',e=>{if(e.target?.closest?.('[data-preset],#themeResetV458,#themeLoadSnapshotV458'))markReturnTheme();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeInfo();});

  const returnToTheme=consumeReturnTheme();
  injectStyle();ensureWrap();
  if(returnToTheme){setTimeout(()=>{try{switchTab('theme');}catch(_){ }setTimeout(patchEditor,80);},0);}
  window.addEventListener('load',()=>{ensureWrap();setTimeout(patchEditor,120);});

  window.__modThemeEditorPolishV468={version:BUILD_VERSION,patch:patchEditor,openInfo,presetStaysTheme:true,paletteHelp:true,actionControlsUnified:true,rootBackground:true,addButtonDark:true,nextTaskUnified:true,get wrapped(){return wrapped;}};
})();
