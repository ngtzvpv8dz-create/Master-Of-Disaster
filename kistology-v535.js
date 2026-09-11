/* V535 · KISTOLOGY PREVIEW
   - Aktiviert KISTOLOGY als eigenen App-Bereich.
   - Eigener Magenta-/Lagerstil, Regalansicht, Kiste öffnen, Fundkarten und Suche.
   - Nutzt ausschließlich eingebaute Vorschau-Daten; keine localStorage-/Cloud-/Inventardaten werden verändert.
*/
(function(){
  'use strict';
  if(window.__modKistologyV535)return;

  const VERSION='V535';
  const BODY_CLASS='mod-kistology-v535';
  const ROOT_ID='modKistologyV535';

  const BOXES=[
    {id:'box-01',label:'KISTE 01',row:'Reihe 1',categories:['Camping','Technik'],items:[
      {id:'DEMO-01',name:'Schwarze Kabelbinder',category:'Technik',detail:'Befestigung'},
      {id:'DEMO-02',name:'Graues Panzer-/Gewebeband',category:'Werkzeug',detail:'Kleben',aliases:['Panzerband','Gewebeband']},
      {id:'DEMO-03',name:'USB-C-Ladegerät 65 W',category:'Technik',detail:'Stromversorgung'},
      {id:'DEMO-04',name:'Karabinerhaken (Set)',category:'Camping',detail:'Outdoor'}
    ]},
    {id:'box-02',label:'KISTE 02',row:'Reihe 1',categories:['Werkzeug','Material'],items:[
      {id:'DEMO-05',name:'Bit-Set kompakt',category:'Werkzeug',detail:'Schrauben'},
      {id:'DEMO-06',name:'Schwarzes Gewebeband',category:'Werkzeug',detail:'Kleben',aliases:['Tape']},
      {id:'DEMO-07',name:'Maßband 5 m',category:'Werkzeug',detail:'Messen'}
    ]},
    {id:'box-03',label:'KISTE 03',row:'Reihe 2',categories:['Elektronik','Kabel'],items:[
      {id:'DEMO-08',name:'HDMI-Kabel',category:'Elektronik',detail:'Kabel'},
      {id:'DEMO-09',name:'USB-C-Kabel',category:'Elektronik',detail:'Kabel'},
      {id:'DEMO-10',name:'USB-Netzteil',category:'Elektronik',detail:'Stromversorgung'}
    ]},
    {id:'box-04',label:'KISTE 04',row:'Reihe 2',categories:['Haushalt','Freizeit'],items:[
      {id:'DEMO-11',name:'Taschenlampe',category:'Freizeit',detail:'Licht'},
      {id:'DEMO-12',name:'AA-Batterien',category:'Haushalt',detail:'Energie'},
      {id:'DEMO-13',name:'Multitool',category:'Freizeit',detail:'Werkzeug'}
    ]},
    {id:'box-05',label:'KISTE 05',row:'Reihe 3',categories:['Outdoor','Camping'],items:[
      {id:'DEMO-14',name:'Stirnlampe',category:'Camping',detail:'Licht'},
      {id:'DEMO-15',name:'Packsack',category:'Outdoor',detail:'Transport'},
      {id:'DEMO-16',name:'Spanngurt',category:'Outdoor',detail:'Befestigung'}
    ]},
    {id:'box-06',label:'KISTE 06',row:'Reihe 3',categories:['Ersatzteile','Sonstiges'],items:[
      {id:'DEMO-17',name:'Adapter-Set',category:'Ersatzteile',detail:'Adapter'},
      {id:'DEMO-18',name:'Kleinteilebox',category:'Sonstiges',detail:'Aufbewahrung',status:'Noch prüfen'},
      {id:'DEMO-19',name:'Ersatzkabel',category:'Ersatzteile',detail:'Kabel'}
    ]}
  ];

  let activeBoxId=null;
  let highlightedItemId=null;
  let query='';
  let activeFilter='Alle';
  let observer=null;
  let captureInstalled=false;
  let hubPatched=false;
  let originalHubShow=null;
  let originalHubOpen=null;
  let originalHubHide=null;

  function hubApi(){return window.__modAppHubV515||null;}
  function sportApi(){return window.__modSportModeV510||null;}
  function isOpen(){return document.body.classList.contains(BODY_CLASS);}
  function normalize(value){return String(value||'').toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

  function allItems(){
    return BOXES.flatMap(box=>box.items.map(item=>({...item,boxId:box.id,boxLabel:box.label,row:box.row,categories:box.categories})));
  }

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(root)return root;
    const app=document.querySelector('.app');
    if(!app)return null;
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='mod-kistology-shell-v535';
    root.hidden=true;
    root.setAttribute('aria-label','Kistology Inventar Vorschau');
    const input=document.getElementById('inputPanel');
    app.insertBefore(root,input||null);
    renderShell();
    return root;
  }

  function boxCard(box){
    const pending=box.items.filter(item=>item.status==='Noch prüfen').length;
    return `<button type="button" class="mod-kistology-box-v535" data-kistology-box-v535="${box.id}" aria-label="${box.label} öffnen">
      <span class="mod-kistology-box-handle-v535" aria-hidden="true"></span>
      <span class="mod-kistology-box-label-v535">
        <strong>${box.label}</strong>
        <small>${box.row} · ${box.items.length} Gegenstände${pending?` · ${pending} prüfen`:''}</small>
        <span>${box.categories.join(' · ')}</span>
      </span>
      <span class="mod-kistology-box-mark-v535">${box.row.replace('Reihe ','R')}</span>
    </button>`;
  }

  function itemCard(item,{highlight=false}={}){
    return `<article class="mod-kistology-item-v535${highlight?' is-highlighted':''}" data-kistology-item-v535="${item.id}">
      <div class="mod-kistology-item-code-v535">${item.id}</div>
      <div class="mod-kistology-item-main-v535">
        <h4>${item.name}</h4>
        <p>${item.category} · ${item.detail}${item.status?` · ${item.status}`:''}</p>
        <small>${item.boxLabel||''}${item.row?` · ${item.row}`:''}</small>
      </div>
      <span class="mod-kistology-item-arrow-v535" aria-hidden="true">›</span>
    </article>`;
  }

  function matchesFilter(item,filter){
    if(filter==='Alle')return true;
    if(item.status===filter)return true;
    return item.category===filter||item.categories.includes(filter);
  }

  function matchingItems(){
    const q=normalize(query.trim());
    const filter=activeFilter;
    return allItems().filter(item=>{
      if(!matchesFilter(item,filter))return false;
      if(!q)return true;
      const hay=normalize([
        item.id,item.name,item.category,item.detail,item.status||'',item.boxLabel,item.row,
        item.categories.join(' '),(item.aliases||[]).join(' ')
      ].join(' '));
      return hay.includes(q);
    });
  }

  function filteredBoxes(){
    if(activeFilter==='Alle')return BOXES;
    return BOXES.filter(box=>box.items.some(item=>matchesFilter({...item,categories:box.categories},activeFilter)));
  }

  function renderShelf(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v535]`);
    if(!content)return;
    const boxes=filteredBoxes();
    content.innerHTML=`
      <section class="mod-kistology-regal-v535" data-kistology-view-v535="regal">
        <div class="mod-kistology-section-head-v535"><div><span>REGALANSICHT</span><strong>${boxes.length} KISTEN</strong></div><small>VORSCHAU-DATEN</small></div>
        <div class="mod-kistology-shelf-v535">
          ${boxes.map(boxCard).join('')}
        </div>
        <div class="mod-kistology-footnote-v535">GUTE DINGE HABEN IHREN PLATZ.</div>
      </section>`;
    content.querySelectorAll('[data-kistology-box-v535]').forEach(button=>button.addEventListener('click',()=>openBox(button.dataset.kistologyBoxV535)));
  }

  function renderBox(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v535]`);
    const box=BOXES.find(entry=>entry.id===activeBoxId);
    if(!content||!box){activeBoxId=null;renderShelf();return;}
    content.innerHTML=`
      <section class="mod-kistology-openbox-v535" data-kistology-view-v535="box">
        <button type="button" class="mod-kistology-back-v535" data-kistology-back-v535>‹ REGAL</button>
        <div class="mod-kistology-pulled-box-wrap-v535">
          <div class="mod-kistology-pulled-box-v535">
            <span class="mod-kistology-box-handle-v535" aria-hidden="true"></span>
            <div><strong>${box.label}</strong><small>${box.row} · ${box.items.length} Gegenstände</small><span>${box.categories.join(' · ')}</span></div>
            <b>${box.row.replace('Reihe ','R')}</b>
          </div>
        </div>
        <div class="mod-kistology-section-head-v535"><div><span>INHALT DER KISTE</span><strong>${box.items.length} EINTRÄGE</strong></div><small>DURCHWÜHLEN</small></div>
        <div class="mod-kistology-stack-v535">
          ${box.items.map(item=>itemCard({...item,boxLabel:box.label,row:box.row},{highlight:item.id===highlightedItemId})).join('')}
        </div>
      </section>`;
    content.querySelector('[data-kistology-back-v535]')?.addEventListener('click',()=>{activeBoxId=null;highlightedItemId=null;renderShelf();});
    if(highlightedItemId){
      setTimeout(()=>{
        const target=content.querySelector(`[data-kistology-item-v535="${highlightedItemId}"]`);
        target?.scrollIntoView?.({block:'center',behavior:'smooth'});
      },120);
    }
  }

  function renderSearch(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v535]`);
    if(!content)return;
    const results=matchingItems();
    content.innerHTML=`
      <section class="mod-kistology-search-results-v535" data-kistology-view-v535="search">
        <div class="mod-kistology-section-head-v535"><div><span>SUCHERGEBNISSE</span><strong>${results.length} TREFFER</strong></div><small>${query?`„${query}“`:'ALLE'}</small></div>
        <div class="mod-kistology-results-v535">
          ${results.length?results.map(item=>`<article class="mod-kistology-result-v535">
            <div class="mod-kistology-result-marker-v535"></div>
            <div class="mod-kistology-result-main-v535"><span>${item.id}</span><h4>${item.name}</h4><p>${item.category} · ${item.detail}${item.status?` · ${item.status}`:''}</p><small>${item.boxLabel} · ${item.row}</small></div>
            <button type="button" data-kistology-result-open-v535="${item.id}">Zur Kiste</button>
          </article>`).join(''):'<div class="mod-kistology-empty-v535">Nichts gefunden. Selbst das Chaos hat Grenzen.</div>'}
        </div>
      </section>`;
    content.querySelectorAll('[data-kistology-result-open-v535]').forEach(button=>button.addEventListener('click',()=>{
      const item=allItems().find(entry=>entry.id===button.dataset.kistologyResultOpenV535);
      if(item)openBox(item.boxId,item.id);
    }));
  }

  function renderContent(){
    if(query.trim())return renderSearch();
    if(activeBoxId)return renderBox();
    return renderShelf();
  }

  function syncFilters(){
    document.querySelectorAll(`#${ROOT_ID} [data-kistology-filter-v535]`).forEach(button=>{
      const active=button.dataset.kistologyFilterV535===activeFilter;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
  }

  function renderShell(){
    const root=document.getElementById(ROOT_ID);
    if(!root)return false;
    root.innerHTML=`
      <div class="mod-kistology-head-v535">
        <div class="mod-kistology-brand-v535">
          <div class="mod-kistology-kicker-v535">MASTER OF DISASTER // INVENTAR</div>
          <h2>KISTOLOGY</h2>
          <p>Inventar · Lagerorte · Fundstücke</p>
        </div>
        <span class="mod-kistology-preview-v535">PREVIEW</span>
      </div>
      <div class="mod-kistology-searchbar-v535">
        <span aria-hidden="true"></span>
        <input type="search" data-kistology-search-v535 autocomplete="off" placeholder="Nach Gegenstand, Inventarnr. oder Lagerort suchen" aria-label="Kistology durchsuchen">
        <button type="button" data-kistology-clear-v535 aria-label="Suche löschen">×</button>
      </div>
      <div class="mod-kistology-filters-v535" role="group" aria-label="Kistology Filter">
        ${['Alle','Camping','Werkzeug','Technik','Noch prüfen'].map(label=>`<button type="button" data-kistology-filter-v535="${label}" aria-pressed="${label==='Alle'?'true':'false'}">${label}</button>`).join('')}
      </div>
      <div class="mod-kistology-content-v535" data-kistology-content-v535></div>
      <div class="mod-kistology-data-note-v535">V535 · INTERAKTIVE VORSCHAU · KEINE ECHTEN INVENTARDATEN VERÄNDERT</div>`;

    const input=root.querySelector('[data-kistology-search-v535]');
    input.value=query;
    input.addEventListener('input',()=>{
      query=input.value;
      activeBoxId=null;
      highlightedItemId=null;
      renderContent();
    });
    root.querySelector('[data-kistology-clear-v535]')?.addEventListener('click',()=>{
      query='';
      input.value='';
      activeBoxId=null;
      highlightedItemId=null;
      renderContent();
      input.focus();
    });
    root.querySelectorAll('[data-kistology-filter-v535]').forEach(button=>button.addEventListener('click',()=>{
      activeFilter=button.dataset.kistologyFilterV535;
      activeBoxId=null;
      highlightedItemId=null;
      syncFilters();
      renderContent();
    }));
    syncFilters();
    renderContent();
    return true;
  }

  function openBox(boxId,itemId=null){
    const box=BOXES.find(entry=>entry.id===boxId);
    if(!box)return false;
    activeBoxId=boxId;
    highlightedItemId=itemId;
    query='';
    const input=document.querySelector(`#${ROOT_ID} [data-kistology-search-v535]`);
    if(input)input.value='';
    renderBox();
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return true;
  }

  function patchLauncher(){
    const button=document.querySelector('[data-mod-hub-launch-v517="kistology"]');
    if(!button)return false;
    button.removeAttribute('aria-disabled');
    button.setAttribute('aria-label','Kistology öffnen');
    button.dataset.modKistologyActiveV535='true';
    return true;
  }

  function close(){
    if(!isOpen())return false;
    document.body.classList.remove(BODY_CLASS);
    const root=document.getElementById(ROOT_ID);
    if(root){root.hidden=true;root.setAttribute('aria-hidden','true');}
    activeBoxId=null;
    highlightedItemId=null;
    query='';
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return true;
  }

  function open(){
    ensureRoot();
    try{window.__modBackstageV531?.close?.({restoreTodo:false});}catch(_){}
    try{originalHubHide?.();}catch(_){try{hubApi()?.hide?.();}catch(__){}}
    try{sportApi()?.setMode?.('todo',{persist:false,animate:false});}catch(_){}
    document.body.classList.add(BODY_CLASS);
    document.body.dataset.modAppSurfaceV515='kistology';
    const root=document.getElementById(ROOT_ID);
    if(root){root.hidden=false;root.setAttribute('aria-hidden','false');}
    activeBoxId=null;
    highlightedItemId=null;
    query='';
    activeFilter='Alle';
    renderShell();
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    try{window.scrollTo?.({top:0,left:0,behavior:'instant'});}catch(_){try{window.scrollTo?.(0,0);}catch(__){}}
    return 'kistology';
  }

  function patchHub(){
    const hub=hubApi();
    if(!hub||hubPatched)return false;
    originalHubShow=hub.show?.bind(hub)||null;
    originalHubOpen=hub.open?.bind(hub)||null;
    originalHubHide=hub.hide?.bind(hub)||null;
    if(!originalHubShow||!originalHubOpen||!originalHubHide)return false;

    hub.show=function(){
      if(isOpen())close();
      return originalHubShow(...arguments);
    };
    hub.open=function(target,options){
      if(target==='kistology')return open();
      if(isOpen())close();
      return originalHubOpen(target,options);
    };
    hub.kistologyActiveV535=true;
    hubPatched=true;
    return true;
  }

  function installCapture(){
    if(captureInstalled)return;
    captureInstalled=true;
    window.addEventListener('click',event=>{
      const launcherButton=event.target?.closest?.('[data-mod-hub-launch-v517="kistology"]');
      if(launcherButton){
        event.preventDefault();
        event.stopImmediatePropagation();
        open();
        return;
      }
      if(!isOpen())return;
      const sportButton=event.target?.closest?.('#sportSwitchV510');
      if(sportButton){
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
        if(originalHubOpen)originalHubOpen('sport',{source:'switch'});
      }
    },true);
  }

  function observeLauncher(){
    if(observer)return;
    observer=new MutationObserver(()=>patchLauncher());
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  function init(){
    ensureRoot();
    patchHub();
    patchLauncher();
    installCapture();
    observeLauncher();
    return !!hubApi();
  }

  window.__modKistologyV535={
    version:VERSION,
    open,
    close,
    openBox,
    patchHub,
    patchLauncher,
    render:renderShell,
    isOpen,
    previewBoxes:BOXES,
    previewOnly:true,
    searchWorksV535:true,
    searchAliasesV535:true,
    statusFilterV535:true,
    shelfViewV535:true,
    pulledBoxV535:true,
    jumpToBoxV535:true,
    inventoryPersistenceUntouched:true,
    todoDataUntouched:true,
    sportHealthHookPreserved:true,
    homeNavigationPreserved:true
  };

  let tries=0;
  const timer=setInterval(()=>{tries++;if(init()||tries>240)clearInterval(timer);},60);
  if(document.readyState!=='loading')setTimeout(init,0);
  else document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  window.addEventListener('load',()=>setTimeout(init,220),{once:true});
})();
