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

test('measured fruit receipt: exact individual gross weights, fail closed',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','shopping-v678.js'),'utf8');
  const a=src.indexOf('  function requiresMeasuredPurchase('),b=src.indexOf('  function purchaseDetailsForReview(',a);
  const {parseMeasuredPurchaseWeights:parse,measuredPurchaseReady:ready}=new Function('state',src.slice(a,b)+';return {parseMeasuredPurchaseWeights,measuredPurchaseReady};')({checkoutItemLots:[]});
  assert.deepEqual(parse('153; 147,5',2,'Stück',1),[153,147.5]);
  assert.deepEqual(parse('153\n147',2,'Stück',2),[153,147]);
  for(const args of [['150;0',2,'Stück',1],['150',2,'Stück',1],['150;160',2,'g',1],['150;160;170',3,'Stück',2],['1e2',1,'Stück',1]])assert.throws(()=>parse(...args));
  assert.equal(ready({quantity:2,unit:'Stück',purchase_data:{gross_piece_weights_g:[150]}},{ingredient_family_name:'Apfel'}),false);
  assert.equal(ready({quantity:2,unit:'Stück',purchase_data:{gross_piece_weights_g:[150,160]}},{ingredient_family_name:'Avocado'}),true);
  assert.equal(ready(null,{ingredient_family_name:'Milch'}),true);
  assert.equal(ready({inventory_applied_at:'old'},{ingredient_family_name:'Apfel'}),true);
});
test('meal preview excludes skipped meals and rejects unknown snack calories',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
  const a=src.indexOf('  function dayCaloriesWithProposedMeal('),b=src.indexOf('  async function previewMealDayCalories(',a);
  const calc=new Function('number','text','plannedMealAllocationState','nutritionForMeal',src.slice(a,b)+';return dayCaloriesWithProposedMeal;')(x=>x==null||x===''?null:Number(x),x=>String(x||'').toLowerCase(),()=>({contexts:new Map(),allocations:new Map()}),m=>({complete:true,kcal:m.id==='one'?150:999}));
  const data={meals:[{id:'one',meal_date:'2026-11-25',status:'planned',eaten_servings:1},{id:'two',meal_date:'2026-11-25',status:'skipped'}],recipes:[],extras:[{consumption_date:'2026-11-25',calories_kcal:0}]};
  assert.equal(calc(data,'one',[],true).kcal,150);
  const invalid=calc({...data,extras:[{consumption_date:'2026-11-25',title:'Unknown',calories_kcal:null}]},'one',[],true);
  assert.equal(invalid.complete,false);
  assert.equal(invalid.kcal,null);
});

test('measured fruit purchase groups retain exact individual assignment',()=>{
 const src=fs.readFileSync(path.join(__dirname,'..','shopping-v678.js'),'utf8');
 const a=src.indexOf('  function requiresMeasuredPurchase('),b=src.indexOf('  function purchaseDetailsForReview(',a);
 const groups=[{id:'a',checkout_item_id:'i',package_count:1},{id:'b',checkout_item_id:'i',package_count:1}];
 const api=new Function('state',src.slice(a,b)+';return {parseGroupedMeasuredWeights,measuredPurchaseReady};')({checkoutItemLots:groups});
 const r=api.parseGroupedMeasuredWeights(groups,{a:'140',b:'150;160'},3,'Stück',2);
 assert.deepEqual(r.flat,[140,150,160]);
 assert.deepEqual(r.mapped,{a:[140],b:[150,160]});
 const item={id:'i',quantity:3,unit:'Stück',package_count:2,purchase_data:{gross_piece_weights_g:r.flat,gross_piece_weights_by_checkout_lot:r.mapped}};
 const product={ingredient_family_name:'Avocado'};
 assert.equal(api.measuredPurchaseReady(item,product),true);
 assert.equal(api.measuredPurchaseReady({...item,purchase_data:{gross_piece_weights_g:r.flat}},product),false);
 assert.throws(()=>api.parseGroupedMeasuredWeights(groups,{a:'140',b:'150'},3,'Stück',2));
});
