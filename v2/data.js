(() => {
'use strict';

const SUPABASE_URL='https://oktpzwhhndsbikkeelot.supabase.co';
const SUPABASE_KEY='sb_publishable_EaxtFXKAGOLyI6HRWPU6DQ_f04wfWru';
const TASK_KEY='masterOfDisasterTasks';
const ARCHIVE_KEY='masterOfDisasterArchive';

let client=null;
let session=null;

function readJson(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    if(!raw)return fallback;
    const parsed=JSON.parse(raw);
    return parsed??fallback;
  }catch(_){ return fallback; }
}

function writeJson(key,value){
  try{
    localStorage.setItem(key,JSON.stringify(value));
    return true;
  }catch(_){ return false; }
}

function legacyTasks(){
  const rows=readJson(TASK_KEY,[]);
  return Array.isArray(rows)?rows:[];
}

function legacyArchive(){
  const rows=readJson(ARCHIVE_KEY,[]);
  return Array.isArray(rows)?rows:[];
}

function cleanNumber(v,fallback=null){
  const n=Number(v);
  return Number.isFinite(n)?n:fallback;
}

function toView(local,cloud=null){
  const row=cloud||{};
  return {
    id:row.id||('legacy-'+String(local.id)),
    legacy_task_id:cleanNumber(local.id,row.legacy_task_id??null),
    text:String(local.text??row.text??''),
    status:String(local.status??row.status??'open'),
    type:String(local.type??row.type??'work'),
    priority:String(local.priority??row.priority??'normal'),
    optional:Boolean(local.optional??row.optional??false),
    due_mode:String(local.dueMode??row.due_mode??'none'),
    due_date:local.dueDate??row.due_date??null,
    today_date:local.todayDate??row.today_date??null,
    today_order:local.todayOrder??row.today_order??null,
    plan_duration_ms:local.planDurationMs??row.plan_duration_ms??null,
    started_at:local.startedAt??row.started_at??null,
    paused_at:local.pausedAt??row.paused_at??null,
    completed_at:local.completedAt??row.completed_at??null,
    aborted_at:local.abortedAt??row.aborted_at??null,
    pause_total_ms:cleanNumber(local.pauseTotalMs,row.pause_total_ms??0)??0,
    active_duration_ms:local.activeDurationMs??row.active_duration_ms??null,
    actual_duration_ms:local.actualDurationMs??row.actual_duration_ms??null,
    leisure_duration_ms:local.leisureDurationMs??row.leisure_duration_ms??null,
    passive_duration_ms:local.passiveDurationMs??row.passive_duration_ms??null,
    cooking_active_duration_ms:local.cookingActiveDurationMs??row.cooking_active_duration_ms??null,
    cooking_passive_duration_ms:local.cookingPassiveDurationMs??row.cooking_passive_duration_ms??null,
    cooking_mode:local.cookingMode??row.cooking_mode??'active',
    notes:local.notes??row.notes??null,
    _legacy:local
  };
}

function archiveView(local){
  return {
    id:null,
    archive_number:local.archiveNumber??null,
    text:String(local.text??''),
    status:String(local.status??'completed'),
    type:String(local.type??'work'),
    priority:String(local.priority??'normal'),
    optional:Boolean(local.optional),
    due_mode:String(local.dueMode??'none'),
    due_date:local.dueDate??null,
    completed_date:local.completedDate??null,
    category:local.category??null,
    archived_at:local.archivedAt??null
  };
}

function cloudRow(local,userId){
  return {
    user_id:userId,
    legacy_task_id:cleanNumber(local.id,null),
    source_master_version:local.sourceMasterVersion??null,
    source_master_dynamic_number:cleanNumber(local.sourceMasterDynamicNumber,null),
    text:String(local.text||''),
    status:String(local.status||'open'),
    type:String(local.type||'work'),
    priority:String(local.priority||'normal'),
    optional:Boolean(local.optional),
    due_mode:String(local.dueMode||'none'),
    due_date:local.dueDate??null,
    today_date:local.todayDate??null,
    today_order:cleanNumber(local.todayOrder,null),
    plan_duration_ms:cleanNumber(local.planDurationMs,null),
    started_at:local.startedAt??null,
    paused_at:local.pausedAt??null,
    completed_at:local.completedAt??null,
    aborted_at:local.abortedAt??null,
    pause_total_ms:Math.max(0,cleanNumber(local.pauseTotalMs,0)||0),
    active_duration_ms:cleanNumber(local.activeDurationMs,null),
    actual_duration_ms:cleanNumber(local.actualDurationMs,null),
    leisure_duration_ms:cleanNumber(local.leisureDurationMs,null),
    passive_duration_ms:cleanNumber(local.passiveDurationMs,null),
    cooking_active_duration_ms:cleanNumber(local.cookingActiveDurationMs,null),
    cooking_passive_duration_ms:cleanNumber(local.cookingPassiveDurationMs,null),
    cooking_mode:local.cookingMode??'active',
    aborted_active_duration_ms:cleanNumber(local.abortedActiveDurationMs,null),
    imported_historical_progress_duration_ms:Math.max(0,cleanNumber(local.importedHistoricalProgressDurationMs,0)||0),
    historical_already_archived_duration_ms:Math.max(0,cleanNumber(local.historicalAlreadyArchivedDurationMs,0)||0),
    historical_unallocated_accounting_ms:Math.max(0,cleanNumber(local.historicalUnallocatedAccountingMs,0)||0),
    historical_accounting_by_date:(local.historicalAccountingByDate&&typeof local.historicalAccountingByDate==='object')?local.historicalAccountingByDate:{},
    historical_accounting_segments:Array.isArray(local.historicalAccountingSegments)?local.historicalAccountingSegments:[],
    historical_time_parts:Array.isArray(local.historicalTimeParts)?local.historicalTimeParts:[],
    weight_info:local.weightInfo??null,
    source_notes:Array.isArray(local.sourceNotes)?local.sourceNotes:[],
    notes:local.notes??null
  };
}

function durationMs(segment){
  if(!segment||!segment.startedAt||!segment.endedAt)return null;
  const a=new Date(segment.startedAt).getTime(),b=new Date(segment.endedAt).getTime();
  return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,b-a):null;
}

