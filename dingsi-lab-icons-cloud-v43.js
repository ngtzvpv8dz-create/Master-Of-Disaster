/* V43 Dingsi Lab Icon choices: bounded Supabase REST sync, no stuck auth.getSession.
   Uses the existing user's persisted auth session, publishable key, and row-level security.
   Never transmits secrets, tokens, or profile details to a third-party server.
   User can manually retry, with visible error reasons and a hard timeout. */
(function(){
 'use strict';
 var TABLE='dingsi_lab_icon_choices', KEY='mod-dingsi-lab-icon-variacionen-v1';
 var status=document.getElementById('cloud-status'),retry=document.getElementById('cloud-retry-v43');
 var config=window.SUPABASE_CONFIG||{};
 var url=String(config.url||'').replace(/\/+$/,''),key=String(config.publishableKey||'');
 var ref=url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
 var authKey=ref?'sb-'+ref[1]+'-auth-token':null;
 var ready=false,active=false,busy=false,pending=null,dirty=false,token=null,userId=null;
 var initialized=false,needsRetry=false,revision=0;
 var valid=function(v){return /^I(0[1-9]|1[0-2])$/.test(String(v||''));};
 function show(s){if(status)status.textContent=s;}
 function normalize(s){
  if(!s||!valid(s.variant))return null;
  return {variant:s.variant,chosen:valid(s.chosen)?s.chosen:null,
   liked:[...new Set(Array.isArray(s.liked)?s.liked.filter(valid):[])]};
 }
 function local(){
  try{var raw=localStorage.getItem(KEY);return raw?normalize(JSON.parse(raw)):null;}
  catch(_){return null;}
 }
 function fromRow(r){return normalize({variant:r.active_variant,chosen:r.chosen_variant,liked:r.favorite_variants});}
 function storedSession(){
  if(!authKey)return null;
  try{
   var raw=localStorage.getItem(authKey);
   var obj=raw&&JSON.parse(raw);
   var s=obj&&(obj.currentSession||obj);
   if(!s||!s.access_token||!s.user||!s.user.id)return null;
   var expiry=Number(s.expires_at)||0;
   if(expiry&&expiry<=Date.now()/1000+15)return null;
   return {token:s.access_token,userId:s.user.id};
  }catch(_){return null;}
 }
 function reason(error){
  if(error&&error.name==='AbortError')return 'Zeitüberschreitung';
  return error&&error.message?String(error.message).slice(0,110):'Netzwerkproblem';
 }
 async function bounded(url,options){
  var control=typeof AbortController==='function'?new AbortController():null;
  var timer;
  var timeout=new Promise(function(_,reject){
   timer=setTimeout(function(){if(control)control.abort();reject(new Error('Zeitüberschreitung nach 9 Sekunden'));},9000);
  });
  try{
   return await Promise.race([
    fetch(url,Object.assign({cache:'no-store'},options,control?{signal:control.signal}:{})),
    timeout
   ]);
  }finally{clearTimeout(timer);}
 }
 function headers(write){
  return Object.assign({'apikey':key,'Authorization':'Bearer '+token,'Accept':'application/json'},
   write?{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=representation'}:{});
 }
 async function api(method,body){
  var endpoint=url+'/rest/v1/'+TABLE;
  var opts={method:method,headers:headers(method==='POST')};
  if(method==='GET')endpoint+='?select=active_variant,chosen_variant,favorite_variants,updated_at&user_id=eq.'+encodeURIComponent(userId)+'&limit=1';
  else {endpoint+='?on_conflict=user_id';opts.body=JSON.stringify(body);}
  var response=await bounded(endpoint,opts);
  if(!response.ok)throw Error('HTTP '+response.status+' beim '+(method==='GET'?'Lesen':'Speichern'));
  return response.json();
 }
 function requireRetry(msg){
  needsRetry=true;
  show('⚠️ '+msg+' · Vormerkung bleibt lokal erhalten.');
  if(retry)retry.hidden=false;
 }
 function getSessionOrThrow(){
  if(!ref||!key)throw Error('Supabase-Konfiguration fehlt');
  var s=storedSession();
  if(!s)throw Error('Keine gültige App-Anmeldung gefunden. Bitte Haupt-App öffnen und dann hier erneut versuchen');
  token=s.token;userId=s.userId;
 }
 async function bootstrap(){
  if(active||ready)return;
  active=true;needsRetry=false;
  if(retry)retry.hidden=true;
  show('☁️ Verbinde mit Supabase …');
  var startRevision=revision;
  try{
   getSessionOrThrow();
   var rows=await api('GET');
   ready=true;initialized=true;
   if(dirty||revision!==startRevision){
    // A user change occurred while loading: never overwrite it with server data.
    pending=local()||pending;
   }else if(Array.isArray(rows)&&rows[0]){
    var saved=fromRow(rows[0]);
    if(saved){
     window.dispatchEvent(new CustomEvent('mod-icon-lab-cloud-hydrate',{detail:saved}));
     show('✓ Icon-Auswahl aus Supabase geladen');
    }
   }else{
    pending=local();
   }
   if(pending)await flush();
   else if(!rows||!rows.length)show('✓ Cloud verbunden · keine Variante gespeichert');
  }catch(e){
   ready=false;
   requireRetry(reason(e));
  }finally{active=false;}
 }
 async function flush(){
  if(busy||!ready||!pending)return;
  busy=true;
  try{
   while(pending){
    var item=pending;pending=null;
    show('☁️ Speichere deine Icon-Auswahl …');
    var payload={
     user_id:userId,active_variant:item.variant,
     chosen_variant:item.chosen,
     favorite_variants:item.liked,
     updated_at:new Date().toISOString()
    };
    try{
     await api('POST',payload);
    }catch(e){
     if(!pending)pending=item;
     ready=false;
     requireRetry(reason(e));
     return;
    }
   }
   needsRetry=false;
   if(retry)retry.hidden=true;
   show('✓ In Supabase gespeichert · ich kann deine Vormerkungen jetzt abfragen');
  }finally{busy=false;}
 }
 function changed(detail){
  var item=normalize(detail);
  if(!item)return;
  revision++;dirty=true;pending=item;
  show('☁️ Lokale Auswahl vorhanden · Cloud-Abgleich wird vorbereitet …');
  if(ready)flush();
  else if(!active)bootstrap();
 }
 window.addEventListener('mod-icon-lab-local-change',function(e){changed(e.detail);});
 if(retry)retry.addEventListener('click',function(){
  ready=false;active=false;token=null;userId=null;pending=local()||pending;
  bootstrap();
 });
 window.addEventListener('online',function(){
  if(ready)flush();else bootstrap();
 });
 document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'){if(ready)flush();else bootstrap();}
 });
 // Bounded REST bootstrap. The UI must never say "läuft" forever.
 bootstrap();
})();