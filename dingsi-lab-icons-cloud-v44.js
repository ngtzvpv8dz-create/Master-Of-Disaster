/* V44 · Dingsi Lab Cloud: independent secure login when the Icon Lab has no session.
   Uses only HTTPS endpoints belonging to the configured Supabase project.
   User password is NEVER stored or sent anywhere except Supabase Auth. */
(function(){
 'use strict';
 const KEY='mod-dingsi-lab-icon-variacionen-v1';
 const TABLE='dingsi_lab_icon_choices';
 const cfg=window.SUPABASE_CONFIG||{};
 const base=String(cfg.url||'').replace(/\/+$/,'');
 const apiKey=String(cfg.publishableKey||'');
 const domain=base.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
 const sessionKey=domain?'sb-'+domain[1]+'-auth-token':null;
 const status=document.getElementById('cloud-status');
 const retry=document.getElementById('cloud-retry-v43');
 const loginPanel=document.getElementById('cloud-login-v44');
 const loginForm=document.getElementById('cloud-login-form-v44');
 const email=document.getElementById('cloud-login-email-v44');
 const password=document.getElementById('cloud-login-password-v44');
 const loginButton=document.getElementById('cloud-login-submit-v44');
 let token=null,userId=null,ready=false,connecting=false,writing=false,queued=null,dirty=false;
 const valid=v=>/^I(0[1-9]|1[0-2])$/.test(String(v||''));
 function show(s){if(status)status.textContent=s;}
 function norm(v){
  if(!v||!valid(v.variant))return null;
  return {variant:v.variant,chosen:valid(v.chosen)?v.chosen:null,
   liked:[...new Set(Array.isArray(v.liked)?v.liked.filter(valid):[])]};
 }
 function local(){
  try{const data=localStorage.getItem(KEY);return data?norm(JSON.parse(data)):null;}
  catch(_){return null;}
 }
 function session(){
  if(!sessionKey)return null;
  try{
   const o=JSON.parse(localStorage.getItem(sessionKey)||'null');
   return o&&(o.currentSession||o)||null;
  }catch(_){return null;}
 }
 function saveSession(s){
  if(!s||!s.access_token||!s.user||!s.user.id)throw Error('Ungültige Antwort vom Anmeldeserver');
  const next={
   ...s,
   expires_at:Number(s.expires_at)||Math.floor(Date.now()/1000)+Number(s.expires_in||3600),
   token_type:s.token_type||'bearer'
  };
  localStorage.setItem(sessionKey,JSON.stringify(next));
  return next;
 }
 function configCheck(){
  if(!domain||!apiKey)throw Error('Supabase-Konfiguration fehlt');
 }
 function reason(e){
  if(e&&e.message)return String(e.message).slice(0,150);
  return 'Verbindung fehlgeschlagen';
 }
 function displayLogin(message){
  ready=false;
  if(loginPanel)loginPanel.hidden=false;
  if(retry){retry.hidden=false;retry.textContent='🔑 Anmeldung öffnen';}
  show('⚠️ '+(message||'Hier fehlt noch die Supabase-Anmeldung.')+' · Auswahl #'+(local()?.chosen||local()?.variant||'?')+' bleibt erhalten.');
 }
 function displayError(message){
  if(retry){retry.hidden=false;retry.textContent='↻ Erneut synchronisieren';}
  show('⚠️ '+message+' · Vormerkung bleibt auf diesem Gerät erhalten.');
 }
 function displaySuccess(message){
  if(loginPanel)loginPanel.hidden=true;
  if(retry)retry.hidden=true;
  show('✓ '+message);
 }
 async function bounded(url,options){
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timer;
  const deadline=new Promise((_,reject)=>{
   timer=setTimeout(()=>{if(controller)controller.abort();reject(Error('Zeitüberschreitung nach 9 Sekunden'));},9000);
  });
  try{return await Promise.race([fetch(url,{cache:'no-store',...options,...(controller?{signal:controller.signal}:{})}),deadline]);}
  finally{clearTimeout(timer);}
 }
 async function fetchJson(url,options){
  const response=await bounded(url,options);
  const data=await response.json().catch(()=>null);
  if(!response.ok){
   const error=new Error((data&&data.msg)|| (data&&data.error_description)|| (data&&data.message)||'HTTP '+response.status);
   error.status=response.status;
   throw error;
  }
  return data;
 }
 function apiHeaders(write){
  return {'apikey':apiKey,'Authorization':'Bearer '+token,'Accept':'application/json',
   ...(write?{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=representation'}:{})};
 }
 async function api(method,body){
  let url=base+'/rest/v1/'+TABLE;
  const options={method,headers:apiHeaders(method==='POST')};
  if(method==='GET')url+='?select=active_variant,chosen_variant,favorite_variants&user_id=eq.'+encodeURIComponent(userId)+'&limit=1';
  else{url+='?on_conflict=user_id';options.body=JSON.stringify(body);}
  return await fetchJson(url,options);
 }
 async function authRequest(grant,credentials){
  return fetchJson(base+'/auth/v1/token?grant_type='+grant,{
   method:'POST',headers:{'apikey':apiKey,'Content-Type':'application/json'},
   body:JSON.stringify(credentials)
  });
 }
 async function credentials(){
  configCheck();
  let s=session();
  if(!s||!s.user||!s.user.id)throw Object.assign(Error('Bitte einmal hier im Icon Lab anmelden'),{loginRequired:true});
  if(Number(s.expires_at||0)<=Date.now()/1000+35){
   if(!s.refresh_token)throw Object.assign(Error('Anmeldung abgelaufen'),{loginRequired:true});
   try{
    show('☁️ Bestehende Anmeldung wird erneuert …');
    s=saveSession(await authRequest('refresh_token',{refresh_token:s.refresh_token}));
   }catch(e){throw Object.assign(Error('Anmeldung abgelaufen. Bitte hier neu anmelden'),{loginRequired:true});}
  }
  token=s.access_token;userId=s.user.id;
 }
 async function push(){
  if(writing||!ready||!queued)return;
  writing=true;
  try{
   while(queued){
    const item=queued;queued=null;
    show('☁️ Speichere deine Auswahl in Supabase …');
    const payload={user_id:userId,active_variant:item.variant,chosen_variant:item.chosen,
     favorite_variants:item.liked,updated_at:new Date().toISOString()};
    try{await api('POST',payload);}
    catch(e){
     if(!queued)queued=item;
     if(e.status===401||e.status===403){
      ready=false;displayLogin('Die Cloud-Anmeldung muss erneuert werden');
     }else{displayError(reason(e));}
     return;
    }
   }
   displaySuccess('In Supabase gespeichert · deine Auswahl ist jetzt abrufbar');
  }finally{writing=false;}
 }
 async function connect(){
  if(connecting||ready)return;
  connecting=true;
  show('☁️ Prüfe Cloud-Anmeldung …');
  const changed=dirty;
  try{
   await credentials();
   let rows;
   try{rows=await api('GET');}
   catch(e){
    if(e.status===401||e.status===403)throw Object.assign(Error('Cloud-Anmeldung ungültig. Bitte hier anmelden'),{loginRequired:true});
    throw e;
   }
   ready=true;
   if(dirty!==changed){queued=local()||queued;}
   else if(Array.isArray(rows)&&rows[0]&&!dirty&&!queued){
    const item=norm({variant:rows[0].active_variant,chosen:rows[0].chosen_variant,liked:rows[0].favorite_variants});
    if(item)window.dispatchEvent(new CustomEvent('mod-icon-lab-cloud-hydrate',{detail:item}));
    displaySuccess('Auswahl aus Supabase geladen');
   }else if(!queued){
    queued=local();
   }
   if(queued)await push();
   else if(!rows||!rows.length)displaySuccess('Cloud verbunden, aber noch keine Variante vorgemerkt');
  }catch(e){
   if(e.loginRequired)displayLogin(reason(e));
   else displayError(reason(e));
  }finally{connecting=false;}
 }
 function changed(v){
  const item=norm(v);
  if(!item)return;
  dirty=true;queued=item;
  if(ready)push();
  else if(!connecting)connect();
 }
 window.addEventListener('mod-icon-lab-local-change',e=>changed(e.detail));
 if(retry)retry.addEventListener('click',()=>{
  if(loginPanel&&!loginPanel.hidden){loginPanel.hidden=false;email?.focus();return;}
  if(!session()||!session()?.access_token){displayLogin('Bitte hier im Icon Lab anmelden');email?.focus();}
  else{ready=false;connect();}
 });
 if(loginForm)loginForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const address=String(email?.value||'').trim();
  const secret=String(password?.value||'');
  if(!address||!secret){displayLogin('Bitte E-Mail und Passwort eingeben');return;}
  if(loginButton)loginButton.disabled=true;
  show('☁️ Melde dich sicher bei Supabase an …');
  try{
   configCheck();
   const response=await authRequest('password',{email:address,password:secret});
   saveSession(response);
   if(password)password.value='';
   ready=false;queued=local()||queued;dirty=true;
   await connect();
  }catch(e){
   if(e.status===400||e.status===401)displayLogin('E-Mail oder Passwort nicht akzeptiert');
   else displayLogin(reason(e));
  }finally{if(loginButton)loginButton.disabled=false;}
 });
 window.addEventListener('online',()=>{if(ready)push();else connect();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(ready)push();else connect();}});
 connect();
})();