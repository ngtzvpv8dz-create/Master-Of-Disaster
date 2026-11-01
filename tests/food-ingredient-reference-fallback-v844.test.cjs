'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../food-nutrition-v711.js'),'utf8');
const anchor='  schedule(450);\n})();';
assert.ok(src.includes(anchor));
const win={},doc={documentElement:{},addEventListener(){}};
const instrumented=src.replace(anchor,
 '  window.__modFoodNutritionV711.__test={calculate,sourceFor,referenceFor,nutritionText};\n'+anchor);
new Function('window','document','MutationObserver','setTimeout','clearTimeout',instrumented)(
 win,doc,class{observe(){}},()=>0,()=>0);
const {calculate,sourceFor,referenceFor,nutritionText}=win.__modFoodNutritionV711.__test;
const noStock={inventory:[],products:[],lots:[]};
const calc=(name,quantity,unit='g',data=noStock)=>
 calculate([{name,quantity,unit}],1,data);
const stock=(id,name,family,quantity,unit='g')=>
 ({id,name,family_name:family,quantity,unit,is_active:true,sort_order:20});
const prod=(id,inventory_id,nutrition_per_100)=>
 ({id,inventory_id,active:true,nutrition_per_100});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' should equal '+b);

test('BLS Hokkaido reference fills absent product, not inventory',()=>{
 const data={inventory:[stock('pumpkin','Hokkaido-Kürbis','Hokkaido-Kürbis',0)],products:[],lots:[]};
 const before=JSON.stringify(data);
 const n=calc('Hokkaido-Kürbis',700,'g',data);
 assert.equal(n.complete,true);near(n.kcal,217);near(n.protein,9.8);
 assert.equal(n.estimated,true);
 assert.equal(JSON.stringify(data),before,'no inventory creation or mutation');
});
test('generic Greek yogurt uses sole available 2% product, not absent 9.4%',()=>{
 const data={inventory:[
  stock('two','Milbona Joghurt','Griechischer Joghurt 2 %',900),
  stock('nine','Griechischer Joghurt Pur','Griechischer Joghurt 9,4 %',0)
 ],products:[
  prod('a','two',{energy_kcal:58,protein_g:6,fat_g:2,carbohydrates_g:4}),
  prod('b','nine',{energy_kcal:114,protein_g:3.1,fat_g:9.4,carbohydrates_g:3.5})
 ],lots:[]};
 const n=calc('Griechischer Joghurt',250,'g',data);
 assert.equal(n.complete,true);near(n.kcal,145);near(n.fat,5);
 assert.equal(n.estimated,true);
});
test('ambiguous Greek yogurt fat profiles stay unresolved when both are in stock',()=>{
 const data={inventory:[
  stock('two','Milbona Joghurt','Griechischer Joghurt 2 %',200),
  stock('nine','Griechischer Joghurt Pur','Griechischer Joghurt 9,4 %',200)
 ],products:[
  prod('a','two',{energy_kcal:58,protein_g:6,fat_g:2,carbohydrates_g:4}),
  prod('b','nine',{energy_kcal:114,protein_g:3.1,fat_g:9.4,carbohydrates_g:3.5})
 ],lots:[]};
 const n=calc('Griechischer Joghurt',250,'g',data);
 assert.equal(n.complete,false);
});
test('food quantities and units: source data for teriyaki g, soy sauce ml, baking powder packet',()=>{
 near(calc('Teriyaki-Sauce',75,'g').kcal,75);
 near(calc('Sojasauce',15,'ml').kcal,11.49);
 near(calc('Backpulver',1,'Päckchen').kcal,14.08);
 assert.equal(calc('Teriyaki-Sauce',20,'ml').complete,false);
});
test('normalized international labels Ají, Edamame, TK-Asia, mango are present',()=>{
 for(const [name,unit] of [
  ['Ají-Amarillo-Paste','g'],
  ['Edamame TK ohne Schote','g'],
  ['Mango (essbar)','g']
 ]){
  const n=calc(name,100,unit);
  assert.equal(n.complete,true,name);
  assert.equal(n.estimated,true,name);
 }
});
test('actual Bio frozen Asian pan is selected over generic reference',()=>{
 const db={inventory:[stock('asia','Bio-Gemüsepfanne Asiatische Art','Asia-Gemüse',950)],products:[
  prod('freshona','asia',{energy_kcal:46,protein_g:1.6,fat_g:1.2,carbohydrates_g:5.9})
 ],lots:[]};
 const n=calc('TK-Asiagemüse',440,'g',db);
 assert.equal(n.complete,true);near(n.kcal,202.4);
 assert.equal(n.estimated,true,'generic alias explicitly marked as inferred');
});
test('real confirmed prepared snapshot wins over present-day reference',()=>{
 const prepared={name:'Hokkaido-Kürbis',quantity:100,unit:'g',
  prepared_nutrition_per_100:{energy_kcal:55,protein_g:2,fat_g:1,carbohydrates_g:10}};
 const n=calculate([prepared],1,noStock);
 assert.equal(n.complete,true);near(n.kcal,55);near(n.carbs,10);
 assert.equal(n.estimated,false);
});
test('manufacturer <0.1 g carbohydrate remains upper bound, never exact zero',()=>{
 const data={inventory:[stock('hack','Hackfleisch gemischt','Hackfleisch gemischt',100)],products:[
  prod('p','hack',{energy_kcal:224,protein_g:19.4,fat_g:16.4,carbohydrates_g_lt:0.1})
 ],lots:[]};
 const n=calc('Hackfleisch gemischt',100,'g',data);
 assert.equal(n.complete,true);near(n.carbs,0.1);assert.equal(n.carbsBound,true);
 assert.match(nutritionText(n),/KH/);
 assert.match(nutritionText(n),/< 0,1 g KH/);
});
test('known product takes precedence over generic recipe comparison',()=>{
 const db={inventory:[stock('ricotta','Ricotta','Ricotta',200)],products:[
  prod('p','ricotta',{energy_kcal:190,protein_g:10,fat_g:15,carbohydrates_g:1})
 ],lots:[]};
 const n=calc('Ricotta',110,'g',db);
 assert.equal(n.complete,true);near(n.kcal,209);
 assert.equal(n.estimated,false);
});
