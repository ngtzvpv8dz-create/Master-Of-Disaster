/* V635 · DENKFABRIK / PROJECT BRAIN
   Read-only Projektgedaechtnis mit Suche, Filtern, Statuszahlen und Detailansicht.
*/
(function(){
  'use strict';
  if(window.__modDenkfabrikV635)return;

  const VERSION='V635';
  const ROOT_ID='modDenkfabrikV634';
  const BODY_CLASS='mod-denkfabrik-v634';
  const SURFACE_CLASS='mod-denkfabrik-surface-v634';
  const CURRENT_STATUSES=new Set(['active','open','parked','review']);
  const STATUS_META={
    active:{label:'Aktiv',short:'AKTIV'},
    open:{label:'Offen',short:'OFFEN'},
    parked:{label:'Geparkt',short:'PARK'},
    review:{label:'Prüfen',short:'PRÜFEN'},
    done:{label:'Erledigt',short:'DONE'},
    superseded:{label:'Ersetzt',short:'ERSETZT'},
    historical:{label:'Historisch',short:'HISTORISCH'}
  };
  const AREA_ORDER=['denkfabrik','global','food','sport','todo','kistology','finance','shopping','backup','backstage','progress','integration','development'];
  const AREA_LABELS={denkfabrik:'Denkfabrik',global:'Global',food:'Food',sport:'Sport',todo:'To-do',kistology:'Kistology',finance:'Finanzen',shopping:'Einkaufsliste',backup:'Backup',backstage:'Backstage',progress:'Progress',integration:'Integration',development:'Entwicklung'};
  const areaLabel=area=>AREA_LABELS[String(area||'')]||String(area||'Sonstiges');

  let rows=[];
  let loadState='idle';
  let loadError='';
  let activeArea='all';
  let activeStatus='current';
  let searchQuery='';
  let loadPromise=null;
  let hubPatched=false;
  let originalHubShow=null;
  let originalHubOpen=null;

  const esc=value=>String(value??'').replace(/[&<>'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[char]));
  const fmtDate=value=>{
    if(!value)return '';
    const date=new Date(String(value).slice(0,10)+'T12:00:00');
    if(Number.isNaN(date.getTime()))return String(value);
    return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Berlin'}).format(date);
  };
  const statusMeta=status=>STATUS_META[status]||{label:String(status||'Unbekannt'),short:String(status||'?').toUpperCase()};
  const currentRows=()=>rows.filter(row=>CURRENT_STATUSES.has(row.status));
  const uniqueAreas=()=>{
    const found=[...new Set(rows.map(row=>String(row.area||'sonstiges')).filter(Boolean))];
    return found.sort((a,b)=>{
      const ai=AREA_ORDER.indexOf(a),bi=AREA_ORDER.indexOf(b);
      if(ai!==-1||bi!==-1){
        if(ai===-1)return 1;if(bi===-1)return -1;if(ai!==bi)return ai-bi;
      }
      return a.localeCompare(b,'de');
    });
  };

  function client(){
    try{return typeof window.getSupabaseClient==='function'?window.getSupabaseClient():null;}
    catch(error){throw error;}
  }

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(root)return root;
    const app=document.querySelector('main.app');
    if(!app)return null;
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='mod-denkfabrik-root-v634';
    root.hidden=true;
    root.setAttribute('aria-hidden','true');
    root.setAttribute('aria-label','Denkfabrik');
    app.appendChild(root);
    return root;
  }

  function setSurface(active){
    const html=document.documentElement;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(active){
      document.body.classList.add(BODY_CLASS);
      html.classList.add(SURFACE_CLASS);
      document.body.dataset.modAppSurfaceV515='denkfabrik';
      if(meta)meta.setAttribute('content','#16293a');
    }else{
      document.body.classList.remove(BODY_CLASS);
      html.classList.remove(SURFACE_CLASS);
      if(document.body.dataset.modAppSurfaceV515==='denkfabrik')delete document.body.dataset.modAppSurfaceV515;
      if(meta)meta.setAttribute('content','#0b0d0f');
    }
  }

  async function fetchRows(){
    if(loadPromise)return loadPromise;
    const backgroundRefresh=loadState==='ready';
    loadError='';
    if(!backgroundRefresh){
      loadState='loading';
      render();
    }
    loadPromise=(async()=>{
      const supabase=client();
      if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const session=await supabase.auth.getSession();
      const user=session?.data?.session?.user;
      if(session?.error||!user?.id)throw new Error('Cloud-Sitzung ist nicht verfügbar.');
      const result=await supabase.from('project_brain')
        .select('brain_key,area,kind,status,title,details,effective_date,source_date,source_chat_nos,source_file,supersedes_note,priority,tags,needs_verification,verified_at,resolved_at,metadata,updated_at')
        .order('area',{ascending:true})
        .order('brain_key',{ascending:true});
      if(result.error)throw result.error;
      rows=Array.isArray(result.data)?result.data:[];
      loadState='ready';
      return rows;
    })().catch(error=>{
      console.error('V634 Denkfabrik:',error);
      loadState='error';
      loadError=error?.message||String(error);
      return [];
    }).finally(()=>{
      loadPromise=null;
      render();
    });
    return loadPromise;
  }

  function counts(){
    const current=currentRows();
    const byStatus=status=>rows.filter(row=>row.status===status).length;
    return {
      current:current.length,
      active:byStatus('active'),
      open:byStatus('open'),
      parked:byStatus('parked'),
      review:byStatus('review'),
      done:byStatus('done')
    };
  }

  function filteredRows(){
    const q=searchQuery.trim().toLocaleLowerCase('de-DE');
    return rows.filter(row=>{
      if(activeArea!=='all'&&row.area!==activeArea)return false;
      if(activeStatus==='current'&&!CURRENT_STATUSES.has(row.status))return false;
      if(activeStatus!=='all'&&activeStatus!=='current'&&row.status!==activeStatus)return false;
      if(!q)return true;
      const hay=[row.brain_key,row.area,row.kind,row.status,row.title,row.details,...(row.tags||[])].join(' ').toLocaleLowerCase('de-DE');
      return hay.includes(q);
    });
  }

  function openByArea(){
    const map=new Map();
    rows.filter(row=>row.status==='open').forEach(row=>map.set(row.area,(map.get(row.area)||0)+1));
    return [...map.entries()].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]),'de'));
  }

  function statMarkup(){
    const c=counts();
    return '<div class="denk-stats-v634" aria-label="Denkfabrik Status">'+[
      ['current','Aktuell',c.current],['open','Offen',c.open],['parked','Geparkt',c.parked],['review','Prüfen',c.review]
    ].map(([status,label,value])=>'<button type="button" class="denk-stat-v634 denk-stat-'+status+'-v634" data-denk-status="'+status+'"><strong>'+value+'</strong><span>'+label+'</span></button>').join('')+'</div>';
  }

  function statusFilters(){
    const filters=[['current','Aktuell'],['open','Offen'],['active','Aktiv'],['parked','Geparkt'],['review','Prüfen'],['done','Erledigt'],['all','Alle']];
    return '<div class="denk-filter-row-v634" role="group" aria-label="Status filtern">'+filters.map(([value,label])=>'<button type="button" data-denk-status="'+value+'" class="'+(activeStatus===value?'is-active':'')+'">'+label+'</button>').join('')+'</div>';
  }

  function areaFilters(){
    const areas=uniqueAreas();
    return '<div class="denk-area-row-v634" role="group" aria-label="Bereich filtern"><button type="button" data-denk-area="all" class="'+(activeArea==='all'?'is-active':'')+'">Alle Bereiche</button>'+areas.map(area=>'<button type="button" data-denk-area="'+esc(area)+'" class="'+(activeArea===area?'is-active':'')+'">'+esc(areaLabel(area))+'</button>').join('')+'</div>';
  }

  function openAreaSummary(){
    const groups=openByArea();
    if(!groups.length)return '';
    return '<section class="denk-open-areas-v634"><div class="denk-section-head-v634"><div><span>OFFENE PUNKTE</span><h3>Wo noch was brennt</h3></div><small>'+groups.reduce((sum,item)=>sum+item[1],0)+' offen</small></div><div class="denk-open-area-grid-v634">'+groups.map(([area,count])=>'<button type="button" data-denk-open-area="'+esc(area)+'"><span>'+esc(areaLabel(area))+'</span><strong>'+count+'</strong></button>').join('')+'</div></section>';
  }

  function sourceMarkup(row){
    const parts=[];
    if(row.source_date)parts.push('Quelle '+fmtDate(row.source_date));
    if(Array.isArray(row.source_chat_nos)&&row.source_chat_nos.length)parts.push('Chat '+row.source_chat_nos.join(', '));
    if(row.source_file&&row.source_file!=='current-chat')parts.push(String(row.source_file));
    if(row.effective_date)parts.push('Gültig ab '+fmtDate(row.effective_date));
    return parts.length?'<div class="denk-source-v634">'+parts.map(part=>'<span>'+esc(part)+'</span>').join('')+'</div>':'';
  }

  function entryMarkup(row){
    const meta=statusMeta(row.status);
    const tags=Array.isArray(row.tags)?row.tags:[];
    const priority=row.priority?'<span class="denk-priority-v634">P'+esc(row.priority)+'</span>':'';
    const verify=row.needs_verification?'<span class="denk-verify-v634">PRÜFEN</span>':'';
    return '<details class="denk-entry-v634 status-'+esc(row.status)+'" data-denk-key="'+esc(row.brain_key)+'">'
      +'<summary><span class="denk-entry-main-v634"><small>'+esc(row.brain_key)+' · '+esc(areaLabel(row.area))+'</small><strong>'+esc(row.title)+'</strong></span><span class="denk-entry-side-v634"><span class="denk-status-v634">'+esc(meta.short)+'</span>'+priority+verify+'<b aria-hidden="true">+</b></span></summary>'
      +'<div class="denk-entry-body-v634"><p>'+esc(row.details)+'</p>'
      +(row.supersedes_note?'<div class="denk-note-v634"><strong>Ersetzt / ersetzt durch</strong><span>'+esc(row.supersedes_note)+'</span></div>':'')
      +sourceMarkup(row)
      +(tags.length?'<div class="denk-tags-v634">'+tags.map(tag=>'<span>#'+esc(tag)+'</span>').join('')+'</div>':'')
      +'</div></details>';
  }

  function listMarkup(){
    const filtered=filteredRows();
    if(!filtered.length)return '<div class="denk-empty-v634"><strong>Nichts gefunden.</strong><span>Filter oder Suche ändern, dann taucht das Hirn wieder auf.</span></div>';
    const groups=[];
    filtered.forEach(row=>{
      let group=groups.find(item=>item.area===row.area);
      if(!group){group={area:row.area,rows:[]};groups.push(group);}
      group.rows.push(row);
    });
    return '<div class="denk-results-v634"><div class="denk-results-count-v634">'+filtered.length+' '+(filtered.length===1?'Eintrag':'Einträge')+'</div>'+groups.map(group=>'<section class="denk-area-group-v634"><div class="denk-area-head-v634"><h3>'+esc(areaLabel(group.area))+'</h3><span>'+group.rows.length+'</span></div>'+group.rows.map(entryMarkup).join('')+'</section>').join('')+'</div>';
  }

  function shell(){
    if(loadState==='error')return '<div class="denk-hero-v634"><div><span class="denk-kicker-v634">PROJECT BRAIN</span><h2>DENKFABRIK</h2><p>Mind the Pinky · Das Brain behind the Disaster</p></div></div><div class="denk-error-v634"><strong>Denkfabrik gerade nicht erreichbar.</strong><span>'+esc(loadError)+'</span><button type="button" data-denk-retry>Erneut laden</button></div>';
    if(loadState!=='ready')return '<div class="denk-hero-v634"><div><span class="denk-kicker-v634">PROJECT BRAIN</span><h2>DENKFABRIK</h2><p>Mind the Pinky · Das Brain behind the Disaster</p></div></div><div class="denk-loading-v634"><span></span><strong>Gedanken werden sortiert …</strong></div>';
    return '<div class="denk-hero-v634"><div class="denk-hero-copy-v634"><span class="denk-kicker-v634">PROJECT BRAIN // READ ONLY</span><h2>DENKFABRIK</h2><p><em>Mind the Pinky</em> · Das Brain behind the Disaster</p></div><img src="./assets/icons/denkfabrik-v634-192.jpg?v=634" alt="" width="72" height="72" draggable="false"></div>'
      +statMarkup()
      +'<section class="denk-controls-v634"><label class="denk-search-v634"><span>Suche</span><input type="search" value="'+esc(searchQuery)+'" placeholder="Idee, Regel, Baustelle …" data-denk-search autocomplete="off"></label>'+statusFilters()+areaFilters()+'</section>'
      +openAreaSummary()+listMarkup();
  }

  function bind(root){
    root.querySelector('[data-denk-search]')?.addEventListener('input',event=>{searchQuery=event.target.value||'';render();const input=document.querySelector('#'+ROOT_ID+' [data-denk-search]');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}});
    root.querySelectorAll('[data-denk-status]').forEach(button=>button.addEventListener('click',()=>{activeStatus=button.dataset.denkStatus||'current';render();}));
    root.querySelectorAll('[data-denk-area]').forEach(button=>button.addEventListener('click',()=>{activeArea=button.dataset.denkArea||'all';render();}));
    root.querySelectorAll('[data-denk-open-area]').forEach(button=>button.addEventListener('click',()=>{activeArea=button.dataset.denkOpenArea||'all';activeStatus='open';render();}));
    root.querySelector('[data-denk-retry]')?.addEventListener('click',()=>{loadState='idle';fetchRows();});
  }

  function render(){
    const root=ensureRoot();
    if(!root)return false;
    root.innerHTML=shell();
    bind(root);
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return true;
  }

  function close(){
    if(!document.body.classList.contains(BODY_CLASS))return false;
    setSurface(false);
    const root=document.getElementById(ROOT_ID);
    if(root){root.hidden=true;root.setAttribute('aria-hidden','true');}
    return true;
  }

  function open(){
    try{window.__modFoodV544?.close?.();}catch(_){}
    try{window.__modFinanceV552?.close?.();}catch(_){}
    try{window.__modKistologyV603?.close?.();}catch(_){}
    try{window.__modBackstageV531?.close?.({restoreTodo:false});}catch(_){}
    try{window.__modAppHubV515?.hide?.();}catch(_){}
    setSurface(true);
    const root=ensureRoot();
    if(root){root.hidden=false;root.setAttribute('aria-hidden','false');}
    render();
    fetchRows();
    try{window.scrollTo?.({top:0,left:0,behavior:'instant'});}catch(_){window.scrollTo?.(0,0);}
    return 'denkfabrik';
  }

  function patchHub(){
    const hub=window.__modAppHubV515;
    if(!hub||hubPatched)return false;
    originalHubShow=hub.show?.bind(hub)||null;
    originalHubOpen=hub.open?.bind(hub)||null;
    if(originalHubShow)hub.show=function(){close();return originalHubShow(...arguments);};
    if(originalHubOpen)hub.open=function(target,options){if(target==='denkfabrik')return open();if(document.body.classList.contains(BODY_CLASS))close();return originalHubOpen(target,options);};
    hub.denkfabrikActiveV634=true;
    hubPatched=true;
    return true;
  }

  function patchLauncher(){
    const launcher=window.__modHubLauncherV603||window.__modHubLauncherV517;
    const item=launcher?.modules?.find?.(entry=>entry.id==='denkfabrik');
    if(item)item.active=true;
    document.querySelectorAll('[data-mod-hub-launch-v517="denkfabrik"]').forEach(button=>{button.removeAttribute('aria-disabled');button.setAttribute('aria-label','Denkfabrik öffnen');});
    return true;
  }

  function init(){
    ensureRoot();
    patchHub();
    patchLauncher();
    return true;
  }

  const api={version:VERSION,open,close,render,reload(){loadState='idle';rows=[];return fetchRows();},readOnly:true,getRows:()=>rows.map(row=>({...row})),getCounts:counts};
  window.__modDenkfabrikV635=api;

  const observer=new MutationObserver(()=>patchLauncher());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init();observer.observe(document.documentElement,{subtree:true,childList:true});},{once:true});
  else{init();observer.observe(document.documentElement,{subtree:true,childList:true});}
})();