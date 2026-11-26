'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a);
  return source.slice(a,b);
}
const loader=vm.runInNewContext(section('  async function loadIngredientIdentities(','  async function remoteData()')+'\nloadIngredientIdentities');
const limits=vm.runInNewContext(section('  const REQUEST_TIMEOUT_MS=','  const SOURCE_KEYS=')+'\n({request:REQUEST_TIMEOUT_MS,long:LONG_REQUEST_TIMEOUT_MS,session:SESSION_TIMEOUT_MS,outer:FOOD_LOAD_TIMEOUT_MS})');
test('FOOD loads every catalog row in a single authenticated snapshot without REST page truncation',async()=>{
  const identities=Array.from({length:297},(_,i)=>({source_name:'name'+i}));
  const positions=Array.from({length:3315},(_,i)=>({ingredient_id:'id'+i}));
  let calls=0;
  const result=await loader({rpc:async name=>{calls++;assert.equal(name,'food_catalog_identity_snapshot_v1');return {data:{identities,positions}};}},'test-user');
  assert.equal(calls,1);assert.equal(result.data.length,3612);
  assert.equal(result.data[3611].ingredient_id,'id3314');
});
test('FOOD rejects malformed, unauthenticated, failed and oversized snapshots',async()=>{
  await assert.rejects(loader({rpc:async()=>({data:{}})},'user'),/unvollständige/);
  await assert.rejects(loader({rpc:async()=>({data:{identities:[],positions:Array(25001).fill({})}})},'user'),/Ladebereich/);
  await assert.rejects(loader({rpc:async()=>{throw Error('must not call');}},null),/Anmeldung/);
  await assert.rejects(loader({rpc:async()=>({error:Error('network')})},'user'),/network/);
});
test('outer render timeout cannot preempt a valid slow source or its session',async()=>{
  assert.ok(limits.outer>limits.session+limits.long);
  const render=section('  async function render(){','  function setSurface(');
  let deadline=0,painted=false,failed=false;
  const context={FOOD_LOAD_TIMEOUT_MS:limits.outer,withTimeout:async(p,label,ms)=>{deadline=ms;return p;},load:async()=>({meals:[]}),ensureRoot:()=>({}),shell:()=>'<div/>',paint:()=>{painted=true;return true;},renderFailure:()=>{failed=true;}};
  const run=vm.runInNewContext('let renderSerial=0,state=null;\n'+render+'\nrender',context);
  assert.equal(await run(),true);assert.equal(deadline,limits.outer);assert.ok(painted);assert.equal(failed,false);
});
