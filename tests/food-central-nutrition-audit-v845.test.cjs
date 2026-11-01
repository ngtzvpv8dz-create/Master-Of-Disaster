'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../food-nutrition-v711.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../food-v544.js'),'utf8');
const anchor='  schedule(450);\n})();';
assert.ok(code.includes(anchor));
assert.ok(html.includes('data-food-nutrition-audit'));
const instrumented=code.replace(anchor,
 '  window.__modFoodNutritionV711.__test={collectNutritionAudit,auditMarkup};\n'+anchor);
const win={},doc={documentElement:{},addEventListener(){}};
new Function('window','document','MutationObserver','setTimeout','clearTimeout',instrumented)(
 win,doc,class{observe(){}},()=>0,()=>0);
const {collectNutritionAudit,auditMarkup}=win.__modFoodNutritionV711.__test;
const item=(id,name,quantity=100,unit='g')=>({id,name,quantity,unit});
const stock=(id,name,quantity=100)=>({id,name,quantity,unit:'g',is_active:true});
const product=(id,inventory_id,nutrition_per_100,product_data={})=>({
 id,inventory_id,brand:'Test',product_name:'Birne',active:true,nutrition_per_100,product_data
});
const full={energy_kcal:57,protein_g:.4,fat_g:.1,carbohydrates_g:13};
const fresh=()=>({recipes:[],meals:[],inventory:[],products:[],lots:[]});
test('single complete scan covers recipe even without any rendered card',()=>{
 const data=fresh();
 data.recipes=[{id:'recipe',title:'Rezept',servings:1,
   food_recipe_ingredients:[item('z','Unbekannte Zutat')]}];
 const result=collectNutritionAudit(data,'2026-11-01');
 assert.equal(result.recipeTargets,1);
 assert.equal(result.blocking,1);
 assert.match(auditMarkup(result),/data-food-audit-open="recipe"/);
});
test('all future planned meal problems are collected, not only today',()=>{
 const data=fresh();
 data.meals=[
  {id:'today',meal_date:'2026-11-01',title:'Heute',status:'planned',meal_type:'lunch',
    food_meal_ingredients:[item('a','Unbekannt A')]},
  {id:'future',meal_date:'2026-11-04',title:'Zukunft',status:'planned',meal_type:'dinner',
    food_meal_ingredients:[item('b','Unbekannt B')]},
  {id:'old',meal_date:'2026-10-20',title:'Vergangenheit',status:'planned',
    food_meal_ingredients:[item('c','Unbekannt C')]},
  {id:'done',meal_date:'2026-11-01',title:'Abgeschlossen',status:'completed',
    food_meal_ingredients:[item('d','Unbekannt D')]}
 ];
 const result=collectNutritionAudit(data,'2026-11-01');
 assert.equal(result.plannedMealTargets,2);
 assert.equal(result.blocking,2);
 assert.equal(result.targets[0].id,'today');
 assert.equal(result.targets[1].id,'future');
});
test('each available product variant reports missing macros independently',()=>{
 const data=fresh();
 data.inventory.push(stock('s','Birne'));
 data.products.push(product('p1','s',{energy_kcal:57,protein_g:.4}));
 data.products.push(product('p2','s',{energy_kcal:60,protein_g:.5,fat_g:.2}));
 const result=collectNutritionAudit(data,'2026-11-01');
 assert.equal(result.productTargets,2);
 assert.equal(result.blocking,2);
 assert.equal(result.review,0);
});
test('physical lot only checks its matching real product, not outdated variant',()=>{
 const data=fresh();data.inventory.push(stock('s','Birne'));
 data.products.push(product('p1','s',{}),product('p2','s',full));
 data.lots.push({id:'l',inventory_id:'s',product_id:'p2',
  unopened_packages:1,opened_remaining_quantity:0});
 const result=collectNutritionAudit(data,'2026-11-01');
 assert.equal(result.productTargets,0);
});
test('optional reference instead of pack is a review, not a blocking gap',()=>{
 const data=fresh();
 data.inventory.push(stock('s','Birne'));
 data.products.push(product('p','s',full,{nutrition_reference_only:true}));
 const result=collectNutritionAudit(data,'2026-11-01');
 assert.equal(result.productTargets,1);
 assert.equal(result.review,1);
 assert.equal(result.blocking,0);
});
test('review and unresolved entries disappear upon full correction',()=>{
 const data=fresh();data.inventory.push(stock('s','Birne'));
 data.products.push(product('p','s',{energy_kcal:57,protein_g:.4}));
 const first=collectNutritionAudit(data,'2026-11-01');
 data.products[0].nutrition_per_100={...full};
 const second=collectNutritionAudit(data,'2026-11-01');
 assert.equal(first.total,1);
 assert.equal(second.total,0);
 assert.match(auditMarkup(second),/Keine offenen Nährwertpunkte/);
});
test('audit HTML escapes dangerous data and navigates to source IDs',()=>{
 const data=fresh();data.recipes.push({id:'r<1',title:'<script>alert(1)</script>',
   servings:1,food_recipe_ingredients:[item('i','Unbekannt')]});
 const text=auditMarkup(collectNutritionAudit(data,'2026-11-01'));
 assert.ok(!text.includes('<script>'));
 assert.match(text,/&lt;script&gt;/);
 assert.match(text,/data-food-audit-open="r&lt;1"/);
});
test('audit is strictly read-only for inventories and meal snapshots',()=>{
 const data=fresh();
 data.meals.push({id:'m',status:'completed',meal_date:'2026-11-01',title:'Fertig',
   prepared_sources_snapshot:{sources:[{name:'Original',quantity:100}]},
   food_meal_ingredients:[item('i','Unbekannt')]});
 data.products.push(product('p','unused',{}));
 const prior=JSON.stringify(data);
 collectNutritionAudit(data,'2026-11-01');
 assert.equal(JSON.stringify(data),prior);
});

test('unlinked planned leftovers have a precise source-link error instead of fake ingredients',()=>{
 const data=fresh();
 data.meals.push({id:'left',meal_date:'2026-11-03',status:'planned',title:'Rest Kartoffel-Ei-Tortilla vom 02.11.',food_meal_ingredients:[]});
 const result=collectNutritionAudit(data,'2026-11-01');
 assert.equal(result.plannedMealTargets,1);
 assert.equal(result.blocking,1);
 assert.match(result.targets[0].issues[0].reason,/Ausgangsmahlzeit verknüpft/);
 assert.doesNotMatch(result.targets[0].issues[0].name,/Keine Zutaten/);
});
