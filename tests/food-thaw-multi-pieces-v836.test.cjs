'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'food-v544.js'),'utf8');
const css=fs.readFileSync(path.join(root,'food-v544.css'),'utf8');

function thawTask(parts){
  const start=source.indexOf('  function plannedThawTasks(){');
  const end=source.indexOf('  function thawReminderMarkupForMeal()',start);
  assert(start>=0&&end>start,'task function exists');
  const script=source.slice(start,end)+'\nplannedThawTasks();';
  const context={
    state:{
      meals:[{id:'meal',meal_date:'2026-10-19',meal_type:'dinner',title:'Wokpfanne',
        status:'planned',ingredients:[{id:'ingredient',name:'Hähnchenbrustfilet',quantity:454,unit:'g'}]}],
      freezer:parts,
      lots:[{id:'lot271'},{id:'lot183'}]
    },
    plannedThawCacheState:null,
    plannedThawCache:null,
    todayIso:()=> '2026-10-18',
    normalizedStatus:value=>value,
    plannedFamilyAllocationMaps:()=>new Map([['meal',new Map([['ingredient',
      {allocations:[{frozen:true,quantity:183}]}]])]]),
    plusDays:()=> '2026-10-18',
    fmtQty:(value,unit)=>value+' '+unit,
    ingredientName:item=>item.name
  };
  return vm.runInNewContext(script,context)[0];
}
const portion=(id,quantity,status,lot)=>({
  id,quantity,unit:'g',meal_ingredient_id:'ingredient',status,frozen_lot_id:lot,
  thaw_started_at:status==='frozen'?null:'2026-10-18T08:20:00Z',
  thawed_at:status==='thawed'?'2026-10-18T08:20:45Z':null
});

test('V836 food frontend parses without syntax errors',()=>{
  assert.doesNotThrow(()=>new vm.Script(source,{filename:'food-v544.js'}));
});

test('271 g thawed leaves 183 g available to assign for 454 g meal',()=>{
  const task=thawTask([portion('a',271,'thawed','lot271')]);
  assert.equal(task.linkedQuantity,271);
  assert.equal(task.missingQuantity,183);
  assert.equal(task.thawedAt,null);
  assert.match(task.portionDetails,/183 g noch nicht zugeordnet/);
});

test('assigned but still frozen second piece must not mark whole meal thawed',()=>{
  const task=thawTask([
    portion('a',271,'thawed','lot271'),
    portion('b',183,'frozen','lot183')
  ]);
  assert.equal(task.missingQuantity,0);
  assert.equal(task.thawedAt,null);
  assert.match(task.portionDetails,/183 g noch eingefroren/);
});

test('meal fully thawed only after all its physical pieces thaw',()=>{
  const task=thawTask([
    portion('a',271,'thawed','lot271'),
    portion('b',183,'thawed','lot183')
  ]);
  assert.equal(task.missingQuantity,0);
  assert.ok(task.thawedAt);
});

test('stock and today both offer another piece; freeze and thaw visually distinct',()=>{
  assert(source.includes('Number(hint.missingQuantity)>0.000001'));
  assert(source.includes('food-thaw-more-piece-v836'));
  assert(source.includes('data-food-freezer-plan-hint'));
  assert(css.includes('is-freeze-planned-v822'));
  assert(css.includes('rgba(255,183,84,.42)'));
});
