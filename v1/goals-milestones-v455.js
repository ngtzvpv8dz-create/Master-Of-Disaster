/* V455 · ZIELE & MEILENSTEINE
   Editierbare Projektziele plus automatisch erkannte runde Meilensteine.
*/
(function(){
  const BUILD_VERSION='V455';
  const STORAGE_KEY='masterOfDisasterGoalsV455';
  const PROGRESS_KEY='masterOfDisasterGoalProgressV455';
  const DEFAULTS={archiveTasks:250,activeHours:100,activeDays:30,weightedTasks:100};
  const MILESTONES={archiveTasks:[50,100,150,200,250,300,400,500,750,1000],activeHours:[25,50,75,100,150,200,300,500],activeDays:[10,20,25,30,40,50,75,100,150,200],weightedTasks:[10,25,50,75,100,150,200,300,500]};

  function num(value){const n=Number(value);return Number.isFinite(n)?n:0;}
  function esc(value){return typeof escapeHtml==='function'?escapeHtml(String(value??'')):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function readJson(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function isTest(row){try{if(typeof isArchivedTest==='function')return !!isArchivedTest(row);if(typeof isTestTask==='function')return !!isTestTask(row);}catch(_){}return /\(\s*test\s*\)/i.test(String(row&&row.text||''));}
  function dateKey(row){
    if(row&&row.completedDate)return String(row.completedDate).slice(0,10);
    const raw=row&&(row.completedAt||row.archivedAt||row.abortedAt);if(!raw)return null;
    const d=new Date(raw);if(!Number.isFinite(d.getTime()))return null;
    try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}catch(_){return d.toISOString().slice(0,10);}
  }
  function activeMs(row){try{if(typeof getArchiveAccountingActiveMs==='function')return Math.max(0,num(getArchiveAccountingActiveMs(row)));}catch(_){}return Math.max(0,num(row&&row.archiveAccountingActiveDurationMs)||num(row&&row.activeDurationMs)||num(row&&row.actualDurationMs));}
  function weighted(row){return num(row&&row.weightedActiveDurationMs)>0||num(row&&row.historicalWeightKg)>0||num(row&&row.weightInfo&&row.weightInfo.weightKg)>0;}
  function totals(){
    const rows=(Array.isArray(archive)?archive:[]).filter(row=>row&&!isTest(row)&&String(row.status)!=='aborted');
    return {
      archiveTasks:rows.length,
      activeHours:rows.reduce((sum,row)=>sum+activeMs(row),0)/3600000,
      activeDays:new Set(rows.map(dateKey).filter(Boolean)).size,
      weightedTasks:rows.filter(weighted).length
    };
  }
  function goals(){const stored=readJson(STORAGE_KEY,{});return {...DEFAULTS,...(stored&&typeof stored==='object'?stored:{})};}
  function setGoals(next){
    const clean={};
    for(const key of Object.keys(DEFAULTS)){const value=Math.max(1,Math.round(num(next&&next[key])));clean[key]=value||DEFAULTS[key];}
    writeJson(STORAGE_KEY,clean);renderGoals();return clean;
  }
  function percent(value,target){return target>0?Math.max(0,Math.min(100,value/target*100)):0;}
  function fmtValue(key,value){if(key==='activeHours')return value.toFixed(1).replace('.',',')+' h';return Math.round(value).toLocaleString('de-DE');}
  function label(key){return {archiveTasks:'ARCHIVAUFGABEN',activeHours:'AKTIVE STUNDEN',activeDays:'NUTZUNGSTAGE',weightedTasks:'AUFGABEN MIT ZUSATZGEWICHT'}[key]||key;}
  function icon(key){return {archiveTasks:'📦',activeHours:'⏱️',activeDays:'📅',weightedTasks:'🏋️'}[key]||'🏆';}
  function nextMilestone(key,value){return (MILESTONES[key]||[]).find(mark=>mark>value)||null;}
  function reachedMilestones(current){
    const result=[];
    for(const key of Object.keys(MILESTONES))for(const mark of MILESTONES[key])if(current[key]>=mark)result.push({key,mark});
    return result;
  }
  function checkNewMilestones(){
    const current=totals();const previous=readJson(PROGRESS_KEY,null);writeJson(PROGRESS_KEY,current);
    if(!previous)return;
    for(const key of Object.keys(MILESTONES))for(const mark of MILESTONES[key]){
      if(num(previous[key])<mark&&current[key]>=mark){
        try{window.__modLiveLogV453?.append?.('SYSTEM','PASS',`Meilenstein erreicht: ${label(key)} · ${key==='activeHours'?mark+' h':mark}`);}catch(_){}
      }
    }
  }
  function injectStyle(){
    if(document.getElementById('goalsMilestonesV455Style'))return;
    const style=document.createElement('style');style.id='goalsMilestonesV455Style';style.textContent=`
      .goals-v455{display:grid;gap:12px}.goal-grid-v455{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.goal-card-v455{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px;background:rgba(255,255,255,.035)}.goal-head-v455{display:flex;justify-content:space-between;gap:8px;font-size:.8rem;font-weight:800}.goal-value-v455{font-size:1.18rem;font-weight:850;margin:7px 0}.goal-track-v455{height:9px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden}.goal-fill-v455{height:100%;background:linear-gradient(90deg,#d7a23a,#67a8d8);border-radius:inherit}.goal-sub-v455{opacity:.72;font-size:.8rem;margin-top:6px}.milestones-v455{display:flex;flex-wrap:wrap;gap:7px}.milestone-v455{padding:6px 9px;border:1px solid rgba(95,185,120,.32);border-radius:999px;font-size:.76rem;background:rgba(95,185,120,.08)}.goal-edit-v455{margin-top:4px}@media(max-width:560px){.goal-grid-v455{grid-template-columns:1fr}}
      .goal-modal-grid-v455{display:grid;gap:10px;margin:14px 0}.goal-modal-row-v455{display:grid;grid-template-columns:1fr 110px;gap:10px;align-items:center}.goal-modal-row-v455 input{width:100%;box-sizing:border-box}
    `;document.head.appendChild(style);
  }
  function card(key,current,target){
    const pct=percent(current,target),next=nextMilestone(key,current);const done=current>=target;
    return `<div class="goal-card-v455"><div class="goal-head-v455"><span>${icon(key)} ${label(key)}</span><span>${done?'✅':'🎯'}</span></div><div class="goal-value-v455">${esc(fmtValue(key,current))} / ${esc(fmtValue(key,target))}</div><div class="goal-track-v455"><div class="goal-fill-v455" style="width:${pct.toFixed(1)}%"></div></div><div class="goal-sub-v455">${done?'Ziel erreicht':pct.toFixed(1).replace('.',',')+' %'}${next?` · nächste runde Marke: ${esc(fmtValue(key,next))}`:''}</div></div>`;
  }
  function renderGoals(){
    if(typeof currentTab==='undefined'||currentTab!=='statistics')return;
    injectStyle();const host=document.getElementById('viewContainer');if(!host)return;
    document.getElementById('goalsMilestonesV455')?.remove();
    const current=totals(),target=goals(),reached=reachedMilestones(current).slice(-14).reverse();
    const details=document.createElement('details');details.id='goalsMilestonesV455';details.className='statistics-collapsible-v452';details.dataset.defaultCollapsed='true';
    details.innerHTML=`<summary>🏆 ZIELE & MEILENSTEINE · ${BUILD_VERSION}</summary><div class="goals-v455"><div class="goal-grid-v455">${Object.keys(DEFAULTS).map(key=>card(key,current[key],target[key])).join('')}</div><div><div class="statistics-section-title">ERREICHTE MEILENSTEINE</div><div class="milestones-v455">${reached.length?reached.map(item=>`<span class="milestone-v455">✅ ${esc(label(item.key))} · ${esc(fmtValue(item.key,item.mark))}</span>`).join(''):'<span class="statistics-empty-small">Noch keine runde Marke erreicht.</span>'}</div></div><button class="option-button goal-edit-v455" id="editGoalsV455">🎯 ZIELE BEARBEITEN</button></div>`;
    const anchor=document.getElementById('extendedStatsV403');if(anchor&&anchor.parentNode===host)host.insertBefore(details,anchor);else host.prepend(details);
    document.getElementById('editGoalsV455')?.addEventListener('click',openEditor);
  }
  function openEditor(){
    const modal=document.getElementById('modalContainer');if(!modal)return;const current=goals();
    modal.innerHTML=`<div class="modal-overlay"><div class="modal"><div class="modal-title">🏆 ZIELE BEARBEITEN</div><div class="category-page-help-v412">Die Werte sind persönliche Zielmarken. Die erreichten Meilensteine werden unabhängig davon automatisch aus dem Archiv erkannt.</div><div class="goal-modal-grid-v455">${Object.keys(DEFAULTS).map(key=>`<label class="goal-modal-row-v455"><span>${icon(key)} ${label(key)}</span><input id="goal-${key}-v455" type="number" min="1" step="1" value="${Math.round(current[key])}"></label>`).join('')}</div><div class="modal-actions"><button class="modal-button secondary" id="goalsCancelV455">ABBRECHEN</button><button class="modal-button primary" id="goalsSaveV455">SPEICHERN</button></div></div></div>`;
    document.getElementById('goalsCancelV455')?.addEventListener('click',()=>modal.innerHTML='');
    document.getElementById('goalsSaveV455')?.addEventListener('click',()=>{const next={};for(const key of Object.keys(DEFAULTS))next[key]=document.getElementById(`goal-${key}-v455`)?.value;setGoals(next);modal.innerHTML='';if(typeof render==='function')render();});
  }
  const previousRender=typeof render==='function'?render:null;
  if(previousRender){window.render=function(){const result=previousRender.apply(this,arguments);setTimeout(()=>{renderGoals();checkNewMilestones();},0);return result;};}
  window.__modGoalsMilestonesV455={version:BUILD_VERSION,totals,goals,setGoals,renderGoals,reachedMilestones};
  window.addEventListener('load',()=>setTimeout(()=>{checkNewMilestones();renderGoals();},500));
})();
