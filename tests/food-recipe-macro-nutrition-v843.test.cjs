'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const anchor='  schedule(450);\n})();';
assert.ok(source.includes(anchor),'Nutrition test export anchor exists');
const instrumented=source.replace(anchor,
 '  window.__modFoodNutritionV711.__test={calculate,chooseProduct,genericFamilyNutrition,mixedLotNutrition,withPreparedNutrition,combine,nutritionText};\n'+anchor);
const win={},doc={documentElement:{},addEventListener(){}};
new Function('window','document','MutationObserver','setTimeout','clearTimeout',instrumented)(
 win,doc,class{observe(){}},()=>0,()=>0);
const {calculate,chooseProduct,withPreparedNutrition,combine,nutritionText}=win.__modFoodNutritionV711.__test;
const nutrition=(kcal=100,protein=10,fat=5,carbs=20)=>({
 energy_kcal:kcal,protein_g:protein,fat_g:fat,carbohydrates_g:carbs,
 saturated_fat_g:2,sugars_g:15
});
const item=(name,quantity,unit='g',inventory_id=null)=>({name,quantity,unit,inventory_id});
const stock=(id,name,quantity,unit='g',family_name='')=>({
 id,name,quantity,unit,family_name,is_active:true,sort_order:100
});
const product=(id,inventory_id,n)=>({
 id,inventory_id,active:true,nutrition_per_100:n
});
const single=(n)=>({
 inventory:[stock('s','Test',100)],products:[product('p','s',n)],lots:[]
});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' expected '+b);

test('calculates fat and carbs only once; sugars and saturated fats are subsets',()=>{
 const r=calculate([item('Test',100,'g','s')],1,single(nutrition()));
 assert.equal(r.complete,true);
 assert.equal(r.kcal,100);
 assert.equal(r.protein,10);
 assert.equal(r.fat,5);
 assert.equal(r.carbs,20);
 assert.match(nutritionText(r),/5 g Fett/);
 assert.match(nutritionText(r),/20 g KH/);
});
test('divides summed macros by recipe servings',()=>{
 const r=calculate([item('Test',50,'g','s'),item('Test',50,'g','s')],2,single(nutrition(100,10,8,22)));
 assert.equal(r.kcal,50);assert.equal(r.protein,5);
 assert.equal(r.fat,4);assert.equal(r.carbs,11);
});
test('unknown macros remain unknown while calorie and protein totals stay available',()=>{
 const r=calculate([item('Test',100,'g','s')],1,single({energy_kcal:100,protein_g:10,carbohydrates_g:20}));
 assert.equal(r.complete,true);assert.equal(r.kcal,100);
 assert.equal(r.fat,null);assert.equal(r.carbs,20);
 assert.doesNotMatch(nutritionText(r),/g Fett|g KH/);
});
test('mixed brands with same kcal/protein cannot silently choose fat/carbs',()=>{
 const rows=[
 product('a','s',nutrition(100,10,5,15)),
 product('b','s',nutrition(100,10,8,30))
 ];
 const selected=chooseProduct(rows);
 assert.ok(selected);
 assert.equal(selected.nutrition_per_100.energy_kcal,100);
 assert.equal(selected.nutrition_per_100.fat_g,null);
 assert.equal(selected.nutrition_per_100.carbohydrates_g,null);
 const r=calculate([item('Test',100,'g','s')],1,{
  inventory:[stock('s','Test',100)],products:rows,lots:[]
 });
 assert.equal(r.complete,true);assert.equal(r.kcal,100);
 assert.equal(r.fat,null);assert.equal(r.carbs,null);
});
test('generic family allocates actual 50+50 gram products, not a random first brand',()=>{
 const rows={
  inventory:[stock('a','Light',50,'g','Example'),stock('b','Normal',50,'g','Example')],
  products:[product('ap','a',nutrition(100,10,2,3)),product('bp','b',nutrition(200,20,8,15))],
  lots:[]
 };
 const r=calculate([item('Example',100)],1,rows);
 assert.equal(r.complete,true);assert.equal(r.kcal,150);
 assert.equal(r.protein,15);assert.equal(r.fat,5);assert.equal(r.carbs,9);
});
test('prepared original nutrition overrides later current stock and brand',()=>{
 const prepared=item('Test',50,'g',null);
 prepared.prepared_nutrition_per_100=nutrition(180,20,6,9);
 const r=calculate([prepared],1,single(nutrition(100,10,1,1)));
 assert.equal(r.kcal,90);assert.equal(r.protein,10);
 assert.equal(r.fat,3);assert.equal(r.carbs,4.5);
});
test('meal-prep combine retains unknown macros instead of treating them as zero',()=>{
 const r=combine(
  {complete:true,kcal:200,protein:10,fat:5,carbs:20},
  {complete:true,kcal:50,protein:2,fat:null,carbs:3}
 );
 assert.equal(r.complete,true);assert.equal(r.kcal,250);
 assert.equal(r.fat,null);assert.equal(r.carbs,23);
});
test('snapshot selector requires unique matching name/quantity/unit',()=>{
 const meal={status:'completed',prepared_sources_snapshot:{sources:[
  {name:'Test',unit:'g',quantity:100,nutrition_per_100:nutrition()}
 ]}};
 const [found]=withPreparedNutrition([item('Test',100)],meal);
 assert.equal(found.prepared_nutrition_per_100.fat_g,5);
 const [missing]=withPreparedNutrition([item('Test',80)],meal);
 assert.equal(missing.prepared_nutrition_per_100,undefined);
});
