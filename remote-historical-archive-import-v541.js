/* V541 · SAFE HISTORICAL ARCHIVE IMPORT
   Imports explicitly documented historical work blocks directly into the local archive.
   Supabase remains command mailbox + mirror; localStorage stays master.
*/
(function(){
  'use strict';
  const VERSION='V541';
  const COMMAND='IMPORT_HISTORICAL_ARCHIVE_TASK';
  const QUEUE_STATUS='processing';
  const POLL_MS=1400;
  let busy=false,timer=null;

  const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
  const iso=v=>{
    const d=new Date(v);
    if(!v||Number.isNaN(d.getTime()))throw new Error('Ungültiger ISO-Zeitpunkt.');
    return d.toISOString();
  };
  const clone=v=>JSON.parse(JSON.stringify(v));

  async function getSession(){
    const client=typeof getSupabaseClient==='function'?getSupabaseClient():null;
    if(!client)return null;
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    const user=data?.session?.user;
    return user?.id?{client,userId:user.id}:null;
  }

  function berlinDateKey(value){
    if(typeof getBerlinDateKeyFromISO==='function')return getBerlinDateKeyFromISO(value);
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return null;
    return new Intl.DateTimeFormat('en-CA',{
      timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'
    }).format(d);
  }

  function normalizeSegments(list){
    if(!Array.isArray(list)||!list.length)throw new Error('Zeitsegmente fehlen.');
    const rows=list.map((row,index)=>{
      const startedAt=iso(row?.startedAt),endedAt=iso(row?.endedAt);
      const start=new Date(startedAt).getTime(),end=new Date(endedAt).getTime();
      if(end<=start)throw new Error('Segment '+(index+1)+': Ende muss nach Start liegen.');
      return {startedAt,endedAt};
    }).sort((a,b)=>new Date(a.startedAt)-new Date(b.startedAt));
    for(let i=0;i<rows.length-1;i++){
      if(new Date(rows[i].endedAt)>new Date(rows[i+1].startedAt)){
        throw new Error('Zeitsegmente überlappen sich.');
      }
    }
    return rows;
  }

  function totalMs(rows){
    return rows.reduce((sum,row)=>sum+(new Date(row.endedAt)-new Date(row.startedAt)),0);
  }

  function findExisting(importKey){
    if(!Array.isArray(archive))return null;
    return archive.find(row=>row&&String(row.historicalImportKey||'')===String(importKey))||null;
  }

  function importHistorical(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    if(!Array.isArray(archive))throw new Error('Lokales Archiv ist nicht verfügbar.');
    const importKey=clean(payload.import_key);
    const text=clean(payload.text);
    const category=clean(payload.category)||null;
    if(!importKey)throw new Error('import_key fehlt.');
    if(!text)throw new Error('Aufgabentitel fehlt.');

    const existing=findExisting(importKey);
    if(existing){
      return {
        already_imported:true,
        import_key:importKey,
        archive_number:existing.archiveNumber??null,
        text:existing.text??text
      };
    }

    const segments=normalizeSegments(payload.segments);
    const duration=totalMs(segments);
    if(duration<=0)throw new Error('Historische Aktivzeit ist 0.');

    const startedAt=segments[0].startedAt;
    const completedAt=payload.completed_at?iso(payload.completed_at):segments[segments.length-1].endedAt;
    if(new Date(completedAt)<new Date(segments[segments.length-1].endedAt)){
      throw new Error('completed_at liegt vor dem letzten Zeitsegment.');
    }

    const n=Number(nextArchiveNumber);
    if(!Number.isInteger(n)||n<=0)throw new Error('nextArchiveNumber ist ungültig.');

    const noteMarker='Historischer App-Werkstatt-Import '+importKey;
    const sourceNotes=Array.isArray(payload.source_notes)
      ? payload.source_notes.map(clean).filter(Boolean)
      : [];
    if(!sourceNotes.includes(noteMarker))sourceNotes.push(noteMarker);

    const row={
      archiveNumber:n,
      archiveId:'A-'+n+'-hist-'+Date.now(),
      isTestArchive:false,
      sourceTaskId:null,
      text,
      type:'work',
      status:'completed',
      priority:clean(payload.priority)||'normal',
      optional:false,
      dueMode:'none',
      dueDate:null,
      startedAt,
      pauseTotalMs:0,
      completedAt,
      abortedAt:null,
      activeDurationMs:duration,
      archiveAccountingActiveDurationMs:duration,
      leisureDurationMs:null,
      actualDurationMs:duration,
      passiveDurationMs:null,
      cookingActiveDurationMs:null,
      cookingPassiveDurationMs:null,
      cookingSegments:[],
      cookingMode:'active',
      activeSegments:segments,
      importedHistoricalProgressDurationMs:0,
      historicalAlreadyArchivedDurationMs:0,
      historicalAccountingByDate:{},
      historicalAccountingSegments:[],
      historicalUnallocatedAccountingMs:0,
      sourceMasterVersion:null,
      sourceMasterDynamicNumber:null,
      sourceNotes,
      sourceNote:clean(payload.source_note)||noteMarker,
      category,
      completedDate:berlinDateKey(completedAt),
      archivedAt:new Date().toISOString(),
      historicalImportKey:importKey,
      historicalImportVersion:VERSION
    };

    archive.push(row);
    nextArchiveNumber=n+1;

    if(typeof saveArchive==='function')saveArchive();
    else{
      safeStorageSet('masterOfDisasterArchive',JSON.stringify(archive));
      safeStorageSet('masterOfDisasterNextArchiveNumber',String(nextArchiveNumber));
      try{if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('historical-app-workshop-import');}catch(_){}
    }
    if(typeof render==='function')render();
    try{window.__modLiveLogV453?.append?.('ARCHIVE','OK','Historische Aufgabe importiert: „'+text+'“ · '+segments.length+' Segmente');}catch(_){}

    return {
      already_imported:false,
      import_key:importKey,
      archive_number:n,
      text,
      category,
      started_at:startedAt,
      completed_at:completedAt,
      active_duration_ms:duration,
      segments:clone(segments)
    };
  }

  async function mark(client,id,status,extra={}){
    const {error}=await client.from('remote_commands').update({
      status,
      processed_at:new Date().toISOString(),
      ...extra
    }).eq('id',id);
    if(error)throw error;
  }

  async function processOne(client,row){
    try{
      if(row.command!==COMMAND)return false;
      const result=importHistorical(row.payload||{});
      await mark(client,row.id,'done',{result,error:null});
      return true;
    }catch(error){
      const message=error?.message||String(error);
      try{await mark(client,row.id,'error',{error:message});}catch(_){}
      console.warn('V541 historical archive import:',error);
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
        .eq('command',COMMAND)
        .order('created_at',{ascending:true})
        .limit(10);
      if(error)throw error;
      for(const row of(data||[]))await processOne(s.client,row);
    }catch(error){
      console.warn('V541 historical archive import poll:',error);
    }finally{
      busy=false;
    }
  }

  function start(){
    if(timer)clearInterval(timer);
    poll();
    timer=setInterval(poll,POLL_MS);
  }

  window.addEventListener('online',()=>setTimeout(poll,120));
  window.addEventListener('focus',()=>setTimeout(poll,100));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(poll,100);});
  window.addEventListener('load',()=>setTimeout(start,700));
  setTimeout(start,1000);

  window.__modHistoricalArchiveImportV541={
    version:VERSION,
    command:COMMAND,
    queueStatus:QUEUE_STATUS,
    pollMs:POLL_MS,
    importHistorical,
    poll
  };
})();