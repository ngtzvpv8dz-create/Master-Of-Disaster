/* V497 · SAFE TASK SEGMENT REPAIR
   One-off guarded mailbox bridge for restoring documented task segments and
   task-specific weight ranges without touching unrelated local data.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V497';
  const COMMAND='RESTORE_TASK_SEGMENTS';
  const QUEUE_STATUS='done';
  const POLL_MS=1200;
  let busy=false,timer=null;

  const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');
  const clone=v=>JSON.parse(JSON.stringify(v));
  const iso=v=>{const d=new Date(v);if(!v||Number.isNaN(d.getTime()))throw new Error('Ungültiger ISO-Zeitpunkt.');return d.toISOString();};

  async function getSession(){
    const client=typeof getSupabaseClient==='function'?getSupabaseClient():null;
    if(!client)return null;
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    const user=data?.session?.user;
    return user?.id?{client,userId:user.id}:null;
  }

  function resolveTask(payload){
    if(!Array.isArray(tasks))throw new Error('Lokale Aufgabenliste fehlt.');
    if(payload?.local_task_id==null)throw new Error('local_task_id fehlt.');
    const matches=tasks.filter(t=>t&&String(t.id)===String(payload.local_task_id));
    if(matches.length!==1)throw new Error('Zielaufgabe ist nicht eindeutig vorhanden.');
    const task=matches[0];
    if(payload.expected_text&&norm(task.text)!==norm(payload.expected_text))throw new Error('Aufgabentext stimmt nicht mit expected_text überein.');
    if(payload.expected_status&&String(task.status)!==String(payload.expected_status))throw new Error(`Aufgabenstatus ist ${String(task.status)}, erwartet ${String(payload.expected_status)}.`);
    return task;
  }

  function normalizeSegments(list,label){
    if(!Array.isArray(list)||!list.length)throw new Error(`${label} fehlt.`);
    const rows=list.map((row,index)=>{
      const startedAt=iso(row?.startedAt),endedAt=iso(row?.endedAt);
      const start=new Date(startedAt).getTime(),end=new Date(endedAt).getTime();
      if(end<=start)throw new Error(`${label} ${index+1}: Ende muss nach Start liegen.`);
      return {startedAt,endedAt};
    }).sort((a,b)=>new Date(a.startedAt)-new Date(b.startedAt));
    for(let i=0;i<rows.length-1;i++)if(new Date(rows[i].endedAt)>new Date(rows[i+1].startedAt))throw new Error(`${label}: Segmente überlappen sich.`);
    return rows;
  }

  function normalizeWeightSegments(list){
    if(!Array.isArray(list)||!list.length)return [];
    const rows=list.map((row,index)=>{
      const startedAt=iso(row?.startedAt),endedAt=iso(row?.endedAt);
      const start=new Date(startedAt).getTime(),end=new Date(endedAt).getTime();
      const weightKg=Number(row?.weightKg);
      if(end<=start)throw new Error(`Gewichtssegment ${index+1}: Ende muss nach Start liegen.`);
      if(!Number.isFinite(weightKg)||weightKg<=0)throw new Error(`Gewichtssegment ${index+1}: Gewicht ist ungültig.`);
      return {startedAt,endedAt,weightKg};
    }).sort((a,b)=>new Date(a.startedAt)-new Date(b.startedAt));
    return rows;
  }

  function segmentKey(row){return `${iso(row.startedAt)}|${iso(row.endedAt)}`;}

  function repair(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    const task=resolveTask(payload);
    const existing=Array.isArray(task.activeSegments)?task.activeSegments.filter(s=>s?.startedAt&&s?.endedAt):[];
    if(payload.expected_current_segment_count!=null&&existing.length!==Number(payload.expected_current_segment_count))throw new Error(`Aktuell ${existing.length} Segmente, erwartet ${payload.expected_current_segment_count}. Nichts verändert.`);
    if(payload.expected_last_segment_end){
      const last=existing.slice().sort((a,b)=>new Date(a.startedAt)-new Date(b.startedAt)).at(-1);
      if(!last||iso(last.endedAt)!==iso(payload.expected_last_segment_end))throw new Error('Letztes vorhandenes Segment entspricht nicht dem erwarteten Stand. Nichts verändert.');
    }

    const replacement=normalizeSegments(payload.segments,'Zeitsegment');
    const weightSegments=normalizeWeightSegments(payload.weight_segments);
    const unique=new Set(replacement.map(segmentKey));
    if(unique.size!==replacement.length)throw new Error('Doppelte Zeitsegmente im Wiederherstellungsdatensatz.');

    for(const w of weightSegments){
      const ws=new Date(w.startedAt).getTime(),we=new Date(w.endedAt).getTime();
      const covered=replacement.some(s=>ws>=new Date(s.startedAt).getTime()&&we<=new Date(s.endedAt).getTime());
      if(!covered)throw new Error('Ein Gewichtssegment liegt außerhalb der wiederhergestellten Arbeitssegmente.');
    }

    const before=clone(task);
    const placement={todayDate:task.todayDate??null,todayOrder:task.todayOrder??null,todayWorkBlockId:task.todayWorkBlockId??null};
    try{
      task.activeSegments=replacement;
      task.startedAt=replacement[0].startedAt;
      task.pausedAt=task.status==='paused'?replacement[replacement.length-1].endedAt:task.pausedAt??null;
      task.pauseTotalMs=0;
      if(['open','paused','running'].includes(String(task.status))){task.activeDurationMs=null;task.actualDurationMs=null;}
      if(weightSegments.length)task.weightActiveSegments=weightSegments;
      Object.assign(task,placement);
      if(typeof saveTasks==='function')saveTasks();
      else if(typeof safeStorageSet==='function')safeStorageSet('masterOfDisasterTasks',JSON.stringify(tasks));
      if(typeof render==='function')render();
      try{window.__modLiveLogV453?.append?.('EDIT','WARN',`Dokumentierte Zeitsegmente wiederhergestellt: „${task.text}“ · ${replacement.length} Segmente · Zusatzgewichtsdaten erhalten`);}catch(_){}
      try{if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('restore-task-segments-v497');}catch(_){}
    }catch(error){
      Object.keys(task).forEach(k=>delete task[k]);Object.assign(task,before);
      throw error;
    }

    const activeTotalMs=replacement.reduce((sum,s)=>sum+(new Date(s.endedAt)-new Date(s.startedAt)),0);
    const weightedTotalMs=weightSegments.reduce((sum,s)=>sum+(new Date(s.endedAt)-new Date(s.startedAt)),0);
    return {
      version:BUILD_VERSION,
      local_task_id:task.id,
      text:task.text,
      status:task.status,
      started_at:task.startedAt??null,
      paused_at:task.pausedAt??null,
      completed_at:task.completedAt??null,
      active_segments:clone(task.activeSegments),
      weight_active_segments:Array.isArray(task.weightActiveSegments)?clone(task.weightActiveSegments):[],
      active_total_ms:activeTotalMs,
      weighted_total_ms:weightedTotalMs,
      today_date:task.todayDate??null,
      today_order:task.todayOrder??null,
      today_work_block_id:task.todayWorkBlockId??null
    };
  }

  async function mark(client,id,status,extra={}){
    const {error}=await client.from('remote_commands').update({status,processed_at:new Date().toISOString(),...extra}).eq('id',id);
    if(error)throw error;
  }

  async function processOne(client,row){
    try{const result=repair(row.payload||{});await mark(client,row.id,'done',{result,error:null});return true;}
    catch(error){const message=error?.message||String(error);try{await mark(client,row.id,'error',{error:message});}catch(_){}console.warn('V497 segment repair:',error);return false;}
  }

  async function poll(){
    if(busy||!navigator.onLine)return;
    busy=true;
    try{
      const s=await getSession();if(!s)return;
      const {data,error}=await s.client.from('remote_commands').select('id,command,payload,created_at')
        .eq('user_id',s.userId).eq('status',QUEUE_STATUS).is('processed_at',null).eq('command',COMMAND).order('created_at',{ascending:true}).limit(3);
      if(error)throw error;
      for(const row of(data||[]))await processOne(s.client,row);
    }catch(error){console.warn('V497 segment repair poll:',error);}finally{busy=false;}
  }

  function start(){if(timer)clearInterval(timer);poll();timer=setInterval(poll,POLL_MS);}
  window.addEventListener('online',()=>setTimeout(poll,100));
  window.addEventListener('focus',()=>setTimeout(poll,80));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(poll,80);});
  window.addEventListener('load',()=>setTimeout(start,650));
  setTimeout(start,900);
  window.__modTaskSegmentRepairV497={version:BUILD_VERSION,command:COMMAND,poll,repair};
})();
