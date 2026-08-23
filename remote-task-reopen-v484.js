/* V484 · REMOTE COMPLETION REOPEN
   Safe Bedienmodus command to undo one accidental completion while the task
   is still in the local tasks array. No archive mutation and no direct time
   editing outside the selected completed task.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V484';
  const COMMAND='REOPEN_COMPLETED_TASK';
  const QUEUE_STATUS='processing';
  const POLL_MS=1500;
  let busy=false,timer=null;

  async function getSession(){
    const client=typeof getSupabaseClient==='function'?getSupabaseClient():null;
    if(!client)return null;
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    const user=data?.session?.user;
    return user?.id?{client,userId:user.id}:null;
  }

  const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');

  function resolveCompletedTask(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    if(!Array.isArray(tasks))throw new Error('Lokale Aufgabenliste fehlt.');
    let matches=tasks.filter(t=>t&&t.status==='completed');
    if(payload.local_task_id!=null)matches=matches.filter(t=>String(t.id)===String(payload.local_task_id));
    else if(payload.text)matches=matches.filter(t=>norm(t.text)===norm(payload.text));
    else throw new Error('REOPEN_COMPLETED_TASK: Aufgabe nicht angegeben.');
    if(matches.length===0)throw new Error('Abgeschlossene Aufgabe nicht gefunden.');
    if(matches.length>1)throw new Error('Abgeschlossene Aufgabe ist nicht eindeutig.');
    return matches[0];
  }

  function reopenCompletedTask(payload){
    const task=resolveCompletedTask(payload);
    const historicalProgress=Number(task.importedHistoricalProgressDurationMs)||0;
    if(historicalProgress>0)throw new Error('Aufgabe enthält historischen Fortschritt und wird nicht automatisch zurückgesetzt.');

    const before={
      id:task.id,
      text:task.text,
      status:task.status,
      started_at:task.startedAt??null,
      completed_at:task.completedAt??null,
      active_duration_ms:Number(task.activeDurationMs)||0,
      actual_duration_ms:Number(task.actualDurationMs)||0,
      today_date:task.todayDate??null,
      today_order:task.todayOrder??null
    };

    task.status='open';
    task.startedAt=null;
    task.pausedAt=null;
    task.completedAt=null;
    task.abortedAt=null;
    task.pauseTotalMs=0;
    task.activeDurationMs=null;
    task.actualDurationMs=null;
    task.leisureDurationMs=null;
    task.passiveDurationMs=null;
    task.cookingActiveDurationMs=null;
    task.cookingPassiveDurationMs=null;
    task.cookingMode='active';
    task.activeSegments=[];
    task.cookingSegments=[];

    if(typeof normalizeTodayOrder==='function')normalizeTodayOrder();
    if(typeof saveTasks==='function')saveTasks();
    else if(typeof safeStorageSet==='function')safeStorageSet('masterOfDisasterTasks',JSON.stringify(tasks));
    if(typeof render==='function')render();
    try{window.__modLiveLogV453?.append?.('EDIT','WARN',`Versehentlichen Abschluss rückgängig gemacht: „${task.text}“ · Zeit zurückgesetzt`);}catch(_){}
    try{if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('remote-reopen-completed-task');}catch(_){}

    return {
      local_task_id:task.id,
      text:task.text,
      status:task.status,
      started_at:task.startedAt,
      completed_at:task.completedAt,
      active_duration_ms:task.activeDurationMs,
      actual_duration_ms:task.actualDurationMs,
      today_date:task.todayDate??null,
      today_order:task.todayOrder??null,
      previous:before,
      reset_to_never_started:true
    };
  }

  async function mark(client,id,status,extra={}){
    const {error}=await client.from('remote_commands').update({status,processed_at:new Date().toISOString(),...extra}).eq('id',id);
    if(error)throw error;
  }

  async function processOne(client,row){
    try{
      if(row.command!==COMMAND)return false;
      const result=reopenCompletedTask(row.payload||{});
      await mark(client,row.id,'done',{result,error:null});
      return true;
    }catch(error){
      const message=error?.message||String(error);
      try{await mark(client,row.id,'error',{error:message});}catch(_){}
      console.warn('V484 remote task reopen:',error);
      return false;
    }
  }

  async function poll(){
    if(busy||!navigator.onLine)return;
    busy=true;
    try{
      const s=await getSession();if(!s)return;
      const {data,error}=await s.client.from('remote_commands').select('id,command,payload,created_at').eq('user_id',s.userId).eq('status',QUEUE_STATUS).eq('command',COMMAND).order('created_at',{ascending:true}).limit(5);
      if(error)throw error;
      for(const row of(data||[]))await processOne(s.client,row);
    }catch(error){console.warn('V484 remote task reopen poll:',error);}finally{busy=false;}
  }

  function start(){if(timer)clearInterval(timer);poll();timer=setInterval(poll,POLL_MS);}
  window.addEventListener('online',()=>setTimeout(poll,120));
  window.addEventListener('focus',()=>setTimeout(poll,100));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(poll,100);});
  window.addEventListener('load',()=>setTimeout(start,700));
  setTimeout(start,1000);

  window.__modRemoteTaskReopenV484={
    version:BUILD_VERSION,
    command:COMMAND,
    queueStatus:QUEUE_STATUS,
    pollMs:POLL_MS,
    resolveCompletedTask,
    reopenCompletedTask,
    poll
  };
})();
