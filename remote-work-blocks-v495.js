/* V495 · REMOTE TODAY WORK BLOCK CONTROL
   Dedicated bridge for date-specific work blocks. It only consumes commands
   parked as ready_v495 so older app versions cannot reject them.
*/
(function(){
  const POLL_MS=5000;
  const STATUS='ready_v495';
  const ACTIVE=new Set(['open','running','paused']);
  let busy=false,timer=null;

  const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');
  const clean=v=>String(v??'').trim().replace(/\s+/g,' ');

  function berlinDay(){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const pick=t=>parts.find(p=>p.type===t)?.value||'';
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  }
  function validDay(v){
    const s=clean(v);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
    const d=new Date(s+'T00:00:00Z');
    return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s?s:null;
  }
  function api(){
    const a=window.__modTodayWorkBlocksV474;
    if(!a||typeof a.getBlocks!=='function'||typeof a.addBlock!=='function'||typeof a.moveTaskToBlock!=='function'||typeof a.orderedByBlocks!=='function'){
      throw new Error('V495: Arbeitsblock-Modul V474 ist nicht verfügbar.');
    }
    return a;
  }
  function resolveTexts(texts){
    if(!Array.isArray(texts)||!texts.length)throw new Error('SET_TODAY_WORK_BLOCK: tasks fehlt.');
    const seen=new Set();
    return texts.map(raw=>{
      const title=clean(raw),key=norm(title);
      if(!title||seen.has(key))throw new Error('SET_TODAY_WORK_BLOCK: leere oder doppelte Aufgabe.');
      seen.add(key);
      const matches=(Array.isArray(tasks)?tasks:[]).filter(t=>t&&ACTIVE.has(String(t.status||''))&&norm(t.text)===key);
      if(matches.length===0)throw new Error(`SET_TODAY_WORK_BLOCK: Aufgabe nicht gefunden: ${title}`);
      if(matches.length>1)throw new Error(`SET_TODAY_WORK_BLOCK: Aufgabe nicht eindeutig: ${title}`);
      return matches[0];
    });
  }
  function snapshot(date){
    const a=api();
    const ordered=a.orderedByBlocks(date)||{};
    const rows=Array.isArray(ordered.rows)?ordered.rows:[];
    return (a.getBlocks(date)||[]).map((b,i)=>({
      block_number:i+1,
      block_id:b.id,
      name:b.name||'',
      tasks:rows.filter(t=>String(t.todayWorkBlockId||'')===String(b.id)).map(t=>t.text)
    }));
  }
  function setBlock(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    const date=validDay(payload.date||payload.today_date)||berlinDay();
    const blockNumber=Math.trunc(Number(payload.block_number||1));
    if(blockNumber<1)throw new Error('SET_TODAY_WORK_BLOCK: block_number muss >= 1 sein.');
    const selected=resolveTexts(payload.tasks);
    const selectedIds=new Set(selected.map(t=>String(t.id)));
    const a=api();

    let blocks=a.getBlocks(date)||[];
    while(blocks.length<blockNumber){a.addBlock('',{date,render:false});blocks=a.getBlocks(date)||[];}
    const target=blocks[blockNumber-1];
    if(!target)throw new Error('SET_TODAY_WORK_BLOCK: Zielblock konnte nicht erstellt werden.');

    const ordered=a.orderedByBlocks(date)||{};
    const todayRows=Array.isArray(ordered.rows)?ordered.rows:[];
    const outsiders=todayRows.filter(t=>String(t.todayWorkBlockId||'')===String(target.id)&&!selectedIds.has(String(t.id)));
    if(outsiders.length){
      let holding=blocks.find(b=>String(b.id)!==String(target.id));
      if(!holding){holding=a.addBlock('',{date,render:false});blocks=a.getBlocks(date)||[];}
      const holdingRows=(a.orderedByBlocks(date).rows||[]).filter(t=>String(t.todayWorkBlockId||'')===String(holding.id));
      let append=holdingRows.length;
      outsiders.forEach(t=>a.moveTaskToBlock(t.id,holding.id,append++,{date,render:false}));
    }

    selected.forEach((t,index)=>a.moveTaskToBlock(t.id,target.id,index,{date,render:false}));
    if(typeof render==='function')render();
    return {date,block_number:blockNumber,requested_tasks:selected.map(t=>t.text),blocks:snapshot(date)};
  }

  async function getSession(){
    const client=typeof getSupabaseClient==='function'?getSupabaseClient():null;
    if(!client)return null;
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    const user=data&&data.session&&data.session.user;
    return user&&user.id?{client,userId:user.id}:null;
  }
  async function mark(client,id,status,extra){
    const {error}=await client.from('remote_commands').update({status,processed_at:new Date().toISOString(),...(extra||{})}).eq('id',id);
    if(error)throw error;
  }
  async function processOne(client,row){
    try{
      let result;
      if(row.command==='SET_TODAY_WORK_BLOCK')result=setBlock(row.payload||{});
      else if(row.command==='REPORT_TODAY_WORK_BLOCKS')result={date:validDay(row.payload&&row.payload.date)||berlinDay(),blocks:snapshot(validDay(row.payload&&row.payload.date)||berlinDay())};
      else throw new Error('V495: nicht unterstützter Arbeitsblock-Befehl '+row.command+'.');
      await mark(client,row.id,'done',{result,error:null});
      return true;
    }catch(error){
      const message=error&&error.message?error.message:String(error||'Unbekannter Fehler');
      try{await mark(client,row.id,'error',{error:message});}catch(_){}
      console.warn('V495 remote work block:',error);
      return false;
    }
  }
  async function poll(){
    if(busy||!navigator.onLine)return;
    busy=true;
    try{
      const s=await getSession();
      if(!s)return;
      const {data,error}=await s.client.from('remote_commands').select('id,command,payload,created_at').eq('user_id',s.userId).eq('status',STATUS).order('created_at',{ascending:true}).limit(10);
      if(error)throw error;
      for(const row of(data||[]))await processOne(s.client,row);
    }catch(error){console.warn('V495 remote work block poll:',error);}
    finally{busy=false;}
  }
  function start(){if(timer)clearInterval(timer);poll();timer=setInterval(poll,POLL_MS);}
  window.addEventListener('online',()=>setTimeout(poll,250));
  window.addEventListener('focus',()=>setTimeout(poll,200));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(poll,200);});
  window.addEventListener('load',()=>setTimeout(start,900));
  window.__modRemoteWorkBlocksV495={version:'V495',poll,pollMs:POLL_MS,status:STATUS,setBlock,snapshot};
})();
