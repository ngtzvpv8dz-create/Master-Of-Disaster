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
const id='red-stock',lotId='red-lot',pId='red-component';
const nutrition={basis:'per_100_g_edible_reference',energy_kcal:43,protein_g:1.3,
  fat_g:0.5,carbohydrates_g:6.4,sugars_g:6.4,fiber_g:3.6,saturated_fat_g_lt:0.1,salt_g_lt:0.1};
const data=()=>({
  inventory:[{id,name:'Blockpaprika rot',family_name:'Paprika rot',quantity:2,
    unit:'Stück',is_active:true,sort_order:1}],
  products:[{id:pId,inventory_id:id,brand:'GUT&GÜNSTIG',product_name:'Paprika Mix · rote Blockpaprika',
    active:true,nutrition_per_100:nutrition,product_data:{nutrition_weight_basis:'purchase_gross'}}],
  lots:[{id:lotId,inventory_id:id,product_id:pId,opened_packages:1,unopened_packages:0,
    opened_remaining_quantity:2,opened_remaining_unit:'Stück',package_quantity:2,package_unit:'Stück',
    batch_data:{gross_weights_g:[130,138],nutrition_weight_basis:'purchase_gross'}}],
  meals:[],recipes:[]
});
const item=(olderWeights=null)=>({
  id:'meal-red',name:'Paprika rot',quantity:2,unit:'Stück',
  label:'Blockpaprika rot (2 Stück, 268 g brutto)',
  allocation_override:[130,138].map((gross,i)=>({
    lot_id:lotId,inventory_id:id,product_id:pId,unit:'Stück',quantity:1,
    piece_id:lotId+':'+(i+1),gross_weight_g:gross,
    ...(olderWeights?{piece_weight_g:olderWeights[i]}:{})
  }))
});
test('unlinked real pepper lot is detected even when manually assigned product exists',()=>{
  const d=data();d.lots[0].product_id=null;
  assert.match(api.nutritionProblem(item(),d).reason,/Vorratscharge ohne Produktzuordnung/);
});
test('linked physical pepper lot is preferred over older varieties',()=>{
  const d=data();
  d.products.push({id:'old-variant',inventory_id:id,brand:'Old',product_name:'Paprika alt',
    active:true,nutrition_per_100:{energy_kcal:10,protein_g:0,fat_g:0,carbohydrates_g:1}});
  assert.equal(api.sourceFor(item(),d).product.id,pId);
});
test('130+138 grams gross at purchase fully calculate pepper calories and macros, no second weighing',()=>{
  const d=data(),m=item();
  assert.equal(api.nutritionProblem(m,d),null);
  const result=api.calculate([m],1,d);
  assert.equal(result.complete,true);
  assert.ok(Math.abs(result.kcal-43*268/100)<1e-8);
  assert.ok(Math.abs(result.protein-1.3*268/100)<1e-8);
  assert.ok(Math.abs(result.fat-0.5*268/100)<1e-8);
  assert.ok(Math.abs(result.carbs-6.4*268/100)<1e-8);
});
test('older edible-weight fields never override available purchase gross',()=>{
  const d=data(),m=item([110,119]);
  assert.equal(api.nutritionProblem(m,d),null);
  assert.ok(Math.abs(api.calculate([m],1,d).kcal-43*268/100)<1e-8);
});
test('lot purchase weighing still works when ingredient has piece IDs but no copied gross',()=>{
  const d=data(),m=item();
  m.allocation_override.forEach(x=>delete x.gross_weight_g);
  const n=api.calculate([m],1,d);
  assert.equal(n.complete,true);
  assert.ok(Math.abs(n.kcal-43*268/100)<1e-8);
});
test('gross rule also covers fruit skins, vegetable ends and onion skins',()=>{
  for(const name of ['Banane','Zwiebel','Zucchini','Salatgurke','Möhre','Karotte','Aubergine','Paprika grün','Kiwi','Apfel','Avocado']){
    const d=data(),m=item();
    d.inventory[0].name=name;d.inventory[0].family_name=name;d.products[0].product_name=name;
    m.name=name;
    assert.equal(api.nutritionProblem(m,d),null,name);
    const n=api.calculate([m],1,d);
    assert.equal(n.complete,true,name);
    assert.ok(Math.abs(n.kcal-43*268/100)<1e-8,name);
  }
});
test('missing purchase weight does not request new edible net weighing during cooking',()=>{
  const d=data(),m=item();
  m.allocation_override.forEach(x=>{delete x.gross_weight_g;x.piece_id='unknown';});
  d.lots[0].batch_data={};
  const problem=api.nutritionProblem(m,d);
  assert.equal(problem.missingPurchaseWeight,true);
  assert.match(problem.reason,/Bruttogewicht vom Einkauf/);
  assert.doesNotMatch(problem.reason,/Nettogewicht wiegen/);
});
test('UI never asks for cleaned or peeled net grams',()=>{
  assert.match(source,/Einkaufs-Bruttogewicht nicht dokumentiert/);
  assert.match(source,/Gewichtsdokumentation:/);
  assert.doesNotMatch(source,/Bitte nach dem Entkernen das essbare Nettogewicht/);
  assert.match(source,/if\(!lot\.product_id\)return/);
});
