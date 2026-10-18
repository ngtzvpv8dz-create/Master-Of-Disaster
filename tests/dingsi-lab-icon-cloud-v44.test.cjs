'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','dingsi-lab-icons-cloud-v44.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','dingsi-lab-icons.html'),'utf8');
const KEY='mod-dingsi-lab-icon-variacionen-v1',AUTH='sb-oktpzwhhndsbikkeelot-auth-token';
const tick=()=>new Promise(r=>setTimeout(r,0));
function app({storedAuth=null,local={variant:'I11',chosen:'I11',liked:['I11']},failAuth=false}={}){
 const storage=new Map(),handlers={},requests=[],status={textContent:''};
 if(local)storage.set(KEY,JSON.stringify(local));
 if(storedAuth)storage.set(AUTH,JSON.stringify(storedAuth));
 const retry={hidden:true,textContent:'',addEventListener(kind,fn){handlers['retry:'+kind]=fn;}};
 const panel={hidden:true};
 const email={value:'',focus(){handlers.focused='email'}};
 const password={value:''};
 const submit={disabled:false};
 const form={addEventListener(kind,fn){handlers['form:'+kind]=fn;}};
 const node={
  'cloud-status':status,'cloud-retry-v43':retry,'cloud-login-v44':panel,
  'cloud-login-form-v44':form,'cloud-login-email-v44':email,
  'cloud-login-password-v44':password,'cloud-login-submit-v44':submit
 };
 const document={visibilityState:'visible',getElementById(id){return node[id]||null;},
  addEventListener(kind,fn){handlers['doc:'+kind]=fn;}};
 let table=[];
 const window={
  SUPABASE_CONFIG:{url:'https://oktpzwhhndsbikkeelot.supabase.co',publishableKey:'sb_publishable_dummy'},
  addEventListener(kind,fn){handlers['window:'+kind]=fn;},
  dispatchEvent(e){if(e.type==='mod-icon-lab-cloud-hydrate')handlers.hydrate=e.detail;}
 };
 const localStorage={getItem(k){return storage.get(k)||null},setItem(k,v){storage.set(k,v)}};
 class CustomEvent{constructor(type,params){this.type=type;this.detail=params.detail;}}
 const issuedSession={access_token:'user-bearer',refresh_token:'refresh-v44',user:{id:'test-user'},expires_in:3600,token_type:'bearer'};
 async function fetch(url,opts){
  const body=opts.body&&JSON.parse(opts.body);
  requests.push({url,method:opts.method,body});
  if(url.includes('/auth/v1/token?grant_type=password')){
   assert.equal(body.email,'test@example.com');
   assert.equal(body.password,'demo-password');
   if(failAuth)return {ok:false,status:400,async json(){return {error_description:'bad credentials'}}};
   return {ok:true,async json(){return issuedSession;}};
  }
  if(url.includes('/auth/v1/token?grant_type=refresh_token')){
   assert.equal(body.refresh_token,'refresh-old');
   return {ok:true,async json(){return issuedSession;}};
  }
  assert.match(url,/\/rest\/v1\/dingsi_lab_icon_choices/);
  assert.equal(opts.headers.apikey,'sb_publishable_dummy');
  assert.equal(opts.headers.Authorization,'Bearer user-bearer');
  if(opts.method==='GET')return {ok:true,async json(){return table;}};
  assert.equal(opts.method,'POST');
  table=[body];
  return {ok:true,async json(){return table;}};
 }
 new vm.Script(src).runInNewContext({window,document,localStorage,CustomEvent,fetch,setTimeout,clearTimeout,AbortController,Date,Error,Set});
 return {status,retry,panel,email,password,submit,form,handlers,requests,storage,table:()=>table,
  async signin(){
   email.value='test@example.com';password.value='demo-password';
   const promise=handlers['form:submit']({preventDefault(){}});
   await promise;await tick();await tick();
  }
 };
}
test('v44 interface includes real action for missing app session',()=>{
 assert.match(html,/id="cloud-login-form-v44"/);
 assert.match(html,/type="email"/);
 assert.match(html,/type="password"/);
 assert.match(html,/dingsi-lab-icons-cloud-v44\.js\?v=44/);
 assert.doesNotThrow(()=>new vm.Script(src));
});
test('missing session opens a functional login panel and retry focuses email',async()=>{
 const x=app();
 await tick();await tick();
 assert.equal(x.panel.hidden,false);
 assert.equal(x.retry.hidden,false);
 assert.match(x.status.textContent,/Bitte einmal hier im Icon Lab anmelden/);
 x.handlers['retry:click']();
 assert.equal(x.handlers.focused,'email');
 assert.equal(x.requests.length,0);
});
test('one-time secure login saves existing chosen and favorite variant #I11',async()=>{
 const x=app();
 await tick();await tick();
 await x.signin();
 assert.equal(x.panel.hidden,true);
 assert.equal(x.retry.hidden,true);
 assert.match(x.status.textContent,/In Supabase gespeichert/);
 assert.equal(x.table().length,1);
 assert.equal(x.table()[0].chosen_variant,'I11');
 assert.deepEqual(Array.from(x.table()[0].favorite_variants),['I11']);
 assert.equal(x.password.value,'');
 assert(x.storage.has(AUTH));
 assert(![...x.storage.values()].some(v=>String(v).includes('demo-password')),'Password must not be stored');
});
test('expired session is refreshed and uploaded without asking for password',async()=>{
 const x=app({storedAuth:{access_token:'expired',refresh_token:'refresh-old',user:{id:'test-user'},expires_at:1}});
 await tick();await tick();await tick();
 assert.equal(x.panel.hidden,true);
 assert(x.requests.some(r=>r.url.includes('grant_type=refresh_token')));
 assert.equal(x.table()[0].chosen_variant,'I11');
 assert.match(x.status.textContent,/In Supabase gespeichert/);
});
test('invalid login stays visible with actionable message and preserves local choice',async()=>{
 const x=app({failAuth:true});
 await tick();await tick();
 await x.signin();
 assert.equal(x.panel.hidden,false);
 assert.match(x.status.textContent,/E-Mail oder Passwort nicht akzeptiert/);
 assert.equal(x.submit.disabled,false);
 assert.equal(JSON.parse(x.storage.get(KEY)).chosen,'I11');
});
