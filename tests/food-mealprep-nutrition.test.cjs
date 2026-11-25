const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const cut=source.lastIndexOf("  document.addEventListener('click',event=>");
assert.ok(cut>0,'Nutrition module entry point');
const sandbox={};
new Function('window','document','MutationObserver',
  source.slice(0,cut)+'window.__test={nutritionForMeal,confirmedAllocationNutrition};})();'
)(sandbox,{documentElement:{}},class{observe(){}});
const {nutritionForMeal,confirmedAllocationNutrition}=sandbox.__test;
const ingredient={id:'pepper',name:'Blockpaprika grün',quantity:154,unit:'g',
  allocation_override:[{inventory_id:'stock',lot_id:'consumed-lot',product_id:'pepper-product',
    unit:'Stück',quantity:1,actual_weight_g:154}]};
const data={inventory:[],lots:[],products:[{id:'pepper-product',nutrition_per_100:{
  energy_kcal:35,protein_g:0.98,fat_g:0.21,carbohydrates_g:5.92}}]};
test('Consumed lot remains valid for historical nutrition, not current stock',()=>{
  const past=confirmedAllocationNutrition(ingredient,data,true);
  const live=confirmedAllocationNutrition(ingredient,data,false);
  assert.equal(past.complete,true);
  assert.equal(live.complete,false);
  assert.equal(past.kcal,53.9);
});
test('Meal prep divides all macros by measured cooked weight',()=>{
  const sourceMeal={id:'source',status:'completed',prepared_servings:2,
    food_meal_ingredients:[ingredient],prepared_sources_snapshot:{}};
  const meal={source_meal_id:'source',food_meal_ingredients:[],
    prepared_sources_snapshot:{nutrition_portion:{source_meal_id:'source',fraction:1216/2090,
      exclude_ingredient_ids:[]}}};
  const n=nutritionForMeal(meal,new Map(),new Map([['source',sourceMeal]]),data,data,null);
  assert.equal(n.complete,true);
  assert.ok(Math.abs(n.kcal-53.9*1216/2090)<1e-9);
  assert.ok(Math.abs(n.protein-1.5092*1216/2090)<1e-9);
  assert.ok(Math.abs(n.fat-.3234*1216/2090)<1e-9);
  assert.ok(Math.abs(n.carbs-9.1168*1216/2090)<1e-9);
});
test('Complete persisted macro snapshots never require consumed lots',()=>{
  const meal={source_meal_id:'source',food_meal_ingredients:[],
    prepared_sources_snapshot:{nutrition_portion:{macros:{
      kcal:1972.95,protein_g:135.56,fat_g:75.22,carbs_g:169.72}}}};
  const n=nutritionForMeal(meal,new Map(),new Map(),data,data,null);
  assert.equal(n.complete,true);
  assert.equal(n.protein,135.56);
  assert.equal(n.fat,75.22);
  assert.equal(n.carbs,169.72);
});
test('Separate side dishes are excluded before proportional scaling',()=>{
  const salad={id:'salad',name:'Salatgurke',quantity:401,unit:'g',
    allocation_override:[{inventory_id:'cucumber',product_id:'cucumber-product',
      unit:'g',quantity:401}]};
  const sourceMeal={id:'source',status:'completed',prepared_servings:2,
    food_meal_ingredients:[ingredient,salad],prepared_sources_snapshot:{}};
  const context={...data,products:[...data.products,{id:'cucumber-product',
    nutrition_per_100:{energy_kcal:14,protein_g:.6,fat_g:.2,carbohydrates_g:1.8}}]};
  const meal={source_meal_id:'source',food_meal_ingredients:[],
    prepared_sources_snapshot:{nutrition_portion:{source_meal_id:'source',
      fraction:1216/2090,exclude_ingredient_ids:['salad']}}};
  const n=nutritionForMeal(meal,new Map(),new Map([['source',sourceMeal]]),context,context,null);
  assert.equal(n.complete,true);
  assert.ok(Math.abs(n.kcal-53.9*1216/2090)<1e-9);
});

