'use strict';
// Regression: 12 Nov 2026 real breakfast and recurring ingredient/nutrition bugs.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const anchor='  schedule(450);\n})();';
assert.ok(source.includes(anchor),'stable calculator instrumentation point');
const instrumented=source.replace(anchor,
  '  window.__modFoodNutritionV711.__test={calculate,basisAmount,confirmedAllocationNutrition,plannedMealAllocationState,nutritionProblem};\n'+anchor);
const win={},doc={documentElement:{},addEventListener(){}};
new Function('window','document','MutationObserver','setTimeout','clearTimeout',instrumented)(
  win,doc,class{observe(){}},()=>0,()=>0);
const {calculate,basisAmount,confirmedAllocationNutrition,plannedMealAllocationState,nutritionProblem}=
  win.__modFoodNutritionV711.__test;
const weights=[52,58,50,53,56,56,59,55,56];
const bread={id:'harry',inventory_id:'bread',active:true,product_name:'Vital+fit',package_unit:'g',
  product_data:{measurement_date:'2026-11-01',
    numbered_slices:weights.map((gross_weight_g,i)=>({slice_number:i+1,gross_weight_g}))},
  nutrition_per_100:{energy_kcal:241,protein_g:7.7,carbohydrates_g:38,fat_g:4.9}};
const ricotta={id:'ricotta',inventory_id:'ricotta-stock',active:true,
  nutrition_per_100:{energy_kcal:181,protein_g:9.2,carbohydrates_g:4.5,fat_g:14}};
const tomato={id:'tomato',inventory_id:'tomato-stock',active:true,
  nutrition_per_100:{energy_kcal:18,protein_g:.88,carbohydrates_g:3.89,fat_g:.2}};
const basil={id:'basil',inventory_id:'basil-pot',active:true,product_name:'Bio Basilikum',
  nutrition_per_100:{energy_kcal:23,protein_g:3.15,carbohydrates_g:.31,fat_g:.64}};
const stock=(id,name,quantity,unit='g',family_name=name)=>({id,name,quantity,unit,
  family_name,is_active:true,sort_order:30});
const data=()=>({inventory:[
  stock('bread','Harry Vital+fit Brot',14,'Scheiben','Vollkornbrot'),
  stock('ricotta-stock','Ricotta',150),stock('tomato-stock','Mini Pflaumentomaten',348),
  stock('basil-pot','Bio Basilikum im Topf',1,'Topf','Basilikum')
],products:[bread,ricotta,tomato,basil],lots:[
 {id:'old-lot',product_id:'harry',inventory_id:'bread',purchased_on:'2026-10-30',
  opened_remaining_quantity:5,opened_remaining_unit:'Scheiben',unopened_packages:0},
 {id:'new-lot',product_id:'harry',inventory_id:'bread',purchased_on:'2026-11-11',
  opened_remaining_quantity:0,unopened_packages:1,package_quantity:9,package_unit:'Scheiben'}
]});
const pinned=(id,quantity,unit,product_id,inventory_id,extra={})=>
 ({id,name:product_id,quantity,unit,allocation_override:[
  {quantity,unit,product_id,inventory_id,...extra}]});
const breadMeal=()=>({
  id:'slice3and4',name:'Harry Vital+fit Brot',quantity:2,unit:'Scheiben',
  label:'2 Scheiben: Nr. 3 = 50 g und Nr. 4 = 53 g',
  allocation_override:[{quantity:2,unit:'Scheiben',product_id:'harry',
    inventory_id:'bread',lot_id:'old-lot',actual_weight_g:103,
    slice_numbers:[3,4],slice_weights_g:[50,53],estimated_not_measured:false}]
});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,
  String(actual)+' should be '+String(expected));

