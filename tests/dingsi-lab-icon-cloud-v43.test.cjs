'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const js=fs.readFileSync(path.join(__dirname,'..','dingsi-lab-icons-cloud-v43.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','dingsi-lab-icons.html'),'utf8');
const hub=fs.readFileSync(path.join(__dirname,'..','dingsi-lab.html'),'utf8');
const KEY='mod-dingsi-lab-icon-variacionen-v1',AUTH='sb-oktpzwhhndsbikkeelot-auth-token';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function boot({local,remote,authenticated=true,fail,never=false}={}){
 const callbacks={},store=new Map(),requests=[];
 if(local)store.set(KEY,JSON.stringify(local));
 if(authenticated)store.set(AUTH,JSON.stringify({access_token:'user-jwt-token',user:{id:'test-user-id'},expires_at:4102444800}));
 const status={textContent:''}, retry={hidden:true,addEventListener(n,fn){callbacks['retry']=fn;}};
 const window={
  SUPABASE_CONFIG:{url:'https://oktpzwhhndsbikkeelot.supabase.co',publishableKey:'sb_publishable_test'},
  addEventListener(n,fn){callbacks['win:'+n]=fn;},
  dispatchEvent(e){if(e.type==='mod-icon-lab-cloud-hydrate')callbacks.hydrated=e.detail;},
 };
 const document={visibilityState:'visible',getElementById(id){return id==='cloud-status'?status:id==='cloud-retry-v43'?retry:null;},
 addEventListener(n,fn){callbacks['doc:'+n]=fn;}};
 let rows=remote?[remote]:[];
 async function fetch(url,opts){
  requests.push({url,opts});
  if(never)return new Promise(()=>{});
  if(fail)throw Error(fail);
  assert.match(url,/dingsi_lab_icon_choices/);
  assert.equal(opts.headers.apikey,'sb_publishable_test');
  assert.equal(opts.headers.Authorization,'Bearer user-jwt-token');
  if(opts.method==='GET')return {ok:true,async json(){return rows;}};
  assert.equal(opts.method,'POST');
  assert.match(opts.headers.Prefer,/merge-duplicates/);
  const data=JSON.parse(opts.body);rows=[data];
  return {ok:true,async json(){return [data];}};
 }
 class CustomEvent{constructor(type,args){this.type=type;this.detail=args.detail;}}
 const localStorage={getItem(k){return store.get(k)||null;},setItem(k,v){store.set(k,v)}};
 const context={window,document,fetch,localStorage,CustomEvent,Date,Set,AbortController,clearTimeout,setTimeout};
 vm.runInNewContext(js,context);
 return {window,status,retry,store,requests,callbacks,rows:()=>rows,
  change(x){store.set(KEY,JSON.stringify({variant:x.variant,chosen:x.chosen,liked:x.liked}));callbacks['win:mod-icon-lab-local-change']({detail:x});}};
}
test('HTML loads v43 bridge directly and cache-busted lab page',()=>{
 assert.match(hub,/dingsi-lab-icons\.html\?v=44/);
 assert.match(html,/dingsi-lab-icons-cloud-v44\.js\?v=44/);
 assert.match(html,/id="cloud-retry-v43"/);
 assert.doesNotMatch(html,/@supabase\/supabase-js@2/);
 assert.doesNotThrow(()=>new vm.Script(js));
});
test('old iPhone favorite and chosen style upload to real table via direct REST',async()=>{
 const b=boot({local:{variant:'I11',chosen:'I11',liked:['I10','I11']}});
 await tick();await tick();
 assert.equal(b.requests.length,2);
 assert.equal(b.rows()[0].active_variant,'I11');
 assert.equal(b.rows()[0].chosen_variant,'I11');
 assert.deepEqual(Array.from(b.rows()[0].favorite_variants),['I10','I11']);
 assert.match(b.status.textContent,/In Supabase gespeichert/);
});
test('Cloud data hydrates old lab page without re-writing',async()=>{
 const b=boot({remote:{active_variant:'I12',chosen_variant:'I09',favorite_variants:['I10'],updated_at:'2026-10-18T22:00:00Z'}});
 await tick();
 assert.equal(b.requests.length,1);
 assert.equal(b.callbacks.hydrated.variant,'I12');
 assert.equal(b.callbacks.hydrated.chosen,'I09');
 assert.deepEqual(Array.from(b.callbacks.hydrated.liked),['I10']);
});
test('missing session fails visibly instead of hanging, Retry sends when auth is restored',async()=>{
 const b=boot({local:{variant:'I05',chosen:'I05',liked:['I05']},authenticated:false});
 await tick();
 assert.match(b.status.textContent,/Keine gültige App-Anmeldung gefunden/);
 assert.equal(b.retry.hidden,false);
 assert.equal(b.requests.length,0);
 b.store.set(AUTH,JSON.stringify({access_token:'user-jwt-token',user:{id:'test-user-id'},expires_at:4102444800}));
 b.callbacks.retry();
 await tick();await tick();
 assert.equal(b.rows()[0].chosen_variant,'I05');
 assert.equal(b.retry.hidden,true);
});
test('tapping new favorites after initial connect persists to cloud',async()=>{
 const b=boot({local:{variant:'I09',chosen:null,liked:[]}});
 await tick();await tick();
 b.change({variant:'I12',chosen:'I12',liked:['I09','I12']});
 await tick();await tick();
 assert.equal(b.rows()[0].chosen_variant,'I12');
 assert.deepEqual(Array.from(b.rows()[0].favorite_variants),['I09','I12']);
});
test('failed network stops and exposes retry instead of indefinite loading',async()=>{
 const b=boot({local:{variant:'I12',chosen:'I12',liked:['I12']},fail:'connection failed'});
 await tick();
 assert.match(b.status.textContent,/connection failed/);
 assert.equal(b.retry.hidden,false);
});