async function ensureClient(){
  if(!window.supabase)throw new Error('Supabase-Bibliothek noch nicht geladen.');
  if(!client){
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
  }
  const result=await client.auth.getSession();
  if(result.error)throw result.error;
  session=result.data&&result.data.session?result.data.session:null;
  if(!session)throw new Error('Für 2.0 ist dein bestehender Supabase-Login nötig.');
  return client;
}

async function syncSegments(local,cloudId){
  if(!cloudId)return;
  let result=await client.from('task_active_segments').delete().eq('task_id',cloudId);
  if(result.error)throw result.error;
  result=await client.from('task_cooking_segments').delete().eq('task_id',cloudId);
  if(result.error)throw result.error;

  const active=(Array.isArray(local.activeSegments)?local.activeSegments:[])
    .filter(s=>s&&s.startedAt)
    .map(s=>({
      user_id:session.user.id,task_id:cloudId,started_at:s.startedAt,ended_at:s.endedAt??null,
      duration_ms:durationMs(s),weight_kg:s.weightKg??null,metadata:{}
    }));
  if(active.length){
    result=await client.from('task_active_segments').insert(active);
    if(result.error)throw result.error;
  }

  const cooking=(Array.isArray(local.cookingSegments)?local.cookingSegments:[])
    .filter(s=>s&&s.startedAt)
    .map(s=>({
      user_id:session.user.id,task_id:cloudId,mode:s.mode==='passive'?'passive':'active',
      started_at:s.startedAt,ended_at:s.endedAt??null,duration_ms:durationMs(s)
    }));
  if(cooking.length){
    result=await client.from('task_cooking_segments').insert(cooking);
    if(result.error)throw result.error;
  }
}

