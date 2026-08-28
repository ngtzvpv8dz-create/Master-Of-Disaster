/* V496 · SAFE ACCIDENTAL COMPLETION RECOVERY
   Restores one explicitly identified completed local task to a supplied prior
   snapshot while preserving Today/work-block placement. Optionally removes
   the matching accidental archive entry, but only after strict validation.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V496';
  const COMMAND='RECOVER_ACCIDENTAL_COMPLETION';
  const QUEUE_STATUS='done';
  const POLL_MS=1200;
  let busy=false,timer=null;

  const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');
  const clone=v=>JSON.parse(JSON.stringify(v));
  const isoOrNull=v=>{if(v==null||v==='')return null;const d=new Date(v);if(Number.isNaN(d.getTime()))throw new Error('Ungültiger ISO-Zeitpunkt im Wiederherstellungs-Snapshot.');return d.toISOString();};

  async function getSession(){
    const client=typeof getSupabaseClient==='function'?getSupabaseClient():null;
    if(!client)return null;
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    const user=data?.session?.user;
    return user?.id?{client,userId:user.id}:null;
  }

  function realArchiveNumber(row){
    if(!row||row.isTestArchive)return null;
    const n=Number(row.archiveNumber);
    return Number.isInteger(n)&&n>0?n:null;
  }

  function resolveCompletedTask(payload){
    if(!Array.isArray(tasks))throw new Error('Lokale Aufgabenliste fehlt.');
    const id=payload?.local_task_id;
    if(id==null)throw new Error('RECOVER_ACCIDENTAL_COMPLETION: local_task_id fehlt.');
    const matches=tasks.filter(t=>t&&String(t.id)===String(id));
    if(matches.length!==1)throw new Error(`Lokale Aufgabe ${id} ist nicht eindeutig vorhanden.`);
    const task=matches[0];
    if(payload.expected_text&&norm(task.text)!==norm(payload.expected_text))throw new Error('Aufgabentext stimmt nicht mit expected_text überein.');
    if(task.status!=='completed')throw new Error(`Aufgabe ist nicht completed, sondern ${String(task.status||'unbekannt')}.`);
    return task;
  }

  function validateSnapshot(snapshot){
    if(!snapshot||typeof snapshot!=='object')throw new Error('Wiederherstellungs-Snapshot fehlt.');
    const status=String(snapshot.status||'');
    if(!['open','paused','running'].includes(status))throw new Error('Snapshot-Status ist nicht wiederherstellbar.');
    const segments=Array.isArray(snapshot.activeSegments)?snapshot.activeSegments.map(seg=>({
      startedAt:isoOrNull(seg?.startedAt),
      endedAt:isoOrNull(seg?.endedAt)
    })):[];
    for(const seg of segments){if(!seg.startedAt||!seg.endedAt)throw new Error('Unvollständiges Arbeitssegment im Snapshot.');}
    return {
      status,
      startedAt:isoOrNull(snapshot.startedAt),
      pausedAt:isoOrNull(snapshot.pausedAt),
      completedAt:null,
      abortedAt:null,
      pauseTotalMs:Number(snapshot.pauseTotalMs)||0,
      activeDurationMs:snapshot.activeDurationMs==null?null:Number(snapshot.activeDurationMs),
      actualDurationMs:snapshot.actualDurationMs==null?null:Number(snapshot.actualDurationMs),
      leisureDurationMs:snapshot.leisureDurationMs==null?null:Number(snapshot.leisureDurationMs),
      passiveDurationMs:snapshot.passiveDurationMs==null?null:Number(snapshot.passiveDurationMs),
      cookingActiveDurationMs:snapshot.cookingActiveDurationMs==null?null:Number(snapshot.cookingActiveDurationMs),
      cookingPassiveDurationMs:snapshot.cookingPassiveDurationMs==null?null:Number(snapshot.cookingPassiveDurationMs),
      cookingMode:snapshot.cookingMode||'active',
      activeSegments:segments,
      cookingSegments:Array.isArray(snapshot.cookingSegments)?clone(snapshot.cookingSegments):[]
    };
  }

  function validateArchiveRemoval(payload,task){
    const raw=payload?.accidental_archive_number;
    if(raw==null)return null;
    if(!Array.isArray(archive))throw new Error('Lokales Archiv fehlt.');
    const n=Number(raw);
    if(!Number.isInteger(n)||n<=0)throw new Error('accidental_archive_number ist ungültig.');
    const matches=[];
    archive.forEach((row,index)=>{if(realArchiveNumber(row)===n)matches.push({row,index});});
    if(matches.length===0)return {archiveNumber:n,index:null,row:null};
    if(matches.length!==1)throw new Error(`A${n} ist nicht eindeutig (${matches.length} Treffer).`);
    const match=matches[0];
    if(norm(match.row.text)!==norm(task.text))throw new Error(`A${n} gehört zu „${String(match.row.text||'')}“ statt „${task.text}“; nichts verändert.`);
    if(String(match.row.status||'completed')!=='completed')throw new Error(`A${n} ist kein abgeschlossener Archiveintrag; nichts verändert.`);
    return {archiveNumber:n,index:match.index,row:match.row};
  }

  function recover(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    const task=resolveCompletedTask(payload);
    const snapshot=validateSnapshot(payload.previous_snapshot);
    const archiveMatch=validateArchiveRemoval(payload,task);

    const beforeTask=clone(task);
    const beforeNext=typeof nextArchiveNumber!=='undefined'?nextArchiveNumber:null;
    const beforeArchive=archiveMatch?.row?clone(archiveMatch.row):null;
    const placement={todayDate:task.todayDate??null,todayOrder:task.todayOrder??null,todayWorkBlockId:task.todayWorkBlockId??null};

    Object.assign(task,snapshot,placement);

    let removedArchive=null;
    if(archiveMatch?.row){
      removedArchive=clone(archiveMatch.row);
      archive.splice(archiveMatch.index,1);
      const highest=archive.reduce((m,row)=>Math.max(m,realArchiveNumber(row)||0),0);
      if(typeof nextArchiveNumber!=='undefined')nextArchiveNumber=highest+1;
    }

    try{
      if(typeof saveTasks==='function')saveTasks();
      else if(typeof safeStorageSet==='function')safeStorageSet('masterOfDisasterTasks',JSON.stringify(tasks));
      if(removedArchive){
        if(typeof saveArchive==='function')saveArchive();
        else if(typeof safeStorageSet==='function'){
          safeStorageSet('masterOfDisasterArchive',JSON.stringify(archive));
          safeStorageSet('masterOfDisasterNextArchiveNumber',String(nextArchiveNumber));
        }
      }
      if(typeof render==='function')render();
      try{window.__modLiveLogV453?.append?.('EDIT','WARN',`Versehentlichen Abschluss sicher zurückgerollt: „${task.text}“ · Status ${task.status} · Arbeitssegmente erhalten${removedArchive?` · A${removedArchive.archiveNumber} entfernt`:''}`);}catch(_){}
      try{if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('recover-accidental-completion-v496');}catch(_){}
    }catch(error){
      Object.keys(task).forEach(k=>delete task[k]);Object.assign(task,beforeTask);
      if(removedArchive){archive.splice(archiveMatch.index,0,beforeArchive);if(typeof nextArchiveNumber!=='undefined')nextArchiveNumber=beforeNext;}
      throw error;
    }

    return {
      version:BUILD_VERSION,
      local_task_id:task.id,
      text:task.text,
      status:task.status,
      started_at:task.startedAt??null,
      paused_at:task.pausedAt??null,
      completed_at:task.completedAt??null,
      today_date:task.todayDate??null,
      today_order:task.todayOrder??null,
      today_work_block_id:task.todayWorkBlockId??null,
      active_segments:Array.isArray(task.activeSegments)?clone(task.activeSegments):[],
      archive_removed:removedArchive?{archive_number:removedArchive.archiveNumber,archive_id:removedArchive.archiveId??null,text:removedArchive.text}:null,
      archive_entry_not_found:archiveMatch&&!archiveMatch.row?archiveMatch.archiveNumber:null,
      next_archive_number:typeof nextArchiveNumber!=='undefined'?nextArchiveNumber:null
    };
  }

  async function mark(client,id,status,extra={}){
    const {error}=await client.from('remote_commands').update({status,processed_at:new Date().toISOString(),...extra}).eq('id',id);
    if(error)throw error;
  }

  async function processOne(client,row){
    try{
      const result=recover(row.payload||{});
      await mark(client,row.id,'done',{result,error:null});
      return true;
    }catch(error){
      const message=error?.message||String(error);
      try{await mark(client,row.id,'error',{error:message});}catch(_){}
      console.warn('V496 accidental completion recovery:',error);
      return false;
    }
  }

  async function poll(){
    if(busy||!navigator.onLine)return;
    busy=true;
    try{
      const s=await getSession();if(!s)return;
      const {data,error}=await s.client.from('remote_commands')
        .select('id,command,payload,created_at')
        .eq('user_id',s.userId)
        .eq('status',QUEUE_STATUS)
        .is('processed_at',null)
        .eq('command',COMMAND)
        .order('created_at',{ascending:true})
        .limit(3);
      if(error)throw error;
      for(const row of(data||[]))await processOne(s.client,row);
    }catch(error){console.warn('V496 recovery poll:',error);}finally{busy=false;}
  }

  function start(){if(timer)clearInterval(timer);poll();timer=setInterval(poll,POLL_MS);}
  window.addEventListener('online',()=>setTimeout(poll,100));
  window.addEventListener('focus',()=>setTimeout(poll,80));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(poll,80);});
  window.addEventListener('load',()=>setTimeout(start,650));
  setTimeout(start,900);

  window.__modAccidentalCompletionRecoveryV496={version:BUILD_VERSION,command:COMMAND,queueStatus:QUEUE_STATUS,pollMs:POLL_MS,recover,poll};
})();
