/* V472 · ARCHIVE DELETE QUEUE FIX
   Uses the already permitted remote_commands status=processing as a dedicated
   maintenance queue. V450 only polls pending, so destructive archive work stays isolated.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V472';
  const QUEUE_STATUS='processing';
  const POLL_MS=2000;
  let busy=false,timer=null;

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
  function deleteArchiveEntry(archiveNumber){
    const n=Number(archiveNumber);
    if(!Number.isInteger(n)||n<=0)throw new Error('DELETE_ARCHIVE_ENTRY: gültige archive_number fehlt.');
    if(!Array.isArray(archive))throw new Error('Lokales Archiv ist nicht verfügbar.');
    const matches=[];
    archive.forEach((row,index)=>{if(realArchiveNumber(row)===n)matches.push({row,index});});
    if(matches.length===0)throw new Error(`A${n} wurde im lokalen Archiv nicht gefunden.`);
    if(matches.length!==1)throw new Error(`A${n} ist nicht eindeutig (${matches.length} Treffer).`);

    const beforeHighest=archive.reduce((m,row)=>Math.max(m,realArchiveNumber(row)||0),0);
    const {row,index}=matches[0];
    const deleted={archiveNumber:n,archiveId:row.archiveId??null,text:String(row.text||''),type:row.type??null,status:row.status??null};
    archive.splice(index,1);
    const afterHighest=archive.reduce((m,item)=>Math.max(m,realArchiveNumber(item)||0),0);
    nextArchiveNumber=afterHighest+1;
    if(typeof saveArchive==='function')saveArchive();
    else {
      safeStorageSet('masterOfDisasterArchive',JSON.stringify(archive));
      safeStorageSet('masterOfDisasterNextArchiveNumber',String(nextArchiveNumber));
      if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('archive');
    }
    if(typeof render==='function')render();
    try{window.__modLiveLogV453?.append?.('ARCHIVE','WARN',`Archiv A${n} gezielt gelöscht: „${deleted.text}“`);}catch(_){}
    return {deleted,highest_before:beforeHighest,highest_after:afterHighest,next_archive_number:nextArchiveNumber};
  }
  async function mark(client,id,status,extra={}){
    const {error}=await client.from('remote_commands').update({status,processed_at:new Date().toISOString(),...extra}).eq('id',id);
    if(error)throw error;
  }
  async function processOne(client,row){
    try{
      if(row.command!=='DELETE_ARCHIVE_ENTRY')return false;
      const result=deleteArchiveEntry(row.payload?.archive_number);
      await mark(client,row.id,'done',{result,error:null});
      return true;
    }catch(error){
      const message=error?.message||String(error);
      try{await mark(client,row.id,'error',{error:message});}catch(_){}
      console.warn('V472 remote archive maintenance:',error);
      return false;
    }
  }
  async function poll(){
    if(busy||!navigator.onLine)return;
    busy=true;
    try{
      const s=await getSession();if(!s)return;
      const {data,error}=await s.client.from('remote_commands').select('id,command,payload,created_at').eq('user_id',s.userId).eq('status',QUEUE_STATUS).eq('command','DELETE_ARCHIVE_ENTRY').order('created_at',{ascending:true}).limit(5);
      if(error)throw error;
      for(const row of (data||[]))await processOne(s.client,row);
    }catch(error){console.warn('V472 archive maintenance poll:',error);}finally{busy=false;}
  }
  function start(){if(timer)clearInterval(timer);poll();timer=setInterval(poll,POLL_MS);}
  window.addEventListener('online',()=>setTimeout(poll,150));
  window.addEventListener('focus',()=>setTimeout(poll,120));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(poll,120);});
  window.addEventListener('load',()=>setTimeout(start,900));
  setTimeout(start,1200);
  window.__modRemoteArchiveMaintenanceV472={version:BUILD_VERSION,poll,pollMs:POLL_MS,queueStatus:QUEUE_STATUS,command:'DELETE_ARCHIVE_ENTRY',deleteArchiveEntry};
})();
