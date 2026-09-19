/* V537 · KISTOLOGY LIVE SNAPSHOT
   - Replaces preview boxes with the verified Mega-Sortierung snapshot copied into Master of Disaster Supabase.
   - Read-only: no Kistology inventory writes, no localStorage inventory persistence.
   - Keeps V535 visual language: shelf, pulled box, rummage cards, search and jump-to-box.
   - Source inventory IDs remain internal technical keys and are never rendered to the user.
*/
(function(){
  'use strict';
  if(window.__modKistologyV537)return;

  const VERSION='V537';
  const BODY_CLASS='mod-kistology-v535';
  const ROOT_ID='modKistologyV535';
  const RPC_NAME='kistology_snapshot_v1';

  let BOXES=[];
  let activeBoxId=null;
  let highlightedItemId=null;
  let query='';
  let observer=null;
  let captureInstalled=false;
  let hubPatched=false;
  let originalHubShow=null;
  let originalHubOpen=null;
  let originalHubHide=null;
  let loadPromise=null;
  let loadState='idle';
  let loadError='';
  let snapshotMeta={containers:0,items:0,loadedAt:null};

  function hubApi(){return window.__modAppHubV515||null;}
  function sportApi(){return window.__modSportModeV510||null;}
  function isOpen(){return document.body.classList.contains(BODY_CLASS);}
  function normalize(value){return String(value||'').toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}

  function allItems(){
    return BOXES.flatMap(box=>box.items.map(item=>({...item,boxId:box.id,boxCode:box.code,boxName:box.name})));
  }

  function categorySummary(items){
    const counts=new Map();
    items.forEach(item=>{
      const key=String(item.category||'').trim();
      if(key)counts.set(key,(counts.get(key)||0)+1);
    });
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de')).slice(0,3).map(([name])=>name);
  }

  function mapSnapshot(payload){
    const containers=Array.isArray(payload?.containers)?payload.containers:[];
    const items=Array.isArray(payload?.items)?payload.items:[];
    const grouped=new Map();
    items.forEach(row=>{
      const code=String(row?.container_code||'').trim();
      if(!code)return;
      if(!grouped.has(code))grouped.set(code,[]);
      grouped.get(code).push({
        id:String(row.source_id||''),
        name:String(row.designation||'Unbenannter Gegenstand'),
        category:String(row.category||'Ohne Kategorie'),
        section:String(row.section||'').trim(),
        status:String(row.status||'').trim(),
        details:row.details&&typeof row.details==='object'?row.details:{},
        verifiedAt:row.verified_at||null,
        updatedAt:row.updated_at||null
      });
    });

    const mapped=containers.map(row=>{
      const code=String(row?.code||'').trim();
      const boxItems=(grouped.get(code)||[]).sort((a,b)=>a.name.localeCompare(b.name,'de',{sensitivity:'base'}));
      return {
        id:code,
        code,
        name:String(row?.name||code||'Kiste'),
        containerType:String(row?.container_type||'').trim(),
        dimensions:String(row?.dimensions||'').trim(),
        notes:String(row?.notes||'').trim(),
        categories:categorySummary(boxItems),
        items:boxItems,
        updatedAt:row?.updated_at||null
      };
    }).filter(box=>box.id&&box.items.length>0);

    mapped.sort((a,b)=>a.code.localeCompare(b.code,'de',{numeric:true,sensitivity:'base'}));
    return mapped;
  }

  async function fetchSnapshot(){
    if(loadPromise)return loadPromise;
    loadState='loading';
    loadError='';
    renderContent();
    loadPromise=(async()=>{
      const client=typeof getSupabaseClient==='function'?getSupabaseClient():null;
      if(!client)throw new Error('Supabase-Client ist nicht verfügbar.');
      const sessionResult=await client.auth.getSession();
      if(sessionResult?.error)throw sessionResult.error;
      if(!sessionResult?.data?.session?.user?.id)throw new Error('Supabase-Login fehlt.');
      const result=await client.rpc(RPC_NAME);
      if(result?.error)throw result.error;
      const payload=result?.data;
      const boxes=mapSnapshot(payload);
      if(!boxes.length)throw new Error('Der Kistology-Snapshot enthält keine Kisten.');
      const itemCount=boxes.reduce((sum,box)=>sum+box.items.length,0);
      BOXES=boxes;
      snapshotMeta={containers:boxes.length,items:itemCount,loadedAt:new Date().toISOString()};
      loadState='ready';
      loadError='';
      return boxes;
    })().catch(error=>{
      loadState='error';
      loadError=error?.message||String(error||'Unbekannter Fehler');
      throw error;
    }).finally(()=>{
      loadPromise=null;
      if(isOpen())renderShell();
    });
    return loadPromise;
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
    root.setAttribute('aria-label','Kistology Inventar');
    const input=document.getElementById('inputPanel');
    app.insertBefore(root,input||null);
    renderShell();
    return root;
  }

  function boxCard(box){
    const secondary=[box.containerType,box.dimensions].filter(Boolean).join(' · ');
    const cats=box.categories.length?box.categories.join(' · '):'Gemischter Inhalt';
    return `<button type="button" class="mod-kistology-box-v535" data-kistology-box-v537="${esc(box.id)}" aria-label="${esc(box.code+' '+box.name)} öffnen">
      <span class="mod-kistology-box-handle-v535" aria-hidden="true"></span>
      <span class="mod-kistology-box-label-v535">
        <strong>${esc(box.code)}</strong>
        <small>${box.items.length} Gegenstände${secondary?` · ${esc(secondary)}`:''}</small>
        <span>${esc(box.name)}${cats?` · ${esc(cats)}`:''}</span>
      </span>
      <span class="mod-kistology-box-mark-v535">${esc(box.code)}</span>
    </button>`;
  }

  function sectionLabel(item){return item.section||'Hauptfach';}

  function itemCard(item,box,{highlight=false}={}){
    const meta=[item.category,item.status].filter(Boolean).join(' · ');
    return `<article class="mod-kistology-item-v535${highlight?' is-highlighted':''}" data-kistology-item-v537="${esc(item.id)}">
      <div class="mod-kistology-item-code-v535">${esc(sectionLabel(item))}</div>
      <div class="mod-kistology-item-main-v535">
        <h4>${esc(item.name)}</h4>
        <p>${esc(meta||'Ohne Kategorie')}</p>
        <small>${esc(box.code)} · ${esc(box.name)}${item.section?` · ${esc(item.section)}`:''}</small>
      </div>
      <span class="mod-kistology-item-arrow-v535" aria-hidden="true">›</span>
    </article>`;
  }

  function matchingItems(){
    const q=normalize(query.trim());
    if(!q)return [];
    return allItems().filter(item=>{
      const hay=normalize([
        item.name,item.category,item.section,item.status,item.boxCode,item.boxName
      ].join(' '));
      return hay.includes(q);
    });
  }

  function renderLoading(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v537]`);
    if(!content)return;
    content.innerHTML=`<section class="mod-kistology-regal-v535" data-kistology-view-v537="loading">
      <div class="mod-kistology-section-head-v535"><div><span>SUPABASE SNAPSHOT</span><strong>KISTEN WERDEN GELADEN</strong></div><small>NUR LESEN</small></div>
      <div class="mod-kistology-empty-v535">Echte Kisten werden aus dem Master-of-Disaster-Snapshot geladen …</div>
    </section>`;
  }

  function renderError(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v537]`);
    if(!content)return;
    content.innerHTML=`<section class="mod-kistology-regal-v535" data-kistology-view-v537="error">
      <div class="mod-kistology-section-head-v535"><div><span>SUPABASE SNAPSHOT</span><strong>NICHT VERFÜGBAR</strong></div><small>NICHTS VERÄNDERT</small></div>
      <div class="mod-kistology-empty-v535">${esc(loadError||'Kistology konnte den Snapshot nicht laden.')}</div>
      <button type="button" class="mod-kistology-back-v535" data-kistology-retry-v537>↻ ERNEUT LADEN</button>
    </section>`;
    content.querySelector('[data-kistology-retry-v537]')?.addEventListener('click',()=>{loadState='idle';fetchSnapshot().catch(()=>{});});
  }

  function renderShelf(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v537]`);
    if(!content)return;
    content.innerHTML=`
      <section class="mod-kistology-regal-v535" data-kistology-view-v537="regal">
        <div class="mod-kistology-section-head-v535"><div><span>REGALANSICHT</span><strong>${BOXES.length} KISTEN · ${snapshotMeta.items} GEGENSTÄNDE</strong></div><small>ECHTER SNAPSHOT</small></div>
        <div class="mod-kistology-shelf-v535">
          ${BOXES.map(boxCard).join('')}
        </div>
        <div class="mod-kistology-footnote-v535">GUTE DINGE HABEN IHREN PLATZ.</div>
      </section>`;
    content.querySelectorAll('[data-kistology-box-v537]').forEach(button=>button.addEventListener('click',()=>openBox(button.dataset.kistologyBoxV537)));
  }

  function renderBox(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v537]`);
    const box=BOXES.find(entry=>entry.id===activeBoxId);
    if(!content||!box){activeBoxId=null;renderShelf();return;}
    const boxMeta=[box.containerType,box.dimensions].filter(Boolean).join(' · ');
    content.innerHTML=`
      <section class="mod-kistology-openbox-v535" data-kistology-view-v537="box">
        <button type="button" class="mod-kistology-back-v535" data-kistology-back-v537>‹ REGAL</button>
        <div class="mod-kistology-pulled-box-wrap-v535">
          <div class="mod-kistology-pulled-box-v535">
            <span class="mod-kistology-box-handle-v535" aria-hidden="true"></span>
            <div><strong>${esc(box.code)} · ${esc(box.name)}</strong><small>${box.items.length} Gegenstände${boxMeta?` · ${esc(boxMeta)}`:''}</small><span>${esc(box.categories.join(' · ')||'Gemischter Inhalt')}</span></div>
            <b>${esc(box.code)}</b>
          </div>
        </div>
        <div class="mod-kistology-section-head-v535"><div><span>INHALT DER KISTE</span><strong>${box.items.length} EINTRÄGE</strong></div><small>DURCHWÜHLEN</small></div>
        <div class="mod-kistology-stack-v535">
          ${box.items.map(item=>itemCard(item,box,{highlight:item.id===highlightedItemId})).join('')}
        </div>
      </section>`;
    content.querySelector('[data-kistology-back-v537]')?.addEventListener('click',()=>{activeBoxId=null;highlightedItemId=null;renderShelf();});
    if(highlightedItemId){
      setTimeout(()=>{
        const target=content.querySelector(`[data-kistology-item-v537="${CSS.escape(highlightedItemId)}"]`);
        target?.scrollIntoView?.({block:'center',behavior:'smooth'});
      },120);
    }
  }

  function renderSearch(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v537]`);
    if(!content)return;
    const results=matchingItems();
    content.innerHTML=`
      <section class="mod-kistology-search-results-v535" data-kistology-view-v537="search">
        <div class="mod-kistology-section-head-v535"><div><span>SUCHERGEBNISSE</span><strong>${results.length} TREFFER</strong></div><small>„${esc(query)}“</small></div>
        <div class="mod-kistology-results-v535">
          ${results.length?results.map(item=>`<article class="mod-kistology-result-v535">
            <div class="mod-kistology-result-marker-v535"></div>
            <div class="mod-kistology-result-main-v535"><span>${esc(item.boxCode)}</span><h4>${esc(item.name)}</h4><p>${esc([item.category,item.status].filter(Boolean).join(' · ')||'Ohne Kategorie')}</p><small>${esc(item.boxCode)} · ${esc(item.boxName)}${item.section?` · ${esc(item.section)}`:''}</small></div>
            <button type="button" data-kistology-result-open-v537="${esc(item.id)}">Zur Kiste</button>
          </article>`).join(''):'<div class="mod-kistology-empty-v535">Nichts gefunden. Selbst das Chaos hat Grenzen.</div>'}
        </div>
      </section>`;
    content.querySelectorAll('[data-kistology-result-open-v537]').forEach(button=>button.addEventListener('click',()=>{
      const item=allItems().find(entry=>entry.id===button.dataset.kistologyResultOpenV537);
      if(item)openBox(item.boxId,item.id);
    }));
  }

  function renderContent(){
    if(loadState==='loading'||loadState==='idle')return renderLoading();
    if(loadState==='error')return renderError();
    if(query.trim())return renderSearch();
    if(activeBoxId)return renderBox();
    return renderShelf();
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
        <span class="mod-kistology-preview-v535">SNAPSHOT</span>
      </div>
      <div class="mod-kistology-searchbar-v535">
        <span aria-hidden="true"></span>
        <input type="search" data-kistology-search-v537 autocomplete="off" placeholder="Gegenstand, Kategorie oder Kiste suchen" aria-label="Kistology durchsuchen" ${loadState==='ready'?'':'disabled'}>
        <button type="button" data-kistology-clear-v537 aria-label="Suche löschen">×</button>
      </div>
      <div class="mod-kistology-content-v535" data-kistology-content-v537></div>
      <div class="mod-kistology-data-note-v535">V537 · SUPABASE-SNAPSHOT · NUR LESEN · QUELLE BLEIBT MEGA-SORTIERUNG</div>`;

    const input=root.querySelector('[data-kistology-search-v537]');
    input.value=query;
    input.addEventListener('input',()=>{
      query=input.value;
      activeBoxId=null;
      highlightedItemId=null;
      renderContent();
    });
    root.querySelector('[data-kistology-clear-v537]')?.addEventListener('click',()=>{
      query='';
      input.value='';
      activeBoxId=null;
      highlightedItemId=null;
      renderContent();
      if(!input.disabled)input.focus();
    });
    renderContent();
    return true;
  }

  function openBox(boxId,itemId=null){
    const box=BOXES.find(entry=>entry.id===boxId);
    if(!box)return false;
    activeBoxId=boxId;
    highlightedItemId=itemId;
    query='';
    const input=document.querySelector(`#${ROOT_ID} [data-kistology-search-v537]`);
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
    button.dataset.modKistologyActiveV537='true';
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
    renderShell();
    if(loadState==='idle'||loadState==='error')fetchSnapshot().catch(()=>{});
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
    hub.show=function(){if(isOpen())close();return originalHubShow(...arguments);};
    hub.open=function(target,options){if(target==='kistology')return open();if(isOpen())close();return originalHubOpen(target,options);};
    hub.kistologyActiveV537=true;
    hubPatched=true;
    return true;
  }

  function installCapture(){
    if(captureInstalled)return;
    captureInstalled=true;
    window.addEventListener('click',event=>{
      const launcherButton=event.target?.closest?.('[data-mod-hub-launch-v517="kistology"]');
      if(launcherButton){event.preventDefault();event.stopImmediatePropagation();open();return;}
      if(!isOpen())return;
      const sportButton=event.target?.closest?.('#sportSwitchV510');
      if(sportButton){event.preventDefault();event.stopImmediatePropagation();close();if(originalHubOpen)originalHubOpen('sport',{source:'switch'});}
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

  window.__modKistologyV537={
    version:VERSION,
    open,
    close,
    openBox,
    patchHub,
    patchLauncher,
    render:renderShell,
    reload:()=>{loadState='idle';BOXES=[];return fetchSnapshot();},
    isOpen,
    getSnapshotMeta:()=>({...snapshotMeta}),
    getBoxes:()=>BOXES.map(box=>({...box,items:box.items.map(item=>({...item}))})),
    readonlySnapshotV537:true,
    realSupabaseSnapshotV537:true,
    sourceInventoryIdsHiddenV537:true,
    noInventoryWritesV537:true,
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
