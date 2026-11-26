'use strict';
// Run: node --test tests/shopping-v1.test.cjs
// Synthetic fixtures only. Never writes to Supabase or checkout records.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const fixtureClock='2026-11-18T12:00:00Z';
class FixedDate extends Date{
  constructor(...args){super(...(args.length?args:[fixtureClock]));}
  static now(){return Date.parse(fixtureClock);}
}
function loadSource(file,endToken,exports,extra=''){
  const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const start=source.indexOf('(function(){');
  const end=source.indexOf(endToken,start);
  assert.ok(start>=0&&end>start,file+' module boundary');
  const fragment=source.slice(start,end)+extra+'return '+exports+';})();';
  return vm.runInNewContext(fragment,{window:{},document:{},Date:FixedDate,Intl,console},{timeout:20000});
}
function food(){return loadSource('food-v544.js','function shoppingView(data)','{deriveShopping,regularShoppingDate}');}
function shop(){return loadSource('shopping-v678.js','// V866: These badges describe','{buildRows,shoppingCompactDescription,effectiveShoppingDate,state}',"function shoppingPackageSummary(){return ''; }");}
function fixtures(){
  return {
    meals:[
      {meal_date:'2026-11-18',meal_type:'snack',status:'planned',ingredients:[
        {name:'Mandelmus',label:'20 g Mandelmus',quantity:20,unit:'g',inventory_id:null}]},
      {meal_date:'2026-11-19',meal_type:'breakfast',status:'planned',ingredients:[
        {name:'Buchweizen',label:'Buchweizenmehl aus Körnern',quantity:65,unit:'g',inventory_id:null}]},
      {meal_date:'2026-11-21',meal_type:'breakfast',status:'planned',ingredients:[
        {name:'Körniger Frischkäse',label:'150 g körniger Frischkäse leicht',quantity:150,unit:'g',inventory_id:null}]}
    ],
    inventory:[
      {id:'almond',name:'REWE Bio Mandelmus weiß',family_name:'Mandelmus weiß',quantity:250,unit:'g',is_active:true},
      {id:'cottage',name:'Körniger Frischkäse',family_name:'Körniger Frischkäse',quantity:300,unit:'g',is_active:true},
      {id:'buckwheat',name:'Buchweizenkörner (Menge noch prüfen)',family_name:'Buchweizen',quantity:0,unit:'g',is_active:true,shopping_excluded:true,pending_weighing:true}
    ],
    products:[{id:'cottage-light',inventory_id:'cottage',active:true,variant:'leicht · 0,4 % Fett'}]
  };
}
function connect(sh,d,gaps){
  sh.state.food={gaps,inventory:d.inventory,manualFood:[],cartKeys:[],plannedShoppingUses:[],inventoryLots:[]};
  sh.state.products=d.products;
  return sh;
}
test('known almond butter and verified light cottage cheese are not repurchased',()=>{
  const gaps=food().deriveShopping(fixtures());
  assert.equal(gaps.filter(g=>/mandelmus|frischkäse/i.test(g.label)).length,0);
});
test('light cottage cheese is never matched to an unverified regular variant',()=>{
  const d=fixtures();
  d.products[0].variant='normal';
  const gaps=food().deriveShopping(d);
  assert.ok(gaps.some(g=>/frischkäse/i.test(g.label)&&g.missing===150));
});
test('unweighed buckwheat remains visible and explicitly unverified',()=>{
  const d=fixtures(),gaps=food().deriveShopping(d);
  const g=gaps.find(g=>/buchweizen/i.test(g.label));
  assert.ok(g);
  assert.equal(g.missing,65);
  assert.equal(g.stockUnverified,true);
  const sh=connect(shop(),d,gaps);
  const row=sh.buildRows().find(r=>/buchweizen/i.test(r.label));
  assert.ok(row);
  assert.match(row.primary,/Bestand prüfen/);
  assert.match(sh.shoppingCompactDescription(row),/nicht gewogen/);
});
test('Wednesday evening and Saturday morning shopping windows survive holidays',()=>{
  const f=food(),s=shop();
  assert.equal(f.regularShoppingDate('2026-11-18','dinner'),'2026-11-18');
  assert.equal(f.regularShoppingDate('2026-11-21','breakfast'),'2026-11-18');
  assert.equal(f.regularShoppingDate('2026-11-21','lunch'),'2026-11-21');
  assert.equal(f.regularShoppingDate('2026-10-31','lunch'),'2026-10-30');
  assert.equal(s.effectiveShoppingDate('2026-10-31'),'2026-10-30');
});
test('old automated 500g yoghurt request cannot override verified 590g stock',()=>{
  const d={meals:[],inventory:[{id:'y',name:'Naturjoghurt mild (1,5 % Fett)',family_name:'Naturjoghurt mild (1,5 % Fett)',quantity:590,unit:'g',is_active:true}],products:[]};
  const sh=connect(shop(),d,[]);
  sh.state.general=[
    {id:'stale',label:'Naturjoghurt mild (1,5 % Fett)',quantity:500,unit:'g',category:'Lebensmittel',source:'food-plan',status:'now',needed_by:'2026-11-18'},
    {id:'manual',label:'Scheibenenteiser',quantity:1,unit:'Stück',category:'Non-Food',source:'manual',status:'now',needed_by:'2026-11-11'}
  ];
  const rows=sh.buildRows();
  assert.equal(rows.length,1);
  assert.equal(rows[0].label,'Scheibenenteiser');
  sh.state.general[0].status='cart';
  assert.equal(sh.buildRows().length,2,'explicit user cart selections remain available');
});
test('chicken stock is chronologically allocated, not double counted',()=>{
  const d={
    meals:[
      {meal_date:'2026-11-18',meal_type:'dinner',status:'planned',ingredients:[{name:'Hähnchenbrustfilet',quantity:1080,unit:'g',inventory_id:'chicken'}]},
      {meal_date:'2026-11-22',meal_type:'dinner',status:'planned',ingredients:[{name:'Hähnchenbrustfilet',quantity:1010,unit:'g',inventory_id:'chicken'}]}
    ],
    inventory:[{id:'chicken',name:'Hähnchenbrustfilet',family_name:'Hähnchenbrustfilet',quantity:281,unit:'g',is_active:true}],
    products:[]
  };
  const gaps=food().deriveShopping(d);
  const wed=gaps.find(g=>g.buyFrom==='2026-11-18');
  const sat=gaps.find(g=>g.buyFrom==='2026-11-21');
  assert.ok(wed&&sat);
  assert.equal(wed.missing,799);
  assert.equal(sat.missing,1010);
});
test('planner handles 520 distinct items without losing entries',()=>{
  const d={meals:[],inventory:[],products:[]};
  for(let i=0;i<520;i++){
    const name='RegressionArtikel'+i;
    d.inventory.push({id:'stock'+i,name,family_name:name,quantity:0,unit:'g',is_active:true});
    d.meals.push({meal_date:'2026-11-19',meal_type:'dinner',status:'planned',ingredients:[
      {name,quantity:i+1,unit:'g',inventory_id:'stock'+i}]});
  }
  assert.equal(food().deriveShopping(d).length,520);
});