test('Cooking-time nutrition survives deletion of both lot and product',()=>{
  const sourceMeal={id:'source',status:'completed',prepared_servings:2,
    food_meal_ingredients:[ingredient],prepared_sources_snapshot:{sources:[{
      name:'Blockpaprika grün',inventory_id:'stock',unit:'Stück',quantity:1,
      nutrition_per_100:{energy_kcal:35,protein_g:.98,fat_g:.21,carbohydrates_g:5.92}
    }]}};
  const meal={source_meal_id:'source',food_meal_ingredients:[],
    prepared_sources_snapshot:{nutrition_portion:{source_meal_id:'source',
      fraction:.5,exclude_ingredient_ids:[]}}};
  const n=nutritionForMeal(meal,new Map(),new Map([['source',sourceMeal]]),
    {inventory:[],lots:[],products:[]},{inventory:[],lots:[],products:[]},null);
  assert.equal(n.complete,true);
  assert.equal(n.kcal,26.95);
  assert.equal(n.protein,.7546);
});

test('Completed source meal uses consumed grams plus separately eaten sides',()=>{
  const source={id:'source',status:'completed',eaten_servings:.84,
    food_meal_ingredients:[],prepared_sources_snapshot:{nutrition_consumed:{
      kcal:1896.83,protein_g:101.58,fat_g:96.66,carbs_g:140.5}}};
  const n=nutritionForMeal(source,new Map(),new Map([['source',source]]),
    data,data,null);
  assert.equal(n.complete,true);
  assert.ok(Math.abs(n.kcal*.84-1896.83)<1e-9);
  assert.ok(Math.abs(n.protein*.84-101.58)<1e-9);
});


