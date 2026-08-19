/* V401 · IPHONE-FIRST OFFLINE BACKUP
   Ziel: Ein Gerät, localStorage ist Master. Supabase ist ausschließlich Sicherung.
   - Keine Multi-Device-Synchronisation.
   - Kein automatisches Cloud→Local.
   - Jede lokale Änderung wird lokal sofort gespeichert.
   - Cloud-Backup erfolgt gebündelt 10 Sekunden nach der LETZTEN lokalen Änderung, nicht als Endlosschleife.
   - Offline-Änderungen bleiben pending und werden beim Wieder-online-Gehen automatisch gesichert.
   - Nach jedem Upload wird der Cloud-Snapshot zurückgelesen und vollständig verifiziert.
   - Zusätzlich wird pro Kalendertag ein Tages-Backup in Supabase geführt und am selben Tag auf den letzten sicheren Stand aktualisiert.
*/
(function(){
  const LIVE_KEY="live_complete_backup_v1";
  const DAILY_PREFIX="daily_complete_backup_v400_";
  /* V400-Schlüssel bleiben absichtlich bestehen, damit bestehender Pending-/Last-OK-Status nicht verloren geht. */
  const PENDING_KEY="masterOfDisasterIphoneBackupPendingV400";
  const LAST_OK_KEY="masterOfDisasterIphoneBackupLastOkV400";
  const LAST_DAILY_KEY="masterOfDisasterIphoneBackupDailyDateV400";
  const AUTO_BACKUP_DELAY_MS=10000;
  let busy=false;
  let timer=null;

  function setPending(v){ safeStorageSet(PENDING_KEY,v?"1":"0"); }
  function isPending(){ return safeStorageGet(PENDING_KEY)==="1"; }

  function berlinDateKey(){
    try{
      return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    }catch(_){ return new Date().toISOString().slice(0,10); }
  }

  function payload(){
    const p=createCompleteBackupPayload();
    if(!p||!p.state) throw new Error("Lokaler Komplett-Snapshot konnte nicht erstellt werden.");
    p.masterVersion="V401";
    p.backupMode="iphone-local-master";
    p.cloudSnapshotVersion=401;
    p.cloudSnapshotSavedAt=new Date().toISOString();
    return p;
  }

  function canonical(value){
    if(Array.isArray(value)) return value.map(canonical);
    if(value&&typeof value==="object"){
      const out={}; Object.keys(value).sort().forEach(k=>{out[k]=canonical(value[k]);}); return out;
    }
    return value===undefined?null:value;
  }

  function domain(state){
    state=state&&typeof state==="object"?state:{};
    return {
      tasks:Array.isArray(state.tasks)?state.tasks:[],
      archive:Array.isArray(state.archive)?state.archive:[],
      nextArchiveNumber:Number(state.nextArchiveNumber)||1,
      weightState:state.weightState&&typeof state.weightState==="object"?state.weightState:{},
      weightPhases:Array.isArray(state.weightPhases)?state.weightPhases:[]
    };
  }

  async function hashState(state){
    const text=JSON.stringify(canonical(domain(state)));
    if(window.crypto&&window.crypto.subtle&&typeof TextEncoder!=="undefined"){
      const bytes=new TextEncoder().encode(text);
      const digest=await crypto.subtle.digest("SHA-256",bytes);
      return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
    }
    let h=2166136261; for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);} return "fnv1a-"+(h>>>0).toString(16);
  }

  async function session(){
    const client=getSupabaseClient();
    if(!client) throw new Error("Supabase-Client fehlt.");
    const {data,error}=await client.auth.getSession();
    if(error) throw error;
    const user=data&&data.session&&data.session.user;
    if(!user||!user.id) return null;
    return {client,userId:user.id};
  }

  async function replaceSnapshot(client,userId,key,p){
    let r=await client.from("legacy_metadata").delete().eq("user_id",userId).eq("key",key);
    if(r.error) throw r.error;
    r=await client.from("legacy_metadata").insert([{user_id:userId,key,payload:p}]);
    if(r.error) throw r.error;
  }

  async function verifyLive(client,userId,localPayload){
    const {data,error}=await client.from("legacy_metadata").select("payload").eq("user_id",userId).eq("key",LIVE_KEY).limit(1);
    if(error) throw error;
    const row=Array.isArray(data)&&data.length?data[0]:null;
    if(!row||!row.payload||!row.payload.state) throw new Error("Cloud-Verifikation: Live-Backup fehlt.");
    const [a,b]=await Promise.all([hashState(localPayload.state),hashState(row.payload.state)]);
    if(a!==b) throw new Error("Cloud-Verifikation fehlgeschlagen: gesicherter Stand weicht lokal ab.");
  }

  function setUi(status,label,detail,reason){
    supabaseLiveSyncState={...(supabaseLiveSyncState||{}),status,label,detail,lastReason:reason,lastSyncAt:new Date().toISOString()};
    if(currentTab==="dev"&&typeof render==="function") render();
  }

  async function backupNow(manual=false){
    if(busy) return;
    if(timer){ clearTimeout(timer); timer=null; }
    if(!navigator.onLine){
      setPending(true);
      setUi("warn","OFFLINE · LOKAL SICHER 📱","Änderungen sind lokal gespeichert. Das Cloud-Backup wird automatisch nachgeholt, sobald das iPhone wieder online ist.","v401-offline");
      addStatus();
      return;
    }
    busy=true;
    try{
      const s=await session();
      if(!s){
        setPending(true);
        setUi("warn","CLOUD-BACKUP WARTET","Supabase-Login fehlt. Lokal ist alles gespeichert.","v401-no-session");
        return;
      }
      const p=payload();
      const integrity=typeof collectDataIntegrityReport==="function"?collectDataIntegrityReport():{ok:true};
      if(integrity&&integrity.ok===false) throw new Error("Lokale Datenprüfung meldet Fehler. Cloud-Backup wurde vorsichtshalber nicht überschrieben.");

      await replaceSnapshot(s.client,s.userId,LIVE_KEY,p);
      await verifyLive(s.client,s.userId,p);

      const day=berlinDateKey();
      await replaceSnapshot(s.client,s.userId,DAILY_PREFIX+day,p);
      safeStorageSet(LAST_DAILY_KEY,day);
      safeStorageSet(LAST_OK_KEY,new Date().toISOString());
      setPending(false);
      setUi("ok","IPHONE-BACKUP SICHER ✅","Lokaler iPhone-Stand wurde vollständig in Supabase gesichert und zurückgelesen verifiziert. Keine Multi-Device-Synchronisation aktiv.",manual?"v401-manual-backup":"v401-auto-backup");
    }catch(error){
      setPending(true);
      const text=error&&error.message?error.message:String(error||"Unbekannter Backup-Fehler");
      setUi("warn","CLOUD-BACKUP AUSSTEHEND · LOKAL SICHER 📱",text,"v401-backup-error");
      console.warn("V401 iPhone backup:",error);
    }finally{
      busy=false;
      addStatus();
    }
  }

  function schedule(reason="local-save"){
    setPending(true);
    if(reason){ try{supabaseLiveSyncReasons.add(String(reason));}catch(_){} }
    if(!navigator.onLine){
      setUi("warn","OFFLINE · LOKAL SICHER 📱","Änderung lokal gespeichert. Cloud-Backup wartet auf Internet.","v401-offline-pending");
      addStatus();
      return;
    }
    if(timer) clearTimeout(timer);
    timer=setTimeout(()=>{timer=null;backupNow(false);},AUTO_BACKUP_DELAY_MS);
    addStatus();
  }

  try{
    if(typeof supabaseLiveSyncTimer!=="undefined"&&supabaseLiveSyncTimer){clearTimeout(supabaseLiveSyncTimer);supabaseLiveSyncTimer=null;}
    if(typeof supabaseLiveSyncReasons!=="undefined"&&supabaseLiveSyncReasons&&supabaseLiveSyncReasons.clear)supabaseLiveSyncReasons.clear();
  }catch(_){}

  scheduleSupabaseLiveSync=schedule;
  runSupabaseLiveSync=async function(manual=false){return backupNow(Boolean(manual));};

  function addStatus(){
    if(currentTab!=="dev") return;
    ["offlineSyncStatusV396","syncStatusV399","iphoneBackupStatusV400","iphoneBackupStatusV401"].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();});
    const button=Array.from(document.querySelectorAll("button")).find(btn=>/JETZT SYNCHRONISIEREN|JETZT SICHERN/i.test(btn.textContent||""));
    if(!button||!button.parentElement) return;
    button.textContent="☁️ JETZT SICHERN · SOFORT";
    const box=document.createElement("div");
    box.id="iphoneBackupStatusV401";
    box.style.cssText="margin-top:10px;padding:10px;border:1px solid #30383e;border-radius:10px;background:#0f1315;font-size:10px;line-height:1.55;";
    const last=safeStorageGet(LAST_OK_KEY);
    const shown=last&&typeof formatSupabaseSyncTimestamp==="function"?formatSupabaseSyncTimestamp(last):(last||"NOCH KEINS");
    box.innerHTML=`<strong>📱 IPHONE · LOCAL MASTER · V401</strong><br>`+
      `NETZ · ${navigator.onLine?"ONLINE ✅":"OFFLINE ⚠️"}<br>`+
      `CLOUD-BACKUP AUSSTEHEND · ${isPending()?"JA ⚠️":"NEIN ✅"}<br>`+
      `AUTO-BACKUP · 10 SEK. NACH LETZTER ÄNDERUNG ✅<br>`+
      `LETZTES SICHERES CLOUD-BACKUP · ${escapeHtml(String(shown))}<br>`+
      `<span style="opacity:.72">Supabase ist Sicherung. Kein automatisches Cloud→Local und keine Geräte-Synchronisation.</span>`;
    button.insertAdjacentElement("afterend",box);
  }

  const previousRender=render;
  render=function(){
    previousRender();
    const weight=document.getElementById("weightContainer");
    if(weight) weight.style.display=(currentTab==="all"||currentTab==="today")?"":"none";
    if(currentTab==="dev") setTimeout(addStatus,0);
  };

  window.addEventListener("online",()=>setTimeout(()=>{if(isPending())backupNow(false);},600));
  window.addEventListener("focus",()=>setTimeout(()=>{if(isPending()&&navigator.onLine)backupNow(false);},350));
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&isPending()&&navigator.onLine)setTimeout(()=>backupNow(false),350);});
  window.addEventListener("load",()=>setTimeout(()=>{addStatus();if(isPending()&&navigator.onLine)backupNow(false);},500));

  window.__modIphoneBackupV401={backupNow,isPending,berlinDateKey,autoBackupDelayMs:AUTO_BACKUP_DELAY_MS};
})();