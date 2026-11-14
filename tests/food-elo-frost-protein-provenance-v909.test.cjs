'use strict';
// ELO-Frost 13/14 Nov 2026 regression with fixtures, no live inventory writes.
// Nutrients are from the exact named 1kg product (REWE item 3646033).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../food-nutrition-v711.js'),'utf8');
const anchor='  schedule(450);\n})();';
assert(src.includes(anchor),'nutrition module test anchor exists');
const instrumented=src.replace(anchor,
 '  window.__modFoodNutritionV711.__test={calculate,nutritionProblem,sourceFor,collectNutritionAudit};\n'+anchor);
const win={},doc={documentElement:{},addEventListener(){}};
new Function('window','document','MutationObserver','setTimeout','clearTimeout',instrumented)(
 win,doc,class{observe(){}},()=>0,()=>0);
const {calculate,nutritionProblem,sourceFor}=win.__modFoodNutritionV711.__test;
const stockId='elo-frost-2026-11-13',realLotId='elo-frost-purchased-2026-11-13',currentProductId='elo-frost-product';
const nutrition={
 basis:'per_100_g',energy_kj:137,energy_kcal:32,calories_kcal:32,
 fat_g:0.3,saturated_fat_g:0.1,carbohydrates_g:5.4,carbs_g:5.4,
 sugars_g:4.4,protein_g:1.3,salt_g:0.01
};
const build=()=>({
 inventory:[{id:stockId,name:'ELO Frost Zwiebelwürfel TK',family_name:'Zwiebeln TK gewürfelt',
  quantity:860,unit:'g',is_active:true,sort_order:10}],
 products:[{id:currentProductId,inventory_id:stockId,brand:'ELO Frost',
  product_name:'Zwiebelwürfel TK',variant:'gewürfelt · tiefgekühlt · 1 kg',
  nutrition_per_100:{...nutrition},active:true,
  product_data:{nutrition_review_needed:false}}],
 lots:[{id:realLotId,inventory_id:stockId,product_id:currentProductId,
  opened_packages:1,opened_remaining_quantity:860,opened_remaining_unit:'g',
  unopened_packages:0,package_quantity:1000,package_unit:'g',
  purchased_on:'2026-11-13'}],
 recipes:[],meals:[]
});
const todayIngredient={id:'elo-today',name:'Zwiebeln TK gewürfelt',quantity:90,unit:'g',inventory_id:null};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,String(a)+' vs '+String(b));
test('planned 90g frozen onion resolves to physical ELO-Frost product',()=>{
 const d=build();
 assert.equal(sourceFor(todayIngredient,d).product.id,currentProductId);
 assert.equal(nutritionProblem(todayIngredient,d),null);
 const result=calculate([todayIngredient],1,d);
 assert.equal(result.complete,true);
 close(result.kcal,28.8);
 close(result.protein,1.17);
 close(result.fat,0.27);
 close(result.carbs,4.86);
});
test('current lot product has all mandatory declared nutrition',()=>{
 const d=build();
 for(const field of ['energy_kj','energy_kcal','fat_g','saturated_fat_g',
   'carbohydrates_g','sugars_g','protein_g','salt_g'])
   assert.equal(typeof d.products[0].nutrition_per_100[field],'number',field);
 assert.equal(d.lots[0].product_id,d.products[0].id);
 assert.equal(d.inventory[0].quantity,860);
});
test('32 kcal with missing protein must yield an explicit error, not a zero protein value',()=>{
 const d=build();
 d.products[0].nutrition_per_100={energy_kcal:32};
 assert.notEqual(nutritionProblem(todayIngredient,d),null);
 const result=calculate([todayIngredient],1,d);
 assert.equal(result.complete,false);
 assert.match(result.missing.join(' '),/Zwiebeln TK gewürfelt/);
});
test('do not borrow fresh or historical onion values for current frozen ELO lot',()=>{
 const d=build();
 d.products.push({id:'wrong-old-fresh',brand:'GUT&GÜNSTIG',
  inventory_id:stockId,product_name:'Speisezwiebeln frisch',
  nutrition_per_100:{energy_kcal:29,protein_g:1.4,fat_g:0.3,carbohydrates_g:5},
  active:true});
 assert.equal(sourceFor(todayIngredient,d).product.id,currentProductId);
 close(calculate([todayIngredient],1,d).protein,1.17);
});
test('nutrition calculation never changes real stock or lot quantities',()=>{
 const d=build(),before=JSON.stringify(d);
 calculate([todayIngredient],1,d);
 nutritionProblem(todayIngredient,d);
 assert.equal(JSON.stringify(d),before);
});
