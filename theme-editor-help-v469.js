/* V469 · COMPLETE THEME EDITOR HELP
   Extends the V468 info system from the central palette to the full Theme/Scene editor.
   Help content is generated centrally from labels, control metadata and editor groups.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V469';
  let observer=null;
  let patching=false;

  const EXPLICIT={
    'MINDESTHÖHE':{zone:'card',what:'Legt die Mindesthöhe der Aufgabenkarte fest. Die Karte darf bei viel Inhalt weiterhin höher werden.',where:'Direkt an der Aufgabenkarte in der Live-Vorschau.'},
    'INNENABSTAND X':{zone:'card',what:'Bestimmt den horizontalen Innenabstand zwischen Kartenrand und Inhalt.',where:'Links und rechts innerhalb der Aufgabenkarte.'},
    'INNENABSTAND Y':{zone:'card',what:'Bestimmt den vertikalen Innenabstand zwischen Kartenrand und Inhalt.',where:'Oben und unten innerhalb der Aufgabenkarte.'},
    'ABSTAND ELEMENTE':{zone:'card',what:'Regelt den Grundabstand zwischen den Bestandteilen der Aufgabenkarte.',where:'Zwischen Nummer, Status, Titel, Meta und anderen Kartenelementen.'},
    'RAHMENDICKE':{zone:'cardBorder',what:'Stellt die Dicke des Kartenrahmens ein.',where:'Außenkante der Aufgabenkarte.'},
    'RUNDUNG':{zone:'card',what:'Ändert die Rundung der Kartenecken.',where:'An den vier Ecken der Aufgabenkarte.'},
    'SCHATTEN':{zone:'card',what:'Regelt die Stärke des Schattens unter der Aufgabenkarte.',where:'Außerhalb der Karte, vor allem unterhalb und seitlich.'},
    'VERLAUF START':{zone:'card',what:'Erste Farbe des Kartenverlaufs für den aktuell gewählten Zustand.',where:'Hintergrund der Aufgabenkarte.'},
    'VERLAUF ENDE':{zone:'card',what:'Zweite Farbe des Kartenverlaufs für den aktuell gewählten Zustand.',where:'Hintergrund der Aufgabenkarte.'},
    'KARTE VERLAUF WINKEL':{zone:'card',what:'Dreht die Richtung des Farbverlaufs der Aufgabenkarte.',where:'Der komplette Kartenhintergrund ändert seine Verlaufsrichtung.'},
    'KARTENRAHMEN':{zone:'cardBorder',what:'Legt die Rahmenfarbe der Aufgabenkarte fest.',where:'Außenkante der Aufgabenkarte.'},
    'SCHRIFTGRÖSSE':{zone:'selected',what:'Ändert die Schriftgröße des aktuell ausgewählten Objekts im gewählten Aufgabenzustand.',where:'Am markierten Element in der festen Live-Vorschau.'},
    'SCHRIFTSTÄRKE':{zone:'selected',what:'Regelt, wie dünn oder fett das aktuell ausgewählte Textelement dargestellt wird.',where:'Am markierten Textelement der Aufgabenkarte.'},
    'ZEILENABSTAND':{zone:'selected',what:'Verändert die Zeilenhöhe des aktuell ausgewählten Textelements.',where:'Bei mehrzeiligem Text innerhalb des markierten Elements.'},
    'SCHRIFTFARBE':{zone:'selected',what:'Ändert die Textfarbe des aktuell ausgewählten Objekts.',where:'Am markierten Element der Aufgabenkarte.'},
    'AKTIONSTASTEN GRÖSSE':{zone:'actions',what:'Ändert die Größe aller Aktionstasten im aktuell ausgewählten Aufgabenzustand.',where:'Bei den Aktionstasten rechts bzw. an ihrer gespeicherten Position in der Aufgabenkarte.'},
    'AKTIONSTASTEN ABSTAND':{zone:'actions',what:'Regelt den Abstand zwischen den Aktionstasten des aktuell gewählten Zustands.',where:'Zwischen den einzelnen Aktionstasten.'},
    'TASTE VERLAUF START':{zone:'actionOne',what:'Erste Verlaufsfarbe nur für die aktuell ausgewählte Aktionstaste.',where:'Hintergrund der markierten Aktionstaste.'},
    'TASTE VERLAUF ENDE':{zone:'actionOne',what:'Zweite Verlaufsfarbe nur für die aktuell ausgewählte Aktionstaste.',where:'Hintergrund der markierten Aktionstaste.'},
    'TASTE VERLAUF WINKEL':{zone:'actionOne',what:'Dreht den Farbverlauf nur der aktuell ausgewählten Aktionstaste.',where:'Hintergrund der markierten Aktionstaste.'},
    'TASTE RAHMEN':{zone:'actionOne',what:'Ändert die Rahmenfarbe nur der aktuell ausgewählten Aktionstaste.',where:'Außenkante der markierten Aktionstaste.'},
    'POSITION':{zone:'selected',what:'Legt fest, wo das ausgewählte Objekt innerhalb der Aufgabenkarte sitzt.',where:'In der Live-Vorschau innerhalb der aktuell ausgewählten Aufgabenkarte.'},
    'RASTER':{zone:'selected',what:'Bestimmt, um wie viele Pixel ein Druck auf einen Richtungspfeil das Objekt verschiebt.',where:'Wirkt beim Steuerkreuz für die Positionierung.'}
  };

  function inTheme(){return typeof currentTab!=='undefined'&&currentTab==='theme';}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function norm(s){return String(s||'').replace(/ⓘ/g,'').replace(/\s+/g,' ').trim().toUpperCase();}

  function infer(label,el){
    const l=norm(label);
    if(EXPLICIT[l])return {title:label,...EXPLICIT[l]};
    if(/MASTER DARK|GRAPHITE|BLUE NIGHT|FOREST/.test(l))return {title:label,zone:'theme',what:'Wendet dieses vollständige Farb-Preset an. Individuelle zustandsspezifische Verlaufsreste werden dabei bereinigt.',where:'Die Farbwelt der gesamten App und der Theme-Vorschau.'};
    if(l.includes('MEIN THEME SPEICHERN'))return {title:label,zone:'theme',what:'Speichert deinen kompletten aktuellen Theme-Stand inklusive Zustandsdesign, Positionen und einzelnen Aktionstasten.',where:'Lokaler Theme-Speicher dieser App.'};
    if(l.includes('MEIN THEME LADEN'))return {title:label,zone:'theme',what:'Lädt den zuletzt über „Mein Theme speichern“ gesicherten Komplettstand.',where:'Alle Theme-, Layout- und Aktionstasten-Einstellungen werden wiederhergestellt.'};
    if(l.includes('EXPORT'))return {title:label,zone:'theme',what:'Exportiert den kompletten Theme-Stand als JSON-Datei.',where:'Zum Sichern oder Übertragen deines Designs.'};
    if(l.includes('IMPORT'))return {title:label,zone:'theme',what:'Importiert einen zuvor exportierten vollständigen Theme-Stand.',where:'Ersetzt die aktuellen Theme-Einstellungen durch die importierten Werte.'};
    if(l.includes('STANDARD')||l==='RESET')return {title:label,zone:'theme',what:'Setzt Theme, Zustandsdesign, Positionen und individuelle Aktionstasten auf den App-Standard zurück.',where:'Der komplette Theme-/Scene-Editor wird auf Ausgangswerte gesetzt.'};
    if(/OFFEN|LÄUFT|PAUSIERT|KOCHEN|ERLEDIGT|ABGEBROCHEN/.test(l)&&el?.matches?.('[data-sticky-state-v460],[data-position-state-v460]'))return {title:label,zone:'state',what:'Wählt den Aufgabenzustand, den du gerade in der festen Vorschau und im Editor bearbeitest.',where:'Unten in der festen Live-Vorschau und in allen zustandsbezogenen Reglern.'};
    if(el?.matches?.('[data-theme-role-select]'))return {title:label,zone:'selected',what:'Wählt dieses Objekt innerhalb der Aufgabenkarte zum Bearbeiten aus. Typografie und Position beziehen sich danach genau auf dieses Element und diesen Zustand.',where:'Das entsprechende Element wird in der Live-Vorschau markiert.'};
    if(el?.matches?.('[data-v466-select]'))return {title:label,zone:'actionOne',what:'Wählt genau diese Aktionstaste aus. Verlauf, Rahmen und Position darunter gelten anschließend nur für diese Taste.',where:'Die entsprechende Taste in der Live-Vorschau.'};
    if(el?.matches?.('[data-v466-anchor],[data-anchor-v460]'))return {title:label,zone:'selected',what:'Verankert das ausgewählte Element an einer festen Kartenecke. Dadurch bleibt es auch bei einer anderen Kartenhöhe an dieser Ecke.',where:'Innerhalb der Aufgabenkarte, relativ zur gewählten Ecke.'};
    if(el?.matches?.('[data-move],[data-v466-dir]'))return {title:label||'Richtungspfeil',zone:'selected',what:'Verschiebt das ausgewählte Objekt um die aktuell eingestellte Rasterweite in diese Richtung.',where:'Direkt in der Live-Vorschau innerhalb der Aufgabenkarte.'};
    if(el?.matches?.('[data-grid-step]'))return {title:label,zone:'selected',what:'Stellt die Schrittweite für das Steuerkreuz ein. Kleine Werte erlauben feineres Positionieren.',where:'Wirkt auf jede Bewegung mit den Pfeiltasten.'};
    if(l==='OK'||l.includes('POSITION'))return {title:label||'Position übernehmen',zone:'selected',what:'Bestätigt bzw. speichert die aktuell eingestellte Position des ausgewählten Objekts.',where:'Die gespeicherte Position bleibt für den aktuellen Zustand erhalten.'};
    if(l.includes('OBEN LINKS')||l.includes('OBEN RECHTS')||l.includes('UNTEN LINKS')||l.includes('UNTEN RECHTS')||l==='FREI')return {title:label,zone:'selected',what:'Wählt die Art der Positionierung. „Frei“ nutzt X/Y-Versatz, eine Ecke hält das Objekt relativ zu dieser Kartenecke fest.',where:'Innerhalb der Aufgabenkarte.'};
    if(el?.matches?.('input[type="color"]'))return {title:label,zone:'selected',what:'Ändert die Farbe für diese Einstellung.',where:'Die Änderung ist direkt in der Live-Vorschau sichtbar.'};
    if(el?.matches?.('input[type="range"]'))return {title:label,zone:'selected',what:'Ändert den Zahlenwert dieser Einstellung. Der aktuelle Wert steht direkt neben der Bezeichnung.',where:'Die Änderung ist direkt in der Live-Vorschau sichtbar.'};
    return {title:label||'Bedienelement',zone:'theme',what:'Steuert diesen Teil des Theme-/Scene-Editors.',where:'Die Auswirkung siehst du direkt in der festen Live-Vorschau oder in der App-Oberfläche.'};
  }

  function mini(zone){
    const hit=z=>z===zone?' hit':'';
    return `<div class="theme-mini-v468 v469-mini"><div class="theme-mini-top-v468${hit('theme')}" data-v469-zone="theme">MASTER OF DISASTER</div><div class="theme-mini-tabs-v468"><div class="theme-mini-tab-v468 active${hit('state')}" data-v469-zone="state">ZUSTAND</div><div class="theme-mini-tab-v468">THEME</div></div><div class="theme-mini-panel-v468"><div class="theme-mini-next-v468${hit('selected')}" data-v469-zone="selected">AUSGEWÄHLTES OBJEKT</div><div class="theme-mini-card-v468${hit('card')}${hit('cardBorder')}" data-v469-zone="card"><div class="theme-mini-title-v468">Aufgabentitel</div><div class="theme-mini-muted-v468">META</div><div class="theme-mini-actions-v468${hit('actions')}" data-v469-zone="actions"><span class="theme-mini-action-v468${hit('actionOne')}" data-v469-zone="actionOne"></span><span class="theme-mini-action-v468 warn"></span><span class="theme-mini-action-v468 danger"></span></div></div></div></div>`;
  }

  function openHelp(info){
    document.getElementById('themeInfoBackdropV468')?.remove();
    const back=document.createElement('div');back.id='themeInfoBackdropV468';back.className='theme-info-backdrop-v468';
    back.innerHTML=`<div class="theme-info-card-v468" role="dialog" aria-modal="true"><div class="theme-info-head-v468"><div class="theme-info-title-v468">ⓘ ${esc(info.title)}</div><button type="button" class="theme-info-close-v468">×</button></div><div class="theme-info-text-v468">${esc(info.what)}</div><div class="theme-info-where-v468"><strong>Wo sehe ich das?</strong><br>${esc(info.where)}</div>${mini(info.zone)}</div>`;
    document.body.appendChild(back);const close=()=>back.remove();back.querySelector('.theme-info-close-v468')?.addEventListener('click',close);back.addEventListener('click',e=>{if(e.target===back)close();});
  }

  function addInfoButton(target,label){
    if(!target||target.dataset.v469Help==='1')return;
    const info=infer(label,target);const b=document.createElement('button');b.type='button';b.className='theme-info-v468 theme-info-v469';b.textContent='i';b.title=`Info: ${info.title}`;b.setAttribute('aria-label',`Info zu ${info.title}`);b.dataset.v469HelpButton='1';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openHelp(info);});
    target.dataset.v469Help='1';target.after(b);
  }

  function patchFields(){
    for(const field of document.querySelectorAll('.theme-editor-v458 .theme-field-v458')){
      const row=field.querySelector('.theme-label-v458');const labelNode=row?.querySelector('span');const input=field.querySelector('input,select,button');const label=labelNode?.textContent?.trim()||input?.getAttribute('aria-label')||'Einstellung';
      if(labelNode&&!row.querySelector('.theme-info-v469'))addInfoButton(labelNode,label);
    }
  }
  function patchToolbar(){
    document.querySelectorAll('.theme-editor-v458 .theme-toolbar-v458 > button').forEach(b=>{if(b.dataset.v469Help==='1')return;const label=b.textContent.trim();const wrap=document.createElement('span');wrap.className='v469-control-wrap';b.parentNode.insertBefore(wrap,b);wrap.appendChild(b);addInfoButton(b,label);});
  }
  function patchChoiceGroups(){
    const selectors='[data-sticky-state-v460],[data-position-state-v460],[data-theme-role-select],[data-v466-select],[data-v466-anchor],[data-anchor-v460],[data-grid-step],[data-move],[data-v466-dir],#themePositionOkV458,#themePositionZeroV458';
    document.querySelectorAll(`.theme-editor-v458 ${selectors},#themeStickyPreviewV460 ${selectors}`).forEach(b=>{
      if(b.dataset.v469Help==='1')return;const label=b.title||b.textContent.trim()||b.dataset.themeRoleSelect||b.dataset.move||b.dataset.v466Dir||'Bedienelement';
      const wrap=document.createElement('span');wrap.className='v469-control-wrap';b.parentNode?.insertBefore(wrap,b);wrap.appendChild(b);addInfoButton(b,label);
    });
  }
  function patchGroupHeadings(){
    document.querySelectorAll('.theme-editor-v458 .theme-panel-title-v458,.theme-editor-v458 .v468-action-common-title,.theme-editor-v458 .v468-action-individual-title,.theme-editor-v458 .theme-state-position-title-v460').forEach(h=>{
      if(h.dataset.v469Help==='1')return;const label=h.textContent.trim();if(!label)return;addInfoButton(h,label);
    });
  }

  function injectStyle(){
    if(document.getElementById('themeEditorHelpV469Style'))return;const s=document.createElement('style');s.id='themeEditorHelpV469Style';s.textContent=`
      .v469-control-wrap{display:inline-flex;align-items:center;gap:3px;vertical-align:middle;max-width:100%}.theme-toolbar-v458 .v469-control-wrap{margin:0 2px 2px 0}.v469-control-wrap>.theme-info-v469{margin-left:1px;flex:0 0 18px}.theme-label-v458>.theme-info-v469,.theme-panel-title-v458+.theme-info-v469,.v468-action-common-title+.theme-info-v469,.v468-action-individual-title+.theme-info-v469,.theme-state-position-title-v460+.theme-info-v469{margin-left:6px}.theme-panel-title-v458,.v468-action-common-title,.v468-action-individual-title,.theme-state-position-title-v460{display:inline-block}.v469-mini [data-v469-zone].hit{outline:2px solid #ffd166!important;outline-offset:2px;box-shadow:0 0 0 4px rgba(255,209,102,.18)!important}.theme-info-v469{position:relative;z-index:2}
    `;document.head.appendChild(s);
  }

  function patch(){
    if(!inTheme()||patching)return false;patching=true;try{injectStyle();patchFields();patchToolbar();patchChoiceGroups();patchGroupHeadings();return true;}finally{patching=false;}
  }
  function schedule(){setTimeout(patch,0);setTimeout(patch,80);setTimeout(patch,180);}
  const baseSwitch=window.switchTab;if(typeof baseSwitch==='function')window.switchTab=function(){const r=baseSwitch.apply(this,arguments);schedule();return r;};
  const baseRender=window.render;if(typeof baseRender==='function')window.render=function(){const r=baseRender.apply(this,arguments);if(inTheme())schedule();return r;};
  function observe(){observer?.disconnect();const host=document.getElementById('viewContainer');if(!host)return;observer=new MutationObserver(()=>{if(inTheme()&&!patching)schedule();});observer.observe(host,{childList:true,subtree:true});}
  window.addEventListener('load',()=>{observe();schedule();});observe();schedule();

  window.__modThemeEditorHelpV469={version:BUILD_VERSION,patch,completeHelp:true,infer};
})();
