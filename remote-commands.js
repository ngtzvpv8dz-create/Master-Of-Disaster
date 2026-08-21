/* V435 · REMOTE COMMAND BRIDGE
   Supabase ist nur Befehls-Briefkasten. localStorage bleibt Master.
   V435 unterstützt absichtlich ausschließlich ADD_TASK.
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

  function normalizeType(v){ return ['work','leisure','selfrunner','cooking'].includes(v)?v:'work'; }
  function normalizePriority(v){ return ['normal','medium','high'].includes(v)?v:'normal'; }

  function createLocalTask(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    const text=String(payload.text||'').trim();
    if(!text) throw new Error('ADD_TASK: Aufgabentitel fehlt.');
    if(!Array.isArray(tasks)) throw new Error('ADD_TASK: Lokale Aufgabenliste fehlt.');

    const now=Date.now();
    const task={
      id: now + Math.floor(Math.random()*1000),
      text,
      status:'open',
      type:normalizeType(payload.type),
      priority:normalizePriority(payload.priority),
      optional:Boolean(payload.optional),
      dueMode:'none',
      dueDate:null,
      todayDate:null,
      todayOrder:null,
      planDurationMs:null,
      startedAt:null,
      pausedAt:null,
      completedAt:null,
      abortedAt:null,
      pauseTotalMs:0,
      activeDurationMs:null,
      actualDurationMs:null,
      leisureDurationMs:null,
      passiveDurationMs:null,
      cookingActiveDurationMs:null,
      cookingPassiveDurationMs:null,
      cookingMode:'active',
      activeSegments:[],
      cookingSegments:[],
      category:payload.category==null?null:String(payload.category).trim()||null,
      createdAt:new Date(now).toISOString(),
      remoteCommandV435:true
    };

    tasks.push(task);
    if(typeof save==='function') save();
    else safeStorageSet('masterOfDisasterTasks',JSON.stringify(tasks));
    if(typeof render==='function') render();
    return task;
  }

  async function mark(client,id,status,extra){
    const patch={status,processed_at:new Date().toISOString(),...(extra||{})};
    const {error}=await client.from('remote_commands').update(patch).eq('id',id);
    if(error) throw error;
  }

  async function processOne(client,row){
    try{
      if(row.command!=='ADD_TASK') throw new Error('V435 unterstützt nur ADD_TASK.');
      const task=createLocalTask(row.payload);
      await mark(client,row.id,'done',{result:{local_task_id:task.id,text:task.text}});
      try{ if(typeof scheduleSupabaseLiveSync==='function') scheduleSupabaseLiveSync('remote-command-add-task'); }catch(_){}
      return true;
    }catch(error){
      const message=error&&error.message?error.message:String(error||'Unbekannter Fehler');
      try{await mark(client,row.id,'error',{error:message});}catch(markError){console.warn('V435 command mark error:',markError);}
      console.warn('V435 remote command:',error);
      return false;
    }
  }

  async function poll(){
    if(busy||!navigator.onLine) return;
    busy=true;
    try{
      const s=await getSession();
      if(!s) return;
      const {data,error}=await s.client.from('remote_commands')
        .select('id,command,payload,created_at')
        .eq('user_id',s.userId)
        .eq('status','pending')
        .order('created_at',{ascending:true})
        .limit(10);
      if(error) throw error;
      for(const row of (data||[])) await processOne(s.client,row);
    }catch(error){
      console.warn('V435 remote command poll:',error);
    }finally{ busy=false; }
  }

  function start(){
    if(timer) clearInterval(timer);
    poll();
    timer=setInterval(poll,POLL_MS);
  }

  window.addEventListener('online',()=>setTimeout(poll,250));
  window.addEventListener('focus',()=>setTimeout(poll,200));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(poll,200);});
  window.addEventListener('load',()=>setTimeout(start,700));
  window.__modRemoteCommandsV435={poll,pollMs:POLL_MS};
})();