test('monthly freezer and durable food-stockup cover later gaps once; fresh meat stays local',()=>{
  const sh=shop(), names=['Hähnchenbrustfilet','Rinderhackfleisch Light','Putenbrustfilet','ESN Isoclear Fresh Cherry','Zarte Haferflocken','Hokkaido-Kürbis TK'];
  const gaps=names.flatMap(label=>['2026-12-02','2026-12-19'].map(date=>({label,unit:'g',missing:100,required:100,available:0,buyFrom:date,shortageDate:date,uses:[{date,quantity:100}]})));
  sh.state.food={gaps,inventory:[],manualFood:[],cartKeys:[],plannedShoppingUses:names.map(name=>({name,date:'2026-12-02'})),inventoryLots:[]};
  sh.state.general=names.map((label,i)=>({id:'stockup'+i,label,quantity:250,unit:'g',category:'Lebensmittel',source:'food-stockup',status:'cart',needed_by:'2026-11-18',notes:i<3?'Sofort portionieren und einfrieren.':''}));
  assert.equal(sh.buildRows().filter(r=>r.source==='food-gap').length,0);
  assert.equal(sh.buildRows().length,names.length);
  sh.state.general[0].notes='Frisch verwenden';
  assert.equal(sh.buildRows().filter(r=>r.source==='food-gap'&&r.label==='Hähnchenbrustfilet').length,2);
  sh.state.general.push({id:'obsolete',label:'Mandu TK',quantity:120,unit:'g',category:'Lebensmittel',source:'food-stockup',status:'cart',needed_by:'2026-11-18'});
  assert.equal(sh.buildRows().find(r=>r.id==='general:obsolete').unmatchedPlannedPurchase,true);
});
