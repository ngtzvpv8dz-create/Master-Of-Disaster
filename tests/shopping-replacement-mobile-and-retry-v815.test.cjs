'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'..','shopping-v678.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','shopping-v678.css'),'utf8');
const a=js.indexOf('  async function addGeneral('),b=js.indexOf('  async function updateGeneral(',a);
assert.ok(a>=0&&b>a);
const getAdd=new Function('currentUser','state','reload',js.slice(a,b)+'return addGeneral;');

test('manual shopping insert verifies a lost reply and never duplicates after retry',async()=>{
  let inserts=0,refreshes=0,network='success';
  const records=new Map();
  const supabase={from:()=>({
    async insert(value){
      inserts++;
      if(network==='lost-and-committed'){records.set(value.id,value);throw new TypeError('Load failed');}
      if(network==='lost-before-commit')throw new TypeError('Load failed');
      if(records.has(value.id))return {error:{code:'23505'}};
      records.set(value.id,value);return {error:null};
    },
    select(){let key='';return {
      eq(column,value){if(column==='id')key=value;return this;},
      async maybeSingle(){return {error:null,data:records.has(key)?{id:key}:null};}
    };}
  })};
  const add=getAdd(async()=>({supabase,user:{id:'tester'}}),{general:[]},async()=>{refreshes++;});
  await add({label:'Pink Lady Äpfel',quantity:6,unit:'Stück'},'stable1');
  network='lost-and-committed';
  await add({label:'Küchenrolle',quantity:1,unit:'Packung'},'stable2');
  assert.equal(records.size,2);
  network='lost-before-commit';
  await assert.rejects(()=>add({label:'Fresh Cherry',quantity:300,unit:'g'},'stable3'),/Load failed/);
  assert.equal(records.size,2);
  network='success';
  await add({label:'Fresh Cherry',quantity:300,unit:'g'},'stable3');
  await add({label:'Fresh Cherry',quantity:300,unit:'g'},'stable3');
  assert.equal(records.size,3);
  assert.equal(refreshes,4);
  assert.equal(inserts,5);
});

test('primary piece quantity is not repeated in purchase summary',()=>{
  const a=js.indexOf('  function shoppingPackageSummary(');
  const b=js.indexOf('  function parseShoppingExtraData(',a);
  assert.ok(a>=0&&b>a);
  const summary=new Function('fmtQty',js.slice(a,b)+'return shoppingPackageSummary;')((v,u)=>v+' '+u);
  const item={piece_count:6,estimated_total_weight_g:1000};
  assert.doesNotMatch(summary(item,'Stück'),/6 Stück/);
  assert.match(summary(item,'Stück'),/1000 g/);
  assert.match(summary(item,'g'),/6 Stück/);
});

test('mobile replacement quantity is separated from the long product name',()=>{
  assert.match(css,/grid-template-areas:"arrow content" "\. qty"/);
  assert.match(css,/overflow-wrap:anywhere/);
});
