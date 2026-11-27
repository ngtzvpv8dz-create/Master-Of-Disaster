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


function chargePreview(status){
  const start=source.indexOf('  function allocationMarkup(allocation,item){');
  const end=source.indexOf('  // Verbrauchsbuchungen',start);
  assert(start>=0&&end>start);
  const item={id:'ingredient',name:'Hähnchenbrustfilet',quantity:200,unit:'g'};
  const allocation={allocations:status==='frozen'?
    [{lotId:'fresh',label:'Frische Packung',quantity:200,unit:'g',inventoryId:'stock'}]:
    [{lotId:'old',label:'Hähnchenbrustfilet · Kauf 01.10. · '+(status==='thawed'?'aufgetaut':'Auftauen läuft'),quantity:120,unit:'g',inventoryId:'stock'},
     {lotId:'fresh',label:'Frische Packung',quantity:80,unit:'g',inventoryId:'stock'}],remaining:0};
  const before=JSON.stringify(allocation);
  const context={item,allocation,state:{freezer:[portion('a',120,status,'old')],
    lots:[{id:'old',inventory_id:'stock',storage_location:status==='frozen'?'tk':'fridge',purchased_on:'2026-10-01'}],
    inventory:[{id:'stock',name:'Hähnchenbrustfilet'}],products:[]},
    editableAllocationContext:()=>({}),sourceIsReal:()=>true,
    ingredientName:x=>x.name,familyText:x=>x.toLowerCase(),frozenStorageLocation:x=>x==='tk',
    familyAllocationConvertQuantity:x=>x,familyAllocationLotQuantity:()=>120,
    fmtDate:()=> '01.10.',fmtQty:(x,u)=>x+' '+u,esc:String};
  const html=vm.runInNewContext(source.slice(start,end)+'\nallocationMarkup(allocation,item);',context);
  assert.equal(JSON.stringify(allocation),before,'display must not mutate actual allocation');
  return html;
}

test('reserved frozen portion appears with projected fresh remainder without booking or edit controls',()=>{
  const html=chargePreview('frozen');
  assert.match(html,/Noch aufzutauen/);
  assert.match(html,/120 g/);
  assert.match(html,/80 g/);
  assert.doesNotMatch(html,/200 g|data-food-allocation-edit/);
  assert.match(html,/erst nach Auftau-Bestätigung verfügbar/);
  assert.doesNotMatch(html,/is-thawing-v741/);
});

test('confirmed thawing and thawed lots retain warm gradient while fresh lot stays neutral',()=>{
  for(const status of ['thawing','thawed']){
    const html=chargePreview(status);
    assert.equal((html.match(/is-thawing-v741/g)||[]).length,1);
    assert.match(html,/120 g/);
    assert.match(html,/80 g/);
    assert.match(html,/data-food-allocation-edit/);
    assert.doesNotMatch(html,/Noch aufzutauen/);
  }
});
