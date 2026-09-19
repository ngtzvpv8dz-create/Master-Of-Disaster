/* V512 · SPORT-TABS + SICHTBARE WECHSELANIMATION
   - Vier vertikale Sportregister: FITX, X-TRAINING, AKTIVITÄTEN, STATISTIK.
   - Sichtbarer animierter Tab-/Panelwechsel.
   - Nutzt ausschließlich die bestehende V510-Sportdatenquelle.
   - Keine To-do-, Archiv- oder Sportdatenmigration.
*/
(function(){
  'use strict';
  if(window.__modSportTabsV512)return;

  const VERSION='V512';
  const ROOT_ID='sportRootV510';
  const TAB_KEY='masterOfDisasterSportTabV512';
  const TABS=[
    {id:'fitx',label:'FITX'},
    {id:'xtraining',label:'X-TRAINING'},
    {id:'activities',label:'AKTIVITÄTEN'},
    {id:'statistics',label:'STATISTIK'}
  ];
  let activeTab='fitx';
  let observer=null;
  let rendering=false;
  let bootTimer=null;

  const reducedMotion=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validDate=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d:null;};
  const durationMs=(start,end)=>{const a=validDate(start),b=validDate(end);return a&&b?Math.max(0,b-a):0;};
  const totalMinutes=session=>Math.round(durationMs(session?.startedAt,session?.endedAt)/60000);
  const activityMinutes=session=>(Array.isArray(session?.activities)?session.activities:[]).reduce((sum,row)=>sum+Math.round(durationMs(row.startedAt,row.endedAt)/60000),0);
  const formatMinutes=minutes=>{const m=Math.max(0,Math.round(Number(minutes)||0)),h=Math.floor(m/60),rest=m%60;return h<=0?`${rest} min`:`${h}:${String(rest).padStart(2,'0')} h`;};
  const clock=value=>{const d=validDate(value);if(!d)return '–';return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);};
  const dateLabel=dateKey=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey||''));if(!m)return String(dateKey||'');const date=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),12));return new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);};

  function api(){return window.__modSportModeV510||null;}
  function sessions(){try{return api()?.loadSessions?.()||[];}catch(_){return [];}}
  function validTab(id){return TABS.some(tab=>tab.id===id)?id:'fitx';}

  function tabRail(){
    return `<aside class="sport-side-rail-v510 sport-side-rail-v512" aria-label="Sportbereiche">${TABS.map((tab,index)=>`
      <button type="button" class="sport-side-tab-v510 sport-side-tab-v512 ${activeTab===tab.id?'active':''}" data-sport-tab-v510="${tab.id}" data-sport-tab-v512="${tab.id}" style="--sport-tab-index-v512:${index}" ${activeTab===tab.id?'aria-current="page"':''} aria-label="${esc(tab.label)} öffnen">
        <span class="sport-side-tab-label-v510">${esc(tab.label)}</span>
      </button>`).join('')}</aside>`;
  }

  function wave(){return `<svg class="sport-wave-v510 sport-wave-v512" viewBox="0 0 700 96" preserveAspectRatio="none" aria-hidden="true"><path d="M0 58 C70 58 78 25 142 25 S226 82 300 53 S406 19 472 52 S590 79 700 31" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>`;}

  function fitxPanel(rows){
    const session=rows.find(row=>String(row.area||'').toLowerCase()==='fitx')||null;
    if(!session)return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v512="fitx">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span> FITX</div><p class="sport-date-v510">Noch keine Einheit gespeichert.</p></div>${emptyCard('Dein erster FitX-Eintrag landet hier','Zeitfenster, Kurse und Drumherum-Zeit werden später automatisch zusammengeführt.')}</section>`;
    const total=totalMinutes(session),active=activityMinutes(session),other=Math.max(0,total-active),course=session.activities?.[0]||null,coursePct=total?Math.max(0,Math.min(100,(active/total)*100)):0;
    return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v512="fitx" aria-labelledby="sportFitxTitleV510">${wave()}
      <div class="sport-hero-v510">
        <div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span> FITX · LETZTE EINHEIT</div>
        <p class="sport-date-v510">${esc(dateLabel(session.date))}</p>
        <div class="sport-duration-row-v510"><div class="sport-duration-v510" id="sportDurationV510" data-total-minutes="${total}">${esc(formatMinutes(total).replace(' h',''))}</div><div class="sport-duration-unit-v510">Gesamtaufwand</div></div>
        <div class="sport-time-window-v510">${esc(clock(session.startedAt))} <span>→</span> ${esc(clock(session.endedAt))}</div>
      </div>
      <div class="sport-content-v510">
        <article class="sport-session-card-v510 sport-motion-card-v512">
          <div class="sport-card-head-v510"><div><h2 class="sport-card-title-v510" id="sportFitxTitleV510">${esc(course?.name||'FitX')}</h2><div class="sport-card-sub-v510">${course?`${esc(clock(course.startedAt))}–${esc(clock(course.endedAt))}`:'Keine Unteraktivität dokumentiert'}</div></div><div class="sport-chip-v510">${esc(formatMinutes(active))}</div></div>
          <div class="sport-bar-v510"><div class="sport-bar-course-v510" style="width:${coursePct.toFixed(2)}%"></div><div class="sport-bar-other-v510" style="width:${(100-coursePct).toFixed(2)}%"></div></div>
          <div class="sport-meta-grid-v510"><div class="sport-meta-v510"><div class="sport-meta-label-v510">Kurs</div><div class="sport-meta-value-v510">${esc(formatMinutes(active))}</div></div><div class="sport-meta-v510"><div class="sport-meta-label-v510">Drumherum</div><div class="sport-meta-value-v510">${esc(formatMinutes(other))}</div></div></div>
          <div class="sport-footnote-v510">${esc(session.note||'')}</div>
        </article>
        <div class="sport-mode-hint-v510">Seitlich wechseln. Das blaue S bringt dich jederzeit zurück zu To-do.</div>
      </div>
    </section>`;
  }

  function emptyCard(title,text){return `<div class="sport-content-v510"><article class="sport-session-card-v510 sport-empty-card-v512"><div class="sport-empty-orbit-v512"><span></span><span></span><span></span></div><h2 class="sport-card-title-v510">${esc(title)}</h2><div class="sport-card-sub-v510">${esc(text)}</div></article></div>`;}

  function xTrainingPanel(){
    return `<section class="sport-panel-v510 sport-panel-v512 sport-panel-xtraining-v512" data-sport-panel-v512="xtraining">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span> X-TRAINING</div><p class="sport-date-v510">Eigene Trainingssessions außerhalb der normalen FitX-Dokumentation.</p><div class="sport-section-mark-v512">X</div></div>${emptyCard('Noch kein X-Training dokumentiert','Hier können später Übungen, Sätze, Wiederholungen, Gewichte und Trainingsdauer ihren sehr ordentlich übertriebenen Platz bekommen.')}</section>`;
  }

  function activitiesPanel(rows){
    const flat=[];
    rows.forEach(session=>(session.activities||[]).forEach(activity=>flat.push({session,activity,minutes:Math.round(durationMs(activity.startedAt,activity.endedAt)/60000)})));
    const body=flat.length?`<div class="sport-content-v510 sport-list-v512">${flat.slice(0,8).map(({session,activity,minutes},index)=>`<article class="sport-session-card-v510 sport-activity-row-v512" style="--sport-row-index-v512:${index}"><div><div class="sport-card-title-v510">${esc(activity.name||'Aktivität')}</div><div class="sport-card-sub-v510">${esc(dateLabel(session.date))} · ${esc(clock(activity.startedAt))}–${esc(clock(activity.endedAt))}</div></div><div class="sport-chip-v510">${esc(formatMinutes(minutes))}</div></article>`).join('')}</div>`:emptyCard('Noch keine Aktivitäten','Kurse und einzelne Trainingsaktivitäten werden hier als Verlauf zusammengeführt.');
    return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v512="activities">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span> AKTIVITÄTEN</div><p class="sport-date-v510">${flat.length?`${flat.length} dokumentierte Aktivität${flat.length===1?'':'en'}`:'Dein Sportverlauf'}</p><div class="sport-duration-row-v510"><div class="sport-duration-v510 sport-duration-small-v512">${flat.length}</div><div class="sport-duration-unit-v510">Einträge</div></div></div>${body}</section>`;
  }

  function statisticsPanel(rows){
    const total=rows.reduce((sum,row)=>sum+totalMinutes(row),0),active=rows.reduce((sum,row)=>sum+activityMinutes(row),0),other=Math.max(0,total-active),longest=rows.reduce((best,row)=>Math.max(best,totalMinutes(row)),0);
    return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v512="statistics">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span> STATISTIK</div><p class="sport-date-v510">Sportzeit auf einen Blick</p><div class="sport-duration-row-v510"><div class="sport-duration-v510" data-total-minutes="${total}">${esc(formatMinutes(total).replace(' h',''))}</div><div class="sport-duration-unit-v510">Gesamtzeit</div></div></div><div class="sport-content-v510"><div class="sport-stat-grid-v512"><article class="sport-stat-card-v512"><span>Einheiten</span><strong>${rows.length}</strong></article><article class="sport-stat-card-v512"><span>Aktiv / Kurs</span><strong>${esc(formatMinutes(active))}</strong></article><article class="sport-stat-card-v512"><span>Drumherum</span><strong>${esc(formatMinutes(other))}</strong></article><article class="sport-stat-card-v512"><span>Längste Einheit</span><strong>${esc(formatMinutes(longest))}</strong></article></div><div class="sport-stat-meter-v512"><div style="--sport-stat-pct-v512:${total?Math.min(100,(active/total)*100):0}%"></div></div></div></section>`;
  }

  function panel(rows){
    if(activeTab==='xtraining')return xTrainingPanel(rows);
    if(activeTab==='activities')return activitiesPanel(rows);
    if(activeTab==='statistics')return statisticsPanel(rows);
    return fitxPanel(rows);
  }

  function bind(root){
    root.querySelectorAll('[data-sport-tab-v512]').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.sportTabV512,{animate:true,persist:true})));
  }

  function animateCount(){
    if(reducedMotion())return;
    const el=document.querySelector(`#${ROOT_ID} [data-sport-panel-v512="${activeTab}"] .sport-duration-v510[data-total-minutes]`);if(!el)return;
    const target=Math.max(0,Number(el.dataset.totalMinutes)||0),start=performance.now(),duration=420;
    function frame(now){const p=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-p,3),value=Math.round(target*eased);el.textContent=formatMinutes(value).replace(' h','');if(p<1)requestAnimationFrame(frame);}requestAnimationFrame(frame);
  }

  function render({animate=false}={}){
    const root=document.getElementById(ROOT_ID);if(!root||!api())return false;
    rendering=true;
    root.dataset.sportTabV512=activeTab;
    root.innerHTML=`<div class="sport-stage-v510 sport-stage-v512">${tabRail()}${panel(sessions())}</div>`;
    bind(root);
    if(animate&&!reducedMotion()){
      root.classList.remove('sport-tab-switch-v512');void root.offsetWidth;root.classList.add('sport-tab-switch-v512');
      setTimeout(()=>root.classList.remove('sport-tab-switch-v512'),520);
      animateCount();
    }
    rendering=false;
    return true;
  }

  function setTab(id,{animate=true,persist=true}={}){
    const next=validTab(id);if(next===activeTab){if(animate&&!reducedMotion()){const root=document.getElementById(ROOT_ID);root?.classList.remove('sport-tab-bounce-v512');if(root){void root.offsetWidth;root.classList.add('sport-tab-bounce-v512');setTimeout(()=>root.classList.remove('sport-tab-bounce-v512'),360);}}return activeTab;}
    activeTab=next;
    if(persist){try{localStorage.setItem(TAB_KEY,activeTab);}catch(_){}}
    render({animate});
    return activeTab;
  }

  function startObserver(){
    const root=document.getElementById(ROOT_ID);if(!root||observer)return;
    observer=new MutationObserver(()=>{
      if(rendering)return;
      if(!root.querySelector('[data-sport-tab-v512="statistics"]'))queueMicrotask(()=>render({animate:false}));
    });
    observer.observe(root,{childList:true,subtree:false});
  }

  function init(){
    const stored=validTab(localStorage.getItem(TAB_KEY)||'fitx');activeTab=stored;
    if(!api()||!document.getElementById(ROOT_ID))return false;
    render({animate:false});startObserver();return true;
  }

  function boot(){
    let tries=0;clearInterval(bootTimer);bootTimer=setInterval(()=>{tries++;if(init()||tries>240){clearInterval(bootTimer);bootTimer=null;}},100);
  }

  window.__modSportTabsV512={version:VERSION,tabs:TABS.map(tab=>({...tab})),render,setTab,currentTab:()=>activeTab,tabKey:TAB_KEY,noDataMigration:true};
  boot();
  window.addEventListener('load',()=>setTimeout(()=>{init();},180));
  window.addEventListener('focus',()=>setTimeout(()=>render({animate:false}),80));
})();