async function mirror(local,{segments=false}={}){
  await ensureClient();
  const row=cloudRow(local,session.user.id);
  if(!row.legacy_task_id)throw new Error('Lokale Aufgaben-ID fehlt.');
  const result=await client.from('tasks')
    .upsert([row],{onConflict:'user_id,legacy_task_id'})
    .select('id,legacy_task_id')
    .single();
  if(result.error)throw result.error;
  if(segments)await syncSegments(local,result.data.id);
  return result.data;
}

function findLegacy(id){
  const target=Number(id);
  return legacyTasks().find(row=>Number(row&&row.id)===target)||null;
}

async function loadTasks(){
  await ensureClient();
  const result=await client.from('tasks')
    .select('id,legacy_task_id,text,status,type,priority,optional,due_mode,due_date,today_date,today_order,plan_duration_ms,started_at,paused_at,completed_at,aborted_at,pause_total_ms,active_duration_ms,actual_duration_ms,leisure_duration_ms,passive_duration_ms,cooking_active_duration_ms,cooking_passive_duration_ms,cooking_mode,notes,created_at,updated_at')
    .order('today_order',{ascending:true})
    .order('created_at',{ascending:false});
  if(result.error)throw result.error;
  const cloudRows=result.data||[];
  const locals=legacyTasks();

  if(!locals.length){
    return {tasks:cloudRows.map(row=>({...row,_legacy:null})),sharedLocalMaster:false};
  }

  const byLegacy=new Map(cloudRows.filter(r=>r.legacy_task_id!=null).map(r=>[Number(r.legacy_task_id),r]));
  const merged=locals.map(local=>toView(local,byLegacy.get(Number(local.id))||null));
  const known=new Set(locals.map(x=>Number(x.id)));
  cloudRows.forEach(row=>{
    if(row.legacy_task_id==null||!known.has(Number(row.legacy_task_id)))merged.push({...row,_legacy:null});
  });
  return {tasks:merged,sharedLocalMaster:true};
}

async function loadArchive(){
  await ensureClient();
  const locals=legacyArchive();
  if(locals.length)return locals.map(archiveView);
  const result=await client.from('archive_entries')
    .select('id,archive_number,text,status,type,priority,optional,due_mode,due_date,completed_date,category,archived_at')
    .order('archive_number',{ascending:false});
  if(result.error)throw result.error;
  return result.data||[];
}

function baseLegacyTask(props){
  const now=Date.now()+Math.floor(Math.random()*1000);
  return {
    id:now,
    text:String(props.text||'').trim(),
    type:props.type||'work',
    status:'open',
    priority:props.priority||'normal',
    optional:Boolean(props.optional),
    dueMode:props.dueMode||'none',
    dueDate:props.dueDate??null,
    todayDate:null,
    todayOrder:null,
    planDurationMs:null,
    startedAt:null,
    pausedAt:null,
    pauseTotalMs:0,
    completedAt:null,
    activeDurationMs:null,
    abortedAt:null,
    abortedActiveDurationMs:null,
    leisureDurationMs:null,
    actualDurationMs:null,
    passiveDurationMs:null,
    cookingActiveDurationMs:null,
    cookingPassiveDurationMs:null,
    cookingSegments:[],
    cookingMode:'active',
    activeSegments:[],
    importedHistoricalProgressDurationMs:0,
    historicalAlreadyArchivedDurationMs:0,
    historicalUnallocatedAccountingMs:0,
    historicalAccountingByDate:{},
    historicalAccountingSegments:[],
    historicalTimeParts:[],
    sourceNotes:[]
  };
}

