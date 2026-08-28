/* V498 · HISTORY / UNDO / BACKUP SAFETY NET
   - globales rotes R im MASTER-OF-DISASTER-Titel
   - 7 Tage lokaler Ereignisverlauf + Wiederherstellungspunkte in IndexedDB
   - sichere Voll-Restores und, wenn eindeutig, chirurgisches Rueckgaengig
   - bestehendes DEV-Vollbackup wird um Log + History erweitert
   - manuelle, datierte Wochen-Cloudbackups (12 Generationen) in legacy_metadata
*/
(function(){
  'use strict';

  const BUILD_VERSION='V498';
  const DB_NAME='MasterOfDisasterSafetyNetV498';
  const DB_VERSION=1;
  const POINT_STORE='recoveryPoints';
  const LOG_STORE='logEntries';
  const RETENTION_MS=7*24*60*60*1000;
  const MAX_POINTS=1500;
  const MAX_LOGS=20000;
  const LIVE_LOG_KEY='masterOfDisasterLiveLogV453';
  const WEEKLY_PREFIX='weekly_complete_backup_v1_';
  const WEEKLY_KEEP=12;
  const EXCLUDED_HISTORY_KEYS=new Set([
    LIVE_LOG_KEY,
    'masterOfDisasterPreRestoreBackup',
    'masterOfDisasterPreCloudRestoreBackup'
  ]);

  let dbPromise=null;
  let initialized=false;
  let restoring=false;
  let lastSnapshot=null;
  let captureTimer=null;
  let captureChain=Promise.resolve();
  let lastLiveLogSignature='';
  let logRange='TODAY';
  let logFilter='ALL';
  let logSearch='';
  let recoveryOnly=false;
  let logFollow=true;
  let originalStorageSetItem=null;
  let originalStorageRemoveItem=null;
  let originalStorageClear=null;

  const clone=value=>{try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}};
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const nowIso=()=>new Date().toISOString();
  const safeParse=(value,fallback)=>{try{return JSON.parse(value);}catch(_){return fallback;}};
  const same=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b);}catch(_){return false;}};

  function berlinParts(value=new Date()){
    const date=value instanceof Date?value:new Date(value);
    const parts=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,weekday:'short'}).formatToParts(date);
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return {dateKey:`${p.year}-${p.month}-${p.day}`,dateLabel:`${p.weekday}, ${p.day}.${p.month}.${p.year}`,clock:`${p.hour}:${p.minute}:${p.second}`,file:`${p.year}-${p.month}-${p.day}_${p.hour}-${p.minute}-${p.second}`};
  }

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('IndexedDB ist auf diesem Gerät nicht verfügbar.'));return;}
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(POINT_STORE)){
          const store=db.createObjectStore(POINT_STORE,{keyPath:'id'});
          store.createIndex('at','at',{unique:false});
        }
        if(!db.objectStoreNames.contains(LOG_STORE)){
          const store=db.createObjectStore(LOG_STORE,{keyPath:'id'});
          store.createIndex('at','at',{unique:false});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('IndexedDB konnte nicht geöffnet werden.'));
    });
    return dbPromise;
  }

  async function storePut(storeName,value){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,'readwrite');
      tx.objectStore(storeName).put(clone(value));
      tx.oncomplete=()=>resolve(value);
      tx.onerror=()=>reject(tx.error||new Error('IndexedDB-Schreibfehler.'));
    });
  }
  async function storeGet(storeName,id){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(storeName,'readonly').objectStore(storeName).get(id);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error||new Error('IndexedDB-Lesefehler.'));
    });
  }
  async function storeGetAll(storeName){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(storeName,'readonly').objectStore(storeName).getAll();
      req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]);
      req.onerror=()=>reject(req.error||new Error('IndexedDB-Lesefehler.'));
    });
  }
  async function storeDeleteMany(storeName,ids){
    if(!ids.length)return;
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,'readwrite');
      const store=tx.objectStore(storeName);
      ids.forEach(id=>store.delete(id));
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('IndexedDB-Löschfehler.'));
    });
  }
  async function storeClear(storeName){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('IndexedDB-Löschfehler.'));
    });
  }

  async function pruneStore(storeName,maxRows){
    const rows=(await storeGetAll(storeName)).sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime());
    const cutoff=Date.now()-RETENTION_MS;
    const remove=rows.filter(row=>new Date(row.at).getTime()<cutoff).map(row=>row.id);
    const survivors=rows.filter(row=>new Date(row.at).getTime()>=cutoff);
    if(survivors.length>maxRows)remove.push(...survivors.slice(0,survivors.length-maxRows).map(row=>row.id));
    await storeDeleteMany(storeName,[...new Set(remove)]);
  }
  async function pruneAll(){await Promise.all([pruneStore(POINT_STORE,MAX_POINTS),pruneStore(LOG_STORE,MAX_LOGS)]);}

  function shouldTrackKey(key){return !!(key&&String(key).startsWith('masterOfDisaster')&&!EXCLUDED_HISTORY_KEYS.has(String(key))&&!String(key).startsWith('masterOfDisasterSafetyNetV498'));}
  function captureSnapshot(){
    const storage={};
    try{
      const keys=[];
      for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(shouldTrackKey(key))keys.push(key);}
      keys.sort().forEach(key=>{storage[key]=localStorage.getItem(key);});
    }catch(error){console.warn('V498 Snapshot konnte localStorage nicht vollständig lesen:',error);}
    const serialized=JSON.stringify(storage);
    let hash=2166136261;
    for(let i=0;i<serialized.length;i++){hash^=serialized.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return {schemaVersion:1,capturedAt:nowIso(),fingerprint:`${serialized.length}:${hash>>>0}`,storage};
  }
  function snapshotTasks(snapshot){return safeParse(snapshot?.storage?.masterOfDisasterTasks||'[]',[]);}
  function snapshotArchive(snapshot){return safeParse(snapshot?.storage?.masterOfDisasterArchive||'[]',[]);}
  function taskMap(rows){const map=new Map();(Array.isArray(rows)?rows:[]).forEach((row,index)=>map.set(String(row?.id??`idx-${index}`),row));return map;}
  function archiveMap(rows){const map=new Map();(Array.isArray(rows)?rows:[]).forEach((row,index)=>map.set(String(row?.archiveNumber??row?.archiveId??`idx-${index}`),row));return map;}

  function changedStorageKeys(before,after){
    const keys=new Set([...Object.keys(before?.storage||{}),...Object.keys(after?.storage||{})]);
    return [...keys].filter(key=>(before?.storage||{})[key]!== (after?.storage||{})[key]).sort();
  }
  function computeSurgicalDelta(before,after){
    const keys=changedStorageKeys(before,after);
    if(keys.length===1&&keys[0]==='masterOfDisasterTasks'){
      const b=taskMap(snapshotTasks(before)),a=taskMap(snapshotTasks(after));
      const changed=[];
      for(const [id,row] of a){if(!b.has(id)||!same(b.get(id),row))changed.push({id,before:b.get(id)||null,after:row});}
      for(const [id,row] of b){if(!a.has(id))changed.push({id,before:row,after:null});}
      if(changed.length===1)return {kind:'task',...clone(changed[0])};
    }
    if(keys.length&&keys.every(key=>['masterOfDisasterWeightState','masterOfDisasterWeightPhases'].includes(key))){
      return {kind:'weight',before:{state:before.storage.masterOfDisasterWeightState??null,phases:before.storage.masterOfDisasterWeightPhases??null},after:{state:after.storage.masterOfDisasterWeightState??null,phases:after.storage.masterOfDisasterWeightPhases??null}};
    }
    return null;
  }

  function describeTaskDelta(delta){
    const before=delta.before,after=delta.after,name=clean(after?.text||before?.text)||'Unbenannte Aufgabe';
    if(!before&&after)return `Aufgabe erstellt: „${name}“`;
    if(before&&!after)return `Aufgabe gelöscht: „${name}“`;
    if(before?.status!==after?.status){
      if(after?.status==='completed')return `Aufgabe abgeschlossen: „${name}“`;
      if(after?.status==='paused')return `Aufgabe pausiert: „${name}“`;
      if(after?.status==='running'&&before?.status==='paused')return `Aufgabe fortgesetzt: „${name}“`;
      if(after?.status==='running')return `Aufgabe gestartet: „${name}“`;
      if(after?.status==='aborted')return `Aufgabe abgebrochen: „${name}“`;
      return `Status geändert: „${name}“`;
    }
    return `Aufgabe geändert: „${name}“`;
  }
  function deriveLabel(delta){if(delta?.kind==='task')return describeTaskDelta(delta);if(delta?.kind==='weight')return 'Zusatzgewicht geändert';return 'App-Daten geändert';}

  function readRawLiveLog(){try{return safeParse(localStorage.getItem(LIVE_LOG_KEY)||'[]',[]);}catch(_){return [];}}
  function writeRawLiveLog(rows){try{localStorage.setItem(LIVE_LOG_KEY,JSON.stringify(rows));return true;}catch(_){return false;}}
  function latestRelevantLog(){
    const rows=readRawLiveLog();
    const now=Date.now();
    for(let i=rows.length-1;i>=0;i--){
      const row=rows[i],ts=new Date(row?.at).getTime();
      if(!Number.isFinite(ts)||now-ts>5000)break;
      if(['TASK','EDIT','ARCHIVE','WEIGHT'].includes(String(row?.area||'').toUpperCase()))return row;
    }
    return null;
  }
  async function tagLogEntry(entryId,pointId){
    if(!entryId)return false;
    const rows=readRawLiveLog();
    const index=rows.findIndex(row=>String(row?.id)===String(entryId));
    if(index>=0){rows[index]={...rows[index],meta:{...(rows[index].meta||{}),recoveryPointId:pointId,recoveryAvailable:true}};writeRawLiveLog(rows);await storePut(LOG_STORE,rows[index]);return true;}
    const mirrored=await storeGet(LOG_STORE,entryId);
    if(mirrored){mirrored.meta={...(mirrored.meta||{}),recoveryPointId:pointId,recoveryAvailable:true};await storePut(LOG_STORE,mirrored);return true;}
    return false;
  }

  async function mirrorLiveLogs(force=false){
    const rows=readRawLiveLog();
    const last=rows[rows.length-1];
    const signature=`${rows.length}:${last?.id||''}:${last?.meta?.recoveryPointId||''}`;
    if(!force&&signature===lastLiveLogSignature)return;
    lastLiveLogSignature=signature;
    const cutoff=Date.now()-RETENTION_MS;
    for(const row of rows){const ts=new Date(row?.at).getTime();if(Number.isFinite(ts)&&ts>=cutoff&&row?.id)await storePut(LOG_STORE,row);}
    await pruneStore(LOG_STORE,MAX_LOGS);
  }

  async function saveRecoveryPoint({snapshot,label,delta=null,type='change',area='EDIT',logEntryId=null,directState=false}){
    const point={id:`rp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,at:nowIso(),version:BUILD_VERSION,type,label:clean(label)||'App-Daten geändert',area,snapshot:clone(snapshot),delta:clone(delta),directState:!!directState};
    await storePut(POINT_STORE,point);
    await pruneStore(POINT_STORE,MAX_POINTS);
    if(logEntryId)await tagLogEntry(logEntryId,point.id);
    return point;
  }

  function queueCapture(delay=260){
    if(restoring||!initialized)return;
    clearTimeout(captureTimer);
    captureTimer=setTimeout(()=>{captureChain=captureChain.then(captureChange).catch(error=>console.warn('V498 Capture fehlgeschlagen:',error));},delay);
  }
  async function captureChange(){
    if(restoring||!lastSnapshot)return;
    const after=captureSnapshot();
    if(after.fingerprint===lastSnapshot.fingerprint)return;
    const before=lastSnapshot;
    lastSnapshot=after;
    const hint=latestRelevantLog();
    const delta=computeSurgicalDelta(before,after);
    const label=hint?.message||deriveLabel(delta);
    let point=await saveRecoveryPoint({snapshot:before,label,delta,area:hint?.area||'EDIT',logEntryId:hint?.id||null});
    if(!hint&&window.__modLiveLogV453?.append){
      const entry=window.__modLiveLogV453.append('EDIT','INFO',label,{recoveryPointId:point.id,recoveryAvailable:true});
      if(entry)await storePut(LOG_STORE,entry);
    }
    await mirrorLiveLogs(true);
    updateHeaderState();
  }

  function patchStorage(){
    if(Storage.prototype.setItem.__modHistoryV498)return;
    originalStorageSetItem=Storage.prototype.setItem;
    originalStorageRemoveItem=Storage.prototype.removeItem;
    originalStorageClear=Storage.prototype.clear;
    const setWrapped=function(key,value){const out=originalStorageSetItem.apply(this,arguments);try{if(this===localStorage&&shouldTrackKey(key))queueCapture();}catch(_){}return out;};
    const removeWrapped=function(key){const out=originalStorageRemoveItem.apply(this,arguments);try{if(this===localStorage&&shouldTrackKey(key))queueCapture();}catch(_){}return out;};
    const clearWrapped=function(){let had=false;try{if(this===localStorage){for(let i=0;i<this.length;i++)if(shouldTrackKey(this.key(i))){had=true;break;}}}catch(_){}const out=originalStorageClear.apply(this,arguments);if(had)queueCapture();return out;};
    setWrapped.__modHistoryV498=true;removeWrapped.__modHistoryV498=true;clearWrapped.__modHistoryV498=true;
    Storage.prototype.setItem=setWrapped;Storage.prototype.removeItem=removeWrapped;Storage.prototype.clear=clearWrapped;
  }

  function trackedCurrentKeys(){const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(shouldTrackKey(key))keys.push(key);}return keys;}
  function applySnapshotStorage(snapshot,{preserveLiveLog=true}={}){
    if(!snapshot?.storage||typeof snapshot.storage!=='object')throw new Error('Wiederherstellungspunkt enthält keinen gültigen Datenstand.');
    restoring=true;
    const target=snapshot.storage;
    for(const key of trackedCurrentKeys())if(!(key in target))localStorage.removeItem(key);
    for(const [key,value] of Object.entries(target)){if(shouldTrackKey(key))localStorage.setItem(key,value==null?'':String(value));}
    if(!preserveLiveLog&&snapshot.liveLogRaw!=null)localStorage.setItem(LIVE_LOG_KEY,String(snapshot.liveLogRaw));
    lastSnapshot=captureSnapshot();
  }

  function diffPreview(current,target){
    const cTasks=taskMap(snapshotTasks(current)),tTasks=taskMap(snapshotTasks(target));
    let taskChanges=0;for(const [id,row] of cTasks)if(!tTasks.has(id)||!same(row,tTasks.get(id)))taskChanges++;for(const id of tTasks.keys())if(!cTasks.has(id))taskChanges++;
    const cArchive=archiveMap(snapshotArchive(current)),tArchive=archiveMap(snapshotArchive(target));
    let archiveChanges=0;for(const [id,row] of cArchive)if(!tArchive.has(id)||!same(row,tArchive.get(id)))archiveChanges++;for(const id of tArchive.keys())if(!cArchive.has(id))archiveChanges++;
    const changedKeys=changedStorageKeys(current,target);
    const weightChanged=changedKeys.some(k=>/Weight/.test(k));
    return {taskChanges,archiveChanges,weightChanged,otherKeys:changedKeys.filter(k=>!['masterOfDisasterTasks','masterOfDisasterArchive','masterOfDisasterWeightState','masterOfDisasterWeightPhases'].includes(k)).length};
  }

  async function createGuard(label){
    const snap=captureSnapshot();
    const guard=await saveRecoveryPoint({snapshot:snap,label:`Sicherungsstand vor ${label}`,type:'restore-guard',area:'EDIT',directState:true});
    const entry=window.__modLiveLogV453?.append?.('EDIT','PASS',guard.label,{recoveryPointId:guard.id,recoveryAvailable:true});
    if(entry)await storePut(LOG_STORE,entry);
    return guard;
  }

  function scheduleReloadNotice(message){try{sessionStorage.setItem('modV498RestoreNotice',message);}catch(_){}setTimeout(()=>location.reload(),120);}

  async function restoreFullPoint(point){
    const current=captureSnapshot();
    const target=point?.snapshot;
    if(!target)throw new Error('Wiederherstellungspunkt ist unvollständig.');
    const d=diffPreview(current,target);
    const info=[`${d.taskChanges} Aufgabenänderung(en)`,`${d.archiveChanges} Archivänderung(en)`,d.weightChanged?'Gewichtsdaten betroffen':null,d.otherKeys?`${d.otherKeys} weitere App-Einstellung(en)`:null].filter(Boolean).join('\n');
    if(!window.confirm(`STAND WIEDERHERSTELLEN?\n\n${point.label}\n${berlinParts(point.at).dateLabel} · ${berlinParts(point.at).clock}\n\n${info}\n\nDer aktuelle Stand wird vorher automatisch als eigener Rücksprungpunkt gesichert.`))return false;
    await createGuard(`Wiederherstellung „${point.label}“`);
    applySnapshotStorage(target,{preserveLiveLog:true});
    const entry=window.__modLiveLogV453?.append?.('EDIT','PASS',`Wiederherstellung durchgeführt · Ziel: ${point.label}`,{restoredPointId:point.id});
    if(entry)await storePut(LOG_STORE,entry);
    await mirrorLiveLogs(true);
    scheduleReloadNotice(`Wiederhergestellt: ${point.label}`);
    return true;
  }

  function canSurgicallyUndo(point){
    const delta=point?.delta;if(!delta)return false;
    const current=captureSnapshot();
    if(delta.kind==='task'){
      const map=taskMap(snapshotTasks(current));const row=map.get(String(delta.id))||null;
      return same(row,delta.after);
    }
    if(delta.kind==='weight'){
      return current.storage.masterOfDisasterWeightState===delta.after.state&&current.storage.masterOfDisasterWeightPhases===delta.after.phases;
    }
    return false;
  }

  async function surgicalUndo(point){
    if(!canSurgicallyUndo(point)){window.alert('Diese einzelne Änderung kann nicht mehr isoliert zurückgedreht werden, weil sich derselbe Datenbereich seitdem weiter verändert hat. Der komplette Stand davor bleibt aber verfügbar.');return false;}
    if(!window.confirm(`NUR DIESE ÄNDERUNG RÜCKGÄNGIG MACHEN?\n\n${point.label}\n\nSpätere, unabhängige Änderungen bleiben erhalten.`))return false;
    await createGuard(`Einzel-Rückgängig „${point.label}“`);
    restoring=true;
    const delta=point.delta;
    if(delta.kind==='task'){
      const current=snapshotTasks(captureSnapshot());
      const index=current.findIndex(row=>String(row?.id)===String(delta.id));
      if(delta.before==null){if(index>=0)current.splice(index,1);}
      else if(index>=0)current[index]=clone(delta.before);
      else current.push(clone(delta.before));
      localStorage.setItem('masterOfDisasterTasks',JSON.stringify(current));
    }else if(delta.kind==='weight'){
      if(delta.before.state==null)localStorage.removeItem('masterOfDisasterWeightState');else localStorage.setItem('masterOfDisasterWeightState',delta.before.state);
      if(delta.before.phases==null)localStorage.removeItem('masterOfDisasterWeightPhases');else localStorage.setItem('masterOfDisasterWeightPhases',delta.before.phases);
    }
    lastSnapshot=captureSnapshot();
    const entry=window.__modLiveLogV453?.append?.('EDIT','PASS',`Nur diese Änderung rückgängig: ${point.label}`,{undonePointId:point.id});
    if(entry)await storePut(LOG_STORE,entry);
    await mirrorLiveLogs(true);
    scheduleReloadNotice(`Rückgängig: ${point.label}`);
    return true;
  }

  function injectStyle(){
    if(document.getElementById('modSafetyNetV498Style'))return;
    const style=document.createElement('style');style.id='modSafetyNetV498Style';style.textContent=`
      .safe-undo-v457{display:none!important}
      .mod-undo-r-v498{font:inherit;font-weight:inherit;letter-spacing:inherit;line-height:inherit;color:#e04b4b;background:transparent;border:0;padding:0;margin:0;cursor:pointer;text-shadow:0 0 14px rgba(224,75,75,.25);vertical-align:baseline}.mod-undo-r-v498:active{transform:scale(.94)}
      .mod-modal-v498{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;padding:calc(70px + env(safe-area-inset-top)) 12px 18px;overflow:auto}.mod-modal-card-v498{width:min(680px,100%);border:1px solid rgba(255,255,255,.18);border-radius:16px;background:var(--mod-bg-top,#15191d);box-shadow:0 18px 60px rgba(0,0,0,.55);padding:14px}.mod-modal-head-v498{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.mod-modal-head-v498 h3{margin:0}.mod-close-v498,.mod-action-v498{font:inherit;color:inherit;border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.05);border-radius:10px;padding:9px 10px}.mod-close-v498{padding:6px 9px}.mod-action-v498.primary{border-color:rgba(224,75,75,.7);background:rgba(224,75,75,.12)}.mod-point-list-v498{display:grid;gap:8px}.mod-point-v498{display:grid;grid-template-columns:76px 1fr auto;gap:9px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.11);border-radius:11px;background:rgba(255,255,255,.035)}.mod-point-time-v498{font-variant-numeric:tabular-nums;opacity:.72;font-size:.82rem}.mod-point-label-v498{min-width:0}.mod-point-label-v498 small{display:block;opacity:.62;margin-top:2px}.mod-log-v498{display:grid;gap:12px}.mod-log-toolbar-v498{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.mod-log-chip-v498{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.045);color:inherit;border-radius:999px;padding:7px 10px;font:inherit;font-size:.8rem}.mod-log-chip-v498.active{border-color:#d7a23a;background:rgba(215,162,58,.14)}.mod-log-search-v498{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(255,255,255,.05);color:inherit;padding:10px;font:inherit}.mod-log-day-v498{border:1px solid rgba(255,255,255,.11);border-radius:12px;background:rgba(255,255,255,.025);overflow:hidden}.mod-log-day-v498>summary{cursor:pointer;padding:10px 12px;font-weight:850}.mod-log-day-body-v498{display:grid;gap:6px;padding:0 8px 8px}.mod-log-row-v498{display:grid;grid-template-columns:72px 68px 1fr auto;gap:8px;align-items:start;padding:9px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.025)}.mod-log-row-v498[data-level="ERROR"]{border-color:rgba(216,91,91,.55)}.mod-log-row-v498[data-level="WARN"]{border-color:rgba(211,170,69,.45)}.mod-log-time-v498{font-variant-numeric:tabular-nums;opacity:.72}.mod-log-area-v498{font-size:.76rem;font-weight:850}.mod-recovery-badge-v498{border:1px solid rgba(224,75,75,.55);background:rgba(224,75,75,.10);color:inherit;border-radius:8px;padding:6px 8px;font:inherit;font-size:.72rem;font-weight:850}.mod-dev-safety-v498{margin-top:14px;padding:12px;border:1px solid #3d3232;border-radius:12px;background:#171313;display:grid;gap:8px}.mod-dev-safety-v498 .mod-action-v498{width:100%}@media(max-width:560px){.mod-point-v498{grid-template-columns:68px 1fr}.mod-point-v498 .mod-action-v498{grid-column:1/-1}.mod-log-row-v498{grid-template-columns:64px 1fr}.mod-log-area-v498{grid-column:2}.mod-log-message-v498,.mod-recovery-badge-v498{grid-column:1/-1}}
    `;document.head.appendChild(style);
  }

  function installHeaderButton(){
    const h1=document.querySelector('.header h1');if(!h1||h1.querySelector('.mod-undo-r-v498'))return;
    const text=clean(h1.textContent);if(!text)return;
    const prefix=text.endsWith('R')?text.slice(0,-1):text+' ';
    h1.textContent='';h1.append(document.createTextNode(prefix));
    const btn=document.createElement('button');btn.type='button';btn.className='mod-undo-r-v498';btn.textContent='R';btn.title='Rückgängig / Wiederherstellung';btn.setAttribute('aria-label','Rückgängig und Wiederherstellung öffnen');btn.onclick=openQuickHistory;h1.appendChild(btn);
  }
  async function updateHeaderState(){installHeaderButton();}

  function closeModal(){document.getElementById('modSafetyNetModalV498')?.remove();}
  function modal(title,bodyHtml){closeModal();const root=document.createElement('div');root.id='modSafetyNetModalV498';root.className='mod-modal-v498';root.innerHTML=`<div class="mod-modal-card-v498"><div class="mod-modal-head-v498"><h3>${esc(title)}</h3><button type="button" class="mod-close-v498" data-close-v498>✕</button></div>${bodyHtml}</div>`;document.body.appendChild(root);root.querySelector('[data-close-v498]')?.addEventListener('click',closeModal);root.addEventListener('click',event=>{if(event.target===root)closeModal();});return root;}
  async function recentPoints(limit=5){await pruneStore(POINT_STORE,MAX_POINTS);return (await storeGetAll(POINT_STORE)).sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,limit);}
  async function openQuickHistory(){
    const points=await recentPoints(5);
    const rows=points.map(point=>{const t=berlinParts(point.at);return `<div class="mod-point-v498"><div class="mod-point-time-v498">${esc(t.clock.slice(0,5))}</div><div class="mod-point-label-v498">${esc(point.label)}<small>${esc(t.dateLabel)}</small></div><button type="button" class="mod-action-v498" data-point-v498="${esc(point.id)}">AUSWÄHLEN</button></div>`;}).join('');
    const root=modal('RÜCKGÄNGIG / WIEDERHERSTELLUNG',`<div class="mod-point-list-v498">${rows||'<div style="opacity:.7;padding:8px">Noch keine Wiederherstellungspunkte vorhanden.</div>'}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="mod-action-v498 primary" data-more-v498>WEITERE IM 7-TAGE-LOG</button></div>`);
    root.querySelectorAll('[data-point-v498]').forEach(btn=>btn.addEventListener('click',()=>openPoint(btn.dataset.pointV498)));
    root.querySelector('[data-more-v498]')?.addEventListener('click',()=>{closeModal();recoveryOnly=true;try{switchTab('log');}catch(_){}setTimeout(renderEnhancedLog,60);});
  }
  async function openPoint(id){
    const point=await storeGet(POINT_STORE,id);if(!point){window.alert('Dieser Wiederherstellungspunkt ist nicht mehr vorhanden.');return;}
    const t=berlinParts(point.at),surgical=canSurgicallyUndo(point);
    const root=modal('WIEDERHERSTELLUNGSPUNKT',`<div style="padding:4px 2px 12px"><strong>${esc(point.label)}</strong><div style="opacity:.68;margin-top:4px">${esc(t.dateLabel)} · ${esc(t.clock)}</div></div><div style="display:grid;gap:8px">${surgical?'<button type="button" class="mod-action-v498" data-surgical-v498>NUR DIESE ÄNDERUNG RÜCKGÄNGIG</button>':''}<button type="button" class="mod-action-v498 primary" data-full-v498>GESAMTEN STAND DAVOR WIEDERHERSTELLEN</button></div>`);
    root.querySelector('[data-surgical-v498]')?.addEventListener('click',()=>surgicalUndo(point));
    root.querySelector('[data-full-v498]')?.addEventListener('click',()=>restoreFullPoint(point));
  }

  function rangeCutoff(range){const now=Date.now();if(range==='24H')return now-24*60*60*1000;if(range==='3D')return now-3*24*60*60*1000;if(range==='7D')return now-RETENTION_MS;const today=berlinParts().dateKey;return {today};}
  function logMatches(row){
    const ts=new Date(row?.at).getTime();if(!Number.isFinite(ts))return false;
    const cutoff=rangeCutoff(logRange);if(typeof cutoff==='number'&&ts<cutoff)return false;if(cutoff?.today&&berlinParts(row.at).dateKey!==cutoff.today)return false;
    if(recoveryOnly&&!row?.meta?.recoveryPointId)return false;
    if(logFilter==='WARN'&&row.level!=='WARN')return false;if(logFilter==='ERROR'&&row.level!=='ERROR')return false;if(!['ALL','WARN','ERROR'].includes(logFilter)&&row.area!==logFilter)return false;
    if(logSearch&&!`${row.message||''} ${row.area||''} ${row.level||''}`.toLowerCase().includes(logSearch.toLowerCase()))return false;
    return true;
  }
  async function readSevenDayLogs(){await mirrorLiveLogs();await pruneStore(LOG_STORE,MAX_LOGS);return (await storeGetAll(LOG_STORE)).filter(row=>new Date(row.at).getTime()>=Date.now()-RETENTION_MS).sort((a,b)=>new Date(a.at)-new Date(b.at));}
  async function renderEnhancedLog(){
    try{if(typeof currentTab!=='undefined'&&currentTab!=='log')return;}catch(_){return;}
    const host=document.getElementById('viewContainer');if(!host)return;
    const input=document.getElementById('inputPanel');if(input)input.style.display='none';
    const all=await readSevenDayLogs(),rows=all.filter(logMatches);
    const groups=new Map();rows.forEach(row=>{const p=berlinParts(row.at);if(!groups.has(p.dateKey))groups.set(p.dateKey,{label:p.dateLabel,rows:[]});groups.get(p.dateKey).rows.push(row);});
    const today=berlinParts().dateKey;
    const groupHtml=[...groups.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([dateKey,group])=>{const entries=group.rows.slice().reverse().map(row=>{const p=berlinParts(row.at),badge=row?.meta?.recoveryPointId?`<button type="button" class="mod-recovery-badge-v498" data-log-point-v498="${esc(row.meta.recoveryPointId)}">↩ WIEDERHERSTELLUNG</button>`:'';return `<div class="mod-log-row-v498" data-level="${esc(row.level||'INFO')}"><div class="mod-log-time-v498">${esc(p.clock)}</div><div class="mod-log-area-v498">${esc(row.level==='ERROR'?'ERROR':row.level==='WARN'?'WARN':row.area||'LOG')}</div><div class="mod-log-message-v498">${esc(row.message||'')}</div>${badge}</div>`;}).join('');return `<details class="mod-log-day-v498" ${dateKey===today?'open':''}><summary>${esc(group.label)} · ${group.rows.length} Einträge</summary><div class="mod-log-day-body-v498">${entries}</div></details>`;}).join('');
    const areas=['ALL','TASK','EDIT','ARCHIVE','WEIGHT','SYNC','REMOTE','SYSTEM','WARN','ERROR'];
    host.innerHTML=`<section class="mod-log-v498"><div><h2>LOG · LETZTE 7 TAGE</h2><div style="opacity:.68;font-size:.85rem">${all.length} relevante Einträge lokal gesichert · Wiederherstellungspunkte sind direkt markiert</div></div><div class="mod-log-toolbar-v498">${['TODAY','24H','3D','7D'].map(r=>`<button type="button" class="mod-log-chip-v498${logRange===r?' active':''}" data-range-v498="${r}">${r==='TODAY'?'HEUTE':r==='3D'?'3 TAGE':r==='7D'?'7 TAGE':'24 H'}</button>`).join('')}<button type="button" class="mod-log-chip-v498${recoveryOnly?' active':''}" data-recovery-only-v498>↩ NUR RESTORE</button></div><input class="mod-log-search-v498" id="modLogSearchV498" type="search" placeholder="Log durchsuchen, z. B. Kisten…" value="${esc(logSearch)}"><div class="mod-log-toolbar-v498">${areas.map(a=>`<button type="button" class="mod-log-chip-v498${logFilter===a?' active':''}" data-filter-v498="${a}">${a==='ALL'?'ALLE':a==='ARCHIVE'?'ARCHIV':a==='WEIGHT'?'GEWICHT':a}</button>`).join('')}<button type="button" class="mod-log-chip-v498${logFollow?' active':''}" data-follow-v498>LIVE ${logFollow?'AN':'AUS'}</button></div><div class="mod-point-list-v498">${groupHtml||'<div style="opacity:.7;padding:10px">Für diese Auswahl gibt es keine Einträge.</div>'}</div></section>`;
    host.querySelectorAll('[data-range-v498]').forEach(btn=>btn.addEventListener('click',()=>{logRange=btn.dataset.rangeV498;renderEnhancedLog();}));
    host.querySelectorAll('[data-filter-v498]').forEach(btn=>btn.addEventListener('click',()=>{logFilter=btn.dataset.filterV498;renderEnhancedLog();}));
    host.querySelector('[data-recovery-only-v498]')?.addEventListener('click',()=>{recoveryOnly=!recoveryOnly;renderEnhancedLog();});
    host.querySelector('[data-follow-v498]')?.addEventListener('click',()=>{logFollow=!logFollow;renderEnhancedLog();});
    host.querySelector('#modLogSearchV498')?.addEventListener('input',event=>{logSearch=event.target.value||'';clearTimeout(event.target.__timer);event.target.__timer=setTimeout(renderEnhancedLog,180);});
    host.querySelectorAll('[data-log-point-v498]').forEach(btn=>btn.addEventListener('click',()=>openPoint(btn.dataset.logPointV498)));
    if(logFollow&&rows.length)setTimeout(()=>{const list=host.querySelector('.mod-point-list-v498');list?.firstElementChild?.scrollIntoView?.({block:'start'});},0);
  }

  function patchRenderers(){
    if(typeof window.render==='function'&&!window.render.__modHistoryV498){const base=window.render;const wrapped=function(){const out=base.apply(this,arguments);setTimeout(()=>{installHeaderButton();installDevSafetyPanel();installBackupOverride();try{if(currentTab==='log')renderEnhancedLog();}catch(_){}},0);return out;};wrapped.__modHistoryV498=true;window.render=wrapped;}
    if(typeof window.switchTab==='function'&&!window.switchTab.__modHistoryV498){const base=window.switchTab;const wrapped=function(tab){const out=base.apply(this,arguments);if(tab==='log')setTimeout(renderEnhancedLog,0);setTimeout(()=>{installHeaderButton();installDevSafetyPanel();installBackupOverride();},0);return out;};wrapped.__modHistoryV498=true;window.switchTab=wrapped;}
  }

  function collectAllMasterLocalStorage(){const out={};try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('masterOfDisaster'))out[key]=localStorage.getItem(key);}}catch(error){out.__error=error?.message||String(error);}return out;}
  async function exportPackage(){await mirrorLiveLogs(true);await pruneAll();return {schema:'master-of-disaster-safety-net',version:1,build:BUILD_VERSION,exportedAt:nowIso(),retentionDays:7,points:await storeGetAll(POINT_STORE),logs:await storeGetAll(LOG_STORE)};}
  async function importPackage(pkg,{replace=true,extraPoints=[]}={}){
    if(!pkg||pkg.schema!=='master-of-disaster-safety-net'||!Array.isArray(pkg.points)||!Array.isArray(pkg.logs))throw new Error('Ungültige V498-History-Datei.');
    if(replace){await storeClear(POINT_STORE);await storeClear(LOG_STORE);}
    for(const row of pkg.points)if(row?.id)await storePut(POINT_STORE,row);
    for(const row of pkg.logs)if(row?.id)await storePut(LOG_STORE,row);
    for(const row of extraPoints)if(row?.id)await storePut(POINT_STORE,row);
    await pruneAll();
  }

  async function createEnhancedFullBackup(){
    const button=document.getElementById('fullBackupV397');if(button?.disabled)return;
    const setState=(text,disabled)=>{if(button){button.textContent=text;button.disabled=!!disabled;}};
    try{
      setState('⏳ BACKUP WIRD GEBAUT…',true);
      if(typeof JSZip!=='function')throw new Error('ZIP-Bibliothek wurde nicht geladen.');
      if(!navigator.onLine)throw new Error('Für das Code-Vollbackup wird Internet benötigt.');
      const stamp=berlinParts(),zip=new JSZip(),appFolder=zip.folder('APP'),dataFolder=zip.folder('DATA');
      const treeRes=await fetch('https://api.github.com/repos/ngtzvpv8dz-create/Master-Of-Disaster/git/trees/main?recursive=1',{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});if(!treeRes.ok)throw new Error(`GitHub-Dateiliste konnte nicht geladen werden (${treeRes.status}).`);const tree=await treeRes.json();const files=(tree.tree||[]).filter(x=>x?.type==='blob'&&x.path),failed=[];
      for(let i=0;i<files.length;i++){const item=files[i];setState(`⏳ CODE ${i+1}/${files.length}…`,true);try{const url='https://raw.githubusercontent.com/ngtzvpv8dz-create/Master-Of-Disaster/main/'+item.path.split('/').map(encodeURIComponent).join('/');const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error(String(res.status));appFolder.file(item.path,await res.arrayBuffer(),{binary:true});}catch(error){failed.push(`${item.path} · ${error?.message||error}`);}}
      const complete=createCompleteBackupPayload();complete.masterVersion=BUILD_VERSION;complete.fullBackupCreatedAt=nowIso();const safety=await exportPackage();const local=collectAllMasterLocalStorage();
      dataFolder.file('complete-data-backup.json',JSON.stringify(complete,null,2));dataFolder.file('localstorage-master-of-disaster.json',JSON.stringify(local,null,2));dataFolder.file('recovery-history-v498.json',JSON.stringify(safety,null,2));dataFolder.file('live-log-7-days.json',JSON.stringify(safety.logs,null,2));
      const info=['MASTER OF DISASTER · VOLLSTÄNDIGES KOMPLETT-BACKUP','====================================================',`Build: ${BUILD_VERSION}`,`Erstellt: ${stamp.dateLabel} ${stamp.clock} Europe/Berlin`,`Git-Stand/Tree: ${tree.sha||'unbekannt'}`,`Repo-Dateien: ${files.length-failed.length}/${files.length}`,`Wiederherstellungspunkte: ${safety.points.length}`,`7-Tage-Logeinträge: ${safety.logs.length}`,'','DATA/complete-data-backup.json = App-Datenstand','DATA/localstorage-master-of-disaster.json = lokale App-Werte','DATA/recovery-history-v498.json = Wiederherstellungspunkte + 7-Tage-Log','DATA/live-log-7-days.json = lesbarer 7-Tage-Log','',failed.length?'Fehlgeschlagene Repo-Dateien:\n'+failed.join('\n'):'Keine fehlgeschlagenen Repo-Dateien.'].join('\n');zip.file('BACKUP-INFO.txt',info);
      setState('⏳ ZIP WIRD GEPACKT…',true);const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Master-of-Disaster_${BUILD_VERSION}_Vollbackup_${stamp.file}.zip`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);setState('✅ VOLLSTÄNDIGES KOMPLETT-BACKUP',false);showInfoModal?.('Vollbackup erstellt ✅',`Code + App-Daten + ${safety.points.length} Wiederherstellungspunkte + ${safety.logs.length} Logeinträge wurden gesichert.`);
    }catch(error){console.error('V498 Vollbackup fehlgeschlagen:',error);setState('📦 VOLLSTÄNDIGES KOMPLETT-BACKUP',false);showInfoModal?.('Vollbackup fehlgeschlagen',error?.message||String(error));}
  }
  function installBackupOverride(){const btn=document.getElementById('fullBackupV397');if(!btn||btn.dataset.v498Enhanced==='1')return;btn.dataset.v498Enhanced='1';btn.textContent='📦 VOLLSTÄNDIGES KOMPLETT-BACKUP';btn.onclick=createEnhancedFullBackup;const wrap=document.getElementById('fullBackupWrapV397');const note=wrap?.querySelector('div:nth-child(2)');if(note)note.textContent='ZIP mit aktuellem Programmcode + kompletten App-Daten + 7-Tage-Log + Wiederherstellungspunkten.';}

  async function cloudContext(){const client=getSupabaseClient?.();if(!client)throw new Error('Kein Supabase-Client verfügbar.');const {data,error}=await client.auth.getSession();if(error)throw error;const user=data?.session?.user;if(!user?.id)throw new Error('Supabase-Login fehlt.');return {client,userId:user.id};}
  function weeklyKey(){return WEEKLY_PREFIX+nowIso().replace(/[:.]/g,'-');}
  async function createWeeklyCloudBackup(){
    try{const {client,userId}=await cloudContext();const safety=await exportPackage();const payload={bundleVersion:1,build:BUILD_VERSION,savedAt:nowIso(),complete:createCompleteBackupPayload(),localStorage:collectAllMasterLocalStorage(),safety};const key=weeklyKey();let result=await client.from('legacy_metadata').insert([{user_id:userId,key,payload}]);if(result.error)throw result.error;result=await client.from('legacy_metadata').select('id,key,created_at').eq('user_id',userId).like('key',WEEKLY_PREFIX+'%').order('created_at',{ascending:false});if(result.error)throw result.error;const rows=result.data||[],old=rows.slice(WEEKLY_KEEP).map(row=>row.id);if(old.length){const del=await client.from('legacy_metadata').delete().eq('user_id',userId).in('id',old);if(del.error)throw del.error;}window.__modLiveLogV453?.append?.('SYSTEM','PASS',`Wochen-Cloudbackup erstellt · ${safety.points.length} Wiederherstellungspunkte · ${safety.logs.length} Logeinträge`);showInfoModal?.('Wochen-Cloudbackup erstellt ✅',`Der datierte Stand wurde dauerhaft in der Cloud gesichert. Es werden maximal ${WEEKLY_KEEP} Wochenstände behalten.`);}catch(error){console.error('V498 Wochenbackup:',error);showInfoModal?.('Cloudbackup fehlgeschlagen',error?.message||String(error));}
  }
  async function listWeeklyCloudBackups(){
    try{const {client,userId}=await cloudContext();const result=await client.from('legacy_metadata').select('key,created_at').eq('user_id',userId).like('key',WEEKLY_PREFIX+'%').order('created_at',{ascending:false}).limit(WEEKLY_KEEP);if(result.error)throw result.error;const rows=result.data||[];const root=modal('WOCHEN-CLOUDBACKUPS',`<div class="mod-point-list-v498">${rows.map(row=>{const p=berlinParts(row.created_at);return `<div class="mod-point-v498"><div class="mod-point-time-v498">${esc(p.clock.slice(0,5))}</div><div class="mod-point-label-v498">${esc(p.dateLabel)}<small>${esc(row.key)}</small></div><button class="mod-action-v498" type="button" data-cloud-key-v498="${esc(row.key)}">WIEDERHERSTELLEN</button></div>`;}).join('')||'<div style="opacity:.7;padding:8px">Noch kein Wochenbackup vorhanden.</div>'}</div>`);root.querySelectorAll('[data-cloud-key-v498]').forEach(btn=>btn.addEventListener('click',()=>restoreWeeklyCloud(btn.dataset.cloudKeyV498)));}catch(error){showInfoModal?.('Cloudbackups konnten nicht geladen werden',error?.message||String(error));}
  }
  async function restoreWeeklyCloud(key){
    try{const {client,userId}=await cloudContext();const result=await client.from('legacy_metadata').select('payload,created_at').eq('user_id',userId).eq('key',key).limit(1);if(result.error)throw result.error;const row=result.data?.[0];if(!row?.payload?.localStorage||!row?.payload?.safety)throw new Error('Cloudbackup ist unvollständig.');const p=berlinParts(row.created_at);if(!window.confirm(`WOCHEN-CLOUDBACKUP WIEDERHERSTELLEN?\n\n${p.dateLabel} · ${p.clock}\n\nDer aktuelle lokale Stand wird vorher als Rücksprungpunkt gesichert.`))return;const guard=await createGuard('Cloudbackup-Wiederherstellung');const backupSnapshot={schemaVersion:1,capturedAt:row.created_at,storage:Object.fromEntries(Object.entries(row.payload.localStorage).filter(([k])=>shouldTrackKey(k)))};await importPackage(row.payload.safety,{replace:true,extraPoints:[guard]});restoring=true;for(const key of trackedCurrentKeys())if(!(key in backupSnapshot.storage))localStorage.removeItem(key);for(const [k,v] of Object.entries(backupSnapshot.storage))localStorage.setItem(k,String(v));const logs=row.payload.safety.logs||[];localStorage.setItem(LIVE_LOG_KEY,JSON.stringify(logs.filter(x=>new Date(x.at).getTime()>=Date.now()-24*60*60*1000).slice(-5000)));window.__modLiveLogV453?.append?.('EDIT','PASS',`Wochen-Cloudbackup wiederhergestellt · ${p.dateLabel} ${p.clock}`);scheduleReloadNotice('Wochen-Cloudbackup wiederhergestellt');}catch(error){console.error('V498 Cloudrestore:',error);showInfoModal?.('Cloud-Restore fehlgeschlagen',error?.message||String(error));}
  }

  async function importFullBackupZip(file){
    try{if(typeof JSZip!=='function')throw new Error('ZIP-Bibliothek wurde nicht geladen.');const zip=await JSZip.loadAsync(file);const localFile=zip.file('DATA/localstorage-master-of-disaster.json'),safetyFile=zip.file('DATA/recovery-history-v498.json'),completeFile=zip.file('DATA/complete-data-backup.json');if(!localFile||!completeFile)throw new Error('Das ZIP ist kein vollständiges Master-of-Disaster-Backup.');const local=safeParse(await localFile.async('text'),null),complete=safeParse(await completeFile.async('text'),null);if(!local||!complete?.state||!Array.isArray(complete.state.tasks))throw new Error('Backup-Daten sind ungültig.');const safety=safetyFile?safeParse(await safetyFile.async('text'),null):{schema:'master-of-disaster-safety-net',version:1,points:[],logs:safeParse(local[LIVE_LOG_KEY]||'[]',[])};if(!window.confirm(`VOLLBACKUP IMPORTIEREN?\n\n${complete.state.tasks.length} Aufgaben · ${(complete.state.archive||[]).length} Archiv-Einträge\n${safety?.points?.length||0} Wiederherstellungspunkte · ${safety?.logs?.length||0} Logeinträge\n\nDer aktuelle Stand wird vorher gesichert.`))return;const guard=await createGuard('Vollbackup-Import');await importPackage(safety,{replace:true,extraPoints:[guard]});restoring=true;for(const key of [...trackedCurrentKeys(),...Object.keys(local).filter(k=>k?.startsWith('masterOfDisaster'))])if(key!==LIVE_LOG_KEY&&!(key in local)&&shouldTrackKey(key))localStorage.removeItem(key);for(const [k,v] of Object.entries(local))if(k?.startsWith('masterOfDisaster'))localStorage.setItem(k,String(v));const logs=safety.logs||[];localStorage.setItem(LIVE_LOG_KEY,JSON.stringify(logs.filter(x=>new Date(x.at).getTime()>=Date.now()-24*60*60*1000).slice(-5000)));window.__modLiveLogV453?.append?.('EDIT','PASS','Vollbackup-ZIP wiederhergestellt');scheduleReloadNotice('Vollbackup wiederhergestellt');}catch(error){console.error('V498 ZIP-Import:',error);showInfoModal?.('Vollbackup-Import fehlgeschlagen',error?.message||String(error));}
  }

  function installDevSafetyPanel(){
    try{if(typeof currentTab!=='undefined'&&currentTab!=='dev')return;}catch(_){return;}
    if(document.getElementById('modDevSafetyV498'))return;
    const host=document.querySelector('.dev-panel')||document.getElementById('viewContainer');if(!host)return;
    const wrap=document.createElement('section');wrap.id='modDevSafetyV498';wrap.className='mod-dev-safety-v498';wrap.innerHTML=`<div style="font-size:10px;font-weight:900;letter-spacing:.8px">🔴 DATENSICHERHEIT V498</div><div style="font-size:10px;line-height:1.5;opacity:.82">7-Tage-Zeitmaschine lokal · Vollbackup inkl. Historie · datierte Cloud-Wochenstände</div><button type="button" class="mod-action-v498" data-weekly-create-v498>☁️ WOCHEN-CLOUDBACKUP ERSTELLEN</button><button type="button" class="mod-action-v498" data-weekly-list-v498>☁️ WOCHEN-CLOUDBACKUPS ANZEIGEN</button><button type="button" class="mod-action-v498" data-zip-import-v498>📥 VOLLBACKUP-ZIP IMPORTIEREN</button><input type="file" accept=".zip,application/zip" data-zip-file-v498 hidden>`;host.appendChild(wrap);wrap.querySelector('[data-weekly-create-v498]')?.addEventListener('click',createWeeklyCloudBackup);wrap.querySelector('[data-weekly-list-v498]')?.addEventListener('click',listWeeklyCloudBackups);const fileInput=wrap.querySelector('[data-zip-file-v498]');wrap.querySelector('[data-zip-import-v498]')?.addEventListener('click',()=>fileInput?.click());fileInput?.addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importFullBackupZip(file);event.target.value='';});
  }

  function showRestoreNotice(){try{const msg=sessionStorage.getItem('modV498RestoreNotice');if(msg){sessionStorage.removeItem('modV498RestoreNotice');setTimeout(()=>showInfoModal?.('Wiederherstellung abgeschlossen ✅',msg),350);}}catch(_){} }
  function disableOldUndo(){try{window.__modSafeUndoV457?.clear?.();}catch(_){}document.getElementById('safeUndoV457')?.remove();}

  async function init(){
    if(initialized)return;
    injectStyle();
    await openDb();
    lastSnapshot=captureSnapshot();
    patchStorage();
    patchRenderers();
    initialized=true;
    disableOldUndo();
    installHeaderButton();
    installBackupOverride();
    installDevSafetyPanel();
    await mirrorLiveLogs(true);
    await pruneAll();
    showRestoreNotice();
    setInterval(()=>{mirrorLiveLogs().catch(()=>{});if(!restoring)queueCapture(80);try{if(currentTab==='log'&&logFollow)renderEnhancedLog();}catch(_){}},5000);
    window.addEventListener('focus',()=>{mirrorLiveLogs(true).catch(()=>{});queueCapture(80);});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){mirrorLiveLogs(true).catch(()=>{});queueCapture(80);}});
    window.__modRecoveryHistoryV498={version:BUILD_VERSION,dbName:DB_NAME,retentionMs:RETENTION_MS,openQuickHistory,openPoint,restoreFullPoint,surgicalUndo,recentPoints,readSevenDayLogs,renderEnhancedLog,exportPackage,importPackage,createWeeklyCloudBackup,listWeeklyCloudBackups,createEnhancedFullBackup,importFullBackupZip,captureSnapshot,mirrorLiveLogs,pruneAll};
    try{window.__modLiveLogV453?.append?.('SYSTEM','PASS','Datensicherheitsnetz V498 aktiv · 7-Tage-Verlauf + Wiederherstellungspunkte');}catch(_){}
  }

  function waitForDependencies(){
    let tries=0;const timer=setInterval(()=>{tries++;const ready=typeof window.render==='function'&&typeof window.switchTab==='function'&&typeof window.createCompleteBackupPayload==='function'&&!!window.__modLiveLogV453;if(ready){clearInterval(timer);init().catch(error=>console.error('V498 Initialisierung fehlgeschlagen:',error));}else if(tries>120){clearInterval(timer);console.error('V498 Abhängigkeiten wurden nicht rechtzeitig verfügbar.');}},100);
  }
  waitForDependencies();
})();