// Actual lot evidence v2: no database writes, no live product lookups.
{
 const w={};
 new Function('window','document','MutationObserver',
   source.slice(0,cut)+'window.__test={calculate,withPreparedNutrition,nutritionForMeal,confirmedAllocationNutrition,nutritionProblem};})();'
 )(w,{documentElement:{}},class{observe(){}});
 const {calculate,withPreparedNutrition,nutritionForMeal,confirmedAllocationNutrition}=w.__test;
 const d={products:[],lots:[],inventory:[]},near=(a,b)=>typeof a==='number'&&Math.abs(a-b)<1e-7;
 const lot=(q,energy,unit='g',basis='per_100_g',id='l')=>({lot_id:id,product_id:'p'+id,quantity:q,unit,resolution:'profile_captured',nutrition_per_100:{basis,energy_kcal:energy,protein_g:10,fat_g:2,carbohydrates_g:5}});
 const row=(parts,unit='g',ingredient_id='i')=>({ingredient_id,quantity:parts.reduce((s,p)=>s+p.quantity,0),tracked_quantity:parts.reduce((s,p)=>s+p.quantity,0),unit,lot_sources:parts});
 const item=(rows,quantity=100,unit='g',name='Test',extra={})=>({id:'i',name,quantity,unit,prepared_lot_evidence:rows,...extra});
 const cases=[
 ['Single actual lot',item([row([lot(100,160)])]),n=>n.complete&&near(n.kcal,160)],
 ['Different products consumed together',item([row([lot(40,100),lot(60,200,'g','per_100_g','b')])]),n=>n.complete&&near(n.kcal,160)&&near(n.protein,10)],
 ['Multiple withdrawals',item([row([lot(40,100)]),row([lot(60,200)])]),n=>n.complete&&near(n.kcal,160)],
 ['Volume',item([row([lot(100,46,'ml','per_100_ml')],'ml')],100,'ml'),n=>n.complete&&near(n.kcal,46)],
 ['Mass-volume mismatch',item([row([lot(100,46,'g','per_100_ml')])]),n=>!n.complete],
 ['Documented soy density',item([row([lot(108,76,'g','per_100_ml')])],108,'g','Sojasoße'),n=>n.complete&&near(n.kcal,76)&&n.estimated],
 ['Incomplete quantity',item([row([lot(90,100)])]),n=>!n.complete],
 ['Untracked stock',item([row([{...lot(100,100),resolution:'untracked_stock'}])]),n=>!n.complete],
 ['Missing fat stays unknown',item([row([{...lot(100,100),nutrition_per_100:{basis:'per_100_g',energy_kcal:100,protein_g:5,carbohydrates_g:10}}])]),n=>n.complete&&n.fat===null],
 ['Unknown piece weight',item([row([lot(1,100,'stück')],'stück')],1,'stück'),n=>!n.complete],
 ['Prepared instead of dry',item([row([lot(100,100,'g','per_100_ml_prepared')])]),n=>!n.complete],
 ['Unknown drained basis',item([row([lot(100,100,'g','per_100_g_drained')])]),n=>!n.complete],
 ['Explicit drained ingredient',item([row([lot(100,100,'g','per_100_g_drained')])],100,'g','Kichererbsen abgetropft'),n=>n.complete&&near(n.kcal,100)],
 ['Pending edible weight',item([row([{...lot(100,100),nutrition_reference_pending_edible_weight:true}])]),n=>!n.complete],
 ['Implicit legacy package basis marked estimate',item([row([{...lot(100,100,'g',''),package_unit:'g'}])]),n=>n.complete&&n.estimated],
 ['Missing basis and package',item([row([lot(100,100,'g','')])]),n=>!n.complete],
 ['Empty new evidence',item([]),n=>!n.complete],
 ['Two measured slices',item([row([lot(2,241,'scheiben')],'scheiben')],2,'Scheiben','Brot',{allocation_override:[{lot_id:'l',product_id:'pl',quantity:2,unit:'Scheiben',slice_weights_g:[50,53]}]}),n=>n.complete&&near(n.kcal,248.23)],
 ['Gross produce approximation retained',item([row([lot(1,35,'stück','per_100_g_raw_edible')],'stück')],1,'Stück','Paprika rot',{allocation_override:[{lot_id:'l',product_id:'pl',quantity:1,unit:'Stück',gross_weight_g:154}]}),n=>n.complete&&near(n.kcal,53.9)&&n.estimated],
 ['Edible weight never assumed from gross',item([row([lot(1,60,'stück','per_100_g_raw_edible')],'stück')],1,'Stück','Mango essbar',{allocation_override:[{lot_id:'l',quantity:1,unit:'Stück',gross_weight_g:753}]}),n=>!n.complete],
 ['No unrelated piece weight',item([row([lot(1,35,'stück')],'stück')],1,'Stück','Paprika rot',{allocation_override:[{lot_id:'other',product_id:'pl',quantity:1,unit:'Stück',gross_weight_g:154}]}),n=>!n.complete],
 ['Size L eggs with established nominal edible weight',item([row([{...lot(2,150,'stück'),product_name:'Eier',product_variant:'Größe L'}],'stück')],2,'Stück','Eier'),n=>n.complete&&near(n.kcal,189)&&n.estimated],
 ['Recipe grams from explicitly measured piece',item([row([lot(1,35,'stück')],'stück')],154,'g','Paprika rot',{allocation_override:[{lot_id:'l',product_id:'pl',quantity:1,unit:'Stück',actual_weight_g:154}]}),n=>n.complete&&near(n.kcal,53.9)],
 ['Water stays zero',{id:'water',name:'Wasser',quantity:250,unit:'ml',prepared_lot_evidence:[]},n=>n.complete&&n.kcal===0]
 ];
 for(const [name,x,predicate] of cases)test('Lot evidence: '+name,()=>{
   const n=calculate([x],1,d);assert.ok(predicate(n),JSON.stringify(n));
 });
 const sourceMeal={id:'meal',status:'completed',prepared_servings:2,eaten_servings:1,food_meal_ingredients:[{id:'i',name:'Test',quantity:100,unit:'g'}],prepared_sources_snapshot:{nutrition_evidence_v2:[row([lot(40,100),lot(60,200,'g','per_100_g','b')])]}};
 test('Lot evidence: complete meal split into two servings',()=>{
   const n=nutritionForMeal(sourceMeal,new Map(),new Map([['meal',sourceMeal]]),d,d,null);
   assert.ok(n.complete&&near(n.kcal,80),JSON.stringify(n));
 });
 test('Lot evidence: measured Meal Prep share',()=>{
   const child={source_meal_id:'meal',food_meal_ingredients:[],prepared_sources_snapshot:{nutrition_portion:{source_meal_id:'meal',fraction:.25,exclude_ingredient_ids:[]}}};
   const n=nutritionForMeal(child,new Map(),new Map([['meal',sourceMeal]]),d,d,null);
   assert.ok(n.complete&&near(n.kcal,40),JSON.stringify(n));
 });
 test('Lot evidence: old saved nutrition outranks changed current catalogue',()=>{
   const historic={id:'i',name:'historisch',quantity:100,unit:'g',allocation_override:[{quantity:100,unit:'g',inventory_id:'s',product_id:'p',prepared_nutrition_per_100:{energy_kcal:100,protein_g:10,fat_g:1,carbohydrates_g:5}}]};
   const n=confirmedAllocationNutrition(historic,{...d,products:[{id:'p',nutrition_per_100:{energy_kcal:200,protein_g:20,fat_g:2,carbohydrates_g:10}}]},true);
   assert.ok(n.complete&&near(n.kcal,100),JSON.stringify(n));
 });
}
