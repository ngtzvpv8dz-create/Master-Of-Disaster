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
