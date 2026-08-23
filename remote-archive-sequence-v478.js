/* V478 · TARGETED ARCHIVE SEQUENCE REPAIR
   Closes one explicitly requested archive-number gap without changing task data.
   Stable archiveId values are deliberately preserved as identities.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V478';
  const COMMAND='RENUMBER_ARCHIVE_GAP';
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

  function inspectSequence(){
    if(!Array.isArray(archive))throw new Error('Lokales Archiv ist nicht verfügbar.');
    const rows=[];
    archive.forEach((row,index)=>{
      if(row?.isTestArchive)return;
      const n=realArchiveNumber(row);
      if(n===null)throw new Error(`Ungültige Archivnummer an Position ${index}.`);
      rows.push({row,index,n});
    });
    const counts=new Map();
    for(const item of rows)counts.set(item.n,(counts.get(item.n)||0)+1);
    const duplicates=[...counts.entries()].filter(([,count])=>count>1).map(([n])=>n);
    const highest=rows.reduce((m,item)=>Math.max(m,item.n),0);
    const gaps=[];
    for(let n=1;n<=highest;n++)if(!counts.has(n))gaps.push(n);
    return {rows,counts,duplicates,highest,gaps};
  }

  function repairArchiveGap(gapNumber){
    const gap=Number(gapNumber);
    if(!Number.isInteger(gap)||gap<=0)throw new Error('RENUMBER_ARCHIVE_GAP: gültige gap_number fehlt.');

    const before=inspectSequence();
    if(before.duplicates.length)throw new Error(`Archiv enthält doppelte Nummern: ${before.duplicates.join(', ')}.`);

    if(before.gaps.length===0){
      const expectedNext=before.highest+1;
      if(Number(nextArchiveNumber)!==expectedNext)throw new Error(`Archiv ist lückenlos, aber nächste Archivnummer ist ${nextArchiveNumber} statt ${expectedNext}.`);
      return {gap_number:gap,already_repaired:true,shifted:0,highest_before:before.highest,highest_after:before.highest,next_archive_number:expectedNext,archive_id_preserved:true};
    }

    if(before.gaps.length!==1||before.gaps[0]!==gap){
      throw new Error(`Erwartet wurde ausschließlich die Lücke A${gap}; gefunden: ${before.gaps.length?before.gaps.map(n=>'A'+n).join(', '):'keine'}.`);
    }
    if(gap>=before.highest)throw new Error(`A${gap} ist keine innere Archivlücke.`);

    const expectedNextBefore=before.highest+1;
    if(Number(nextArchiveNumber)!==expectedNextBefore){
      throw new Error(`Nächste Archivnummer ${nextArchiveNumber} passt nicht zum höchsten Eintrag A${before.highest}.`);
    }

    const shiftedRows=before.rows.filter(item=>item.n>gap).sort((a,b)=>a.n-b.n);
    if(!shiftedRows.length)throw new Error(`Keine Archivaufgaben hinter A${gap} vorhanden.`);

    const identities=shiftedRows.map(item=>({row:item.row,archiveId:item.row.archiveId??null,from:item.n}));
    for(const item of shiftedRows)item.row.archiveNumber=item.n-1;
    nextArchiveNumber=before.highest;

    const after=inspectSequence();
    if(after.duplicates.length||after.gaps.length||after.highest!==before.highest-1){
      for(const item of identities)item.row.archiveNumber=item.from;
      nextArchiveNumber=expectedNextBefore;
      throw new Error('Archivsequenz konnte nicht sicher geschlossen werden; Änderung wurde zurückgerollt.');
    }
    for(const item of identities){
      if((item.row.archiveId??null)!==item.archiveId){
        for(const restore of identities)restore.row.archiveNumber=restore.from;
        nextArchiveNumber=expectedNextBefore;
        throw new Error('Stabile archiveId wurde unerwartet verändert; Änderung wurde zurückgerollt.');
      }
    }
    if(Number(nextArchiveNumber)!==after.highest+1){
      for(const item of identities)item.row.archiveNumber=item.from;
      nextArchiveNumber=expectedNextBefore;
      throw new Error('Nächste Archivnummer ist nach Reparatur inkonsistent; Änderung wurde zurückgerollt.');
    }

    if(typeof saveArchive==='function')saveArchive();
    else {
      safeStorageSet('masterOfDisasterArchive',JSON.stringify(archive));
      safeStorageSet('masterOfDisasterNextArchiveNumber',String(nextArchiveNumber));
      if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('archive');
    }
    if(typeof render==='function')render();
    try{window.__modLiveLogV453?.append?.('ARCHIVE','WARN',`Archivlücke A${gap} geschlossen: ${shiftedRows.length} Einträge um eine Nummer nachgerückt.`);}catch(_){}

    return {
      gap_number:gap,
      already_repaired:false,
      shifted:shiftedRows.length,
      first_mapping:{from:shiftedRows[0].n,to:shiftedRows[0].n-1},
      last_mapping:{from:shiftedRows.at(-1).n,to:shiftedRows.at(-1).n-1},
      highest_before:before.highest,
      highest_after:after.highest,
      next_archive_number:nextArchiveNumber,
      archive_id_preserved:true,
      sequence_contiguous:true
    };
  }

  async function mark(client,id,status,extra={}){
    const {error}=await client.from('remote_commands').update({status,processed_at:new Date().toISOString(),...extra}).eq('id',id);
    if(error)throw error;
  }

  async function processOne(client,row){
    try{
      if(row.command!==COMMAND)return false;
      const result=repairArchiveGap(row.payload?.gap_number);
      await mark(client,row.id,'done',{result,error:null});
      return true;
    }catch(error){
      const message=error?.message||String(error);
      try{await mark(client,row.id,'error',{error:message});}catch(_){}
      console.warn('V478 archive sequence repair:',error);
      return false;
    }
  }

  async function poll(){
    if(busy||!navigator.onLine)return;
    busy=true;
    try{
      const s=await getSession();if(!s)return;
      const {data,error}=await s.client.from('remote_commands').select('id,command,payload,created_at').eq('user_id',s.userId).eq('status',QUEUE_STATUS).eq('command',COMMAND).order('created_at',{ascending:true}).limit(5);
      if(error)throw error;
      for(const row of (data||[]))await processOne(s.client,row);
    }catch(error){console.warn('V478 archive sequence poll:',error);}finally{busy=false;}
  }

  function start(){if(timer)clearInterval(timer);poll();timer=setInterval(poll,POLL_MS);}
  window.addEventListener('online',()=>setTimeout(poll,150));
  window.addEventListener('focus',()=>setTimeout(poll,120));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(poll,120);});
  window.addEventListener('load',()=>setTimeout(start,900));
  setTimeout(start,1200);

  window.__modRemoteArchiveSequenceV478={
    version:BUILD_VERSION,
    command:COMMAND,
    queueStatus:QUEUE_STATUS,
    pollMs:POLL_MS,
    inspectSequence,
    repairArchiveGap,
    poll
  };
})();
