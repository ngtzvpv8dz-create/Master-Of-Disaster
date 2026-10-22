'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');

function runnable(meals,{response={data:{id:'meal-1',status:'planned'},error:null}}={}){
  const start=source.indexOf('  async function reopenSkippedMeal(id){');
  const end=source.indexOf('  async function skipMeal(id){',start);
  assert(start>=0&&end>start,'reopenSkippedMeal exists and is next to skipMeal');
  const filters=[];
  let mutation=null;
  let inventoryTouched=false;
  const builder={
    update(values){mutation=values;return this;},
    eq(k,v){filters.push(['eq',k,v]);return this;},
    is(k,v){filters.push(['is',k,v]);return this;},
    select(s){filters.push(['select',s]);return this;},
    maybeSingle(){return Promise.resolve(response);}
  };
  const context={
    state:{meals},
    normalizedStatus:status=>status,
    client:()=>({from(table){if(table!=='food_meals')inventoryTouched=true;return builder;}}),
    withTimeout:promise=>promise,
    mutate:async cb=>cb(),
    Date,
    Error
  };
  const fn=vm.runInNewContext(source.slice(start,end)+'\nreopenSkippedMeal;',context);
  return {fn,filters,get mutation(){return mutation;},get inventoryTouched(){return inventoryTouched;}};
}

test('Food V849 parses and skipped meals have a visible reopen control',()=>{
  assert.doesNotThrow(()=>new vm.Script(source,{filename:'food-v544.js'}));
  assert(source.includes("data-food-reopen-skipped"));
  assert(source.includes("await reopenSkippedMeal(String(button.dataset.foodReopenSkipped||''))"));
  assert.equal(source.split("+(status==='skipped'?'<div class=\"food-meal-plan-actions-v630\">'").length-1,3);
});

test('reopening a skipped meal changes status only, under row guards',async()=>{
  const mock=runnable([{id:'meal-1',meal_date:'2026-10-22',status:'skipped',inventory_booked_at:null}]);
  await mock.fn('meal-1');
  assert.equal(mock.mutation.status,'planned');
  assert.deepEqual(Object.keys(mock.mutation).sort(),['status','updated_at']);
  assert.equal(mock.inventoryTouched,false);
  for(const [op,key,value] of [
    ['eq','id','meal-1'],['eq','meal_date','2026-10-22'],
    ['eq','status','skipped'],['is','inventory_booked_at',null]
  ])assert(mock.filters.some(x=>x[0]===op&&x[1]===key&&x[2]===value));
});

test('completed and inventory-booked meals cannot be reopened',async()=>{
  for(const meal of [
    {id:'meal-1',meal_date:'2026-10-22',status:'completed',inventory_booked_at:null},
    {id:'meal-1',meal_date:'2026-10-22',status:'skipped',inventory_booked_at:'2026-10-22T19:00:00Z'}
  ]){
    const mock=runnable([meal]);
    await assert.rejects(mock.fn('meal-1'),/Nur ausgefallene/);
    assert.equal(mock.mutation,null);
  }
});

test('cloud must confirm the write before a success is reported',async()=>{
  const mock=runnable([{id:'meal-1',meal_date:'2026-10-22',status:'skipped',inventory_booked_at:null}],{response:{data:null,error:null}});
  await assert.rejects(mock.fn('meal-1'),/nicht bestätigt/);
});
