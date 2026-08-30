/* V506.1 · BACKUP- UND DATENSICHERHEITS-STABILITÄT
   - V498 öffnet eine geschlossene IndexedDB-Verbindung automatisch neu.
   - Vollbackup wird niemals mehr automatisch per Blob-Link ausgelöst.
   - Die fertige ZIP wird erst nach einem echten zweiten Tipp per Share-Sheet übergeben.
   - Wochen-Cloudbackups speichern ab V506.1 nur den wiederherstellbaren App-Stand,
     nicht mehr die komplette 7-Tage-Historie mit hunderten Voll-Snapshots in einer JSON-Zeile.
   - Bestehende ältere Wochenstände bleiben weiterhin wiederherstellbar.
*/
(function(){
  'use strict';
  if(window.__modBackupStabilityV506?.patchRevision==='V506.1')return;

  const BUILD_VERSION='V506';
  const PATCH_VERSION='V506.1';
  const WEEKLY_PREFIX='weekly_complete_backup_v1_';
  const WEEKLY_KEEP=12;
  const LIVE_LOG_KEY='masterOfDisasterLiveLogV453';
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

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const nowIso=()=>new Date().toISOString();
  const currentBuild=()=>String(window.__MOD_BUILD__?.version||BUILD_VERSION);

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
    console.error(`V506.1 ${title}:`,error);
    modal(title,`<div style="line-height:1.55;opacity:.88">${esc(text)}</div>`);
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
      console.warn('V506.1 Share-Sheet:',error);
    }
  }

  function presentFullBackup(blob,filename,summary){
    activeObjectUrl=URL.createObjectURL(blob);
    const root=modal('VOLLBACKUP BEREIT ✅',`<div style="padding:4px 2px 12px;line-height:1.55">${esc(summary)}<br><br><span style="opacity:.72">Die ZIP ist fertig. Nichts wird automatisch geöffnet oder heruntergeladen. Erst der nächste echte Tipp übergibt die Datei an iOS.</span></div><button type="button" data-share-v5061 style="width:100%;color:inherit;border:1px solid rgba(224,75,75,.7);background:rgba(224,75,75,.12);border-radius:10px;padding:11px;font:inherit;font-weight:800">📤 ZIP TEILEN / IN DATEIEN SICHERN</button><a data-download-v5061 href="${esc(activeObjectUrl)}" download="${esc(filename)}" style="display:none;margin-top:9px;text-align:center;color:inherit;border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.05);border-radius:10px;padding:11px;text-decoration:none;font-weight:800">⬇️ ZIP MANUELL ÖFFNEN / LADEN</a>`);
    const share=root.querySelector('[data-share-v5061]');
    const fallback=root.querySelector('[data-download-v5061]');
    share?.addEventListener('click',()=>shareBackupFile(blob,filename,share,fallback));
  }

  async function createFullBackup(button){
    if(fullBusy)return;
    fullBusy=true;
    try{
      setButtonState(button,'⏳ BACKUP WIRD GEBAUT…',true);
      if(typeof JSZip!=='function')throw new Error('ZIP-Bibliothek wurde nicht geladen.');
      if(!navigator.onLine)throw new Error('Für das Code-Vollbackup wird Internet benötigt.');
      const api=window.__modRecoveryHistoryV498;
      if(!api?.exportPackage)throw new Error('Datensicherheitsmodul V498 ist noch nicht bereit.');

      const stamp=berlinParts(),zip=new JSZip(),appFolder=zip.folder('APP'),dataFolder=zip.folder('DATA');
      const treeRes=await fetch('https://api.github.com/repos/ngtzvpv8dz-create/Master-Of-Disaster/git/trees/main?recursive=1',{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
      if(!treeRes.ok)throw new Error(`GitHub-Dateiliste konnte nicht geladen werden (${treeRes.status}).`);
      const tree=await treeRes.json();
      const files=(tree.tree||[]).filter(x=>x?.type==='blob'&&x.path),failed=[];
      for(let i=0;i<files.length;i++){
        const item=files[i];
        setButtonState(button,`⏳ CODE ${i+1}/${files.length}…`,true);
        try{
          const url='https://raw.githubusercontent.com/ngtzvpv8dz-create/Master-Of-Disaster/main/'+item.path.split('/').map(encodeURIComponent).join('/');
          const res=await fetch(url,{cache:'no-store'});
          if(!res.ok)throw new Error(String(res.status));
          appFolder.file(item.path,await res.arrayBuffer(),{binary:true});
        }catch(error){failed.push(`${item.path} · ${error?.message||error}`);}
      }

      const complete=createCompleteBackupPayload();
      complete.masterVersion=currentBuild();
      complete.backupPatch=PATCH_VERSION;
      complete.fullBackupCreatedAt=nowIso();
      const safety=await api.exportPackage();
      const local=collectAllMasterLocalStorage();
      dataFolder.file('complete-data-backup.json',JSON.stringify(complete,null,2));
      dataFolder.file('localstorage-master-of-disaster.json',JSON.stringify(local,null,2));
      dataFolder.file('recovery-history-v498.json',JSON.stringify(safety,null,2));
      dataFolder.file('live-log-7-days.json',JSON.stringify(safety.logs||[],null,2));
      zip.file('BACKUP-INFO.txt',[
        'MASTER OF DISASTER · VOLLSTÄNDIGES KOMPLETT-BACKUP',
        '====================================================',
        `Build: ${currentBuild()} · Backup-Hotfix ${PATCH_VERSION}`,
        `Erstellt: ${stamp.dateLabel} ${stamp.clock} Europe/Berlin`,
        `Git-Stand/Tree: ${tree.sha||'unbekannt'}`,
        `Repo-Dateien: ${files.length-failed.length}/${files.length}`,
        `Wiederherstellungspunkte: ${(safety.points||[]).length}`,
        `7-Tage-Logeinträge: ${(safety.logs||[]).length}`,
        '',
        failed.length?'Fehlgeschlagene Repo-Dateien:\n'+failed.join('\n'):'Keine fehlgeschlagenen Repo-Dateien.'
      ].join('\n'));

      setButtonState(button,'⏳ ZIP WIRD GEPACKT…',true);
      const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
      const filename=`Master-of-Disaster_${currentBuild()}_Vollbackup_${stamp.file}.zip`;
      const summary=`Code + App-Daten + ${(safety.points||[]).length} Wiederherstellungspunkte + ${(safety.logs||[]).length} Logeinträge wurden in die ZIP gepackt.`;
      presentFullBackup(blob,filename,summary);
      setButtonState(button,'✅ VOLLSTÄNDIGES KOMPLETT-BACKUP',false);
    }catch(error){
      setButtonState(button,'📦 VOLLSTÄNDIGES KOMPLETT-BACKUP',false);
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
    return {id:`rp-${Date.now()}-v5061-${Math.random().toString(36).slice(2,7)}`,at:nowIso(),version:PATCH_VERSION,type:'guard',label,area:'EDIT',snapshot:api.captureSnapshot(),delta:null,directState:true};
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
      window.__modBackupStabilityV506?.weeklyCloudPayloadLightweight===true
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
      indexedDbReconnect:true,
      iphoneZipUsesExplicitHandoff:true,
      noAutomaticBlobNavigation:true,
      fullBackupCaptureInterception:true,
      weeklyCloudPayloadLightweight:true,
      weeklyHistoryStaysLocal:true,
      legacyWeeklyRestoreSupported:true,
      safetyModuleRemainsV498:true,
      dataSemanticsUntouched:true
    };
    showRestoreNotice();
    return true;
  }

  const timer=setInterval(()=>{tries++;if(install()||tries>150)clearInterval(timer);},100);
  window.addEventListener('load',()=>setTimeout(install,400));
  window.addEventListener('focus',()=>setTimeout(install,100));
})();