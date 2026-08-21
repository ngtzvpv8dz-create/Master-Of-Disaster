/* V457 · SICHERES 1-SCHRITT-UNDO
   Hält genau die letzte eindeutig reversible lokale Aktion vor.
   Keine Archiv-Rückabwicklung und kein mehrstufiger Zustandsturm.
*/
(function(){
  const BUILD_VERSION='V457';
  const TTL_MS=10*60*1000;
  let restoring=false;
  let undoAction=null;
  let taskSnapshot=clone(typeof tasks!=='undefined'?tasks:[]);
  let weightSnapshot=snapshotWeight();
  let archiveSignature=hash(typeof archive!=='undefined'?archive:[]);
  let expiryTimer=null;

  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}}
  function hash(value){try{return JSON.stringify(value);}catch(_){return String(Date.now());}}
  function clean(value){return String(value??'').replace(/\s+/g,' ').trim();}
  function taskMap(rows){const map=new Map();(Array.isArray(rows)?rows:[]).forEach((row,index)=>map.set(String(row&&row.id!=null?row.id:`idx-${index}`),row));return map;}
  function snapshotWeight(){return {state:clone(typeof weightState!=='undefined'?weightState:null),phases:clone(typeof weightPhases!=='undefined'?weightPhases:[])};}
  function hasTiming(row){if(!row)return false;return !!(row.startedAt||row.pausedAt||row.completedAt||row.abortedAt||(Array.isArray(row.activeSegments)&&row.activeSegments.length)||(Number(row.activeDurationMs)||0)>0||(Number(row.actualDurationMs)||0)>0);}
  function timingHash(row){return hash({startedAt:row&&row.startedAt,pausedAt:row&&row.pausedAt,completedAt:row&&row.completedAt,abortedAt:row&&row.abortedAt,activeDurationMs:row&&row.activeDurationMs,actualDurationMs:row&&row.actualDurationMs,pauseTotalMs:row&&row.pauseTotalMs,activeSegments:row&&row.activeSegments,cookingSegments:row&&row.cookingSegments});}
  function same(a,b){return hash(a)===hash(b);}

  function describeChanged(before,after){
    const name=`„${clean(after&&after.text||before&&before.text)||'Unbenannte Aufgabe'}“`;
    if(before.status!==after.status){
      if(after.status==='running'&&before.status==='open')return `Start von ${name}`;
      if(after.status==='paused')return `Pause von ${name}`;
      if(after.status==='running'&&before.status==='paused')return `Fortsetzen von ${name}`;
      if(after.status==='completed')return `Abschluss von ${name}`;
      if(after.status==='aborted')return `Abbruch von ${name}`;
      return `Statusänderung von ${name}`;
    }
    if(clean(before.note)!==clean(after.note))return `Notiz von ${name}`;
    if(before.text!==after.text)return `Titeländerung von ${name}`;
    if(before.category!==after.category)return `Kategorieänderung von ${name}`;
    if(before.priority!==after.priority)return `Prioritätsänderung von ${name}`;
    if(before.type!==after.type)return `Typänderung von ${name}`;
    if(Boolean(before.optional)!==Boolean(after.optional))return `Optional-Änderung von ${name}`;
    if(before.dueMode!==after.dueMode||before.dueDate!==after.dueDate)return `Fälligkeitsänderung von ${name}`;
    if(before.todayDate!==after.todayDate||before.todayOrder!==after.todayOrder)return `Heute-Änderung von ${name}`;
    if(timingHash(before)!==timingHash(after))return `Zeitänderung von ${name}`;
    return `Bearbeitung von ${name}`;
  }

  function analyzeTaskChange(beforeRows,afterRows){
    const before=taskMap(beforeRows),after=taskMap(afterRows),added=[],removed=[],changed=[];
    for(const [key,row] of after){if(!before.has(key))added.push(row);else if(!same(before.get(key),row))changed.push([before.get(key),row]);}
    for(const [key,row] of before)if(!after.has(key))removed.push(row);
    if(added.length===1&&!removed.length&&!changed.length){
      const row=added[0];if(String(row.status||'open')!=='open'||hasTiming(row))return null;
      return {label:`Erstellen von „${clean(row.text)||'Unbenannte Aufgabe'}“`};
    }
    if(removed.length===1&&!added.length&&!changed.length){
      const row=removed[0];if(String(row.status||'open')!=='open'||hasTiming(row))return null;
      return {label:`Löschen von „${clean(row.text)||'Unbenannte Aufgabe'}“`};
    }
    if(changed.length===1&&!added.length&&!removed.length)return {label:describeChanged(changed[0][0],changed[0][1])};
    return null;
  }

  function clearUndo(){undoAction=null;if(expiryTimer){clearTimeout(expiryTimer);expiryTimer=null;}renderUndoBar();}
  function setUndo(action){
    undoAction={...action,createdAt:Date.now(),expiresAt:Date.now()+TTL_MS};
    if(expiryTimer)clearTimeout(expiryTimer);expiryTimer=setTimeout(clearUndo,TTL_MS+100);
    renderUndoBar();
  }
  function safeLog(message){try{window.__modLiveLogV453?.append?.('EDIT','INFO',message);}catch(_){} }

  function captureTasks(beforeRows,afterRows){
    const info=analyzeTaskChange(beforeRows,afterRows);
    if(!info){clearUndo();return;}
    setUndo({type:'tasks',label:info.label,before:clone(beforeRows),afterHash:hash(afterRows)});
  }
  function captureWeight(before,after){
    if(same(before,after))return;
    setUndo({type:'weight',label:'Änderung am Zusatzgewicht',before:clone(before),afterHash:hash(after)});
  }

  function undo(){
    const action=undoAction;if(!action)return false;
    if(Date.now()>action.expiresAt){clearUndo();return false;}
    try{
      restoring=true;
      if(action.type==='tasks'){
        if(hash(typeof tasks!=='undefined'?tasks:[])!==action.afterHash)throw new Error('Aufgabenstand hat sich seitdem verändert.');
        tasks=clone(action.before);
        if(typeof saveTasks==='function')saveTasks();
        taskSnapshot=clone(tasks);
      }else if(action.type==='weight'){
        const current=snapshotWeight();if(hash(current)!==action.afterHash)throw new Error('Gewichtsstand hat sich seitdem verändert.');
        weightState=clone(action.before.state);weightPhases=clone(action.before.phases);
        if(typeof saveWeight==='function')saveWeight();
        weightSnapshot=snapshotWeight();
      }else return false;
      const label=action.label;undoAction=null;if(expiryTimer){clearTimeout(expiryTimer);expiryTimer=null;}
      if(typeof render==='function')render();
      try{window.__modLiveLogV453?.logUndo?.(label);}catch(_){safeLog(`Rückgängig: ${label}`);}
      renderUndoBar();return true;
    }catch(error){
      undoAction=null;renderUndoBar();
      try{window.__modLiveLogV453?.append?.('EDIT','WARN',`Rückgängig nicht ausgeführt: ${error&&error.message?error.message:'Zustand geändert'}`);}catch(_){}
      return false;
    }finally{restoring=false;}
  }

  function injectStyle(){
    if(typeof document==='undefined'||document.getElementById('safeUndoV457Style'))return;
    const style=document.createElement('style');style.id='safeUndoV457Style';style.textContent=`
      .safe-undo-v457{position:fixed;left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));z-index:9998;display:flex;justify-content:center;pointer-events:none}.safe-undo-inner-v457{max-width:620px;width:100%;display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:12px;background:rgba(20,22,24,.96);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 28px rgba(0,0,0,.35);pointer-events:auto}.safe-undo-text-v457{min-width:0;flex:1;font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.86}.safe-undo-button-v457{border:1px solid rgba(103,168,216,.65);background:rgba(103,168,216,.14);color:inherit;border-radius:9px;padding:8px 10px;font:inherit;font-weight:850;white-space:nowrap}.safe-undo-close-v457{border:0;background:transparent;color:inherit;font-size:1rem;opacity:.65;padding:5px}
    `;document.head.appendChild(style);
  }
  function renderUndoBar(){
    if(typeof document==='undefined')return;injectStyle();let root=document.getElementById('safeUndoV457');
    if(!undoAction){root?.remove();return;}
    if(!root){root=document.createElement('div');root.id='safeUndoV457';root.className='safe-undo-v457';document.body.appendChild(root);}
    root.innerHTML=`<div class="safe-undo-inner-v457"><div class="safe-undo-text-v457">Letzte Aktion: ${clean(undoAction.label)}</div><button type="button" class="safe-undo-button-v457" id="safeUndoButtonV457">↩️ RÜCKGÄNGIG</button><button type="button" class="safe-undo-close-v457" id="safeUndoCloseV457" aria-label="Rückgängig ausblenden">✕</button></div>`;
    document.getElementById('safeUndoButtonV457')?.addEventListener('click',undo);
    document.getElementById('safeUndoCloseV457')?.addEventListener('click',clearUndo);
  }

  const baseSaveTasks=typeof saveTasks==='function'?saveTasks:null;
  if(baseSaveTasks){window.saveTasks=function(){const before=clone(taskSnapshot);const result=baseSaveTasks.apply(this,arguments);const after=clone(typeof tasks!=='undefined'?tasks:[]);if(!restoring)captureTasks(before,after);taskSnapshot=after;return result;};}
  const baseSaveWeight=typeof saveWeight==='function'?saveWeight:null;
  if(baseSaveWeight){window.saveWeight=function(){const before=clone(weightSnapshot);const result=baseSaveWeight.apply(this,arguments);const after=snapshotWeight();if(!restoring)captureWeight(before,after);weightSnapshot=after;return result;};}
  const baseSaveArchive=typeof saveArchive==='function'?saveArchive:null;
  if(baseSaveArchive){window.saveArchive=function(){const before=archiveSignature;const result=baseSaveArchive.apply(this,arguments);const after=hash(typeof archive!=='undefined'?archive:[]);archiveSignature=after;if(!restoring&&before!==after)clearUndo();return result;};}
  const baseRender=typeof render==='function'?render:null;
  if(baseRender){window.render=function(){const result=baseRender.apply(this,arguments);setTimeout(renderUndoBar,0);return result;};}

  window.__modSafeUndoV457={version:BUILD_VERSION,undo,clear:clearUndo,current:()=>undoAction?clone({type:undoAction.type,label:undoAction.label,createdAt:undoAction.createdAt,expiresAt:undoAction.expiresAt}):null,analyzeTaskChange};
})();
