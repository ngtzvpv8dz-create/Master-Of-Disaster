/* V542 · SAFE HISTORICAL ARCHIVE METADATA EDIT
   Edits only explicitly imported historical archive rows identified by historicalImportKey.
*/
(function(){
  'use strict';
  const VERSION='V542';
  const COMMAND='EDIT_HISTORICAL_ARCHIVE_METADATA';
  const QUEUE_STATUS='processing';
  const POLL_MS=1400;
  let busy=false,timer=null;

  const clean=v=>String(v??'').trim().replace(/\s+/g,' ');

  async function getSession(){
    const client=typeof getSupabaseClient==='function'?getSupabaseClient():null;
    if(!client)return null;
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    const user=data?.session?.user;
    return user?.id?{client,userId:user.id}:null;
  }

  function editHistoricalArchiveMetadata(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    if(!Array.isArray(archive))throw new Error('Lokales Archiv ist nicht verfügbar.');

    const keys=Array.isArray(payload.import_keys)
      ? payload.import_keys.map(clean).filter(Boolean)
      : [];
    if(!keys.length)throw new Error('import_keys fehlen.');

    const wanted=new Set(keys);
    const rows=archive.filter(row=>row&&wanted.has(clean(row.historicalImportKey)));
    if(rows.length!==wanted.size){
      const found=new Set(rows.map(row=>clean(row.historicalImportKey)));
      const missing=keys.filter(k=>!found.has(k));
      throw new Error('Nicht alle historischen App-Werkstatt-Einträge gefunden: '+missing.join(', '));
    }

    const category=payload.category===undefined?undefined:clean(payload.category);
    const renames=payload.renames&&typeof payload.renames==='object'?payload.renames:{};
    const changed=[];

    for(const row of rows){
      const key=clean(row.historicalImportKey);
      const before={text:row.text??null,category:row.category??null};
      if(category!==undefined)row.category=category||null;
      if(Object.prototype.hasOwnProperty.call(renames,key)){
        const next=clean(renames[key]);
        if(!next)throw new Error('Leerer neuer Titel für '+key);
        row.text=next;
      }
      changed.push({import_key:key,before,after:{text:row.text??null,category:row.category??null}});
    }

    if(typeof saveArchive==='function')saveArchive();
    else{
      safeStorageSet('masterOfDisasterArchive',JSON.stringify(archive));
      safeStorageSet('masterOfDisasterNextArchiveNumber',String(nextArchiveNumber));
      try{if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('historical-app-workshop-metadata-edit');}catch(_){}
    }
    if(typeof render==='function')render();
    try{window.__modLiveLogV453?.append?.('ARCHIVE','OK','App-Werkstatt-Metadaten aktualisiert · '+changed.length+' Einträge');}catch(_){}

    return {version:VERSION,changed};
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
      const result=editHistoricalArchiveMetadata(row.payload||{});
      await mark(client,row.id,'done',{result,error:null});
      return true;
    }catch(error){
      const message=error?.message||String(error);
      try{await mark(client,row.id,'error',{error:message});}catch(_){}
      console.warn('V542 historical archive metadata edit:',error);
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
      console.warn('V542 historical archive metadata edit poll:',error);
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

  window.__modHistoricalArchiveMetadataEditV542={
    version:VERSION,
    command:COMMAND,
    queueStatus:QUEUE_STATUS,
    pollMs:POLL_MS,
    editHistoricalArchiveMetadata,
    poll
  };
})();