test('two separately weighed slices use 50+53=103g, never 2*50 or a pack average',()=>{
 const d=data(),item=breadMeal();
 const r=calculate([item],1,d);
 assert.equal(r.complete,true);
 near(r.kcal,241*1.03);near(r.protein,7.7*1.03);
 near(r.carbs,38*1.03);near(r.fat,4.9*1.03);
 assert.equal(nutritionProblem(item,d),null);
});
test('whole 12 Nov breakfast uses all four exact chosen real products',()=>{
 const d=data(),items=[
  breadMeal(),
  pinned('r',100,'g','ricotta','ricotta-stock'),
  pinned('t',152,'g','tomato','tomato-stock'),
  {id:'b',name:'Bio Basilikum',quantity:5,unit:'g'}
 ];
 const r=calculate(items,1,d);
 assert.equal(r.complete,true,JSON.stringify(r.missing||[]));
 near(r.kcal,241*1.03+181+18*1.52+23*.05);
 near(r.protein,7.7*1.03+9.2+.88*1.52+3.15*.05);
 near(r.carbs,38*1.03+4.5+3.89*1.52+.31*.05);
 near(r.fat,4.9*1.03+14+.2*1.52+.64*.05);
});
test('legacy numbered slices reject multiplying just Nr. 3 by quantity two',()=>{
 const source={product:bread,stock:data().inventory[0]};
 assert.equal(basisAmount({quantity:1,unit:'Scheiben',label:'Scheibe Nr. 3'},source),50);
 assert.equal(basisAmount({quantity:2,unit:'Scheiben',label:'Nr. 3 und Nr. 4'},source),103);
 assert.equal(basisAmount({quantity:2,unit:'Scheiben',label:'Scheibe Nr. 3'},source),null);
 assert.equal(basisAmount({quantity:1,unit:'Scheiben',label:'Scheibe Nr. 10'},source),null);
});
test('new unweighed pack must not inherit old pack slice weights',()=>{
 const d=data(),item={...breadMeal(),label:'Scheibe Nr. 3',
  quantity:1,allocation_override:[{quantity:1,unit:'Scheiben',
    product_id:'harry',inventory_id:'bread',lot_id:'new-lot'}]};
 const r=calculate([item],1,d);
 assert.equal(r.complete,false);
 assert.match(r.missing.join(' '),/nicht einzeln gewogen/);
});
test('new weighed pack may use its own measured gram amount',()=>{
 const d=data(),item={...breadMeal(),quantity:1,
  allocation_override:[{quantity:1,unit:'Scheiben',product_id:'harry',
    inventory_id:'bread',lot_id:'new-lot',actual_weight_g:61}]};
 const r=calculate([item],1,d);
 assert.equal(r.complete,true);
 near(r.kcal,241*.61);
});
test('chosen product remains authoritative after quantity reaches zero',()=>{
 const d=data();d.inventory.find(s=>s.id==='ricotta-stock').quantity=0;
 const i=pinned('r',100,'g','ricotta','ricotta-stock');
 near(calculate([i],1,d).kcal,181);
});
test('mismatched confirmed allocation never falls back silently',()=>{
 const i=pinned('r',80,'g','ricotta','ricotta-stock');
 i.quantity=100;
 const r=calculate([i],1,data());
 assert.equal(r.complete,false);
 assert.match(r.missing.join(' '),/Aufteilungsmenge/);
});
test('explicit variant reservation never reserves an additional family stock',()=>{
 const d=data();
 d.inventory.push(stock('other','Ricotta light',300,'g','Ricotta'));
 d.products.push({id:'other-product',inventory_id:'other',active:true,
   nutrition_per_100:{energy_kcal:120,protein_g:12,carbohydrates_g:4,fat_g:5}});
 const i=pinned('i',100,'g','ricotta','ricotta-stock');
 i.name='Ricotta';
 d.meals=[{id:'breakfast',meal_date:'2099-01-01',sort_order:1,status:'planned',
  food_meal_ingredients:[i]}];
 const plan=plannedMealAllocationState(d);
 const next=plan.contexts.get('breakfast');
 assert.ok(next);
 const quantities=Object.fromEntries(next.inventory.map(s=>[s.id,s.quantity]));
 assert.equal(quantities['ricotta-stock'],150);
 assert.equal(quantities.other,300);
});
test('missing macros in an explicitly selected pack are still flagged',()=>{
 const d=data();d.products.find(p=>p.id==='ricotta').nutrition_per_100.fat_g=null;
 const i=pinned('r',100,'g','ricotta','ricotta-stock');
 assert.match(nutritionProblem(i,d).reason,/Fett/);
});
