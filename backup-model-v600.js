/* V600 · UNIFIED BACKUP MODEL
   - Supabase: LIVE + PREVIOUS für den lokalen Master-Stand.
   - 48-Stunden-Zeitmaschine + 48-Stunden-Log werden rollierend nach Supabase gespiegelt.
   - Direkte Supabase-Bereiche werden serverseitig per Delta-Audit für 48 Stunden abgesichert.
   - Wochen-Cloudbackups sind stillgelegt.
   - Vollbackup holt zusätzlich einen authentifizierten Supabase-Komplettexport.
*/
(function(){
  'use strict';
  if(window.__modBackupModelV600)return;

  const VERSION='V600';
  const RETENTION_MS=48*60*60*1000;
  const LAST_SYNC_KEY='masterOfDisasterSafetyCloudLastSyncV600';
  const PENDING_KEY='masterOfDisasterSafetyCloudPendingV600';
  const LAST_ERROR_KEY='masterOfDisasterSafetyCloudLastErrorV600';
  const POINT_TABLE='backup_recovery_points';
  const LOG_TABLE='backup_log_entries';
  let syncing=false;
  let timer=null;
  let installTries=0;

  const nowIso=()=>new Date().toISOString();
  const safeGet=key=>{try{return localStorage.getItem(key);}catch(_){return null;}};
  const safeSet=(key,value)=>{try{localStorage.setItem(key,String(value));}catch(_){}};
  const safeRemove=key=>{try{localStorage.removeItem(key);}catch(_){}};

  async function context(){
    const client=typeof getSupabaseClient==='function'?getSupabaseClient():null;
    if(!client)throw new Error('Kein Supabase-Client verfügbar.');
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    const user=data?.session?.user;
    if(!user?.id)throw new Error('Supabase-Login fehlt.');
    return {client,userId:user.id};
  }

  function chunk(rows,size=180){
    const out=[];
    for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));
    return out;
  }

  function cutoffIso(){return new Date(Date.now()-RETENTION_MS).toISOString();}

  function candidateFrom(){
    const cutoff=Date.now()-RETENTION_MS;
    const last=Date.parse(safeGet(LAST_SYNC_KEY)||'');
    if(!Number.isFinite(last))return cutoff;
    return Math.max(cutoff,last-2*60*1000);
  }

  function markSafetyPending(reason='local-change'){
    safeSet(PENDING_KEY,'1');
    safeSet('masterOfDisasterSafetyCloudPendingReasonV600',reason);
    scheduleSafetySync(2500);
  }

  function scheduleSafetySync(delay=2500){
    if(timer)clearTimeout(timer);
    timer=setTimeout(()=>{timer=null;syncSafetyNow({force:false}).catch(()=>{});},delay);
  }

  async function upsertRows(client,table,rows,onConflict){
    for(const part of chunk(rows)){
      const result=await client.from(table).upsert(part,{onConflict});
      if(result.error)throw result.error;
    }
  }

  async function syncSafetyNow({force=false}={}){
    if(syncing)return false;
    if(!navigator.onLine){safeSet(PENDING_KEY,'1');return false;}
    const api=window.__modRecoveryHistoryV498;
    if(!api?.exportPackage)return false;

    syncing=true;
    try{
      const {client,userId}=await context();
      const pkg=await api.exportPackage();
      const from=force?Date.now()-RETENTION_MS:candidateFrom();
      const cutoff=cutoffIso();
      const syncedAt=nowIso();

      const points=(Array.isArray(pkg?.points)?pkg.points:[])
        .filter(row=>row?.id&&Number.isFinite(Date.parse(row.at))&&Date.parse(row.at)>=from)
        .map(row=>({
          user_id:userId,
          point_id:String(row.id),
          occurred_at:row.at,
          payload:row,
          synced_at:syncedAt
        }));

      const logs=(Array.isArray(pkg?.logs)?pkg.logs:[])
        .filter(row=>row?.id&&Number.isFinite(Date.parse(row.at))&&Date.parse(row.at)>=from)
        .map(row=>({
          user_id:userId,
          log_id:String(row.id),
          occurred_at:row.at,
          payload:row,
          synced_at:syncedAt
        }));

      if(points.length)await upsertRows(client,POINT_TABLE,points,'user_id,point_id');
      if(logs.length)await upsertRows(client,LOG_TABLE,logs,'user_id,log_id');

      let result=await client.from(POINT_TABLE).delete().eq('user_id',userId).lt('occurred_at',cutoff);
      if(result.error)throw result.error;
      result=await client.from(LOG_TABLE).delete().eq('user_id',userId).lt('occurred_at',cutoff);
      if(result.error)throw result.error;
      result=await client.from('backup_db_changes').delete().eq('user_id',userId).lt('occurred_at',cutoff);
      if(result.error)throw result.error;

      safeSet(LAST_SYNC_KEY,syncedAt);
      safeSet(PENDING_KEY,'0');
      safeRemove(LAST_ERROR_KEY);
      try{
        window.__modLiveLogV453?.append?.('SYSTEM','PASS',`48-Stunden-Sicherheitsnetz → Supabase · ${points.length} Punkte · ${logs.length} Logs aktualisiert`);
      }catch(_){}
      return true;
    }catch(error){
      safeSet(PENDING_KEY,'1');
      safeSet(LAST_ERROR_KEY,error?.message||String(error));
      console.warn('V600 Safety-Cloudsync:',error);
      return false;
    }finally{
      syncing=false;
    }
  }

  async function requestSupabaseExport(){
    const {client}=await context();
    const {data,error}=await client.functions.invoke('backup-export-v1',{body:{mode:'full'}});
    if(error)throw error;
    if(!data||data.format!=='Master of Disaster Unified Supabase Backup'){
      throw new Error('Supabase-Komplettexport hat ein unerwartetes Format.');
    }
    return data;
  }

  function retiredWeeklyAction(){
    try{
      window.showInfoModal?.(
        'Wochen-Cloudbackups wurden ersetzt',
        'Das neue Backup-Modell nutzt LIVE + PREVIOUS, eine rollierende 48-Stunden-Zeitmaschine und eine einzige Vollbackup-ZIP. Alte Wochen-Cloudbackups werden nicht mehr neu erzeugt.'
      );
    }catch(_){}
    return false;
  }

  function retireWeeklyApis(){
    const history=window.__modRecoveryHistoryV498;
    if(history){
      history.createWeeklyCloudBackup=retiredWeeklyAction;
      history.listWeeklyCloudBackups=retiredWeeklyAction;
      history.weeklyCloudBackupsRetiredV600=true;
    }
    const stability=window.__modBackupStabilityV506;
    if(stability){
      stability.createWeeklyCloudBackup=retiredWeeklyAction;
      stability.listWeeklyCloudBackups=retiredWeeklyAction;
      stability.restoreWeeklyCloud=retiredWeeklyAction;
      stability.weeklyCloudBackupsRetiredV600=true;
    }
  }

  function retireWeeklyUi(){
    document.querySelectorAll('[data-weekly-create-v498],[data-weekly-list-v498]').forEach(el=>el.remove());
    const panel=document.getElementById('modDevSafetyV498');
    const note=panel?.querySelector('div:nth-child(2)');
    if(note)note.textContent='48-Stunden-Zeitmaschine lokal + rollierend in Supabase · Vollbackup als eine ZIP · keine Wochen-Cloudbackups mehr.';
  }

  function install(){
    retireWeeklyApis();
    retireWeeklyUi();
    if(window.__modRecoveryHistoryV498?.exportPackage){
      const pending=safeGet(PENDING_KEY)==='1';
      const last=Date.parse(safeGet(LAST_SYNC_KEY)||'');
      const stale=!Number.isFinite(last)||Date.now()-last>10*60*1000;
      if(pending||stale)scheduleSafetySync(900);
    }
    return true;
  }

  window.addEventListener('online',()=>scheduleSafetySync(600));
  window.addEventListener('focus',()=>scheduleSafetySync(900));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleSafetySync(900);});
  document.addEventListener('click',()=>setTimeout(retireWeeklyUi,0),true);

  window.__modBackupModelV600={
    version:VERSION,
    retentionDays:2,
    retentionHours:48,
    livePlusPrevious:true,
    weeklyCloudBackups:false,
    syncSafetyNow,
    scheduleSafetySync,
    markSafetyPending,
    requestSupabaseExport,
    retireWeeklyApis,
    retireWeeklyUi,
    status(){
      return {
        pending:safeGet(PENDING_KEY)==='1',
        lastSyncAt:safeGet(LAST_SYNC_KEY),
        lastError:safeGet(LAST_ERROR_KEY)
      };
    }
  };

  const interval=setInterval(()=>{
    installTries++;
    install();
    if(installTries>120)clearInterval(interval);
  },250);
  if(document.readyState!=='loading')setTimeout(install,0);
  else document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
})();