/* V438 · REMOTE COMMAND BRIDGE
   Supabase ist nur Befehls-Briefkasten. localStorage bleibt Master.
   Unterstützt ADD_TASK, START_TASK, PAUSE_TASK, RESUME_TASK, COMPLETE_TASK,
   START_WEIGHT, STOP_WEIGHT und ADJUST_WEIGHT_START.
*/
(function(){
  const POLL_MS=5000;
  let busy=false;
  let timer=null;

  async function getSession(){
    const client=typeof getSupabaseClient==='function'?getSupabaseClient():null;
    if(!client) return null;
    const {data,error}=await client.auth.getSession();
    if(error) throw error;
    const user=data&&data.session&&data.session.user;
    return user&&user.id?{client,userId:user.id}:null;
  }

  const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');
  const isoOrNull=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();};
  function normalizeType(v){ return ['work','leisure','selfrunner','cooking'].includes(v)?v:'work'; }
  function normalizePriority(v){ return ['normal','medium','high'].includes(v)?v:'normal'; }

  function createLocalTask(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    const text=String(payload.text||'').trim();
    if(!text) throw new Error('ADD_TASK: Aufgabentitel fehlt.');
    if(!Array.isArray(tasks)) throw new Error('ADD_TASK: Lokale Aufgabenliste fehlt.');
    const now=Date.now();
    const task={id:now+Math.floor(Math.random()*1000),text,status:'open',type:normalizeType(payload.type),priority:normalizePriority(payload.priority),optional:Boolean(payload.optional),dueMode:'none',dueDate:null,todayDate:null,todayOrder:null,planDurationMs:null,startedAt:null,pausedAt:null,completedAt:null,abortedAt:null,pauseTotalMs:0,activeDurationMs:null,actualDurationMs:null,leisureDurationMs:null,passiveDurationMs:null,cookingActiveDurationMs:null,cookingPassiveDurationMs:null,cookingMode:'active',activeSegments:[],cookingSegments:[],category:payload.category==null?null:String(payload.category).trim()||null,createdAt:new Date(now).toISOString(),remoteCommandV438:true};
    tasks.push(task);
    if(typeof saveTasks==='function') saveTasks(); else safeStorageSet('masterOfDisasterTasks',JSON.stringify(tasks));
    if(typeof render==='function') render();
    return task;
  }

  function resolveTask(payload,allowedStatuses){
    payload=payload&&typeof payload==='object'?payload:{};
    const allowed=new Set(allowedStatuses||[]);
    let matches=(Array.isArray(tasks)?tasks:[]).filter(t=>t&&(!allowed.size||allowed.has(t.status)));
    if(payload.local_task_id!=null) matches=matches.filter(t=>String(t.id)===String(payload.local_task_id));
    else if(payload.text) matches=matches.filter(t=>norm(t.text)===norm(payload.text));
    else throw new Error('Aufgabe nicht angegeben.');
    if(matches.length===0) throw new Error('Passende lokale Aufgabe nicht gefunden.');
    if(matches.length>1) throw new Error('Aufgabe ist nicht eindeutig. Bitte local_task_id verwenden.');
    return matches[0];
  }

  function runTaskCommand(command,payload){
    let task;
    if(command==='START_TASK'){
      task=resolveTask(payload,['open']); if(typeof startTask!=='function') throw new Error('startTask fehlt.'); startTask(task.id);
      if(task.status!=='running'&&task.type!=='selfrunner') throw new Error('Aufgabe konnte nicht gestartet werden.');
    } else if(command==='PAUSE_TASK'){
      task=resolveTask(payload,['running']); if(typeof pauseTask!=='function') throw new Error('pauseTask fehlt.'); pauseTask(task.id);
      if(task.status!=='paused') throw new Error('Aufgabe konnte nicht pausiert werden.');
    } else if(command==='RESUME_TASK'){
      task=resolveTask(payload,['paused']); if(typeof resumeTask!=='function') throw new Error('resumeTask fehlt.'); resumeTask(task.id);
      if(task.status!=='running') throw new Error('Aufgabe konnte nicht fortgesetzt werden.');
    } else if(command==='COMPLETE_TASK'){
      task=resolveTask(payload,['running','paused']); if(typeof finishTask!=='function') throw new Error('finishTask fehlt.'); finishTask(task.id);
      if(task.status!=='completed') throw new Error('Aufgabe konnte nicht abgeschlossen werden.');
    } else throw new Error('Unbekannter Aufgabenbefehl.');
    return task;
  }

  function saveWeightAndRender(){
    if(typeof saveWeight==='function') saveWeight();
    if(typeof renderWeightPanel==='function') renderWeightPanel();
    if(typeof render==='function') render();
  }

  function runWeightCommand(command,payload){
    payload=payload&&typeof payload==='object'?payload:{};
    if(command==='START_WEIGHT'){
      const kg=Number(String(payload.weight_kg!=null?payload.weight_kg:'').replace(',','.'));
      const requestedAt=isoOrNull(payload.at);
      if(!Number.isFinite(kg)||kg<=0) throw new Error('START_WEIGHT: gültiges weight_kg fehlt.');
      if(payload.at&&!requestedAt) throw new Error('START_WEIGHT: ungültiger Zeitpunkt.');
      if(weightState&&weightState.isWearing) throw new Error('Zusatzgewicht ist bereits angelegt.');
      weightState.currentWeightKg=kg;
      if(typeof startWeightPhase!=='function') throw new Error('startWeightPhase fehlt.');
      startWeightPhase();
      if(!weightState.isWearing) throw new Error('Zusatzgewicht konnte nicht gestartet werden.');
      if(requestedAt){weightState.currentPhaseStartedAt=requestedAt; saveWeightAndRender();}
      return {weight_kg:kg,started_at:weightState.currentPhaseStartedAt};
    }
    if(command==='ADJUST_WEIGHT_START'){
      const requestedAt=isoOrNull(payload.at);
      if(!requestedAt) throw new Error('ADJUST_WEIGHT_START: gültiger Zeitpunkt fehlt.');
      if(!weightState||!weightState.isWearing) throw new Error('Kein Zusatzgewicht aktiv.');
      weightState.currentPhaseStartedAt=requestedAt;
      saveWeightAndRender();
      return {weight_kg:Number(weightState.currentPhaseWeightKg||weightState.currentWeightKg)||null,started_at:weightState.currentPhaseStartedAt};
    }
    if(command==='STOP_WEIGHT'){
      if(!weightState||!weightState.isWearing) throw new Error('Kein Zusatzgewicht aktiv.');
      const kg=Number(weightState.currentPhaseWeightKg||weightState.currentWeightKg)||null;
      const startedAt=weightState.currentPhaseStartedAt;
      if(typeof stopWeightPhase!=='function') throw new Error('stopWeightPhase fehlt.');
      stopWeightPhase();
      if(weightState.isWearing) throw new Error('Zusatzgewicht konnte nicht beendet werden.');
      return {weight_kg:kg,started_at:startedAt,ended_at:new Date().toISOString()};
    }
    throw new Error('Unbekannter Gewichtsbefehl.');
  }

  async function mark(client,id,status,extra){const patch={status,processed_at:new Date().toISOString(),...(extra||{})};const {error}=await client.from('remote_commands').update(patch).eq('id',id);if(error) throw error;}

  async function processOne(client,row){
    try{
      let result={};
      if(row.command==='ADD_TASK'){const task=createLocalTask(row.payload);result={local_task_id:task.id,text:task.text,status:task.status};}
      else if(['START_TASK','PAUSE_TASK','RESUME_TASK','COMPLETE_TASK'].includes(row.command)){const task=runTaskCommand(row.command,row.payload);result={local_task_id:task.id,text:task.text,status:task.status,started_at:task.startedAt||null,paused_at:task.pausedAt||null,completed_at:task.completedAt||null};}
      else if(['START_WEIGHT','STOP_WEIGHT','ADJUST_WEIGHT_START'].includes(row.command)){result=runWeightCommand(row.command,row.payload||{});}
      else throw new Error('V438: nicht unterstützter Befehl '+row.command+'.');
      await mark(client,row.id,'done',{result,error:null});
      try{if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('remote-command-'+row.command.toLowerCase());}catch(_){}
      return true;
    }catch(error){const message=error&&error.message?error.message:String(error||'Unbekannter Fehler');try{await mark(client,row.id,'error',{error:message});}catch(markError){console.warn('V438 command mark error:',markError);}console.warn('V438 remote command:',error);return false;}
  }

  async function poll(){if(busy||!navigator.onLine)return;busy=true;try{const s=await getSession();if(!s)return;const {data,error}=await s.client.from('remote_commands').select('id,command,payload,created_at').eq('user_id',s.userId).eq('status','pending').order('created_at',{ascending:true}).limit(10);if(error)throw error;for(const row of(data||[]))await processOne(s.client,row);}catch(error){console.warn('V438 remote command poll:',error);}finally{busy=false;}}
  function start(){if(timer)clearInterval(timer);poll();timer=setInterval(poll,POLL_MS);}
  window.addEventListener('online',()=>setTimeout(poll,250));
  window.addEventListener('focus',()=>setTimeout(poll,200));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(poll,200);});
  window.addEventListener('load',()=>setTimeout(start,700));
  window.__modRemoteCommandsV438={poll,pollMs:POLL_MS};
})();
