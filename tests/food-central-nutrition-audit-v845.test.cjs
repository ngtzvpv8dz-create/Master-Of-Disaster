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
 '  window.__modFoodNutritionV711.__test={collectNutritionAudit,auditMarkup,calculate,plannedMealAllocationState,nutritionProblem};\n'+anchor);
const win={},doc={documentElement:{},addEventListener(){}};
new Function('window','document','MutationObserver','setTimeout','clearTimeout',instrumented)(
 win,doc,class{observe(){}},()=>0,()=>0);
const {collectNutritionAudit,auditMarkup,calculate,plannedMealAllocationState,nutritionProblem}=win.__modFoodNutritionV711.__test;
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

test('linked future meal-prep leftover is calculated from original dinner without a fake no-ingredients error',()=>{
 const data=fresh();
 data.inventory.push(stock('s','Tomaten',800));
 data.products.push(product('p','s',{energy_kcal:20,protein_g:1,fat_g:0.2,carbohydrates_g:3}));
 data.meals=[
  {id:'source',meal_date:'2026-11-02',status:'planned',title:'Tomatenpfanne',meal_type:'dinner',
    prepared_servings:2,eaten_servings:1,
    food_meal_ingredients:[{...item('i','Tomaten',400),inventory_id:'s'}]},
  {id:'left',source_meal_id:'source',meal_date:'2026-11-03',status:'planned',title:'Rest Tomatenpfanne vom 02.11.',meal_type:'lunch',
    prepared_servings:1,eaten_servings:1,food_meal_ingredients:[]}
 ];
 const result=collectNutritionAudit(data,'2026-11-01');
 assert.equal(result.plannedMealTargets,0);
 assert.equal(result.blocking,0);
});
test('confirmed packet upper bounds for fat and protein are valid, not missing macros',()=>{
 const data=fresh();
 data.inventory.push(stock('s','Milkshake'));
 data.products.push(product('p','s',{energy_kcal:228.57,
   protein_g_lt:7.143,fat_g_lt:7.143,carbohydrates_g:20},
   {nutrition_review_needed:false,nutrition_verified_with_original_user_photos:true}));
 const result=collectNutritionAudit(data,'2026-11-01');
 assert.equal(result.productTargets,0);
 assert.equal(result.blocking,0);
});
test('coffee without mandatory dry nutrition remains informational, never an invented zero',()=>{
 const data=fresh();data.inventory.push(stock('coffee','Kaffeekapseln'));
 data.products.push(product('p','coffee',{},
   {nutrition_audit_exception_type:'coffee_dry_nutrition_not_mandatory'}));
 const result=collectNutritionAudit(data,'2026-11-01');
 assert.equal(result.blocking,0);
 assert.equal(result.review,1);
 assert.match(result.targets[0].issues[0].reason,/Keine 0-kcal-Erfindung/);
});
test('real piece No. 1 and No. 2 retain their individual gross measured weights',()=>{
 const data=fresh();
 data.inventory.push({...stock('ki','KiKoKa Kiwi',2),family_name:'Kiwi',unit:'Stück'});
 data.inventory.push({...stock('z','Zespri Kiwi',111),family_name:'Kiwi'});
 data.products.push(product('p','ki',{energy_kcal:54,protein_g:0.9,fat_g:0.3,carbohydrates_g:11.1},
  {individual_gross_piece_weights_g:[103,93]}));
 data.products.push(product('zp','z',{energy_kcal:48,protein_g:1.2,fat_g:0.6,carbohydrates_g:9}));
 data.meals=[
  {id:'k1',meal_date:'2026-11-02',status:'planned',sort_order:2,meal_type:'snack',
   food_meal_ingredients:[{...item('i1','Kiwi',1,'Stück'),
     label:'1 ganze KiKoKa-Kiwi Nr. 1 (103 g brutto inkl. Schale)',
     allocation_override:[{inventory_id:'ki',quantity:1,unit:'Stück'}]}]},
  {id:'k2',meal_date:'2026-11-03',status:'planned',sort_order:2,meal_type:'snack',
   food_meal_ingredients:[{...item('i2','Kiwi',1,'Stück'),
     label:'1 ganze KiKoKa-Kiwi Nr. 2 (93 g brutto inkl. Schale)',
     allocation_override:[{inventory_id:'ki',quantity:1,unit:'Stück'}]}]}
 ];
 const plan=plannedMealAllocationState(data);
 const kc1=calculate(data.meals[0].food_meal_ingredients,1,plan.contexts.get('k1'),plan.allocations.get('k1'));
 const kc2=calculate(data.meals[1].food_meal_ingredients,1,plan.contexts.get('k2'),plan.allocations.get('k2'));
 assert.ok(kc1.complete);assert.ok(kc2.complete);
 assert.ok(Math.abs(kc1.kcal-55.62)<1e-7);assert.ok(Math.abs(kc2.kcal-50.22)<1e-7);
 const audit=collectNutritionAudit(data,'2026-11-01');
 assert.equal(audit.blocking,0);
});