async function addTask(props){
  const rows=legacyTasks();
  if(!rows.length)throw new Error('Der gemeinsame 1.0-Datenbestand ist auf diesem Gerät nicht geladen. Bitte 1.0 einmal öffnen.');
  const local=baseLegacyTask(props);
  rows.push(local);
  if(!writeJson(TASK_KEY,rows))throw new Error('Lokale Aufgaben konnten nicht gespeichert werden.');
  let cloud=null;
  try{cloud=await mirror(local,{segments:true});}
  catch(error){console.warn('V2 cloud mirror pending',error);}
  return toView(local,cloud);
}

async function patchTask(legacyId,patch,{segments=false}={}){
  const rows=legacyTasks();
  const index=rows.findIndex(row=>Number(row&&row.id)===Number(legacyId));
  if(index<0)throw new Error('Aufgabe wurde im gemeinsamen Datenbestand nicht gefunden.');
  const local=rows[index];
  Object.assign(local,patch||{});
  rows[index]=local;
  if(!writeJson(TASK_KEY,rows))throw new Error('Lokale Aufgaben konnten nicht gespeichert werden.');
  let cloud=null;
  try{cloud=await mirror(local,{segments});}
  catch(error){console.warn('V2 cloud mirror pending',error);}
  return toView(local,cloud);
}

async function setToday(legacyId,selected){
  const rows=legacyTasks();
  const index=rows.findIndex(row=>Number(row&&row.id)===Number(legacyId));
  if(index<0)throw new Error('Aufgabe wurde im gemeinsamen Datenbestand nicht gefunden.');
  const local=rows[index];
  if(!selected){local.todayDate=null;local.todayOrder=null;}
  else{
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const highest=rows.filter(x=>x&&x.todayDate===day&&!['completed','aborted'].includes(x.status)).reduce((m,x)=>Math.max(m,Number(x.todayOrder)||0),0);
    local.todayDate=day;local.todayOrder=highest+1;
  }
  rows[index]=local;
  if(!writeJson(TASK_KEY,rows))throw new Error('Lokale Aufgaben konnten nicht gespeichert werden.');
  let cloud=null;
  try{cloud=await mirror(local);}
  catch(error){console.warn('V2 cloud mirror pending',error);}
  return toView(local,cloud);
}

async function runTask(legacyId){
  const rows=legacyTasks();
  const index=rows.findIndex(row=>Number(row&&row.id)===Number(legacyId));
  if(index<0)throw new Error('Aufgabe wurde im gemeinsamen Datenbestand nicht gefunden.');
  const task=rows[index];
  if(task.type==='selfrunner')throw new Error('Selbstläufer-Abschluss folgt mit der Abschlusslogik.');

  const now=new Date().toISOString();
  if(task.status==='running'){
    task.status='paused';
    task.pausedAt=now;
    const seg=Array.isArray(task.activeSegments)&&task.activeSegments.length?task.activeSegments[task.activeSegments.length-1]:null;
    if(seg&&!seg.endedAt)seg.endedAt=now;
    const cseg=Array.isArray(task.cookingSegments)&&task.cookingSegments.length?task.cookingSegments[task.cookingSegments.length-1]:null;
    if(task.type==='cooking'&&cseg&&!cseg.endedAt)cseg.endedAt=now;
  }else{
    const other=rows.find(x=>x&&x.status==='running'&&Number(x.id)!==Number(task.id));
    if(other)throw new Error('Es läuft bereits „'+other.text+'“.');
    if(task.status==='paused'&&task.pausedAt){
      const delta=Math.max(0,Date.now()-new Date(task.pausedAt).getTime());
      task.pauseTotalMs=(Number(task.pauseTotalMs)||0)+delta;
    }
    task.status='running';
    if(!task.startedAt)task.startedAt=now;
    task.pausedAt=null;
    if(!Array.isArray(task.activeSegments))task.activeSegments=[];
    task.activeSegments.push({startedAt:now,endedAt:null});
    if(task.type==='cooking'){
      if(!Array.isArray(task.cookingSegments))task.cookingSegments=[];
      task.cookingMode=task.cookingMode==='passive'?'passive':'active';
      task.cookingSegments.push({mode:task.cookingMode,startedAt:now,endedAt:null});
    }
  }
  rows[index]=task;
  if(!writeJson(TASK_KEY,rows))throw new Error('Lokale Aufgaben konnten nicht gespeichert werden.');
  let cloud=null;
  try{cloud=await mirror(task,{segments:true});}
  catch(error){console.warn('V2 cloud mirror pending',error);}
  return toView(task,cloud);
}


