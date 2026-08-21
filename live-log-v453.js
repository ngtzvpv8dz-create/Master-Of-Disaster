/* V453 · ROLLING 24H LIVE LOG
   Relevante App-Ereignisse lokal protokollieren, ohne Polling-Spam.
   Der Log ist ein rollierendes 24-Stunden-Fenster und wird nicht mit Supabase synchronisiert.
*/
(function(){
  const STORAGE_KEY='masterOfDisasterLiveLogV453';
  const WINDOW_MS=24*60*60*1000;
  const MAX_ENTRIES=5000;
  const FILTERS=['ALL','TASK','EDIT','ARCHIVE','WEIGHT','SYNC','REMOTE','SYSTEM','WARN','ERROR'];
  let activeFilter='ALL';
  let liveFollow=true;
  let taskSnapshot=snapshotTasks();
  let archiveSnapshot=snapshotArchive();
  let weightSnapshot=snapshotWeight();
  const recentMessages=new Map();

  function nowIso(){return new Date().toISOString();}
  function cleanText(value){return String(value??'').replace(/\s+/g,' ').trim();}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function safeParse(raw,fallback){try{const value=JSON.parse(raw);return value??fallback;}catch(_){return fallback;}}
  function readRaw(){try{return safeParse(localStorage.getItem(STORAGE_KEY),[]);}catch(_){return [];}}
  function writeRaw(entries){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(entries));return true;}catch(_){return false;}}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}}
  function idKey(row,index){return String(row&&row.id!=null?row.id:`idx-${index}`);}
  function archiveKey(row,index){return String(row&&row.archiveNumber!=null?`A${row.archiveNumber}`:(row&&row.archiveId)||`idx-${index}`);}
  function arrayMap(rows,keyFn){const map=new Map();(Array.isArray(rows)?rows:[]).forEach((row,index)=>map.set(keyFn(row,index),clone(row)));return map;}
  function snapshotTasks(){return arrayMap(typeof tasks!=='undefined'?tasks:[],idKey);}
  function snapshotArchive(){return arrayMap(typeof archive!=='undefined'?archive:[],archiveKey);}
  function snapshotWeight(){
    const state=typeof weightState!=='undefined'&&weightState?clone(weightState):{};
    const phases=typeof weightPhases!=='undefined'&&Array.isArray(weightPhases)?clone(weightPhases):[];
    return {state,phases};
  }
  function prune(entries=readRaw(),at=Date.now()){
    const cutoff=at-WINDOW_MS;
    const clean=(Array.isArray(entries)?entries:[]).filter(entry=>{
      const ts=new Date(entry&&entry.at).getTime();
      return Number.isFinite(ts)&&ts>=cutoff&&ts<=at+60000;
    }).slice(-MAX_ENTRIES);
    if(clean.length!==(Array.isArray(entries)?entries.length:0))writeRaw(clean);
    return clean;
  }
  function isDuplicate(area,level,message){
    const key=`${area}|${level}|${message}`;
    const now=Date.now(),last=recentMessages.get(key)||0;
    recentMessages.set(key,now);
    for(const [k,ts] of recentMessages)if(now-ts>120000)recentMessages.delete(k);
    return now-last<30000;
  }
  function append(area,level,message,meta){
    area=cleanText(area||'SYSTEM').toUpperCase();
    level=cleanText(level||'INFO').toUpperCase();
    message=cleanText(message);
    if(!message||isDuplicate(area,level,message))return null;
    const entries=prune(readRaw());
    const entry={id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,at:nowIso(),area,level,message};
    if(meta&&typeof meta==='object'&&Object.keys(meta).length)entry.meta=meta;
    entries.push(entry);
    writeRaw(entries.slice(-MAX_ENTRIES));
    if(isLogTab())renderLog();
    return entry;
  }
  function isLogTab(){try{return typeof currentTab!=='undefined'&&currentTab==='log';}catch(_){return false;}}
  function formatDuration(ms){
    ms=Number(ms);if(!Number.isFinite(ms)||ms<0)return null;
    const total=Math.floor(ms/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function formatClock(iso){
    const d=new Date(iso);if(Number.isNaN(d.getTime()))return '--:--:--';
    try{return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);}catch(_){return d.toLocaleTimeString('de-DE');}
  }
  function taskLabel(task){return `„${cleanText(task&&task.text)||'Unbenannte Aufgabe'}“`;}
  function timingSignature(task){
    if(!task)return '';
    return JSON.stringify({startedAt:task.startedAt||null,pausedAt:task.pausedAt||null,completedAt:task.completedAt||null,activeDurationMs:task.activeDurationMs??null,actualDurationMs:task.actualDurationMs??null,pauseTotalMs:task.pauseTotalMs??null,activeSegments:Array.isArray(task.activeSegments)?task.activeSegments:[]});
  }
  function taskEditFields(before,after){
    const fields=[];
    if(before.text!==after.text)fields.push('Titel');
    if(before.category!==after.category)fields.push('Kategorie');
    if(before.type!==after.type)fields.push('Typ');
    if(before.priority!==after.priority)fields.push('Priorität');
    if(Boolean(before.optional)!==Boolean(after.optional))fields.push('Optional');
    if(before.dueMode!==after.dueMode||before.dueDate!==after.dueDate)fields.push('Fälligkeit');
    if(before.todayDate!==after.todayDate||before.todayOrder!==after.todayOrder)fields.push('Heute');
    return fields;
  }
  function logTaskDiff(beforeMap,afterMap){
    for(const [key,after] of afterMap){
      const before=beforeMap.get(key);
      if(!before){
        append(after&&after.remoteCommandV441?'REMOTE':'TASK','INFO',`Aufgabe erstellt: ${taskLabel(after)}`,{taskId:after&&after.id});
        continue;
      }
      if(before.status!==after.status){
        const suffix=formatDuration(after.activeDurationMs);
        if(after.status==='running')append('TASK','INFO',`Aufgabe gestartet: ${taskLabel(after)}`,{taskId:after.id});
        else if(after.status==='paused')append('TASK','INFO',`Aufgabe pausiert: ${taskLabel(after)}`,{taskId:after.id});
        else if(after.status==='completed')append('TASK','PASS',`Aufgabe abgeschlossen: ${taskLabel(after)}${suffix?` · aktiv ${suffix}`:''}`,{taskId:after.id});
        else if(after.status==='aborted')append('TASK','WARN',`Aufgabe abgebrochen: ${taskLabel(after)}`,{taskId:after.id});
        else if(after.status==='open')append('TASK','INFO',`Aufgabe wieder geöffnet: ${taskLabel(after)}`,{taskId:after.id});
        else append('TASK','INFO',`Status geändert: ${taskLabel(after)} · ${cleanText(before.status)} → ${cleanText(after.status)}`,{taskId:after.id});
      }
      const editFields=taskEditFields(before,after);
      if(editFields.length)append('EDIT','INFO',`Aufgabe bearbeitet: ${taskLabel(after)} · ${editFields.join(', ')}`,{taskId:after.id});
      if(before.status===after.status&&timingSignature(before)!==timingSignature(after))append('EDIT','WARN',`Zeitdaten geändert: ${taskLabel(after)}`,{taskId:after.id});
    }
  }
  function logArchiveDiff(beforeMap,afterMap){
    const added=[];
    for(const [key,row] of afterMap)if(!beforeMap.has(key))added.push(row);
    if(!added.length)return;
    added.sort((a,b)=>(Number(a.archiveNumber)||0)-(Number(b.archiveNumber)||0));
    if(added.length<=8){
      for(const row of added)append('ARCHIVE','PASS',`Archiviert: ${row.archiveNumber!=null?`A${String(row.archiveNumber).padStart(3,'0')} · `:''}${cleanText(row.text)||'Unbenannte Aufgabe'}`,{archiveNumber:row.archiveNumber??null});
    }else{
      const first=added[0].archiveNumber,last=added[added.length-1].archiveNumber;
      append('ARCHIVE','PASS',`${added.length} Aufgaben archiviert${first!=null&&last!=null?` · A${String(first).padStart(3,'0')}–A${String(last).padStart(3,'0')}`:''}`);
    }
  }
  function weightKg(state){return Number(state&&((state.currentPhaseWeightKg!=null)?state.currentPhaseWeightKg:state.currentWeightKg))||null;}
  function logWeightDiff(before,after){
    const b=before&&before.state||{},a=after&&after.state||{};
    const bOn=!!b.isWearing,aOn=!!a.isWearing,bKg=weightKg(b),aKg=weightKg(a);
    if(!bOn&&aOn)append('WEIGHT','INFO',`Zusatzgewicht gestartet${aKg?` · ${String(aKg).replace('.',',')} kg`:''}${a.currentPhaseStartedAt?` · ${formatClock(a.currentPhaseStartedAt)}`:''}`);
    else if(bOn&&!aOn)append('WEIGHT','PASS',`Zusatzgewicht beendet${bKg?` · ${String(bKg).replace('.',',')} kg`:''}`);
    else if(aOn&&b.currentPhaseStartedAt&&a.currentPhaseStartedAt&&b.currentPhaseStartedAt!==a.currentPhaseStartedAt)append('WEIGHT','WARN',`Startzeit Zusatzgewicht korrigiert · ${formatClock(b.currentPhaseStartedAt)} → ${formatClock(a.currentPhaseStartedAt)}`);
    if(aOn&&bKg!==aKg&&aKg)append('WEIGHT','INFO',`Zusatzgewicht geändert · ${bKg?String(bKg).replace('.',',')+' kg → ':''}${String(aKg).replace('.',',')} kg`);
  }
  function patchCore(){
    if(typeof window.saveTasks==='function'&&!window.saveTasks.__modLogV453){
      const base=window.saveTasks;
      const wrapped=function(){const before=taskSnapshot;const result=base.apply(this,arguments);const after=snapshotTasks();logTaskDiff(before,after);taskSnapshot=after;return result;};
      wrapped.__modLogV453=true;window.saveTasks=wrapped;
    }
    if(typeof window.saveArchive==='function'&&!window.saveArchive.__modLogV453){
      const base=window.saveArchive;
      const wrapped=function(){const before=archiveSnapshot;const result=base.apply(this,arguments);const after=snapshotArchive();logArchiveDiff(before,after);archiveSnapshot=after;return result;};
      wrapped.__modLogV453=true;window.saveArchive=wrapped;
    }
    if(typeof window.saveWeight==='function'&&!window.saveWeight.__modLogV453){
      const base=window.saveWeight;
      const wrapped=function(){const before=weightSnapshot;const result=base.apply(this,arguments);const after=snapshotWeight();logWeightDiff(before,after);weightSnapshot=after;return result;};
      wrapped.__modLogV453=true;window.saveWeight=wrapped;
    }
    if(typeof window.deleteTask==='function'&&!window.deleteTask.__modLogV453){
      const base=window.deleteTask;
      const wrapped=function(id){let before=null;try{before=(typeof tasks!=='undefined'&&Array.isArray(tasks))?tasks.find(t=>String(t.id)===String(id)):null;}catch(_){}const result=base.apply(this,arguments);let exists=false;try{exists=(typeof tasks!=='undefined'&&Array.isArray(tasks))?tasks.some(t=>String(t.id)===String(id)):false;}catch(_){}if(before&&!exists)append('TASK','WARN',`Aufgabe gelöscht: ${taskLabel(before)}`,{taskId:before.id});taskSnapshot=snapshotTasks();return result;};
      wrapped.__modLogV453=true;window.deleteTask=wrapped;
    }
  }
  function classifyConsole(args,isError){
    const message=args.map(value=>value instanceof Error?(value.stack||value.message):typeof value==='string'?value:cleanText(JSON.stringify(value))).join(' ').slice(0,900);
    if(!message)return;
    const area=/remote command/i.test(message)?'REMOTE':/supabase|sync/i.test(message)?'SYNC':'SYSTEM';
    append(area,isError?'ERROR':'WARN',message);
  }
  function patchConsole(){
    if(typeof console==='undefined'||console.__modLogV453)return;
    const baseWarn=console.warn&&console.warn.bind(console),baseError=console.error&&console.error.bind(console);
    if(baseWarn)console.warn=function(){try{classifyConsole([...arguments],false);}catch(_){}return baseWarn(...arguments);};
    if(baseError)console.error=function(){try{classifyConsole([...arguments],true);}catch(_){}return baseError(...arguments);};
    try{Object.defineProperty(console,'__modLogV453',{value:true,configurable:true});}catch(_){}
  }
  function injectStyle(){
    if(typeof document==='undefined'||!document.head||document.getElementById('modLiveLogV453Style'))return;
    const style=document.createElement('style');style.id='modLiveLogV453Style';
    style.textContent=`
      .live-log-v453{display:grid;gap:12px}.log-toolbar-v453{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.log-chip-v453{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:inherit;border-radius:999px;padding:7px 10px;font:inherit}.log-chip-v453.active{border-color:#d7a23a;background:rgba(215,162,58,.14)}.log-meta-v453{opacity:.72;font-size:.86rem}.log-list-v453{display:grid;gap:7px}.log-row-v453{display:grid;grid-template-columns:78px 72px 1fr;gap:8px;align-items:start;padding:9px 10px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.035)}.log-time-v453{font-variant-numeric:tabular-nums;opacity:.75}.log-area-v453{font-size:.78rem;font-weight:800;letter-spacing:.03em}.log-row-v453[data-level="ERROR"]{border-color:rgba(216,91,91,.55)}.log-row-v453[data-level="WARN"]{border-color:rgba(211,170,69,.45)}.log-row-v453[data-level="PASS"]{border-color:rgba(95,185,120,.4)}.log-empty-v453{padding:18px 4px;opacity:.7}@media(max-width:540px){.log-row-v453{grid-template-columns:70px 1fr}.log-area-v453{grid-column:2}.log-message-v453{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }
  function filteredEntries(){
    const entries=prune(readRaw());
    if(activeFilter==='ALL')return entries;
    if(activeFilter==='WARN')return entries.filter(e=>e.level==='WARN');
    if(activeFilter==='ERROR')return entries.filter(e=>e.level==='ERROR');
    return entries.filter(e=>e.area===activeFilter);
  }
  function renderLog(){
    if(typeof document==='undefined')return;
    injectStyle();
    const host=document.getElementById('viewContainer');if(!host)return;
    const input=document.getElementById('inputPanel');if(input)input.style.display='none';
    const all=prune(readRaw()),entries=filteredEntries();
    const filters=FILTERS.map(filter=>`<button type="button" class="log-chip-v453${activeFilter===filter?' active':''}" data-log-filter-v453="${filter}">${filter==='ALL'?'ALLE':filter==='ARCHIVE'?'ARCHIV':filter==='WEIGHT'?'GEWICHT':filter}</button>`).join('');
    const rows=entries.map(entry=>`<div class="log-row-v453" data-level="${escapeHtml(entry.level)}"><div class="log-time-v453">${escapeHtml(formatClock(entry.at))}</div><div class="log-area-v453">${escapeHtml(entry.level==='ERROR'?'ERROR':entry.level==='WARN'?'WARN':entry.area)}</div><div class="log-message-v453">${escapeHtml(entry.message)}</div></div>`).join('');
    host.innerHTML=`<section class="live-log-v453" id="liveLogV453"><div><h2>LIVE-LOG · LETZTE 24 STUNDEN</h2><div class="log-meta-v453">Rollierendes 24-Stunden-Fenster · ${all.length} relevante Einträge · älteste Einträge werden automatisch entfernt</div></div><div class="log-toolbar-v453">${filters}<button type="button" class="log-chip-v453${liveFollow?' active':''}" data-log-follow-v453>LIVE FOLGEN ${liveFollow?'AN':'AUS'}</button></div><div class="log-list-v453" id="liveLogListV453">${rows||'<div class="log-empty-v453">Für diesen Filter gibt es in den letzten 24 Stunden noch keine Einträge.</div>'}</div></section>`;
    host.querySelectorAll('[data-log-filter-v453]').forEach(btn=>btn.addEventListener('click',()=>{activeFilter=btn.dataset.logFilterV453||'ALL';renderLog();}));
    const follow=host.querySelector('[data-log-follow-v453]');if(follow)follow.addEventListener('click',()=>{liveFollow=!liveFollow;renderLog();});
    if(liveFollow){const list=document.getElementById('liveLogListV453');if(list&&typeof list.scrollIntoView==='function')setTimeout(()=>list.lastElementChild&&list.lastElementChild.scrollIntoView({block:'end'}),0);}
  }
  function patchRender(){
    if(typeof window.render!=='function'||window.render.__modLogV453)return;
    const base=window.render;
    const wrapped=function(){if(isLogTab()){renderLog();return;}return base.apply(this,arguments);};
    wrapped.__modLogV453=true;window.render=wrapped;
  }
  function patchSwitchTab(){
    if(typeof window.switchTab!=='function'||window.switchTab.__modLogV453)return;
    const base=window.switchTab;
    const wrapped=function(tab){const result=base.apply(this,arguments);if(tab==='log')renderLog();return result;};
    wrapped.__modLogV453=true;window.switchTab=wrapped;
  }
  function clear(){writeRaw([]);if(isLogTab())renderLog();}
  function exportEntries(){return prune(readRaw()).map(entry=>({...entry}));}
  function logUndo(message){return append('EDIT','PASS',`Rückgängig: ${cleanText(message)||'letzte Änderung'}`);}

  prune();
  patchCore();patchConsole();patchRender();patchSwitchTab();
  if(typeof window!=='undefined'){
    window.addEventListener&&window.addEventListener('error',event=>append('SYSTEM','ERROR',event&&event.message?event.message:'Unbekannter JavaScript-Fehler'));
    window.addEventListener&&window.addEventListener('unhandledrejection',event=>append('SYSTEM','ERROR',event&&event.reason?(event.reason.message||String(event.reason)):'Unbehandelte Promise-Ablehnung'));
  }
  if(typeof setInterval==='function'&&typeof document!=='undefined')setInterval(()=>{prune();if(isLogTab())renderLog();},60000);
  window.__modLiveLogV453={version:'V453',storageKey:STORAGE_KEY,windowMs:WINDOW_MS,append,read:exportEntries,prune,clear,renderLog,logUndo};
})();
