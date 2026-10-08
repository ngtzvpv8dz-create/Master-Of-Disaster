/* V759 · DENKFABRIK / PROJECT BRAIN DASHBOARD
   Bereichs-Dashboard mit aktuellem Projektgedaechtnis, Dringlichkeit und Erledigt-Historie.
*/
(function(){
  'use strict';
  if(window.__modDenkfabrikV752)return;

  const VERSION='V759';
  const ROOT_ID='modDenkfabrikV634';
  const BODY_CLASS='mod-denkfabrik-v634';
  const SURFACE_CLASS='mod-denkfabrik-surface-v634';
  const CURRENT_STATUSES=new Set(['active','open','parked','review']);
  const STATUS_META={
    active:{label:'Aktiv',short:'AKTIV'},
    open:{label:'Offen',short:'OFFEN'},
    parked:{label:'Geparkt',short:'PARK'},
    review:{label:'Prüfen',short:'PRÜFEN'},
    done:{label:'Erledigt',short:'ERLEDIGT'},
    superseded:{label:'Ersetzt',short:'ERSETZT'},
    historical:{label:'Historisch',short:'HISTORISCH'}
  };
  const AREA_ORDER=['denkfabrik','global','app','food','sport','shopping','finance','todo','kistology','backup','backstage','progress','integration','development','cross-domain'];
  const AREA_LABELS={
    denkfabrik:'Denkfabrik',
    global:'Global',
    app:'App',
    food:'Food',
    sport:'Sport',
    shopping:'Einkaufsliste',
    finance:'Finanzen',
    todo:'To-do',
    kistology:'Kistology',
    backup:'Backup',
    backstage:'Backstage',
    progress:'Progress',
    integration:'Integration',
    development:'Entwicklung',
    'cross-domain':'Bereichsübergreifend'
  };
  const AREA_ALIASES={Food:'food',food:'food',finanzen:'finance',finance:'finance'};
  const KIND_LABELS={
    ux:'UX',
    bug:'Fehler',
    idea:'Idee',
    rule:'Regel',
    note:'Hinweis',
    decision:'Entscheidung',
    feature:'Funktion',
    data:'Daten',
    architecture:'Architektur'
  };

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

  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const normalizeArea=area=>{
    const raw=String(area||'sonstiges').trim();
    if(AREA_ALIASES[raw])return AREA_ALIASES[raw];
    const lower=raw.toLocaleLowerCase('de-DE');
    return AREA_ALIASES[lower]||lower||'sonstiges';
  };
  const areaLabel=area=>AREA_LABELS[normalizeArea(area)]||String(area||'Sonstiges');
  const kindLabel=kind=>KIND_LABELS[String(kind||'').toLocaleLowerCase('de-DE')]||String(kind||'').toLocaleUpperCase('de-DE')||'PUNKT';
  const fmtDate=value=>{
    if(!value)return '';
    const raw=String(value);
    const iso=raw.length>10?raw:raw.slice(0,10)+'T12:00:00';
    const date=new Date(iso);
    if(Number.isNaN(date.getTime()))return raw;
    return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Berlin'}).format(date);
  };
  const statusMeta=status=>STATUS_META[status]||{label:String(status||'Unbekannt'),short:String(status||'?').toUpperCase()};
  const currentRows=()=>rows.filter(row=>CURRENT_STATUSES.has(row.status));
  const doneRows=()=>rows.filter(row=>row.status==='done');
  const refNumber=row=>{
    const n=Number(row?.reference_number);
    return Number.isSafeInteger(n)&&n>0?'#'+String(n).padStart(3,'0'):'#?';
  };
  const priorityValue=row=>{
    const value=Number(row?.priority);
    return Number.isFinite(value)&&value>0?Math.max(1,Math.min(5,Math.round(value))):0;
  };

  function sortEntries(list){
    const statusRank={open:0,review:1,active:2,parked:3,done:4};
    return [...list].sort((a,b)=>{
      const priorityDiff=priorityValue(b)-priorityValue(a);
      if(priorityDiff)return priorityDiff;
      const statusDiff=(statusRank[a.status]??9)-(statusRank[b.status]??9);
      if(statusDiff)return statusDiff;
      return String(a.title||'').localeCompare(String(b.title||''),'de');
    });
  }

  function sortAreas(a,b){
    const ai=AREA_ORDER.indexOf(a),bi=AREA_ORDER.indexOf(b);
    if(ai!==-1||bi!==-1){
      if(ai===-1)return 1;
      if(bi===-1)return -1;
      if(ai!==bi)return ai-bi;
    }
    return a.localeCompare(b,'de');
  }

  function uniqueAreas(){
    return [...new Set(rows.map(row=>normalizeArea(row.area)).filter(Boolean))].sort(sortAreas);
  }

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
    root.className='mod-denkfabrik-root-v634 mod-denkfabrik-root-v752';
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
      if(meta)meta.setAttribute('content','#142638');
    }else{
      document.body.classList.remove(BODY_CLASS);
      html.classList.remove(SURFACE_CLASS);
      if(document.body.dataset.modAppSurfaceV515==='denkfabrik')delete document.body.dataset.modAppSurfaceV515;
      if(meta)meta.setAttribute('content','#0b0d0f');
    }
  }

  function iconMarkup(){
    return '<svg class="denk-icon-art-v752" viewBox="0 0 192 192" aria-hidden="true">'
      +'<defs>'
      +'<linearGradient id="denkBg752" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#294d67"/><stop offset=".5" stop-color="#183247"/><stop offset="1" stop-color="#0e2231"/></linearGradient>'
      +'<linearGradient id="denkRim752" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d6a5"/><stop offset=".5" stop-color="#92b5cc"/><stop offset="1" stop-color="#b07b45"/></linearGradient>'
      +'<radialGradient id="denkBrain752" cx=".38" cy=".28" r=".8"><stop offset="0" stop-color="#fff8e8"/><stop offset=".68" stop-color="#eadcc5"/><stop offset="1" stop-color="#bda98d"/></radialGradient>'
      +'</defs>'
      +'<rect x="6" y="6" width="180" height="180" rx="40" fill="url(#denkBg752)" stroke="url(#denkRim752)" stroke-width="5"/>'
      +'<g opacity=".9" fill="none" stroke="#c89b61" stroke-width="4" stroke-linecap="round"><path d="M26 80h26l14 12"/><path d="M24 116h31l13-11"/><path d="M166 76h-27l-13 13"/><path d="M168 120h-31l-12-12"/></g>'
      +'<g fill="#e8c995" stroke="#8d6338" stroke-width="3"><circle cx="25" cy="80" r="7"/><circle cx="23" cy="116" r="7"/><circle cx="167" cy="76" r="7"/><circle cx="169" cy="120" r="7"/></g>'
      +'<g transform="translate(96 97)">'
      +'<path d="M0-65 13-62 18-49 31-43 42-49 52-38 48-25 55-13 68-10 69 4 57 10 52 23 57 35 47 46 34 42 22 50 18 64 3 66-4 54-18 50-30 57-42 47-38 33-46 22-60 18-61 3-49-4-45-18-52-29-41-41-28-37-17-46-13-60Z" fill="#7da1ba" stroke="#e3c48f" stroke-width="4"/>'
      +'<circle cx="4" cy="1" r="47" fill="#132b3e" stroke="#9bb8ca" stroke-width="3"/>'
      +'<path d="M3-37c-15-14-37-2-33 16-14 6-13 28 4 32-6 17 10 31 26 23V-37Z" fill="url(#denkBrain752)" stroke="#8d7b66" stroke-width="3"/>'
      +'<path d="M5-37c15-14 37-2 33 16 14 6 13 28-4 32 6 17-10 31-26 23V-37Z" fill="url(#denkBrain752)" stroke="#8d7b66" stroke-width="3"/>'
      +'<g fill="none" stroke="#a4937c" stroke-width="3" stroke-linecap="round"><path d="M-8-27c-11 4-12 14-5 21"/><path d="M-28-13c11 2 15 11 10 20"/><path d="M-22 16c8-7 17-6 22 1"/><path d="M16-27c11 4 12 14 5 21"/><path d="M36-13c-11 2-15 11-10 20"/><path d="M30 16c-8-7-17-6-22 1"/></g>'
      +'<path d="M4-38v76" stroke="#8a7359" stroke-width="3"/>'
      +'</g>'
      +'</svg>';
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
      const fields='reference_number,brain_key,area,kind,status,title,details,effective_date,source_date,source_chat_nos,source_file,supersedes_note,priority,tags,needs_verification,verified_at,resolved_at,metadata,updated_at';
      const result=await Promise.all([
        supabase.from('project_brain_current').select(fields),
        supabase.from('project_brain').select(fields).eq('status','done')
      ]);
      const currentResult=result[0],doneResult=result[1];
      if(currentResult.error)throw currentResult.error;
      if(doneResult.error)throw doneResult.error;
      const merged=[...(Array.isArray(currentResult.data)?currentResult.data:[]),...(Array.isArray(doneResult.data)?doneResult.data:[])];
      const seen=new Set();
      rows=merged
        .map(row=>({...row,area:normalizeArea(row.area)}))
        .filter(row=>{
          const key=String(row.brain_key||'');
          if(!key||seen.has(key))return false;
          seen.add(key);
          return true;
        });
      loadState='ready';
      return rows;
    })().catch(error=>{
      console.error('V752 Denkfabrik:',error);
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
    const byStatus=status=>rows.filter(row=>row.status===status).length;
    return {
      current:currentRows().length,
      active:byStatus('active'),
      open:byStatus('open'),
      parked:byStatus('parked'),
      review:byStatus('review'),
      done:byStatus('done'),
      total:rows.length
    };
  }

  function grouped(list){
    const map=new Map();
    list.forEach(row=>{
      const area=normalizeArea(row.area);
      if(!map.has(area))map.set(area,[]);
      map.get(area).push(row);
    });
    return [...map.entries()].sort((a,b)=>sortAreas(a[0],b[0])).map(([area,items])=>({area,rows:sortEntries(items)}));
  }

  function filteredRows(){
    const q=searchQuery.trim().toLocaleLowerCase('de-DE');
    const refMatch=q.match(/^(?:#|df[-\s]?|nr\.?\s*)?(\d+)$/);
    return rows.filter(row=>{
      if(refMatch)return Number(row.reference_number)===Number(refMatch[1]);
      if(activeArea!=='all'&&normalizeArea(row.area)!==activeArea)return false;
      if(activeStatus==='current'&&!CURRENT_STATUSES.has(row.status))return false;
      if(activeStatus!=='all'&&activeStatus!=='current'&&row.status!==activeStatus)return false;
      if(!q)return true;
      const hay=[refNumber(row),row.brain_key,row.area,row.kind,row.status,row.title,row.details,...(row.tags||[])].join(' ').toLocaleLowerCase('de-DE');
      return hay.includes(q);
    });
  }

  function statMarkup(){
    const c=counts();
    const stats=[
      ['current','Aktuell',c.current],
      ['open','Offen',c.open],
      ['review','Prüfen',c.review],
      ['done','Erledigt',c.done]
    ];
    return '<div class="denk-stats-v634 denk-stats-v752" aria-label="Denkfabrik Status">'+stats.map(([status,label,value])=>'<button type="button" class="denk-stat-v634 denk-stat-'+status+'-v634" data-denk-status="'+status+'"><strong>'+value+'</strong><span>'+label+'</span></button>').join('')+'</div>';
  }

  function priorityMarkup(row){
    const value=priorityValue(row);
    return value?'<span class="denk-priority-v634 denk-priority-v752 p'+value+'" title="Dringlichkeit '+value+' von 5">DRINGL. '+value+'/5</span>':'';
  }

  function sourceMarkup(row){
    const parts=[];
    if(row.resolved_at)parts.push('Erledigt '+fmtDate(row.resolved_at));
    if(row.source_date)parts.push('Quelle '+fmtDate(row.source_date));
    if(Array.isArray(row.source_chat_nos)&&row.source_chat_nos.length)parts.push('Chat '+row.source_chat_nos.join(', '));
    if(row.source_file&&row.source_file!=='current-chat')parts.push(String(row.source_file));
    if(row.effective_date)parts.push('Gültig ab '+fmtDate(row.effective_date));
    return parts.length?'<div class="denk-source-v634">'+parts.map(part=>'<span>'+esc(part)+'</span>').join('')+'</div>':'';
  }

  function entryMarkup(row){
    const meta=statusMeta(row.status);
    const tags=Array.isArray(row.tags)?row.tags:[];
    const verify=row.needs_verification?'<span class="denk-verify-v634">PRÜFEN</span>':'';
    return '<details class="denk-entry-v634 denk-entry-v752 status-'+esc(row.status)+'" data-denk-key="'+esc(row.brain_key)+'">'
      +'<summary><span class="denk-entry-main-v634"><small><span class="denk-ref-v759" title="Feste Referenznummer">'+esc(refNumber(row))+'</span>'+esc(kindLabel(row.kind))+' · '+esc(row.brain_key)+'</small><strong>'+esc(row.title)+'</strong></span><span class="denk-entry-side-v634"><span class="denk-status-v634">'+esc(meta.short)+'</span>'+priorityMarkup(row)+verify+'<b aria-hidden="true">+</b></span></summary>'
      +'<div class="denk-entry-body-v634"><p>'+esc(row.details)+'</p>'
      +(row.supersedes_note?'<div class="denk-note-v634"><strong>Ersetzt / ersetzt durch</strong><span>'+esc(row.supersedes_note)+'</span></div>':'')
      +sourceMarkup(row)
      +(tags.length?'<div class="denk-tags-v634">'+tags.map(tag=>'<span>#'+esc(tag)+'</span>').join('')+'</div>':'')
      +'</div></details>';
  }

  function focusMarkup(){
    const focus=sortEntries(currentRows().filter(row=>priorityValue(row)>=4)).slice(0,6);
    if(!focus.length)return '';
    const p5=currentRows().filter(row=>priorityValue(row)===5).length;
    const p4=currentRows().filter(row=>priorityValue(row)===4).length;
    return '<section class="denk-focus-v752"><div class="denk-section-head-v634"><div><span>RADAR</span><h3>Gerade besonders wichtig</h3></div><small>'+p5+' × 5/5 · '+p4+' × 4/5</small></div><div class="denk-focus-list-v752">'+focus.map(row=>'<button type="button" data-denk-jump-area="'+esc(normalizeArea(row.area))+'"><span><b class="denk-focus-ref-v759">'+esc(refNumber(row))+'</b> · '+esc(areaLabel(row.area))+'</span><strong>'+esc(row.title)+'</strong><em>'+priorityValue(row)+'/5</em></button>').join('')+'</div></section>';
  }

  function currentBlocksMarkup(){
    const currentGroups=grouped(currentRows());
    const doneMap=new Map(grouped(doneRows()).map(group=>[group.area,group.rows]));
    if(!currentGroups.length)return '';
    return '<section class="denk-dashboard-v752"><div class="denk-section-head-v634"><div><span>AKTUELL</span><h3>Baustellen nach Bereich</h3></div><small>'+currentRows().length+' Punkte</small></div><div class="denk-area-block-list-v752">'+currentGroups.map(group=>{
      const done=(doneMap.get(group.area)||[]).length;
      const total=group.rows.length+done;
      const maxPriority=Math.max(0,...group.rows.map(priorityValue));
      const open=group.rows.filter(row=>row.status==='open').length;
      const review=group.rows.filter(row=>row.status==='review').length;
      return '<details class="denk-area-block-v752" data-denk-area-block="'+esc(group.area)+'"><summary>'
        +'<span class="denk-area-symbol-v752" aria-hidden="true">'+esc(areaLabel(group.area).slice(0,1).toUpperCase())+'</span>'
        +'<span class="denk-area-block-copy-v752"><strong>'+esc(areaLabel(group.area))+'</strong><small>'+group.rows.length+' aktuell · '+done+' erledigt · '+total+' gesamt'+(open?' · '+open+' offen':'')+(review?' · '+review+' prüfen':'')+'</small></span>'
        +'<span class="denk-area-block-side-v752">'+(maxPriority?'<em>D '+maxPriority+'/5</em>':'')+'<b>'+group.rows.length+'</b><i aria-hidden="true">+</i></span>'
        +'</summary><div class="denk-area-block-body-v752">'+group.rows.map(entryMarkup).join('')+'</div></details>';
    }).join('')+'</div></section>';
  }

  function completedMarkup(){
    const done=doneRows();
    if(!done.length)return '';
    const groups=grouped(done);
    return '<details class="denk-completed-v752"><summary><span><small>ERLEDIGT</small><strong>Was wir schon vom Tisch haben</strong></span><span class="denk-completed-side-v752"><b>'+done.length+'</b><i aria-hidden="true">+</i></span></summary><div class="denk-completed-body-v752">'
      +groups.map(group=>'<details class="denk-done-area-v752"><summary><span>'+esc(areaLabel(group.area))+'</span><b>'+group.rows.length+'</b><i aria-hidden="true">+</i></summary><div>'+group.rows.map(entryMarkup).join('')+'</div></details>').join('')
      +'</div></details>';
  }

  function statusFilters(){
    const filters=[['current','Aktuell'],['open','Offen'],['active','Aktiv'],['parked','Geparkt'],['review','Prüfen'],['done','Erledigt'],['all','Alle']];
    return '<div class="denk-filter-row-v634" role="group" aria-label="Status filtern">'+filters.map(([value,label])=>'<button type="button" data-denk-status="'+value+'" class="'+(activeStatus===value?'is-active':'')+'">'+label+'</button>').join('')+'</div>';
  }

  function areaFilters(){
    const areas=uniqueAreas();
    return '<div class="denk-area-row-v634" role="group" aria-label="Bereich filtern"><button type="button" data-denk-area="all" class="'+(activeArea==='all'?'is-active':'')+'">Alle Bereiche</button>'+areas.map(area=>'<button type="button" data-denk-area="'+esc(area)+'" class="'+(activeArea===area?'is-active':'')+'">'+esc(areaLabel(area))+'</button>').join('')+'</div>';
  }

  function listMarkup(){
    const filtered=sortEntries(filteredRows());
    if(!filtered.length)return '<div class="denk-empty-v634"><strong>Nichts gefunden.</strong><span>Filter oder Suche ändern, dann taucht das Hirn wieder auf.</span></div>';
    const groups=grouped(filtered);
    return '<div class="denk-results-v634"><div class="denk-results-count-v634">'+filtered.length+' '+(filtered.length===1?'Eintrag':'Einträge')+'</div>'+groups.map(group=>'<section class="denk-area-group-v634"><div class="denk-area-head-v634"><h3>'+esc(areaLabel(group.area))+'</h3><span>'+group.rows.length+'</span></div>'+group.rows.map(entryMarkup).join('')+'</section>').join('')+'</div>';
  }

  function explorerMarkup(){
    const open=Boolean(searchQuery||activeArea!=='all'||activeStatus!=='current');
    return '<details class="denk-explorer-v752" '+(open?'open':'')+'><summary><span><small>WERKZEUGKISTE</small><strong>Alles durchsuchen & filtern</strong></span><i aria-hidden="true">+</i></summary><div class="denk-explorer-body-v752"><section class="denk-controls-v634"><label class="denk-search-v634"><span>Suche</span><input type="search" value="'+esc(searchQuery)+'" placeholder="Nummer (#023), Idee, Regel …" data-denk-search autocomplete="off"></label>'+statusFilters()+areaFilters()+'</section>'+listMarkup()+'</div></details>';
  }

  function heroMarkup(){
    const c=counts();
    return '<div class="denk-hero-v634 denk-hero-v752"><div class="denk-hero-copy-v634"><span class="denk-kicker-v634">PROJECT BRAIN // '+VERSION+'</span><h2>DENKFABRIK</h2><p><em>Mind the Pinky</em> · Das Brain behind the Disaster</p><div class="denk-hero-meta-v752"><span>'+c.current+' aktuell</span><span>'+c.done+' erledigt</span><span>'+uniqueAreas().length+' Bereiche</span></div></div><div class="denk-hero-icon-v752">'+iconMarkup()+'</div></div>';
  }

  function shell(){
    if(loadState==='error')return '<div class="denk-hero-v634"><div><span class="denk-kicker-v634">PROJECT BRAIN</span><h2>DENKFABRIK</h2><p>Mind the Pinky · Das Brain behind the Disaster</p></div></div><div class="denk-error-v634"><strong>Denkfabrik gerade nicht erreichbar.</strong><span>'+esc(loadError)+'</span><button type="button" data-denk-retry>Erneut laden</button></div>';
    if(loadState!=='ready')return '<div class="denk-hero-v634"><div><span class="denk-kicker-v634">PROJECT BRAIN</span><h2>DENKFABRIK</h2><p>Mind the Pinky · Das Brain behind the Disaster</p></div></div><div class="denk-loading-v634"><span></span><strong>Gedanken werden sortiert …</strong></div>';
    return heroMarkup()+statMarkup()+'<p class="denk-ref-tip-v759">Jeder Eintrag hat eine feste Nummer. Sag einfach: „Nimm #023“.</p>'+focusMarkup()+currentBlocksMarkup()+completedMarkup()+explorerMarkup();
  }

  function bind(root){
    root.querySelector('[data-denk-search]')?.addEventListener('input',event=>{
      searchQuery=event.target.value||'';
      render();
      const input=document.querySelector('#'+ROOT_ID+' [data-denk-search]');
      if(input){
        input.focus();
        input.setSelectionRange(input.value.length,input.value.length);
      }
    });
    root.querySelectorAll('[data-denk-status]').forEach(button=>button.addEventListener('click',()=>{
      activeStatus=button.dataset.denkStatus||'current';
      render();
    }));
    root.querySelectorAll('[data-denk-area]').forEach(button=>button.addEventListener('click',()=>{
      activeArea=button.dataset.denkArea||'all';
      render();
    }));
    root.querySelectorAll('[data-denk-jump-area]').forEach(button=>button.addEventListener('click',()=>{
      const area=button.dataset.denkJumpArea;
      const block=root.querySelector('[data-denk-area-block="'+CSS.escape(area)+'"]');
      if(block){
        block.open=true;
        block.scrollIntoView({behavior:'smooth',block:'start'});
      }
    }));
    root.querySelector('[data-denk-retry]')?.addEventListener('click',()=>{
      loadState='idle';
      fetchRows();
    });
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
    if(root){
      root.hidden=true;
      root.setAttribute('aria-hidden','true');
    }
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
    if(root){
      root.hidden=false;
      root.setAttribute('aria-hidden','false');
    }
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
    hub.denkfabrikActiveV752=true;
    hubPatched=true;
    return true;
  }

  function patchLauncher(){
    const launcher=window.__modHubLauncherV603||window.__modHubLauncherV517;
    const item=launcher?.modules?.find?.(entry=>entry.id==='denkfabrik');
    if(item)item.active=true;
    document.querySelectorAll('[data-mod-hub-launch-v517="denkfabrik"]').forEach(button=>{
      button.removeAttribute('aria-disabled');
      button.setAttribute('aria-label','Denkfabrik öffnen');
    });
    return true;
  }

  function init(){
    ensureRoot();
    patchHub();
    patchLauncher();
    return true;
  }

  const api={
    version:VERSION,
    open,
    close,
    render,
    reload(){loadState='idle';rows=[];return fetchRows();},
    readOnly:true,
    dashboard:true,
    completedHistory:true,
    stableReferenceNumbers:true,
    getRows:()=>rows.map(row=>({...row})),
    getCounts:counts
  };
  window.__modDenkfabrikV752=api;
  window.__modDenkfabrikV635=api;

  const observer=new MutationObserver(()=>patchLauncher());
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      init();
      observer.observe(document.documentElement,{subtree:true,childList:true});
    },{once:true});
  }else{
    init();
    observer.observe(document.documentElement,{subtree:true,childList:true});
  }
})();