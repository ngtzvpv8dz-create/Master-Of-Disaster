/* V454 · BACKGROUND PROCESS LOGGING
   Ergänzt V453 um relevante Hintergrundprozesse: Sync-Timer, Supabase Session/Manifest,
   gebündelte Supabase-Queries, Remote-Command-Treffer, Netzwerk, GitHub Pages und Service Worker.
   Keine Tokens/IDs/Werte im Log; leere Remote-Polls bleiben still.
*/
(function(){
  const SYNC_DELAY_MS=900;
  let traceCounter=0;
  let activeTrace=null;
  const clientProxyCache=new WeakMap();

  function clean(value){return String(value??'').replace(/\s+/g,' ').trim();}
  function log(area,level,message,meta){
    try{return window.__modLiveLogV453&&window.__modLiveLogV453.append?window.__modLiveLogV453.append(area,level,clean(message),meta):null;}catch(_){return null;}
  }
  function formatMs(ms){ms=Number(ms)||0;return ms<1000?`${ms} ms`:`${(ms/1000).toFixed(2).replace('.',',')} s`;}
  function safeFields(value){return value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).filter(key=>!/(token|password|secret|key|email|user_id)/i.test(key)).slice(0,12):[];}
  function countRows(value){return Array.isArray(value)?value.length:(value==null?0:1);}
  function localCounts(){
    const taskRows=typeof tasks!=='undefined'&&Array.isArray(tasks)?tasks:[];
    const archiveRows=typeof archive!=='undefined'&&Array.isArray(archive)?archive:[];
    const weights=typeof weightPhases!=='undefined'&&Array.isArray(weightPhases)?weightPhases:[];
    return {tasks:taskRows.length,archive:archiveRows.length,weights:weights.length};
  }
  function queryContext(ctx,method,args){
    const next={...ctx,filters:[...(ctx.filters||[])],fields:[...(ctx.fields||[])]};
    if(method==='select'){next.op='SELECT';next.columns=clean(args[0]||'*').slice(0,180);next.head=!!(args[1]&&args[1].head);}
    else if(method==='insert'){next.op='INSERT';next.inputRows=countRows(args[0]);}
    else if(method==='upsert'){next.op='UPSERT';next.inputRows=countRows(args[0]);}
    else if(method==='update'){next.op='UPDATE';next.fields=safeFields(args[0]);next.statusValue=args[0]&&['pending','done','error'].includes(args[0].status)?args[0].status:null;}
    else if(method==='delete'){next.op='DELETE';}
    else if(['eq','neq','gt','gte','lt','lte','like','ilike','is'].includes(method)){next.filters.push(`${clean(args[0])} ${method.toUpperCase()} ?`);}
    else if(method==='in'){next.filters.push(`${clean(args[0])} IN(${Array.isArray(args[1])?args[1].length:'?'})`);}
    else if(method==='limit'){next.limit=Number(args[0])||null;}
    return next;
  }
  function eventFromResult(ctx,result,durationMs,thrown){
    const error=thrown||(result&&result.error)||null;
    const resultRows=Array.isArray(result&&result.data)?result.data.length:(result&&result.data?1:null);
    const exactCount=result&&result.count!=null&&Number.isFinite(Number(result.count))?Number(result.count):null;
    return {...ctx,durationMs,error:error?clean(error.message||error):null,resultRows,exactCount};
  }
  function isEmptyRemotePoll(event,result){return event.table==='remote_commands'&&event.op==='SELECT'&&!event.error&&(!Array.isArray(result&&result.data)||result.data.length===0);}
  function singleQueryMessage(event){
    const bits=[`Supabase ${event.op||'QUERY'} ${event.table}`];
    if(event.op==='SELECT'){
      if(event.exactCount!=null)bits.push(`${event.exactCount} Zeilen gezählt`);
      else if(event.resultRows!=null)bits.push(`${event.resultRows} Zeilen gelesen`);
      if(event.columns)bits.push(`Spalten ${event.columns}`);
    }else if(['INSERT','UPSERT'].includes(event.op))bits.push(`${event.inputRows||0} Zeilen übergeben`);
    else if(event.op==='UPDATE'&&event.fields&&event.fields.length)bits.push(`Felder ${event.fields.join(', ')}`);
    else if(event.op==='DELETE')bits.push('Löschabfrage');
    if(event.filters&&event.filters.length)bits.push(`Filter ${event.filters.join(' + ')}`);
    bits.push(formatMs(event.durationMs));
    if(event.error)bits.push(event.error);
    return bits.join(' · ');
  }
  function recordQuery(event,result){
    if(isEmptyRemotePoll(event,result))return;
    if(event.table==='remote_commands'&&event.op==='SELECT'&&!event.error){
      const rows=Array.isArray(result&&result.data)?result.data:[];
      if(rows.length){const commands=[...new Set(rows.map(row=>clean(row&&row.command)).filter(Boolean))];log('REMOTE','INFO',`${rows.length} Remote Command${rows.length===1?'':'s'} gefunden${commands.length?` · ${commands.join(', ')}`:''}`,{table:'remote_commands'});}
      return;
    }
    if(event.table==='remote_commands'&&event.op==='UPDATE'){
      log('REMOTE',event.error?'ERROR':event.statusValue==='error'?'WARN':'PASS',`${event.error?'Remote-Status konnte nicht geschrieben werden':'Remote Command verarbeitet'}${event.statusValue?` · Status ${event.statusValue}`:''} · ${formatMs(event.durationMs)}`,{table:'remote_commands'});
      return;
    }
    if(activeTrace){activeTrace.ops.push(event);return;}
    log('SYNC',event.error?'ERROR':'PASS',singleQueryMessage(event),{table:event.table,op:event.op});
  }
  function wrapBuilder(builder,ctx){
    if(!builder||(typeof builder!=='object'&&typeof builder!=='function'))return builder;
    return new Proxy(builder,{
      get(target,prop){
        if(prop==='then'&&typeof target.then==='function')return function(onFulfilled,onRejected){
          const started=Date.now();
          return target.then(result=>{recordQuery(eventFromResult(ctx,result,Date.now()-started,null),result);return typeof onFulfilled==='function'?onFulfilled(result):result;},error=>{recordQuery(eventFromResult(ctx,null,Date.now()-started,error),null);if(typeof onRejected==='function')return onRejected(error);throw error;});
        };
        const value=target[prop];
        if(typeof value!=='function')return value;
        return function(...args){return wrapBuilder(value.apply(target,args),queryContext(ctx,String(prop),args));};
      }
    });
  }
  function wrapSupabaseClient(client){
    if(!client||typeof client!=='object')return client;
    if(clientProxyCache.has(client))return clientProxyCache.get(client);
    const proxy=new Proxy(client,{get(target,prop){
      if(prop==='from')return function(table){return wrapBuilder(target.from.call(target,table),{table:clean(table),op:'QUERY',filters:[],fields:[]});};
      const value=target[prop];return typeof value==='function'?value.bind(target):value;
    }});
    clientProxyCache.set(client,proxy);return proxy;
  }
  function patchClient(){
    if(typeof window.getSupabaseClient!=='function'||window.getSupabaseClient.__modBackgroundLogV454)return;
    const base=window.getSupabaseClient;
    const wrapped=function(){return wrapSupabaseClient(base.apply(this,arguments));};
    wrapped.__modBackgroundLogV454=true;window.getSupabaseClient=wrapped;
  }
  function patchSessionCheck(){
    if(typeof window.getLiveSyncSessionAndManifest!=='function'||window.getLiveSyncSessionAndManifest.__modBackgroundLogV454)return;
    const base=window.getLiveSyncSessionAndManifest;
    const wrapped=async function(){
      log('SYNC','INFO',`Sync #${activeTrace?activeTrace.id:'?'} · Supabase-Session und Live-Sync-Manifest prüfen`);
      try{
        const result=await base.apply(this,arguments);
        if(result&&result.ready)log('SYNC','PASS',`Sync #${activeTrace?activeTrace.id:'?'} · Supabase-Session aktiv · Live-Sync freigegeben`);
        else log('SYNC','WARN',`Sync #${activeTrace?activeTrace.id:'?'} · Live-Sync nicht freigegeben${result&&result.reason?` · ${clean(result.reason)}`:''}`);
        return result;
      }catch(error){log('SYNC','ERROR',`Sync #${activeTrace?activeTrace.id:'?'} · Session-/Manifestprüfung fehlgeschlagen · ${clean(error&&error.message||error)}`);throw error;}
    };
    wrapped.__modBackgroundLogV454=true;window.getLiveSyncSessionAndManifest=wrapped;
  }
  function summarizeTrace(trace){
    const groups=new Map();
    for(const op of trace.ops){
      const key=`${op.table}|${op.op}`;
      if(!groups.has(key))groups.set(key,{table:op.table,op:op.op,calls:0,inputRows:0,resultRows:0,resultKnown:false,exactCount:null,duration:0,errors:[],fields:new Set()});
      const g=groups.get(key);g.calls++;g.duration+=Number(op.durationMs)||0;
      if(Number(op.inputRows)>0)g.inputRows+=Number(op.inputRows);
      if(op.resultRows!=null){g.resultRows+=Number(op.resultRows)||0;g.resultKnown=true;}
      if(op.exactCount!=null)g.exactCount=op.exactCount;
      if(op.error)g.errors.push(op.error);
      (op.fields||[]).forEach(field=>g.fields.add(field));
    }
    for(const g of groups.values()){
      const parts=[`Sync #${trace.id} · Supabase ${g.op} ${g.table}`,`${g.calls} ${g.calls===1?'Aufruf':'Aufrufe'}`];
      if(['INSERT','UPSERT'].includes(g.op))parts.push(`${g.inputRows} Zeilen übergeben`);
      if(g.op==='SELECT'&&g.exactCount!=null)parts.push(`${g.exactCount} Zeilen gezählt`);
      else if(g.op==='SELECT'&&g.resultKnown)parts.push(`${g.resultRows} Zeilen gelesen`);
      if(g.op==='UPDATE'&&g.fields.size)parts.push(`Felder ${[...g.fields].slice(0,10).join(', ')}`);
      parts.push(formatMs(g.duration));
      if(g.errors.length)parts.push(g.errors.join(' | '));
      log('SYNC',g.errors.length?'ERROR':'PASS',parts.join(' · '),{table:g.table,op:g.op});
    }
  }
  function verifiedCounts(){
    try{return typeof supabaseLiveSyncState!=='undefined'&&supabaseLiveSyncState&&supabaseLiveSyncState.counts?Object.entries(supabaseLiveSyncState.counts).map(([k,v])=>`${k} ${v}`).join(' · '):'';}catch(_){return '';}
  }
  function patchSync(){
    if(typeof window.scheduleSupabaseLiveSync==='function'&&!window.scheduleSupabaseLiveSync.__modBackgroundLogV454){
      const base=window.scheduleSupabaseLiveSync;
      const wrapped=function(reason='local-save'){
        let running=false,hadTimer=false;try{running=typeof supabaseLiveSyncRunning!=='undefined'&&!!supabaseLiveSyncRunning;hadTimer=typeof supabaseLiveSyncTimer!=='undefined'&&!!supabaseLiveSyncTimer;}catch(_){}
        const result=base.apply(this,arguments);
        log('SYNC','INFO',running?`Sync-Anforderung vorgemerkt · Grund ${clean(reason)||'local-save'} · laufender Sync wird erst beendet`:`${hadTimer?'Sync-Timer neu gestartet':'Auto-Sync geplant'} · 0,9 s · Grund ${clean(reason)||'local-save'}`);
        return result;
      };
      wrapped.__modBackgroundLogV454=true;window.scheduleSupabaseLiveSync=wrapped;
    }
    if(typeof window.runSupabaseLiveSync==='function'&&!window.runSupabaseLiveSync.__modBackgroundLogV454){
      const base=window.runSupabaseLiveSync;
      const wrapped=async function(manual=false){
        const trace={id:++traceCounter,started:Date.now(),ops:[]};activeTrace=trace;
        const c=localCounts();log('SYNC','INFO',`Sync #${trace.id} gestartet · ${manual?'manuell':'automatisch'} · lokal ${c.tasks} Aufgaben / ${c.archive} Archiv / ${c.weights} Gewichtsphasen`);
        try{
          if(typeof collectDataIntegrityReport==='function'){
            const integrity=collectDataIntegrityReport();
            log('SYNC',integrity&&integrity.ok?'PASS':'ERROR',`Sync #${trace.id} · lokale Integritätsprüfung ${integrity&&integrity.ok?'bestanden':'fehlgeschlagen'}`);
          }
          const result=await base.apply(this,arguments);
          summarizeTrace(trace);
          let state=null;try{state=typeof supabaseLiveSyncState!=='undefined'?supabaseLiveSyncState:null;}catch(_){}
          const countText=verifiedCounts(),elapsed=formatMs(Date.now()-trace.started);
          if(state&&state.status==='ok')log('SYNC','PASS',`Sync #${trace.id} vollständig verifiziert · ${elapsed}${countText?` · ${countText}`:''}`);
          else if(state&&state.status==='warn')log('SYNC','WARN',`Sync #${trace.id} pausiert · ${clean(state.detail)||'keine Freigabe'} · ${elapsed}`);
          else if(state&&state.status==='error')log('SYNC','ERROR',`Sync #${trace.id} fehlgeschlagen · ${clean(state.detail)||'unbekannter Fehler'} · ${elapsed}`);
          else log('SYNC','INFO',`Sync #${trace.id} beendet · ${elapsed}`);
          return result;
        }catch(error){summarizeTrace(trace);log('SYNC','ERROR',`Sync #${trace.id} Ausnahme · ${clean(error&&error.message||error)}`);throw error;}
        finally{if(activeTrace===trace)activeTrace=null;}
      };
      wrapped.__modBackgroundLogV454=true;window.runSupabaseLiveSync=wrapped;
    }
  }
  function logStartup(){
    try{if(sessionStorage.getItem('modV454BackgroundStartup'))return;sessionStorage.setItem('modV454BackgroundStartup','1');}catch(_){}
    log('SYSTEM','PASS',`Hintergrundlogger V454 aktiv · Netzwerk ${navigator.onLine?'online':'offline'}`);
    if(typeof location!=='undefined'&&/github\.io$/i.test(location.hostname))log('SYSTEM','PASS',`GitHub Pages erreichbar · App-Dateien geladen · ${location.hostname}`);
    if(typeof navigator!=='undefined'&&'serviceWorker' in navigator)setTimeout(()=>navigator.serviceWorker.getRegistration().then(reg=>log('SYSTEM',reg?'PASS':'INFO',reg?`Service Worker registriert · ${reg.active?reg.active.state:'vorhanden'}`:'Service Worker aktuell nicht registriert')).catch(error=>log('SYSTEM','WARN',`Service-Worker-Prüfung fehlgeschlagen · ${clean(error&&error.message||error)}`)),1500);
  }

  patchClient();patchSessionCheck();patchSync();
  if(typeof window!=='undefined'){
    window.addEventListener&&window.addEventListener('online',()=>log('SYSTEM','PASS','Netzwerkverbindung wieder online'));
    window.addEventListener&&window.addEventListener('offline',()=>log('SYSTEM','WARN','Netzwerkverbindung offline'));
    window.addEventListener&&window.addEventListener('load',()=>setTimeout(logStartup,50));
  }
  window.__modBackgroundLogV454={version:'V454',syncDelayMs:SYNC_DELAY_MS,emptyRemotePollSuppressed:true,wrapSupabaseClient,summarizeTrace};
})();
