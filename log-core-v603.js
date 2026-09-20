/* V603 · LOG CORE
   Ereignissammlung ohne eigene sichtbare Log-Oberfläche.
   Die einzige sichtbare Log-Ansicht ist der 7-Tage-Renderer aus dem Safety-Net.
   Der bestehende localStorage-Schlüssel bleibt absichtlich erhalten, damit keine Historie verloren geht.
*/
(function(){
  const STORAGE_KEY='masterOfDisasterLiveLogV453';
  const WINDOW_MS=24*60*60*1000;
  const MAX_ENTRIES=5000;
  let taskSnapshot=snapshotTasks();
  let archiveSnapshot=snapshotArchive();
  let weightSnapshot=snapshotWeight();
  const recentMessages=new Map();

  function nowIso(){return new Date().toISOString();}
  function cleanText(value){return String(value??'').replace(/\s+/g,' ').trim();}
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
    try{window.dispatchEvent(new CustomEvent('mod:log-core-v603-entry',{detail:entry}));}catch(_){}
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
    if(typeof window.saveTasks==='function'&&!window.saveTasks.__modLogCoreV603){
      const base=window.saveTasks;
      const wrapped=function(){const before=taskSnapshot;const result=base.apply(this,arguments);const after=snapshotTasks();logTaskDiff(before,after);taskSnapshot=after;return result;};
      wrapped.__modLogCoreV603=true;window.saveTasks=wrapped;
    }
    if(typeof window.saveArchive==='function'&&!window.saveArchive.__modLogCoreV603){
      const base=window.saveArchive;
      const wrapped=function(){const before=archiveSnapshot;const result=base.apply(this,arguments);const after=snapshotArchive();logArchiveDiff(before,after);archiveSnapshot=after;return result;};
      wrapped.__modLogCoreV603=true;window.saveArchive=wrapped;
    }
    if(typeof window.saveWeight==='function'&&!window.saveWeight.__modLogCoreV603){
      const base=window.saveWeight;
      const wrapped=function(){const before=weightSnapshot;const result=base.apply(this,arguments);const after=snapshotWeight();logWeightDiff(before,after);weightSnapshot=after;return result;};
      wrapped.__modLogCoreV603=true;window.saveWeight=wrapped;
    }
    if(typeof window.deleteTask==='function'&&!window.deleteTask.__modLogCoreV603){
      const base=window.deleteTask;
      const wrapped=function(id){let before=null;try{before=(typeof tasks!=='undefined'&&Array.isArray(tasks))?tasks.find(t=>String(t.id)===String(id)):null;}catch(_){}const result=base.apply(this,arguments);let exists=false;try{exists=(typeof tasks!=='undefined'&&Array.isArray(tasks))?tasks.some(t=>String(t.id)===String(id)):false;}catch(_){}if(before&&!exists)append('TASK','WARN',`Aufgabe gelöscht: ${taskLabel(before)}`,{taskId:before.id});taskSnapshot=snapshotTasks();return result;};
      wrapped.__modLogCoreV603=true;window.deleteTask=wrapped;
    }
  }
  function classifyConsole(args,isError){
    const message=args.map(value=>value instanceof Error?(value.stack||value.message):typeof value==='string'?value:cleanText(JSON.stringify(value))).join(' ').slice(0,900);
    if(!message)return;
    const area=/remote command/i.test(message)?'REMOTE':/supabase|sync/i.test(message)?'SYNC':'SYSTEM';
    append(area,isError?'ERROR':'WARN',message);
  }
  function patchConsole(){
    if(typeof console==='undefined'||console.__modLogCoreV603)return;
    const baseWarn=console.warn&&console.warn.bind(console),baseError=console.error&&console.error.bind(console);
    if(baseWarn)console.warn=function(){try{classifyConsole([...arguments],false);}catch(_){}return baseWarn(...arguments);};
    if(baseError)console.error=function(){try{classifyConsole([...arguments],true);}catch(_){}return baseError(...arguments);};
    try{Object.defineProperty(console,'__modLogCoreV603',{value:true,configurable:true});}catch(_){}
  }
  function renderLog(){
    const enhanced=window.__modRecoveryHistoryV498?.renderEnhancedLog;
    return typeof enhanced==='function'?enhanced():false;
  }
  function clear(){writeRaw([]);if(isLogTab())renderLog();}
  function exportEntries(){return prune(readRaw()).map(entry=>({...entry}));}
  function logUndo(message){return append('EDIT','PASS',`Rückgängig: ${cleanText(message)||'letzte Änderung'}`);}

  prune();
  patchCore();patchConsole();
  if(typeof window!=='undefined'){
    window.addEventListener&&window.addEventListener('error',event=>append('SYSTEM','ERROR',event&&event.message?event.message:'Unbekannter JavaScript-Fehler'));
    window.addEventListener&&window.addEventListener('unhandledrejection',event=>append('SYSTEM','ERROR',event&&event.reason?(event.reason.message||String(event.reason)):'Unbehandelte Promise-Ablehnung'));
  }
  if(typeof setInterval==='function')setInterval(()=>prune(),60000);
  window.__modLogCoreV603={version:'V603',storageKey:STORAGE_KEY,windowMs:WINDOW_MS,append,read:exportEntries,prune,clear,renderLog,logUndo,visibleRenderer:'V498-only'};
  /* Compatibility alias: old callers get the new core, never the removed V453 UI. */
  window.__modLiveLogV453=window.__modLogCoreV603;
})();
