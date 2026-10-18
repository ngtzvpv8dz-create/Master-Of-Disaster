'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','dingsi-lab-icons-cloud-v41.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','dingsi-lab-icons.html'),'utf8');
const KEY='mod-dingsi-lab-icon-variacionen-v1';
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
function boot({local=null,remote=null,authenticated=true}={}){
 const listeners=new Map(),store=new Map(),writes=[],hydrates=[];
 const status={textContent:''};
 if(local)store.set(KEY,JSON.stringify(local));
 const document={
  visibilityState:'visible',
  getElementById(id){assert.equal(id,'cloud-status');return status;},
  addEventListener(type,fn){listeners.set('document:'+type,fn);}
 };
 const db={
  select(){return {eq(){return {maybeSingle:async()=>({data:remote,error:null})}}};},
  async upsert(payload,options){
   assert.equal(options.onConflict,'user_id');
   writes.push(payload);
   remote={active_variant:payload.active_variant,chosen_variant:payload.chosen_variant,favorite_variants:payload.favorite_variants};
   return {data:null,error:null};
  }
 };
 const client={
  auth:{async getSession(){return {data:{session:authenticated?{user:{id:'test-user'}}:null},error:null};}},
  from(name){assert.equal(name,'dingsi_lab_icon_choices');return db;}
 };
 const window={
  getSupabaseClient(){return client;},
  addEventListener(type,fn){listeners.set('window:'+type,fn);},
  dispatchEvent(e){
   if(e.type==='mod-icon-lab-cloud-hydrate')hydrates.push(e.detail);
   listeners.get('window:'+e.type)?.(e);
   return true;
  }
 };
 const localStorage={getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)}};
 class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail;}}
 vm.runInNewContext(source,{window,document,localStorage,CustomEvent,Date,Set,console});
 return {
  status,writes,hydrates,store,
  setAuthenticated(x){authenticated=x;},
  change(x){window.dispatchEvent(new CustomEvent('mod-icon-lab-local-change',{detail:x}));},
  retry(){listeners.get('window:online')?.();}
 };
}
test('cloud bridge is wired to the existing Lab page',()=>{
 assert.match(html,/dingsi-lab-icons-cloud-v41\.js\?v=41/);
 assert.match(html,/id="cloud-status"/);
 assert.match(html,/mod-icon-lab-local-change/);
 assert.match(html,/mod-icon-lab-cloud-hydrate/);
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.doesNotMatch(source,/service_role|sb_secret_/);
});
test('first access uploads old iPhone favorites and selected variant from localStorage',async()=>{
 const app=boot({local:{variant:'I11',chosen:'I11',liked:['I09','I11']}});
 await settle();
 assert.equal(app.writes.length,1);
 assert.equal(app.writes[0].active_variant,'I11');
 assert.equal(app.writes[0].chosen_variant,'I11');
 assert.deepEqual(Array.from(app.writes[0].favorite_variants),['I09','I11']);
 assert.match(app.status.textContent,/Supabase gespeichert/);
});
test('server data is hydrated when no local edit happens during loading',async()=>{
 const app=boot({remote:{active_variant:'I10',chosen_variant:'I12',favorite_variants:['I10'],updated_at:'2026-10-18T20:00:00Z'}});
 await settle();
 assert.equal(app.writes.length,0);
 assert.equal(app.hydrates.length,1);
 assert.equal(app.hydrates[0].variant,'I10');
 assert.equal(app.hydrates[0].chosen,'I12');
 assert.deepEqual(Array.from(app.hydrates[0].liked),['I10']);
});
test('tapping favorite later writes new state; offline state retries after signing in',async()=>{
 const app=boot({authenticated:false,local:{variant:'I03',chosen:null,liked:['I02']}});
 await settle();
 assert.equal(app.writes.length,0);
 assert.match(app.status.textContent,/Nur lokal/);
 app.change({variant:'I12',chosen:'I12',liked:['I09','I12']});
 app.setAuthenticated(true);
 app.retry();
 await settle();
 assert.equal(app.writes.at(-1).chosen_variant,'I12');
 assert.deepEqual(Array.from(app.writes.at(-1).favorite_variants),['I09','I12']);
});
test('connected browser immediately writes new selections without losing other favorites',async()=>{
 const app=boot({local:{variant:'I01',chosen:null,liked:[]}});
 await settle();
 app.change({variant:'I09',chosen:'I09',liked:['I02','I09']});
 await settle();
 assert.equal(app.writes.at(-1).active_variant,'I09');
 assert.equal(app.writes.at(-1).chosen_variant,'I09');
 assert.deepEqual(Array.from(app.writes.at(-1).favorite_variants),['I02','I09']);
});