function sumSegments(segments,endIso){
  return (Array.isArray(segments)?segments:[]).reduce((sum,s)=>{
    if(!s||!s.startedAt)return sum;
    const end=s.endedAt||endIso;
    if(!end)return sum;
    const a=new Date(s.startedAt).getTime(),b=new Date(end).getTime();
    return sum+(Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,b-a):0);
  },0);
}

function cookingDurations(task,endIso){
  let active=0,passive=0;
  (Array.isArray(task.cookingSegments)?task.cookingSegments:[]).forEach(s=>{
    if(!s||!s.startedAt)return;
    const end=s.endedAt||endIso;if(!end)return;
    const a=new Date(s.startedAt).getTime(),b=new Date(end).getTime();
    const ms=Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,b-a):0;
    if(s.mode==='passive')passive+=ms;else active+=ms;
  });
  return {active,passive};
}

async function completeTask(legacyId){
  const rows=legacyTasks();
  const index=rows.findIndex(row=>Number(row&&row.id)===Number(legacyId));
  if(index<0)throw new Error('Aufgabe wurde im gemeinsamen Datenbestand nicht gefunden.');
  const task=rows[index];
  const now=new Date().toISOString();

  const last=Array.isArray(task.activeSegments)&&task.activeSegments.length?task.activeSegments[task.activeSegments.length-1]:null;
  if(last&&!last.endedAt)last.endedAt=now;
  const lastCooking=Array.isArray(task.cookingSegments)&&task.cookingSegments.length?task.cookingSegments[task.cookingSegments.length-1]:null;
  if(task.type==='cooking'&&lastCooking&&!lastCooking.endedAt)lastCooking.endedAt=now;

  const historical=Math.max(0,Number(task.importedHistoricalProgressDurationMs)||0);
  const total=historical+sumSegments(task.activeSegments,now);
  if(task.type!=='selfrunner'&&total<=0){
    throw new Error('Dauer fehlt. Starte die Aufgabe zuerst, bevor du sie erledigst.');
  }

  task.actualDurationMs=task.type==='selfrunner'?0:total;
  if(task.type==='leisure'){
    task.leisureDurationMs=total;
    task.activeDurationMs=0;
    task.passiveDurationMs=null;
    task.cookingActiveDurationMs=null;
    task.cookingPassiveDurationMs=null;
  }else if(task.type==='cooking'){
    const parts=cookingDurations(task,now);
    task.cookingActiveDurationMs=parts.active;
    task.cookingPassiveDurationMs=parts.passive;
    task.activeDurationMs=parts.active;
    task.passiveDurationMs=parts.passive;
    task.leisureDurationMs=null;
  }else{
    task.activeDurationMs=task.type==='selfrunner'?0:total;
    task.leisureDurationMs=null;
    task.passiveDurationMs=null;
    task.cookingActiveDurationMs=null;
    task.cookingPassiveDurationMs=null;
  }
  task.status='completed';
  task.completedAt=now;
  task.pausedAt=null;

  rows[index]=task;
  if(!writeJson(TASK_KEY,rows))throw new Error('Lokale Aufgaben konnten nicht gespeichert werden.');
  let cloud=null;
  try{cloud=await mirror(task,{segments:true});}
  catch(error){console.warn('V2 cloud mirror pending',error);}
  return toView(task,cloud);
}

window.MOD2Data={
  ensureClient,loadTasks,loadArchive,addTask,patchTask,setToday,runTask,completeTask,
  legacyTasks,legacyArchive,findLegacy,version:'2.0.6'
};
})();