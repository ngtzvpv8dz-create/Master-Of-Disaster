/* V41 · Dingsi Lab Icon-Ische Variacionen: per-user Supabase preference bridge.
   Browser preview works offline; Supabase is authoritative after successful bootstrap.
   Local legacy favorites are uploaded on first authenticated use. */
(function(){
 'use strict';
 var TABLE='dingsi_lab_icon_choices';
 var KEY='mod-dingsi-lab-icon-variacionen-v1';
 var status=document.getElementById('cloud-status');
 var client=null,userId=null,ready=false,connecting=false,writing=false,pending=null;
 var dirtyDuringBootstrap=false;
 var valid=function(v){return /^I(0[1-9]|1[0-2])$/.test(String(v||''));};
 function show(message){if(status)status.textContent=message;}
 function local(){
  try{
   var raw=localStorage.getItem(KEY);
   if(!raw)return null;
   var entry=JSON.parse(raw);
   if(!entry||!valid(entry.variant))return null;
   return normalize({variant:entry.variant,chosen:entry.chosen,liked:entry.liked});
  }catch(_){return null;}
 }
 function normalize(entry){
  if(!entry||!valid(entry.variant))return null;
  var liked=Array.isArray(entry.liked)?entry.liked.filter(valid):[];
  return {variant:entry.variant,chosen:valid(entry.chosen)?entry.chosen:null,liked:[...new Set(liked)]};
 }
 function fromRow(row){
  return normalize({variant:row.active_variant,chosen:row.chosen_variant,liked:row.favorite_variants});
 }
 function broadcast(row){
  window.dispatchEvent(new CustomEvent('mod-icon-lab-cloud-hydrate',{detail:row}));
 }
 function queue(row){
  var clean=normalize(row);
  if(!clean)return;
  pending=clean;
  show('☁️ Auswahl lokal gespeichert · Cloud-Abgleich läuft …');
  if(ready)drain();
 }
 async function drain(){
  if(writing||!ready||!userId||!client)return;
  writing=true;
  try{
   while(pending){
    var item=pending;
    pending=null;
    show('☁️ Auswahl wird in Supabase gespeichert …');
    var payload={
     user_id:userId,
     active_variant:item.variant,
     chosen_variant:item.chosen,
     favorite_variants:item.liked,
     updated_at:new Date().toISOString()
    };
    var response=await client.from(TABLE).upsert(payload,{onConflict:'user_id'});
    if(response.error){
     if(!pending)pending=item;
     show('⚠️ Nur lokal gespeichert · Cloud-Abgleich fehlgeschlagen. Bei Verbindung wird erneut versucht.');
     return;
    }
   }
   show('✓ Icon-Auswahl in Supabase gespeichert · für spätere Abfragen verfügbar');
  }catch(_){
   if(!pending)pending=local();
   show('⚠️ Nur lokal gespeichert · keine Verbindung zur Cloud.');
  }finally{writing=false;}
 }
 async function connect(){
  if(connecting||ready)return;
  connecting=true;
  show('☁️ Cloud-Abgleich wird geprüft …');
  try{
   if(typeof window.getSupabaseClient!=='function')throw Error('client_unavailable');
   client=window.getSupabaseClient();
   var sessionResult=await client.auth.getSession();
   var user=sessionResult&&sessionResult.data&&sessionResult.data.session&&sessionResult.data.session.user;
   if(sessionResult.error)throw sessionResult.error;
   if(!user||!user.id){
    show('⚠️ Nur lokal gespeichert. Bitte in der Haupt-App anmelden und das Dingsi Lab erneut öffnen.');
    return;
   }
   userId=user.id;
   var response=await client.from(TABLE)
    .select('active_variant,chosen_variant,favorite_variants,updated_at')
    .eq('user_id',userId)
    .maybeSingle();
   if(response.error)throw response.error;
   ready=true;
   if(dirtyDuringBootstrap){
    queue(local());
   }else if(response.data){
    // Cloud is authoritative when no local change occurred while loading.
    var cloud=fromRow(response.data);
    if(cloud){broadcast(cloud);show('✓ Icon-Auswahl aus Supabase geladen · für spätere Abfragen verfügbar');}
   }else{
    // Migration of previously local-only favorites and chosen variant from this iPhone.
    var saved=local();
    if(saved)queue(saved);
    else show('✓ Cloud verbunden · noch keine Icon-Auswahl gespeichert');
   }
   drain();
  }catch(_){
   show('⚠️ Nur lokal gespeichert · Cloud-Abgleich nicht verfügbar. Erneuter Versuch bei Verbindung.');
  }finally{connecting=false;}
 }
 window.addEventListener('mod-icon-lab-local-change',function(event){
  var item=normalize(event.detail);
  if(!item)return;
  if(!ready)dirtyDuringBootstrap=true;
  queue(item);
 });
 window.addEventListener('online',function(){if(ready)drain();else connect();});
 document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'){if(ready)drain();else connect();}
 });
 connect();
})();