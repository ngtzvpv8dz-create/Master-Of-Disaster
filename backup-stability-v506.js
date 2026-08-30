/* V506.2 · BACKUP- UND DATENSICHERHEITS-STABILITÄT
   - V498 öffnet eine geschlossene IndexedDB-Verbindung automatisch neu.
   - Vollbackup wird niemals automatisch per Blob-Link ausgelöst.
   - V506.2 baut das Vollbackup speicherschonend als STORE-ZIP:
     GitHub-Code kommt als bereits gepacktes Quellcode-ZIP, History/Log werden per IndexedDB-Cursor
     zeilenweise direkt in das äußere ZIP geschrieben statt komplett in den RAM geladen.
   - Ein Crash-Marker zeigt nach einem iOS-WebView-Neustart den letzten Backup-Schritt an.
   - Wochen-Cloudbackups bleiben im kompakten V506.1-Format.
*/
(function(){
  'use strict';
  if(window.__modBackupStabilityV506?.patchRevision==='V506.2')return;

  const BUILD_VERSION='V506';
  const PATCH_VERSION='V506.2';
  const WEEKLY_PREFIX='weekly_complete_backup_v1_';
  const WEEKLY_KEEP=12;
  const LIVE_LOG_KEY='masterOfDisasterLiveLogV453';
  const SAFETY_DB='MasterOfDisasterSafetyNetV498';
  const SAFETY_DB_VERSION=1;
  const POINT_STORE='recoveryPoints';
  const LOG_STORE='logEntries';
  const RETENTION_MS=7*24*60*60*1000;
  const CRASH_MARKER='modV5062FullBackupStage';
  const EXCLUDED_WEEKLY_KEYS=new Set([
    LIVE_LOG_KEY,
    'masterOfDisasterPreRestoreBackup',
    'masterOfDisasterPreCloudRestoreBackup'
  ]);
  let tries=0;
  let fullBusy=false;
  let weeklyBusy=false;
  let captureInstalled=false;
  let activeObjectUrl=null;

  const enc=new TextEncoder();
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const nowIso=()=>new Date().toISOString();
  const currentBuild=()=>String(window.__MOD_BUILD__?.version||BUILD_VERSION);
  const safeParse=(value,fallback)=>{try{return JSON.parse(value);}catch(_){return fallback;}};

  function berlinParts(value=new Date()){
    const date=value instanceof Date?value:new Date(value);
    const parts=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,weekday:'short'}).formatToParts(date);
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return {dateKey:`${p.year}-${p.month}-${p.day}`,dateLabel:`${p.weekday}, ${p.day}.${p.month}.${p.year}`,clock:`${p.hour}:${p.minute}:${p.second}`,file:`${p.year}-${p.month}-${p.day}_${p.hour}-${p.minute}-${p.second}`};
  }

  function closeModal(){
    document.getElementById('modBackupModalV5061')?.remove();
    if(activeObjectUrl){try{URL.revokeObjectURL(activeObjectUrl);}catch(_){}activeObjectUrl=null;}
  }

  function modal(title,bodyHtml){
    closeModal();
    const root=document.createElement('div');
    root.id='modBackupModalV5061';
    root.style.cssText='position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.76);display:flex;align-items:flex-start;justify-content:center;padding:calc(70px + env(safe-area-inset-top)) 12px 18px;overflow:auto';
    root.innerHTML=`<div style="width:min(680px,100%);border:1px solid rgba(255,255,255,.18);border-radius:16px;background:#15191d;box-shadow:0 18px 60px rgba(0,0,0,.55);padding:14px;color:#f5f5f5"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px"><h3 style="margin:0">${esc(title)}</h3><button type="button" data-close-v5061 style="color:inherit;border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.05);border-radius:10px;padding:7px 10px">✕</button></div>${bodyHtml}</div>`;
    document.body.appendChild(root);
    root.querySelector('[data-close-v5061]')?.addEventListener('click',closeModal);
    root.addEventListener('click',event=>{if(event.target===root)closeModal();});
    return root;
  }

  function showError(title,error){
    const text=error?.message||String(error||'Unbekannter Fehler');
    console.error(`V506.2 ${title}:`,error);
    modal(title,`<div style="line-height:1.55;opacity:.88">${esc(text)}</div>`);
  }

  function markFullStage(stage,extra={}){
    try{localStorage.setItem(CRASH_MARKER,JSON.stringify({patch:PATCH_VERSION,stage,at:Date.now(),...extra}));}catch(_){}
  }
  function clearFullStage(){try{localStorage.removeItem(CRASH_MARKER);}catch(_){} }
  function showInterruptedFullBackup(){
    let state=null;
    try{state=safeParse(localStorage.getItem(CRASH_MARKER),null);localStorage.removeItem(CRASH_MARKER);}catch(_){}
    if(!state||state.patch!==PATCH_VERSION||!state.stage)return;
    if(Date.now()-Number(state.at||0)>60*60*1000)return;
    setTimeout(()=>modal('VOLLBACKUP WURDE ABGEBROCHEN',`<div style="line-height:1.55">Das iPhone hat die PWA während des Vollbackups neu geladen.<br><br><strong>Letzter Schritt:</strong> ${esc(state.stage)}<br><br><span style="opacity:.72">Dieser Marker ist absichtlich drin. Falls es noch einmal passiert, wissen wir damit exakt, an welcher Stelle WebKit ausgestiegen ist.</span></div>`),500);
  }

  function collectAllMasterLocalStorage(){
    const out={};
    try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('masterOfDisaster'))out[key]=localStorage.getItem(key);}}
    catch(error){out.__error=error?.message||String(error);}
    return out;
  }

  function isWeeklyDataKey(key){
    key=String(key||'');
    return key.startsWith('masterOfDisaster')&&!EXCLUDED_WEEKLY_KEYS.has(key)&&!key.startsWith('masterOfDisasterSafetyNetV498');
  }

  function collectWeeklyLocalStorage(){
    const out={};
    try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(isWeeklyDataKey(key))out[key]=localStorage.getItem(key);}}
    catch(error){out.__error=error?.message||String(error);}
    return out;
  }

  async function cloudContext(){
    const client=typeof getSupabaseClient==='function'?getSupabaseClient():null;
    if(!client)throw new Error('Kein Supabase-Client verfügbar.');
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    const user=data?.session?.user;
    if(!user?.id)throw new Error('Supabase-Login fehlt.');
    return {client,userId:user.id};
  }

  function weeklyKey(){return WEEKLY_PREFIX+nowIso().replace(/[:.]/g,'-');}

  function setButtonState(button,text,disabled){
    if(!button||!button.isConnected)return;
    button.textContent=text;
    button.disabled=!!disabled;
  }

  async function shareBackupFile(blob,filename,button,fallback){
    try{
      if(typeof File!=='function'||typeof navigator.share!=='function'){
        fallback.style.display='block';
        button.style.display='none';
        return;
      }
      const file=new File([blob],filename,{type:'application/zip'});
      if(typeof navigator.canShare==='function'&&!navigator.canShare({files:[file]})){
        fallback.style.display='block';
        button.style.display='none';
        return;
      }
      await navigator.share({files:[file],title:'Master of Disaster Vollbackup'});
      button.textContent='✅ ZIP AN IOS ÜBERGEBEN';
    }catch(error){
      if(error?.name==='AbortError')return;
      fallback.style.display='block';
      button.textContent='⚠️ TEILEN NICHT MÖGLICH';
      console.warn('V506.2 Share-Sheet:',error);
    }
  }

  function presentFullBackup(blob,filename,summary){
    const root=modal('VOLLBACKUP BEREIT ✅',`<div style="padding:4px 2px 12px;line-height:1.55">${esc(summary)}<br><br><span style="opacity:.72">Die ZIP ist fertig. Nichts wird automatisch geöffnet oder heruntergeladen. Erst der nächste echte Tipp übergibt die Datei an iOS.</span></div><button type="button" data-share-v5061 style="width:100%;color:inherit;border:1px solid rgba(224,75,75,.7);background:rgba(224,75,75,.12);border-radius:10px;padding:11px;font:inherit;font-weight:800">📤 ZIP TEILEN / IN DATEIEN SICHERN</button><a data-download-v5061 href="#" style="display:none;margin-top:9px;text-align:center;color:inherit;border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.05);border-radius:10px;padding:11px;text-decoration:none;font-weight:800">⬇️ ZIP MANUELL ÖFFNEN / LADEN</a>`);
    activeObjectUrl=URL.createObjectURL(blob);
    const share=root.querySelector('[data-share-v5061]');
    const fallback=root.querySelector('[data-download-v5061]');
    if(fallback){fallback.href=activeObjectUrl;fallback.download=filename;}
    share?.addEventListener('click',()=>shareBackupFile(blob,filename,share,fallback));
  }

  const CRC_TABLE=(()=>{
    const table=new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
      table[n]=c>>>0;
    }
    return table;
  })();

  function crcUpdate(crc,bytes){
    let c=crc>>>0;
    for(let i=0;i<bytes.length;i++)c=CRC_TABLE[(c^bytes[i])&0xff]^(c>>>8);
    return c>>>0;
  }

  function u16(view,offset,value){view.setUint16(offset,value,true);}
  function u32(view,offset,value){view.setUint32(offset,value>>>0,true);}

  function dosStamp(date=new Date()){
    const year=Math.max(1980,date.getFullYear());
    return {
      time:((date.getHours()&31)<<11)|((date.getMinutes()&63)<<5)|((Math.floor(date.getSeconds()/2))&31),
      date:(((year-1980)&127)<<9)|(((date.getMonth()+1)&15)<<5)|(date.getDate()&31)
    };
  }

  function bytesOf(value){
    if(value instanceof Uint8Array)return value;
    if(value instanceof ArrayBuffer)return new Uint8Array(value);
    if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
    return enc.encode(String(value??''));
  }

  class StoreZipWriter{
    constructor(){
      this.chunks=[];
      this.entries=[];
      this.offset=0;
      this.stamp=dosStamp();
    }
    push(bytes){
      const b=bytesOf(bytes);
      if(!b.byteLength)return;
      this.chunks.push(b);
      this.offset+=b.byteLength;
    }
    async add(name,producer){
      const nameBytes=enc.encode(name);
      const localOffset=this.offset;
      const header=new Uint8Array(30+nameBytes.length);
      const hv=new DataView(header.buffer);
      u32(hv,0,0x04034b50);u16(hv,4,20);u16(hv,6,0x0808);u16(hv,8,0);
      u16(hv,10,this.stamp.time);u16(hv,12,this.stamp.date);
      u32(hv,14,0);u32(hv,18,0);u32(hv,22,0);u16(hv,26,nameBytes.length);u16(hv,28,0);
      header.set(nameBytes,30);this.push(header);
      let crc=0xffffffff,size=0;
      const emit=value=>{
        const b=bytesOf(value);
        if(!b.byteLength)return;
        crc=crcUpdate(crc,b);size+=b.byteLength;this.push(b);
      };
      await producer(emit);
      crc=(crc^0xffffffff)>>>0;
      if(size>0xffffffff||localOffset>0xffffffff)throw new Error('Vollbackup ist für das klassische ZIP-Format zu groß.');
      const descriptor=new Uint8Array(16),dv=new DataView(descriptor.buffer);
      u32(dv,0,0x08074b50);u32(dv,4,crc);u32(dv,8,size);u32(dv,12,size);this.push(descriptor);
      this.entries.push({nameBytes,localOffset,crc,size,time:this.stamp.time,date:this.stamp.date});
      return size;
    }
    async addBlob(name,blob){
      return this.add(name,async emit=>{
        if(blob?.stream){
          const reader=blob.stream().getReader();
          try{for(;;){const {done,value}=await reader.read();if(done)break;emit(value);}}
          finally{try{reader.releaseLock();}catch(_){} }
        }else emit(new Uint8Array(await blob.arrayBuffer()));
      });
    }
    finish(){
      const centralStart=this.offset;
      for(const e of this.entries){
        const c=new Uint8Array(46+e.nameBytes.length),v=new DataView(c.buffer);
        u32(v,0,0x02014b50);u16(v,4,20);u16(v,6,20);u16(v,8,0x0808);u16(v,10,0);
        u16(v,12,e.time);u16(v,14,e.date);u32(v,16,e.crc);u32(v,20,e.size);u32(v,24,e.size);
        u16(v,28,e.nameBytes.length);u16(v,30,0);u16(v,32,0);u16(v,34,0);u16(v,36,0);u32(v,38,0);u32(v,42,e.localOffset);
        c.set(e.nameBytes,46);this.push(c);
      }
      const centralSize=this.offset-centralStart;
      const end=new Uint8Array(22),v=new DataView(end.buffer);
      u32(v,0,0x06054b50);u16(v,4,0);u16(v,6,0);u16(v,8,this.entries.length);u16(v,10,this.entries.length);
      u32(v,12,centralSize);u32(v,16,centralStart);u16(v,20,0);this.push(end);
      return new Blob(this.chunks,{type:'application/zip'});
    }
  }

  function openSafetyDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(SAFETY_DB,SAFETY_DB_VERSION);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('IndexedDB-Historie konnte nicht geöffnet werden.'));
      req.onblocked=()=>reject(new Error('IndexedDB-Historie ist blockiert.'));
    });
  }

  async function scanSafetyStore(storeName,onRow){
    const db=await openSafetyDb();
    try{
      await new Promise((resolve,reject)=>{
        let tx;
        try{tx=db.transaction(storeName,'readonly');}catch(error){reject(error);return;}
        const req=tx.objectStore(storeName).openCursor();
        req.onsuccess=()=>{
          const cursor=req.result;
          if(!cursor)return;
          try{onRow(cursor.value);}catch(error){reject(error);return;}
          cursor.continue();
        };
        req.onerror=()=>reject(req.error||new Error('IndexedDB-Cursorfehler.'));
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error('IndexedDB-Lesefehler.'));
        tx.onabort=()=>reject(tx.error||new Error('IndexedDB-Lesevorgang abgebrochen.'));
      });
    }finally{try{db.close();}catch(_){} }
  }

  async function addSafetyPackage(writer,progress){
    const cutoff=Date.now()-RETENTION_MS;
    let pointCount=0,logCount=0,firstPoint=true,firstLog=true;
    await writer.add('DATA/recovery-history-v498.json',async emit=>{
      emit(`{"schema":"master-of-disaster-safety-net","version":1,"build":"V498","exportedAt":${JSON.stringify(nowIso())},"retentionDays":7,"points":[`);
      await scanSafetyStore(POINT_STORE,row=>{
        const t=new Date(row?.at).getTime();if(!Number.isFinite(t)||t<cutoff)return;
        if(!firstPoint)emit(',');firstPoint=false;emit(JSON.stringify(row));pointCount++;
        if(pointCount%25===0)progress(`HISTORIE ${pointCount}…`);
      });
      emit('],"logs":[');
      await scanSafetyStore(LOG_STORE,row=>{
        const t=new Date(row?.at).getTime();if(!Number.isFinite(t)||t<cutoff)return;
        if(!firstLog)emit(',');firstLog=false;emit(JSON.stringify(row));logCount++;
        if(logCount%250===0)progress(`LOG ${logCount}…`);
      });
      emit(']}');
    });
    await writer.add('DATA/live-log-7-days.json',async emit=>{
      let first=true;emit('[');
      await scanSafetyStore(LOG_STORE,row=>{
        const t=new Date(row?.at).getTime();if(!Number.isFinite(t)||t<cutoff)return;
        if(!first)emit(',');first=false;emit(JSON.stringify(row));
      });
      emit(']');
    });
    return {pointCount,logCount};
  }

  async function fetchSourceArchive(){
    const treeRes=await fetch('https://api.github.com/repos/ngtzvpv8dz-create/Master-Of-Disaster/git/trees/main',{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
    if(!treeRes.ok)throw new Error(`GitHub-Stand konnte nicht geladen werden (${treeRes.status}).`);
    const tree=await treeRes.json();
    const archiveRes=await fetch('https://codeload.github.com/ngtzvpv8dz-create/Master-Of-Disaster/zip/refs/heads/main',{cache:'no-store'});
    if(!archiveRes.ok)throw new Error(`GitHub-Codearchiv konnte nicht geladen werden (${archiveRes.status}).`);
    return {sha:tree.sha||'unbekannt',blob:await archiveRes.blob()};
  }

  async function createFullBackup(button){
    if(fullBusy)return;
    fullBusy=true;
    markFullStage('START');
    try{
      setButtonState(button,'⏳ BACKUP WIRD GEBAUT…',true);
      if(!navigator.onLine)throw new Error('Für das Code-Vollbackup wird Internet benötigt.');
      if(!('indexedDB' in window))throw new Error('IndexedDB ist auf diesem Gerät nicht verfügbar.');
      const api=window.__modRecoveryHistoryV498;
      if(!api?.captureSnapshot)throw new Error('Datensicherheitsmodul V498 ist noch nicht bereit.');

      const stamp=berlinParts(),writer=new StoreZipWriter();
      markFullStage('GITHUB-CODEARCHIV');
      setButtonState(button,'⏳ CODEARCHIV WIRD GELADEN…',true);
      const source=await fetchSourceArchive();
      await writer.addBlob('APP/source-main.zip',source.blob);

      markFullStage('AKTUELLER APP-DATENSTAND');
      setButtonState(button,'⏳ APP-DATEN WERDEN GESICHERT…',true);
      const complete=createCompleteBackupPayload();
      complete.masterVersion=currentBuild();
      complete.backupPatch=PATCH_VERSION;
      complete.fullBackupCreatedAt=nowIso();
      const local=collectAllMasterLocalStorage();
      await writer.add('DATA/complete-data-backup.json',emit=>emit(JSON.stringify(complete)));
      await writer.add('DATA/localstorage-master-of-disaster.json',emit=>emit(JSON.stringify(local)));

      markFullStage('7-TAGE-HISTORIE / WIEDERHERSTELLUNGSPUNKTE');
      setButtonState(button,'⏳ HISTORIE WIRD GESTREAMT…',true);
      try{await api.mirrorLiveLogs?.(true);}catch(_){}
      const counts=await addSafetyPackage(writer,text=>setButtonState(button,`⏳ ${text}`,true));

      markFullStage('ZIP-VERZEICHNIS');
      setButtonState(button,'⏳ ZIP WIRD ABGESCHLOSSEN…',true);
      await writer.add('BACKUP-INFO.txt',emit=>emit([
        'MASTER OF DISASTER · VOLLSTÄNDIGES KOMPLETT-BACKUP',
        '====================================================',
        `Build: ${currentBuild()} · Backup-Hotfix ${PATCH_VERSION}`,
        `Erstellt: ${stamp.dateLabel} ${stamp.clock} Europe/Berlin`,
        `Git-Stand: ${source.sha}`,
        'APP/source-main.zip = kompletter aktueller GitHub-Quellcode von main',
        'DATA/complete-data-backup.json = kompletter aktueller App-Datenstand',
        'DATA/localstorage-master-of-disaster.json = lokale Master-of-Disaster-Werte',
        'DATA/recovery-history-v498.json = 7-Tage-Wiederherstellungspunkte + Log',
        'DATA/live-log-7-days.json = 7-Tage-Log',
        `Wiederherstellungspunkte: ${counts.pointCount}`,
        `7-Tage-Logeinträge: ${counts.logCount}`,
        '',
        'V506.2-Hinweis: Das äußere ZIP wird absichtlich ohne erneute Kompression gestreamt, damit iOS nicht mehrere vollständige Kopien der History gleichzeitig im RAM halten muss.'
      ].join('\n')));
      const blob=writer.finish();
      const filename=`Master-of-Disaster_${currentBuild()}_Vollbackup_${stamp.file}.zip`;
      const summary=`Code + App-Daten + ${counts.pointCount} Wiederherstellungspunkte + ${counts.logCount} Logeinträge wurden speicherschonend in die ZIP geschrieben.`;
      clearFullStage();
      presentFullBackup(blob,filename,summary);
      setButtonState(button,'✅ VOLLSTÄNDIGES KOMPLETT-BACKUP',false);
    }catch(error){
      setButtonState(button,'📦 VOLLSTÄNDIGES KOMPLETT-BACKUP',false);
      const marker=safeParse(localStorage.getItem(CRASH_MARKER),null);
      clearFullStage();
      if(marker?.stage)error=new Error(`${error?.message||error} · Schritt: ${marker.stage}`);
      showError('Vollbackup fehlgeschlagen',error);
    }finally{fullBusy=false;}
  }

  async function createWeeklyCloudBackup(button){
    if(weeklyBusy)return;
    weeklyBusy=true;
    try{
      setButtonState(button,'⏳ WOCHENSTAND WIRD GEBAUT…',true);
      const {client,userId}=await cloudContext();
      const localStoragePayload=collectWeeklyLocalStorage();
      const complete=createCompleteBackupPayload();
      const payload={
        bundleVersion:2,
        format:'weekly-light-v5061',
        build:currentBuild(),
        backupPatch:PATCH_VERSION,
        savedAt:nowIso(),
        complete,
        localStorage:localStoragePayload,
        history:{mode:'local-only',module:'V498',retentionDays:7,reason:'Cloud-Wochenstand enthält bewusst keine duplizierten Voll-Snapshots.'}
      };
      const key=weeklyKey();
      setButtonState(button,'⏳ CLOUD-UPLOAD…',true);
      let result=await client.from('legacy_metadata').insert([{user_id:userId,key,payload}]).select('id,key,created_at').limit(1);
      if(result.error)throw result.error;
      if(!result.data?.[0]?.id)throw new Error('Cloud-Verifikation: neu gespeicherter Wochenstand wurde nicht bestätigt.');
      result=await client.from('legacy_metadata').select('id,key,created_at').eq('user_id',userId).like('key',WEEKLY_PREFIX+'%').order('created_at',{ascending:false});
      if(result.error)throw result.error;
      const rows=result.data||[],old=rows.slice(WEEKLY_KEEP).map(row=>row.id);
      if(old.length){const del=await client.from('legacy_metadata').delete().eq('user_id',userId).in('id',old);if(del.error)throw del.error;}
      window.__modLiveLogV453?.append?.('SYSTEM','PASS','Wochen-Cloudbackup erstellt · kompakter App-Stand · Historie bleibt lokal in V498');
      setButtonState(button,'✅ WOCHEN-CLOUDBACKUP ERSTELLT',false);
      modal('Wochen-Cloudbackup erstellt ✅',`<div style="line-height:1.55">Der wiederherstellbare App-Stand wurde in der Cloud gespeichert.<br><br><span style="opacity:.72">Die 7-Tage-Zeitmaschine bleibt lokal im V498-Sicherheitsmodul und wird nicht mehr als riesiger Stapel vollständiger Snapshots in eine einzelne Cloud-Zeile kopiert.</span></div>`);
    }catch(error){
      setButtonState(button,'☁️ WOCHEN-CLOUDBACKUP ERSTELLEN',false);
      showError('Cloudbackup fehlgeschlagen',error);
    }finally{weeklyBusy=false;}
  }

  function makeGuard(api,label){
    return {id:`rp-${Date.now()}-v5062-${Math.random().toString(36).slice(2,7)}`,at:nowIso(),version:PATCH_VERSION,type:'guard',label,area:'EDIT',snapshot:api.captureSnapshot(),delta:null,directState:true};
  }

  async function restoreWeeklyCloud(key){
    try{
      const {client,userId}=await cloudContext();
      const result=await client.from('legacy_metadata').select('payload,created_at').eq('user_id',userId).eq('key',key).limit(1);
      if(result.error)throw result.error;
      const row=result.data?.[0],payload=row?.payload;
      if(!payload?.localStorage)throw new Error('Cloudbackup ist unvollständig.');
      const stamp=berlinParts(row.created_at||payload.savedAt||new Date());
      if(!window.confirm(`WOCHEN-CLOUDBACKUP WIEDERHERSTELLEN?\n\n${stamp.dateLabel} · ${stamp.clock}\n\nDer aktuelle lokale Stand wird vorher als Rücksprungpunkt gesichert.`))return;
      const api=window.__modRecoveryHistoryV498;
      if(!api?.captureSnapshot||!api?.importPackage)throw new Error('Datensicherheitsmodul V498 ist nicht bereit.');
      const guard=makeGuard(api,'Vor Wochen-Cloudbackup-Wiederherstellung');
      try{
        localStorage.setItem('masterOfDisasterPreCloudRestoreBackup',JSON.stringify({savedAt:nowIso(),build:currentBuild(),complete:createCompleteBackupPayload(),localStorage:collectWeeklyLocalStorage()}));
      }catch(_){}
      if(Number(payload.bundleVersion||1)>=2){
        await api.importPackage({schema:'master-of-disaster-safety-net',version:1,points:[],logs:[]},{replace:false,extraPoints:[guard]});
        const incoming=payload.localStorage||{};
        const current=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(isWeeklyDataKey(k))current.push(k);}
        current.forEach(k=>{if(!(k in incoming))localStorage.removeItem(k);});
        Object.entries(incoming).forEach(([k,v])=>{if(isWeeklyDataKey(k))localStorage.setItem(k,String(v));});
      }else{
        const safety=payload.safety;
        if(safety?.schema==='master-of-disaster-safety-net')await api.importPackage(safety,{replace:true,extraPoints:[guard]});
        else await api.importPackage({schema:'master-of-disaster-safety-net',version:1,points:[],logs:[]},{replace:false,extraPoints:[guard]});
        const incoming=payload.localStorage||{};
        Object.entries(incoming).forEach(([k,v])=>{if(String(k).startsWith('masterOfDisaster'))localStorage.setItem(k,String(v));});
      }
      window.__modLiveLogV453?.append?.('EDIT','PASS',`Wochen-Cloudbackup wiederhergestellt · ${stamp.dateLabel} ${stamp.clock}`);
      sessionStorage.setItem('modV5061BackupNotice',`Wochen-Cloudbackup vom ${stamp.dateLabel} ${stamp.clock} wurde wiederhergestellt.`);
      location.reload();
    }catch(error){showError('Cloud-Restore fehlgeschlagen',error);}
  }

  async function listWeeklyCloudBackups(){
    try{
      const {client,userId}=await cloudContext();
      const result=await client.from('legacy_metadata').select('key,created_at').eq('user_id',userId).like('key',WEEKLY_PREFIX+'%').order('created_at',{ascending:false}).limit(WEEKLY_KEEP);
      if(result.error)throw result.error;
      const rows=result.data||[];
      const html=rows.map(row=>{const p=berlinParts(row.created_at);return `<div style="display:grid;grid-template-columns:70px 1fr auto;gap:8px;align-items:center;padding:9px;border:1px solid rgba(255,255,255,.11);border-radius:10px;margin-bottom:8px"><div style="opacity:.72">${esc(p.clock.slice(0,5))}</div><div>${esc(p.dateLabel)}<div style="font-size:.72rem;opacity:.55;overflow:hidden;text-overflow:ellipsis">${esc(row.key)}</div></div><button type="button" data-restore-v5061="${esc(row.key)}" style="color:inherit;border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.05);border-radius:8px;padding:7px">RESTORE</button></div>`;}).join('');
      const root=modal('WOCHEN-CLOUDBACKUPS',html||'<div style="opacity:.7">Noch kein Wochenbackup vorhanden.</div>');
      root.querySelectorAll('[data-restore-v5061]').forEach(btn=>btn.addEventListener('click',()=>restoreWeeklyCloud(btn.dataset.restoreV5061)));
    }catch(error){showError('Cloudbackups konnten nicht geladen werden',error);}
  }

  function handleBackupClick(event){
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;
    const full=target.closest('#fullBackupV397');
    if(full){event.preventDefault();event.stopImmediatePropagation();createFullBackup(full);return;}
    const weekly=target.closest('[data-weekly-create-v498]');
    if(weekly){event.preventDefault();event.stopImmediatePropagation();createWeeklyCloudBackup(weekly);return;}
    const list=target.closest('[data-weekly-list-v498]');
    if(list){event.preventDefault();event.stopImmediatePropagation();listWeeklyCloudBackups();}
  }

  function installCapture(){
    if(captureInstalled)return true;
    document.addEventListener('click',handleBackupClick,true);
    captureInstalled=true;
    return true;
  }

  function showRestoreNotice(){
    try{const msg=sessionStorage.getItem('modV5061BackupNotice');if(!msg)return;sessionStorage.removeItem('modV5061BackupNotice');setTimeout(()=>modal('Wiederherstellung abgeschlossen ✅',`<div style="line-height:1.55">${esc(msg)}</div>`),450);}catch(_){}
  }

  function verify(){
    const api=window.__modRecoveryHistoryV498;
    return !!(
      api&&api.dbReconnectV506===true&&typeof api.resetDbConnection==='function'&&
      captureInstalled&&
      window.__modBackupStabilityV506?.noAutomaticBlobNavigation===true&&
      window.__modBackupStabilityV506?.weeklyCloudPayloadLightweight===true&&
      window.__modBackupStabilityV506?.memorySafeFullBackupV5062===true
    );
  }

  function install(){
    if(!window.__modRecoveryHistoryV498)return false;
    installCapture();
    window.__modBackupStabilityV506={
      version:BUILD_VERSION,
      patchRevision:PATCH_VERSION,
      verify,
      createFullBackup,
      createWeeklyCloudBackup,
      listWeeklyCloudBackups,
      restoreWeeklyCloud,
      StoreZipWriter,
      indexedDbReconnect:true,
      iphoneZipUsesExplicitHandoff:true,
      noAutomaticBlobNavigation:true,
      fullBackupCaptureInterception:true,
      weeklyCloudPayloadLightweight:true,
      weeklyHistoryStaysLocal:true,
      legacyWeeklyRestoreSupported:true,
      memorySafeFullBackupV5062:true,
      historyCursorStreamingV5062:true,
      nestedGithubSourceArchiveV5062:true,
      crashStageMarkerV5062:true,
      safetyModuleRemainsV498:true,
      dataSemanticsUntouched:true
    };
    showRestoreNotice();
    showInterruptedFullBackup();
    return true;
  }

  const timer=setInterval(()=>{tries++;if(install()||tries>150)clearInterval(timer);},100);
  window.addEventListener('load',()=>setTimeout(install,400));
  window.addEventListener('focus',()=>setTimeout(install,100));
})();