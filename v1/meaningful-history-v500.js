/* V500 · MEANINGFUL HISTORY
   - rote-R-Liste zeigt nur relevante, verständliche Änderungen
   - automatische Reihenfolge-/Nachrückänderungen werden nicht als Restore-Punkte angeboten
   - vorhandene V498-Punkte werden, soweit sicher möglich, mit aussagekräftigen Log-Ereignissen verknüpft
   - 7-Tage-Log wird kompakter dargestellt
*/
(function(){
  'use strict';

  const BUILD_VERSION='V500';
  const DB_NAME='MasterOfDisasterSafetyNetV498';
  const DB_VERSION=1;
  const POINT_STORE='recoveryPoints';
  const LOG_STORE='logEntries';
  const LIVE_LOG_KEY='masterOfDisasterLiveLogV453';
  const TASKS_KEY='masterOfDisasterTasks';
  const ARCHIVE_KEY='masterOfDisasterArchive';
  const WEIGHT_STATE_KEY='masterOfDisasterWeightState';
  const WEIGHT_PHASES_KEY='masterOfDisasterWeightPhases';
  const IMPORTANT_KEYS=new Set([TASKS_KEY,ARCHIVE_KEY,WEIGHT_STATE_KEY,WEIGHT_PHASES_KEY]);
  const RETENTION_MS=7*24*60*60*1000;

  let dbPromise=null;
  let lastState=null;
  let lastFullSnapshot=null;
  let captureTimer=null;
  let captureChain=Promise.resolve();
  let installed=false;

  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const clone=value=>{try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}};
  const safeParse=(raw,fallback)=>{try{const v=JSON.parse(raw);return v??fallback;}catch(_){return fallback;}};
  const same=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b);}catch(_){return false;}};
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const nowIso=()=>new Date().toISOString();

  function berlinParts(value=new Date()){
    const date=value instanceof Date?value:new Date(value);
    const parts=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,weekday:'short'}).formatToParts(date);
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return {dateKey:`${p.year}-${p.month}-${p.day}`,dateLabel:`${p.weekday}, ${p.day}.${p.month}.${p.year}`,clock:`${p.hour}:${p.minute}:${p.second}`};
  }

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('History-Datenbank konnte nicht geöffnet werden.'));
    });
    return dbPromise;
  }
  async function getAll(storeName){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(storeName,'readonly').objectStore(storeName).getAll();
      req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]);
      req.onerror=()=>reject(req.error||new Error('History konnte nicht gelesen werden.'));
    });
  }
  async function put(storeName,row){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,'readwrite');
      tx.objectStore(storeName).put(clone(row));
      tx.oncomplete=()=>resolve(row);
      tx.onerror=()=>reject(tx.error||new Error('History konnte nicht gespeichert werden.'));
    });
  }
  async function deleteIds(storeName,ids){
    if(!ids.length)return;
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,'readwrite');
      const store=tx.objectStore(storeName);
      ids.forEach(id=>store.delete(id));
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('History konnte nicht bereinigt werden.'));
    });
  }

  function readTasks(){return safeParse(localStorage.getItem(TASKS_KEY)||'[]',[]);}
  function readArchive(){return safeParse(localStorage.getItem(ARCHIVE_KEY)||'[]',[]);}
  function readWeightStateRaw(){return localStorage.getItem(WEIGHT_STATE_KEY);}
  function readWeightPhasesRaw(){return localStorage.getItem(WEIGHT_PHASES_KEY);}
  function taskMap(rows){const map=new Map();(Array.isArray(rows)?rows:[]).forEach((row,index)=>map.set(String(row?.id??`idx-${index}`),clone(row)));return map;}
  function archiveKey(row,index){return String(row?.archiveNumber??row?.archiveId??`idx-${index}`);}
  function archiveMap(rows){const map=new Map();(Array.isArray(rows)?rows:[]).forEach((row,index)=>map.set(archiveKey(row,index),clone(row)));return map;}
  function fullSnapshot(){return window.__modRecoveryHistoryV498?.captureSnapshot?.()||{schemaVersion:1,capturedAt:nowIso(),storage:{}};}
  function captureState(){return {tasks:readTasks(),archive:readArchive(),weightStateRaw:readWeightStateRaw(),weightPhasesRaw:readWeightPhasesRaw()};}

  function timingSignature(task){
    if(!task)return '';
    return JSON.stringify({startedAt:task.startedAt||null,pausedAt:task.pausedAt||null,completedAt:task.completedAt||null,abortedAt:task.abortedAt||null,activeDurationMs:task.activeDurationMs??null,actualDurationMs:task.actualDurationMs??null,pauseTotalMs:task.pauseTotalMs??null,activeSegments:Array.isArray(task.activeSegments)?task.activeSegments:[]});
  }
  function taskWeightSignature(task){return JSON.stringify(Array.isArray(task?.weightActiveSegments)?task.weightActiveSegments:[]);}
  function taskName(task){return clean(task?.text)||'Unbenannte Aufgabe';}
  function valueText(value){if(value==null||value==='')return 'leer';return clean(value);}
  function priorityText(value){const v=clean(value).toLowerCase();return ({low:'niedrig',medium:'mittel',high:'hoch'}[v]||valueText(value));}

  function statusLabel(before,after){
    const name=taskName(after||before),status=after?.status;
    if(status==='completed')return `Aufgabe abgeschlossen: „${name}“`;
    if(status==='aborted')return `Aufgabe abgebrochen: „${name}“`;
    if(status==='paused')return `Aufgabe pausiert: „${name}“`;
    if(status==='running'&&before?.status==='paused')return `Aufgabe fortgesetzt: „${name}“`;
    if(status==='running')return `Aufgabe gestartet: „${name}“`;
    if(status==='open')return `Aufgabe wieder geöffnet: „${name}“`;
    return `Status geändert: „${name}“ · ${valueText(before?.status)} → ${valueText(status)}`;
  }

  function pushTaskEdits(events,before,after){
    const name=taskName(after);
    if(before.text!==after.text)events.push({label:`Titel geändert: „${taskName(before)}“ → „${name}“`,area:'EDIT',priority:90,quick:true});
    if(before.category!==after.category)events.push({label:`Kategorie geändert: „${name}“ · ${valueText(before.category)} → ${valueText(after.category)}`,area:'EDIT',priority:72,quick:true});
    if(before.priority!==after.priority)events.push({label:`Priorität geändert: „${name}“ · ${priorityText(before.priority)} → ${priorityText(after.priority)}`,area:'EDIT',priority:72,quick:true});
    if(before.type!==after.type)events.push({label:`Aufgabentyp geändert: „${name}“ · ${valueText(before.type)} → ${valueText(after.type)}`,area:'EDIT',priority:70,quick:true});
    if(Boolean(before.optional)!==Boolean(after.optional))events.push({label:`Optional geändert: „${name}“ · ${before.optional?'ja':'nein'} → ${after.optional?'ja':'nein'}`,area:'EDIT',priority:65,quick:true});
    if(before.dueMode!==after.dueMode||before.dueDate!==after.dueDate)events.push({label:`Fälligkeit geändert: „${name}“ · ${valueText(before.dueDate||before.dueMode)} → ${valueText(after.dueDate||after.dueMode)}`,area:'EDIT',priority:78,quick:true});
    if(before.todayDate!==after.todayDate){
      const label=after.todayDate?`Für HEUTE markiert: „${name}“`:`Aus HEUTE entfernt: „${name}“`;
      events.push({label,area:'EDIT',priority:18,quick:false});
    }
  }

  function detectTaskEvents(beforeRows,afterRows){
    const events=[],beforeMap=taskMap(beforeRows),afterMap=taskMap(afterRows);
    for(const [id,after] of afterMap){
      const before=beforeMap.get(id);
      if(!before){events.push({label:`Aufgabe erstellt: „${taskName(after)}“`,area:'TASK',priority:62,quick:true,taskId:id,before:null,after});continue;}
      if(before.status!==after.status){events.push({label:statusLabel(before,after),area:'TASK',priority:100,quick:true,taskId:id,before,after});continue;}
      if(timingSignature(before)!==timingSignature(after))events.push({label:`Arbeitszeiten geändert: „${taskName(after)}“`,area:'EDIT',priority:92,quick:true,taskId:id,before,after});
      if(taskWeightSignature(before)!==taskWeightSignature(after))events.push({label:`Zusatzgewicht der Aufgabe geändert: „${taskName(after)}“`,area:'WEIGHT',priority:90,quick:true,taskId:id,before,after});
      const edits=[];pushTaskEdits(edits,before,after);edits.forEach(event=>events.push({...event,taskId:id,before,after}));
    }
    for(const [id,before] of beforeMap){
      if(!afterMap.has(id))events.push({label:`Aufgabe gelöscht: „${taskName(before)}“`,area:'TASK',priority:98,quick:true,taskId:id,before,after:null});
    }
    return events;
  }

  function detectArchiveEvents(beforeRows,afterRows){
    const events=[],before=archiveMap(beforeRows),after=archiveMap(afterRows);
    for(const [id,row] of after){
      if(before.has(id))continue;
      const no=row?.archiveNumber!=null?`A${String(row.archiveNumber).padStart(3,'0')} · `:'';
      events.push({label:`Archiviert: ${no}${taskName(row)}`,area:'ARCHIVE',priority:96,quick:true,archiveNumber:row?.archiveNumber??null});
    }
    return events;
  }

  function weightKg(state){return Number(state&&((state.currentPhaseWeightKg!=null)?state.currentPhaseWeightKg:state.currentWeightKg))||null;}
  function detectWeightEvents(beforeStateRaw,afterStateRaw,beforePhasesRaw,afterPhasesRaw){
    if(beforeStateRaw===afterStateRaw&&beforePhasesRaw===afterPhasesRaw)return [];
    const b=safeParse(beforeStateRaw||'{}',{}),a=safeParse(afterStateRaw||'{}',{}),events=[];
    const bOn=!!b.isWearing,aOn=!!a.isWearing,bKg=weightKg(b),aKg=weightKg(a);
    if(!bOn&&aOn)events.push({label:`Zusatzgewicht gestartet${aKg?` · ${String(aKg).replace('.',',')} kg`:''}`,area:'WEIGHT',priority:94,quick:true,weightDelta:{before:{state:beforeStateRaw,phases:beforePhasesRaw},after:{state:afterStateRaw,phases:afterPhasesRaw}}});
    else if(bOn&&!aOn)events.push({label:`Zusatzgewicht beendet${bKg?` · ${String(bKg).replace('.',',')} kg`:''}`,area:'WEIGHT',priority:94,quick:true,weightDelta:{before:{state:beforeStateRaw,phases:beforePhasesRaw},after:{state:afterStateRaw,phases:afterPhasesRaw}}});
    else if(aOn&&bKg!==aKg)events.push({label:`Zusatzgewicht geändert · ${bKg?String(bKg).replace('.',',')+' kg → ':''}${aKg?String(aKg).replace('.',',')+' kg':'kein Gewicht'}`,area:'WEIGHT',priority:91,quick:true,weightDelta:{before:{state:beforeStateRaw,phases:beforePhasesRaw},after:{state:afterStateRaw,phases:afterPhasesRaw}}});
    else if(beforePhasesRaw!==afterPhasesRaw)events.push({label:'Zusatzgewicht-Zeiten geändert',area:'WEIGHT',priority:88,quick:true,weightDelta:{before:{state:beforeStateRaw,phases:beforePhasesRaw},after:{state:afterStateRaw,phases:afterPhasesRaw}}});
    return events;
  }

  function isLowValueLog(row){
    const msg=clean(row?.message);
    return msg==='App-Daten geändert'||/^Aufgabe bearbeitet: .* · Heute$/i.test(msg);
  }
  function isMeaningfulLog(row){
    const msg=clean(row?.message);
    if(!msg||isLowValueLog(row))return false;
    return /^(Aufgabe (abgeschlossen|abgebrochen|pausiert|gestartet|fortgesetzt|gelöscht|wieder geöffnet|erstellt)|Zeitdaten geändert|Arbeitszeiten geändert|Titel geändert|Kategorie geändert|Priorität geändert|Fälligkeit geändert|Aufgabentyp geändert|Archiviert:|Zusatzgewicht)/i.test(msg);
  }

  function readLiveLogs(){return safeParse(localStorage.getItem(LIVE_LOG_KEY)||'[]',[]);}
  function writeLiveLogs(rows){localStorage.setItem(LIVE_LOG_KEY,JSON.stringify(rows));}

  async function sanitizeLogs(){
    const rows=readLiveLogs(),kept=rows.filter(row=>!isLowValueLog(row));
    if(kept.length!==rows.length)writeLiveLogs(kept);
    const stored=await getAll(LOG_STORE);
    const bad=stored.filter(isLowValueLog).map(row=>row.id).filter(Boolean);
    await deleteIds(LOG_STORE,bad);
  }

  function logMatchesEvent(row,event){
    if(!row||!event)return false;
    const age=Math.abs(new Date(row.at).getTime()-Date.now());
    if(!Number.isFinite(age)||age>7000)return false;
    if(event.taskId!=null&&String(row?.meta?.taskId??'')===String(event.taskId)&&!isLowValueLog(row))return true;
    if(event.archiveNumber!=null&&String(row?.meta?.archiveNumber??'')===String(event.archiveNumber))return true;
    if(event.area==='WEIGHT'&&row.area==='WEIGHT')return true;
    return false;
  }

  async function attachLog(event,point){
    let rows=readLiveLogs();
    let index=-1;
    for(let i=rows.length-1;i>=0;i--){if(logMatchesEvent(rows[i],event)){index=i;break;}}
    if(index>=0){
      rows[index]={...rows[index],meta:{...(rows[index].meta||{}),recoveryPointId:point.id,recoveryAvailable:true}};
      writeLiveLogs(rows);
      await put(LOG_STORE,rows[index]);
      return rows[index];
    }
    const entry=window.__modLiveLogV453?.append?.(event.area||'EDIT','INFO',event.label,event.taskId!=null?{taskId:event.taskId,recoveryPointId:point.id,recoveryAvailable:true}:{recoveryPointId:point.id,recoveryAvailable:true});
    if(entry){await put(LOG_STORE,entry);return entry;}
    return null;
  }

  async function saveMeaningfulPoint(event,beforeFull){
    const delta=event.taskId!=null?{kind:'task',id:String(event.taskId),before:clone(event.before),after:clone(event.after)}:event.weightDelta?{kind:'weight',before:clone(event.weightDelta.before),after:clone(event.weightDelta.after)}:null;
    const point={id:`rpv500-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,at:nowIso(),version:BUILD_VERSION,type:'meaningful-change',source:BUILD_VERSION,meaningful:true,priority:event.priority||50,label:event.label,area:event.area||'EDIT',snapshot:clone(beforeFull),delta,directState:false};
    await put(POINT_STORE,point);
    await attachLog(event,point);
    return point;
  }

  function queueCapture(delay=650){
    if(!installed)return;
    clearTimeout(captureTimer);
    captureTimer=setTimeout(()=>{captureChain=captureChain.then(captureMeaningfulChange).catch(error=>console.warn('V500 History-Capture:',error));},delay);
  }

  async function captureMeaningfulChange(){
    if(!lastState||!lastFullSnapshot)return;
    const beforeState=lastState,beforeFull=lastFullSnapshot;
    const afterState=captureState(),afterFull=fullSnapshot();
    lastState=afterState;lastFullSnapshot=afterFull;
    let events=[
      ...detectTaskEvents(beforeState.tasks,afterState.tasks),
      ...detectArchiveEvents(beforeState.archive,afterState.archive),
      ...detectWeightEvents(beforeState.weightStateRaw,afterState.weightStateRaw,beforeState.weightPhasesRaw,afterState.weightPhasesRaw)
    ];
    events=events.filter((event,index,arr)=>arr.findIndex(x=>x.label===event.label&&String(x.taskId??'')===String(event.taskId??''))===index);
    const quickEvents=events.filter(event=>event.quick).sort((a,b)=>(b.priority||0)-(a.priority||0));
    for(const event of quickEvents)await saveMeaningfulPoint(event,beforeFull);
    for(const event of events.filter(event=>!event.quick))window.__modLiveLogV453?.append?.(event.area||'EDIT','INFO',event.label,event.taskId!=null?{taskId:event.taskId}:{});
    await sanitizeLogs();
    installRedR();
  }

  function snapshotTask(point,taskId){
    const raw=point?.snapshot?.storage?.[TASKS_KEY];
    const rows=safeParse(raw||'[]',[]);
    return rows.find(row=>String(row?.id)===String(taskId))||null;
  }
  function pointCanPrecedeLog(point,log){
    if(!point?.snapshot||!log)return false;
    const taskId=log?.meta?.taskId;
    if(taskId==null)return true;
    const task=snapshotTask(point,taskId),msg=clean(log.message);
    if(/^Aufgabe abgeschlossen:/i.test(msg))return !!task&&task.status!=='completed';
    if(/^Aufgabe abgebrochen:/i.test(msg))return !!task&&task.status!=='aborted';
    if(/^Aufgabe gestartet:/i.test(msg)||/^Aufgabe fortgesetzt:/i.test(msg))return !!task&&task.status!=='running';
    if(/^Aufgabe pausiert:/i.test(msg))return !!task&&task.status!=='paused';
    if(/^Aufgabe gelöscht:/i.test(msg))return !!task;
    if(/^Aufgabe erstellt:/i.test(msg))return !task;
    return true;
  }

  async function migrateExistingPoints(){
    const points=(await getAll(POINT_STORE)).filter(point=>!point.meaningful&&new Date(point.at).getTime()>=Date.now()-RETENTION_MS);
    const logs=(await getAll(LOG_STORE)).filter(isMeaningfulLog).sort((a,b)=>new Date(b.at)-new Date(a.at));
    const used=new Set();
    for(const log of logs){
      if(log?.meta?.recoveryPointId){const existing=points.find(p=>p.id===log.meta.recoveryPointId);if(existing&&pointCanPrecedeLog(existing,log)){existing.meaningful=true;existing.source='V500-migrated';existing.label=clean(log.message);existing.priority=80;await put(POINT_STORE,existing);used.add(existing.id);}continue;}
      const ts=new Date(log.at).getTime();
      const candidates=points.filter(point=>!used.has(point.id)&&pointCanPrecedeLog(point,log)&&Math.abs(new Date(point.at).getTime()-ts)<=5000)
        .sort((a,b)=>Math.abs(new Date(a.at).getTime()-ts)-Math.abs(new Date(b.at).getTime()-ts));
      const point=candidates[0];if(!point)continue;
      point.meaningful=true;point.source='V500-migrated';point.label=clean(log.message);point.priority=80;
      await put(POINT_STORE,point);used.add(point.id);
      const live=readLiveLogs();const idx=live.findIndex(row=>String(row.id)===String(log.id));if(idx>=0){live[idx]={...live[idx],meta:{...(live[idx].meta||{}),recoveryPointId:point.id,recoveryAvailable:true}};writeLiveLogs(live);await put(LOG_STORE,live[idx]);}
    }
  }

  async function meaningfulPoints(limit=5){
    const rows=await getAll(POINT_STORE),cutoff=Date.now()-RETENTION_MS;
    return rows.filter(point=>point?.meaningful===true&&new Date(point.at).getTime()>=cutoff&&!/^App-Daten geändert$/i.test(clean(point.label))&&!/· Heute$/i.test(clean(point.label)))
      .sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,limit);
  }

  function closeModal(){document.getElementById('modSafetyNetModalV498')?.remove();}
  async function openQuickHistory(){
    const points=await meaningfulPoints(5);
    closeModal();
    const root=document.createElement('div');root.id='modSafetyNetModalV498';root.className='mod-modal-v498';
    const rows=points.map(point=>{const t=berlinParts(point.at);return `<div class="mod-point-v498"><div class="mod-point-time-v498">${esc(t.clock.slice(0,5))}</div><div class="mod-point-label-v498">${esc(point.label)}<small>${esc(t.dateLabel)}</small></div><button type="button" class="mod-action-v498" data-v500-point="${esc(point.id)}">AUSWÄHLEN</button></div>`;}).join('');
    root.innerHTML=`<div class="mod-modal-card-v498"><div class="mod-modal-head-v498"><h3>RÜCKGÄNGIG / WIEDERHERSTELLUNG</h3><button type="button" class="mod-close-v498" data-v500-close>✕</button></div><div class="mod-point-list-v498">${rows||'<div style="opacity:.7;padding:8px">Noch kein relevanter Wiederherstellungspunkt vorhanden.</div>'}</div><div style="margin-top:12px"><button type="button" class="mod-action-v498 primary" data-v500-more>WEITERE IM 7-TAGE-LOG</button></div></div>`;
    document.body.appendChild(root);
    root.querySelector('[data-v500-close]')?.addEventListener('click',closeModal);root.addEventListener('click',event=>{if(event.target===root)closeModal();});
    root.querySelectorAll('[data-v500-point]').forEach(btn=>btn.addEventListener('click',()=>window.__modRecoveryHistoryV498?.openPoint?.(btn.dataset.v500Point)));
    root.querySelector('[data-v500-more]')?.addEventListener('click',()=>{closeModal();try{switchTab('log');}catch(_){}setTimeout(()=>{const chip=document.querySelector('[data-recovery-only-v498]');if(chip&&!chip.classList.contains('active'))chip.click();},120);});
  }

  function installRedR(){
    const btn=document.querySelector('.mod-undo-r-v498');if(!btn)return false;
    if(btn.dataset.meaningfulV500==='1')return true;
    btn.dataset.meaningfulV500='1';btn.onclick=openQuickHistory;btn.title='Rückgängig / relevante Wiederherstellung';
    return true;
  }

  function injectCompactLogStyle(){
    if(document.getElementById('modMeaningfulHistoryV500Style'))return;
    const style=document.createElement('style');style.id='modMeaningfulHistoryV500Style';style.textContent=`
      .mod-log-v498{gap:7px!important;font-size:10.5px!important;line-height:1.28!important}
      .mod-log-v498 h2{font-size:13px!important;margin:0 0 2px!important;letter-spacing:.03em}
      .mod-log-v498 h2+div{font-size:9.5px!important}
      .mod-log-toolbar-v498{gap:4px!important}
      .mod-log-chip-v498{padding:4px 7px!important;font-size:9px!important}
      .mod-log-search-v498{padding:6px 8px!important;font-size:10px!important;border-radius:7px!important}
      .mod-log-day-v498{border-radius:8px!important}
      .mod-log-day-v498>summary{padding:6px 8px!important;font-size:10.5px!important}
      .mod-log-day-body-v498{gap:3px!important;padding:0 5px 5px!important}
      .mod-log-row-v498{grid-template-columns:52px 48px minmax(0,1fr) auto!important;gap:5px!important;padding:5px 6px!important;border-radius:6px!important;font-size:10px!important;line-height:1.25!important}
      .mod-log-time-v498{font-size:9.5px!important}.mod-log-area-v498{font-size:8.5px!important}.mod-log-message-v498{min-width:0}
      .mod-recovery-badge-v498{padding:3px 5px!important;font-size:8px!important;border-radius:5px!important}
      @media(max-width:560px){.mod-log-row-v498{grid-template-columns:48px 43px minmax(0,1fr)!important}.mod-log-area-v498{grid-column:auto!important}.mod-log-message-v498{grid-column:3!important}.mod-recovery-badge-v498{grid-column:2/4!important;justify-self:start}}
    `;document.head.appendChild(style);
  }

  function patchStorage(){
    if(Storage.prototype.setItem.__modMeaningfulV500)return;
    const baseSet=Storage.prototype.setItem,baseRemove=Storage.prototype.removeItem;
    const wrappedSet=function(key,value){const out=baseSet.apply(this,arguments);try{if(this===localStorage&&IMPORTANT_KEYS.has(String(key)))queueCapture();}catch(_){}return out;};
    const wrappedRemove=function(key){const out=baseRemove.apply(this,arguments);try{if(this===localStorage&&IMPORTANT_KEYS.has(String(key)))queueCapture();}catch(_){}return out;};
    wrappedSet.__modMeaningfulV500=true;wrappedRemove.__modMeaningfulV500=true;Storage.prototype.setItem=wrappedSet;Storage.prototype.removeItem=wrappedRemove;
  }

  async function init(){
    if(installed)return;installed=true;
    await openDb();injectCompactLogStyle();
    lastState=captureState();lastFullSnapshot=fullSnapshot();
    patchStorage();await sanitizeLogs();await migrateExistingPoints();installRedR();
    const observer=new MutationObserver(()=>installRedR());observer.observe(document.body,{childList:true,subtree:true});
    setInterval(()=>{installRedR();sanitizeLogs().catch(()=>{});},5000);
    window.addEventListener('focus',()=>{installRedR();queueCapture(250);});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){installRedR();queueCapture(250);}});
    window.__modMeaningfulHistoryV500={version:BUILD_VERSION,meaningfulPoints,openQuickHistory,sanitizeLogs,migrateExistingPoints,captureMeaningfulChange};
    try{window.__modLiveLogV453?.append?.('SYSTEM','PASS','Relevante Wiederherstellung V500 aktiv · automatische Positionsänderungen ausgeblendet');}catch(_){}
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(window.__modRecoveryHistoryV498&&window.__modLiveLogV453){clearInterval(timer);init().catch(error=>console.error('V500 Initialisierung:',error));}else if(tries>120)clearInterval(timer);},100);
})();
