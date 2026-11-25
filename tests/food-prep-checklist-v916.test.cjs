'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const nutrition=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','food-v544.css'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'..','area-runtime-v609.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

function isolatedChecklist(){
  const begin=food.indexOf('  async function togglePrepCheck(');
  const end=food.indexOf('  function wire(root)',begin);
  assert(begin>=0&&end>begin);
  const js=food.slice(begin,end);
  const state={meals:[{id:'m1',status:'planned',ingredients:[{id:'i1'}]}],prepChecks:[]};
  const calls=[];
  let prepDoneSet=new Set();
  const fake={
    auth:{getSession:async()=>({data:{session:{user:{id:'u1'}}}})},
    from:table=>{
      assert.equal(table,'food_meal_ingredient_prep_checks');
      return {
        upsert:async(row)=>{calls.push({action:'upsert',row});return {error:null};},
        delete:()=>({eq:()=>({eq:async()=>{calls.push({action:'delete'});return {error:null};}})})
      };
    }
  };
  const run=new Function('state','sourceIsReal','normalizedStatus','client','withTimeout',
    'let prepDoneSet=new Set();'+js+' return {togglePrepCheck,getChecks:()=>state.prepChecks,getDone:()=>prepDoneSet};')(
    state,()=>true,x=>x,()=>fake,async p=>p);
  return {run,state,calls};
}

test('checked ingredient is persisted and undo is supported, no food stock writes',async()=>{
  const {run,calls}=isolatedChecklist();
  await run.togglePrepCheck('i1','m1',true);
  assert.equal(run.getDone().has('i1'),true);
  assert.deepEqual(calls.map(c=>c.action),['upsert']);
  assert.equal(calls[0].row.user_id,'u1');
  assert.equal(calls[0].row.ingredient_id,'i1');
  await run.togglePrepCheck('i1','m1',false);
  assert.equal(run.getDone().has('i1'),false);
  assert.deepEqual(calls.map(c=>c.action),['upsert','delete']);
});
test('no ingredient from another meal or completed meal can be checked',async()=>{
  const {run,state,calls}=isolatedChecklist();
  await assert.rejects(()=>run.togglePrepCheck('other','m1',true),/gehört nicht/);
  state.meals[0].status='completed';
  await assert.rejects(()=>run.togglePrepCheck('i1','m1',true),/gehört nicht/);
  assert.equal(calls.length,0);
});
test('UI marks checked rows but never treats the marker as consumption',()=>{
  assert.match(food,/data-food-prep-check=/);
  assert.match(food,/aria-pressed/);
  assert.match(food,/food-prep-checked-v915/);
  assert.match(food,/sourceIsReal\('prepChecks'\)/);
  assert.match(css,/\.food-prep-check-v915\[aria-pressed="true"\]/);
  assert.match(food,/prepChecks:take\('prepChecks',14/);
  assert.match(food,/async function loadPrepChecks/);
  assert.match(food,/\.range\(offset,offset\+size-1\)/);
});
test('nutrient and freshness warnings are compact collapsible summaries',()=>{
  assert.match(nutrition,/data-food-nutrition-alert-details/);
  assert.match(nutrition,/<summary class="food-nutrition-alarm-head-v795"/);
  assert.match(food,/data-food-freshness-audit-details/);
  assert.match(food,/Frische- und MHD-Prüfung: '\+freshness.length\+' Punkte/);
});
test('active app URL bypasses stale food, nutrition and stylesheet cache',()=>{
  assert.equal(runtime.split('./food-v544.js?v=20261125-v937-explicit-variants').length-1,4);
  assert.equal(runtime.split('./food-nutrition-v711.js?v=20261125-v937-explicit-variants').length-1,4);
  assert.match(index,/food-v544\.css\?v=20261122-tasteprep-918/);
  assert.match(index,/area-runtime-v609\.js\?v=20261125-v937-explicit-variants/);
});
