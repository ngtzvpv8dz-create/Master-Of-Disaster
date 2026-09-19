/* V539 · KISTOLOGY RUMMAGE CARDS
   - Keeps the authenticated read-only V537/V538 Supabase snapshot.
   - Shelf cards prioritize real box names and a prominent single box-code badge.
   - Container type/dimensions stay hidden from normal UI.
   - Exact assigned categories remain source-driven; shelf shows one category or a count.
   - Item cards expand inline with a lift/reveal interaction; no separate item detail page.
   - Search still matches object designation only and jumps to the box with the matching item expanded.
   - Source inventory IDs remain hidden technical keys. No inventory writes.
*/
(function(){
  'use strict';
  if(window.__modKistologyV539)return;

  const VERSION='V539';
  const BODY_CLASS='mod-kistology-v535';
  const ROOT_ID='modKistologyV535';
  const RPC_NAME='kistology_snapshot_v1';

  let BOXES=[];
  let activeBoxId=null;
  let expandedItemId=null;
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

  function distinctCategories(items){
    return [...new Set(items.map(item=>String(item.category||'').trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
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
        name:String(row.designation||'Unbenannter Gegenstand').trim(),
        category:String(row.category||'').trim(),
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
        name:String(row?.name||'').trim(),
        containerType:String(row?.container_type||'').trim(),
        dimensions:String(row?.dimensions||'').trim(),
        notes:String(row?.notes||'').trim(),
        categories:distinctCategories(boxItems),
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
      const boxes=mapSnapshot(result?.data);
      if(!boxes.length)throw new Error('Der Kistology-Snapshot enthält keine Kisten.');
      BOXES=boxes;
      snapshotMeta={containers:boxes.length,items:boxes.reduce((sum,box)=>sum+box.items.length,0),loadedAt:new Date().toISOString()};
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
    app.insertBefore(root,document.getElementById('inputPanel')||null);
    renderShell();
    return root;
  }

  function shelfCategoryLabel(box){
    if(box.categories.length===1)return box.categories[0];
    if(box.categories.length>1)return `${box.categories.length} Kategorien`;
    return 'Keine Kategorie';
  }

  function boxCard(box){
    const name=box.name?`<strong class="mod-kistology-box-name-v539">${esc(box.name)}</strong>`:'<span class="mod-kistology-box-name-v539 is-empty" aria-hidden="true"></span>';
    return `<button type="button" class="mod-kistology-box-v535 mod-kistology-box-v539" data-kistology-box-v539="${esc(box.id)}" aria-label="${esc((box.name?box.name+' · ':'')+box.code)} öffnen">
      <span class="mod-kistology-box-handle-v535" aria-hidden="true"></span>
      <span class="mod-kistology-box-head-v539">${name}<span class="mod-kistology-box-code-v539">${esc(box.code)}</span></span>
      <span class="mod-kistology-box-count-v539">${box.items.length} Gegenstände</span>
      <span class="mod-kistology-box-category-v539">${esc(shelfCategoryLabel(box))}</span>
    </button>`;
  }

  function categoryChips(box){
    if(!box.categories.length)return '<span class="mod-kistology-category-chip-v539 is-muted">Keine Kategorie</span>';
    return box.categories.map(category=>`<span class="mod-kistology-category-chip-v539">${esc(category)}</span>`).join('');
  }

  function sectionLabel(item){return item.section||'Hauptfach';}

  function inlineDetailRow(label,value){
    return value?`<div class="mod-kistology-inline-detail-row-v539"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`:'';
  }

  function itemCard(item,{expanded=false}={}){
    const status=item.status||'Status offen';
    return `<article class="mod-kistology-item-v535 mod-kistology-item-card-v539${expanded?' is-expanded':''}" data-kistology-item-v539="${esc(item.id)}">
      <button type="button" class="mod-kistology-item-toggle-v539" data-kistology-item-toggle-v539="${esc(item.id)}" aria-expanded="${expanded?'true':'false'}">
        <span class="mod-kistology-item-code-v535 mod-kistology-section-badge-v539">${esc(sectionLabel(item))}</span>
        <span class="mod-kistology-item-main-v535 mod-kistology-item-main-v539">
          <h4>${esc(item.name)}</h4>
          <p class="mod-kistology-item-status-v539">${esc(status)}</p>
        </span>
        <span class="mod-kistology-item-arrow-v535 mod-kistology-item-arrow-v539" aria-hidden="true">›</span>
      </button>
      <div class="mod-kistology-item-details-wrap-v539" aria-hidden="${expanded?'false':'true'}">
        <div class="mod-kistology-item-details-v539">
          ${inlineDetailRow('Kategorie',item.category||'Keine Kategorie')}
          ${inlineDetailRow('Status',status)}
        </div>
      </div>
    </article>`;
  }

  function matchingItems(){
    const q=normalize(query.trim());
    if(!q)return [];
    return allItems().filter(item=>normalize(item.name).includes(q));
  }

  function findItem(itemId){return allItems().find(item=>item.id===itemId)||null;}
  function findBox(boxId){return BOXES.find(box=>box.id===boxId)||null;}

  function renderLoading(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v539]`);
    if(!content)return;
    content.innerHTML=`<section class="mod-kistology-regal-v535" data-kistology-view-v539="loading"><div class="mod-kistology-section-head-v535"><div><span>SUPABASE SNAPSHOT</span><strong>KISTEN WERDEN GELADEN</strong></div><small>NUR LESEN</small></div><div class="mod-kistology-empty-v535">Echte Kisten werden geladen …</div></section>`;
  }

  function renderError(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v539]`);
    if(!content)return;
    content.innerHTML=`<section class="mod-kistology-regal-v535" data-kistology-view-v539="error"><div class="mod-kistology-section-head-v535"><div><span>SUPABASE SNAPSHOT</span><strong>NICHT VERFÜGBAR</strong></div><small>NICHTS VERÄNDERT</small></div><div class="mod-kistology-empty-v535">${esc(loadError||'Kistology konnte den Snapshot nicht laden.')}</div><button type="button" class="mod-kistology-back-v535" data-kistology-retry-v539>↻ ERNEUT LADEN</button></section>`;
    content.querySelector('[data-kistology-retry-v539]')?.addEventListener('click',()=>{loadState='idle';fetchSnapshot().catch(()=>{});});
  }

  function renderShelf(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v539]`);
    if(!content)return;
    expandedItemId=null;
    content.innerHTML=`<section class="mod-kistology-regal-v535" data-kistology-view-v539="regal">
      <div class="mod-kistology-section-head-v535"><div><span>REGALANSICHT</span><strong>${BOXES.length} KISTEN · ${snapshotMeta.items} GEGENSTÄNDE</strong></div><small>ECHTER SNAPSHOT</small></div>
      <div class="mod-kistology-shelf-v535">${BOXES.map(boxCard).join('')}</div>
      <div class="mod-kistology-footnote-v535">GUTE DINGE HABEN IHREN PLATZ.</div>
    </section>`;
    content.querySelectorAll('[data-kistology-box-v539]').forEach(button=>button.addEventListener('click',()=>openBox(button.dataset.kistologyBoxV539)));
  }

  function syncExpandedDom({scroll=false}={}){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v539]`);
    if(!content)return;
    const cards=[...content.querySelectorAll('[data-kistology-item-v539]')];
    const expandedIndex=expandedItemId?cards.findIndex(card=>card.dataset.kistologyItemV539===expandedItemId):-1;
    const stack=content.querySelector('.mod-kistology-stack-v539');
    stack?.classList.toggle('has-expanded',expandedIndex>=0);
    cards.forEach((card,index)=>{
      const expanded=index===expandedIndex;
      card.classList.toggle('is-expanded',expanded);
      card.classList.toggle('is-above-expanded',expandedIndex>=0&&index<expandedIndex);
      card.classList.toggle('is-below-expanded',expandedIndex>=0&&index>expandedIndex);
      const toggle=card.querySelector('[data-kistology-item-toggle-v539]');
      const details=card.querySelector('.mod-kistology-item-details-wrap-v539');
      toggle?.setAttribute('aria-expanded',expanded?'true':'false');
      details?.setAttribute('aria-hidden',expanded?'false':'true');
    });
    if(scroll&&expandedIndex>=0){
      const target=cards[expandedIndex];
      setTimeout(()=>target?.scrollIntoView?.({block:'center',behavior:'smooth'}),220);
    }
  }

  function toggleItem(itemId){
    const item=findItem(itemId);
    if(!item||item.boxId!==activeBoxId)return false;
    expandedItemId=expandedItemId===itemId?null:itemId;
    syncExpandedDom({scroll:!!expandedItemId});
    return true;
  }

  function renderBox(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v539]`);
    const box=findBox(activeBoxId);
    if(!content||!box){activeBoxId=null;expandedItemId=null;renderShelf();return;}
    const name=box.name?`<strong class="mod-kistology-openbox-name-v539">${esc(box.name)}</strong>`:'<span class="mod-kistology-openbox-name-v539 is-empty" aria-hidden="true"></span>';
    content.innerHTML=`<section class="mod-kistology-openbox-v535" data-kistology-view-v539="box">
      <button type="button" class="mod-kistology-back-v535 mod-kistology-back-v539" data-kistology-back-v539>‹ REGAL</button>
      <div class="mod-kistology-pulled-box-wrap-v535"><div class="mod-kistology-pulled-box-v535 mod-kistology-pulled-box-v539">
        <span class="mod-kistology-box-handle-v535" aria-hidden="true"></span>
        <div class="mod-kistology-openbox-head-v539">${name}<span class="mod-kistology-openbox-code-v539">${esc(box.code)}</span></div>
        <small class="mod-kistology-openbox-count-v539">${box.items.length} Gegenstände</small>
        <div class="mod-kistology-category-chips-v539">${categoryChips(box)}</div>
      </div></div>
      <div class="mod-kistology-section-head-v535"><div><span>INHALT DER KISTE</span><strong>${box.items.length} EINTRÄGE</strong></div><small>DURCHWÜHLEN</small></div>
      <div class="mod-kistology-stack-v535 mod-kistology-stack-v539">${box.items.map(item=>itemCard(item,{expanded:item.id===expandedItemId})).join('')}</div>
    </section>`;
    content.querySelector('[data-kistology-back-v539]')?.addEventListener('click',()=>{activeBoxId=null;expandedItemId=null;renderShelf();});
    content.querySelectorAll('[data-kistology-item-toggle-v539]').forEach(button=>button.addEventListener('click',()=>toggleItem(button.dataset.kistologyItemToggleV539)));
    syncExpandedDom({scroll:!!expandedItemId});
  }

  function renderSearch(){
    const content=document.querySelector(`#${ROOT_ID} [data-kistology-content-v539]`);
    if(!content)return;
    const results=matchingItems();
    content.innerHTML=`<section class="mod-kistology-search-results-v535" data-kistology-view-v539="search">
      <div class="mod-kistology-section-head-v535"><div><span>SUCHERGEBNISSE</span><strong>${results.length} TREFFER</strong></div><small>„${esc(query)}“</small></div>
      <div class="mod-kistology-results-v535">${results.length?results.map(item=>`<button type="button" class="mod-kistology-result-v535 mod-kistology-result-button-v539" data-kistology-result-v539="${esc(item.id)}"><div class="mod-kistology-result-marker-v535"></div><div class="mod-kistology-result-main-v535"><h4>${esc(item.name)}</h4></div><span class="mod-kistology-result-arrow-v539" aria-hidden="true">›</span></button>`).join(''):'<div class="mod-kistology-empty-v535">Nichts gefunden. Selbst das Chaos hat Grenzen.</div>'}</div>
    </section>`;
    content.querySelectorAll('[data-kistology-result-v539]').forEach(button=>button.addEventListener('click',()=>openDetail(button.dataset.kistologyResultV539,'search')));
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
    root.innerHTML=`<div class="mod-kistology-head-v535"><div class="mod-kistology-brand-v535"><div class="mod-kistology-kicker-v535">MASTER OF DISASTER // INVENTAR</div><h2>KISTOLOGY</h2><p>Inventar · Lagerorte · Fundstücke</p></div><span class="mod-kistology-preview-v535">SNAPSHOT</span></div>
      <div class="mod-kistology-searchbar-v535"><span aria-hidden="true"></span><input type="search" data-kistology-search-v539 autocomplete="off" placeholder="Gegenstand suchen" aria-label="Kistology Gegenstände durchsuchen" ${loadState==='ready'?'':'disabled'}><button type="button" data-kistology-clear-v539 aria-label="Suche löschen">×</button></div>
      <div class="mod-kistology-content-v535" data-kistology-content-v539></div>
      <div class="mod-kistology-data-note-v535">V539 · SUPABASE-SNAPSHOT · NUR LESEN · QUELLE BLEIBT MEGA-SORTIERUNG</div>`;
    const input=root.querySelector('[data-kistology-search-v539]');
    input.value=query;
    input.addEventListener('input',()=>{query=input.value;activeBoxId=null;expandedItemId=null;renderContent();});
    root.querySelector('[data-kistology-clear-v539]')?.addEventListener('click',()=>{query='';input.value='';activeBoxId=null;expandedItemId=null;renderContent();if(!input.disabled)input.focus();});
    renderContent();
    return true;
  }

  function openDetail(itemId){
    const item=findItem(itemId);if(!item)return false;
    return openBox(item.boxId,item.id);
  }

  function openBox(boxId,itemId=null){
    const box=findBox(boxId);if(!box)return false;
    activeBoxId=boxId;
    expandedItemId=itemId&&box.items.some(item=>item.id===itemId)?itemId:null;
    query='';
    const input=document.querySelector(`#${ROOT_ID} [data-kistology-search-v539]`);if(input)input.value='';
    renderBox();
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return true;
  }

  function patchLauncher(){
    const button=document.querySelector('[data-mod-hub-launch-v517="kistology"]');
    if(!button)return false;
    button.removeAttribute('aria-disabled');
    button.setAttribute('aria-label','Kistology öffnen');
    button.dataset.modKistologyActiveV539='true';
    return true;
  }

  function close(){
    if(!isOpen())return false;
    document.body.classList.remove(BODY_CLASS);
    const root=document.getElementById(ROOT_ID);if(root){root.hidden=true;root.setAttribute('aria-hidden','true');}
    activeBoxId=null;expandedItemId=null;query='';
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
    const root=document.getElementById(ROOT_ID);if(root){root.hidden=false;root.setAttribute('aria-hidden','false');}
    activeBoxId=null;expandedItemId=null;query='';
    renderShell();
    if(loadState==='idle'||loadState==='error')fetchSnapshot().catch(()=>{});
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    try{window.scrollTo?.({top:0,left:0,behavior:'instant'});}catch(_){try{window.scrollTo?.(0,0);}catch(__){}}
    return 'kistology';
  }

  function patchHub(){
    const hub=hubApi();if(!hub||hubPatched)return false;
    originalHubShow=hub.show?.bind(hub)||null;originalHubOpen=hub.open?.bind(hub)||null;originalHubHide=hub.hide?.bind(hub)||null;
    if(!originalHubShow||!originalHubOpen||!originalHubHide)return false;
    hub.show=function(){if(isOpen())close();return originalHubShow(...arguments);};
    hub.open=function(target,options){if(target==='kistology')return open();if(isOpen())close();return originalHubOpen(target,options);};
    hub.kistologyActiveV539=true;hubPatched=true;return true;
  }

  function installCapture(){
    if(captureInstalled)return;captureInstalled=true;
    window.addEventListener('click',event=>{
      const launcherButton=event.target?.closest?.('[data-mod-hub-launch-v517="kistology"]');
      if(launcherButton){event.preventDefault();event.stopImmediatePropagation();open();return;}
      if(!isOpen())return;
      const sportButton=event.target?.closest?.('#sportSwitchV510');
      if(sportButton){event.preventDefault();event.stopImmediatePropagation();close();if(originalHubOpen)originalHubOpen('sport',{source:'switch'});}
    },true);
  }

  function observeLauncher(){if(observer)return;observer=new MutationObserver(()=>patchLauncher());observer.observe(document.documentElement,{childList:true,subtree:true});}
  function init(){ensureRoot();patchHub();patchLauncher();installCapture();observeLauncher();return !!hubApi();}

  window.__modKistologyV539={
    version:VERSION,open,close,openBox,openDetail,toggleItem,patchHub,patchLauncher,render:renderShell,
    reload:()=>{loadState='idle';BOXES=[];return fetchSnapshot();},isOpen,
    getSnapshotMeta:()=>({...snapshotMeta}),getBoxes:()=>BOXES.map(box=>({...box,items:box.items.map(item=>({...item}))})),
    readonlySnapshotV539:true,realSupabaseSnapshotV539:true,sourceInventoryIdsHiddenV539:true,noInventoryWritesV539:true,
    exactAssignedCategoriesV539:true,frequencyCategoryRankingRemovedV539:true,boxCodeSingleBadgeV539:true,
    containerTypeAndDimensionsHiddenV539:true,objectNameOnlySearchV539:true,inlineItemDetailsV539:true,
    singleExpandedItemV539:true,searchJumpsToExpandedItemV539:true,permanentCardOffsetsRemovedV539:true,
    inventoryPersistenceUntouched:true,todoDataUntouched:true,sportHealthHookPreserved:true,homeNavigationPreserved:true
  };

  let tries=0;const timer=setInterval(()=>{tries++;if(init()||tries>240)clearInterval(timer);},60);
  if(document.readyState!=='loading')setTimeout(init,0);else document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  window.addEventListener('load',()=>setTimeout(init,220),{once:true});
})();
