'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../food-nutrition-v711.js'),'utf8');
const anchor='  schedule(450);\n})();';
assert(source.includes(anchor),'Food nutrition V711 test anchor');
const instrumented=source.replace(anchor,
  '  window.__modFoodNutritionV711.__test={nutritionProblem,calculate,sourceFor,measuredPaprikaNutrition};\n'+anchor);
const win={},doc={documentElement:{},addEventListener(){}};
new Function('window','document','MutationObserver','setTimeout','clearTimeout',instrumented)(
  win,doc,class{observe(){}},()=>0,()=>0);
const api=win.__modFoodNutritionV711.__test;
const id='red-stock', lotId='red-lot', pId='red-component';
const nutrition={
  basis:'per_100_g_edible_reference',energy_kcal:43,protein_g:1.3,
  fat_g:0.5,carbohydrates_g:6.4,sugars_g:6.4,fiber_g:3.6,
  saturated_fat_g_lt:0.1,salt_g_lt:0.1
};
const data=()=>({
  inventory:[{id,name:'Blockpaprika rot',family_name:'Paprika rot',quantity:2,
    unit:'Stück',is_active:true,sort_order:1}],
  products:[{id:pId,inventory_id:id,brand:'GUT&GÜNSTIG',product_name:'Paprika Mix · rote Blockpaprika',
    active:true,nutrition_per_100:nutrition,product_data:{gross_weights_g:[130,138],
      requires_edible_weight_at_preparation:true}}],
  lots:[{id:lotId,inventory_id:id,product_id:pId,opened_packages:1,unopened_packages:0,
    opened_remaining_quantity:2,opened_remaining_unit:'Stück',package_quantity:2,package_unit:'Stück',
    batch_data:{gross_weights_g:[130,138],edible_weights_unknown:true}}],
  meals:[],recipes:[]
});
const item=(netWeights=null)=>({
  id:'meal-red',name:'Paprika rot',quantity:2,unit:'Stück',
  label:'Blockpaprika rot (2 Stück, 268 g brutto)',
  allocation_override:[130,138].map((gross,i)=>({
    lot_id:lotId,inventory_id:id,product_id:pId,unit:'Stück',quantity:1,
    piece_id:lotId+':'+(i+1),gross_weight_g:gross,
    ...(netWeights?{piece_weight_g:netWeights[i]}:{edible_weight_pending:true})
  }))
});
test('old regression: physically stocked red pepper lot with null product ID is explicitly detected',()=>{
  const d=data();d.lots[0].product_id=null;
  const p=api.nutritionProblem(item(),d);
  assert.match(p.reason,/Vorratscharge ohne Produktzuordnung/);
  assert.doesNotMatch(p.reason,/Hersteller-Nährwerte fehlen/);
});
test('newly linked complete red-pepper profile is used from current physical lot, not old varieties',()=>{
  const d=data();
  d.products.push({id:'old-variant',inventory_id:id,brand:'Old',product_name:'Paprika alt',
    active:true,nutrition_per_100:{energy_kcal:10,protein_g:0,fat_g:0,carbohydrates_g:1}});
  assert.equal(api.sourceFor(item(),d).product.id,pId);
  assert.equal(api.sourceFor(item(),d).nutrition.kcal,43);
});
test('gross 130g + 138g must NOT be interpreted as edible weights or complete meal calories',()=>{
  const d=data();
  const m=item();
  const problem=api.nutritionProblem(m,d);
  assert.equal(problem.needsWeight,true);
  assert.match(problem.reason,/Nährwertprofil ist bereits zugeordnet/);
  assert.match(problem.reason,/essbare Nettogewicht/);
  const result=api.calculate([m],1,d);
  assert.equal(result.complete,false);
  assert.match(result.missing.join(' '),/Stückgewicht fehlt/);
});
test('after real cleaned net weights, meal calories and all macros come from correct red profile',()=>{
  const d=data();
  // Synthetic verified weights only in this regression fixture. No user stock updated.
  const m=item([110,119]);
  assert.equal(api.nutritionProblem(m,d),null);
  const result=api.calculate([m],1,d);
  assert.equal(result.complete,true);
  assert.ok(Math.abs(result.kcal-43*229/100)<1e-8);
  assert.ok(Math.abs(result.protein-1.3*229/100)<1e-8);
  assert.ok(Math.abs(result.fat-0.5*229/100)<1e-8);
  assert.ok(Math.abs(result.carbs-6.4*229/100)<1e-8);
});
test('weight-only UI warnings are not presented as absent nutrient profiles',()=>{
  assert.match(source,/Essbares Nettogewicht noch wiegen/);
  assert.match(source,/Mengenprüfung:/);
  assert.match(source,/if\(!lot\.product_id\)return/);
});
