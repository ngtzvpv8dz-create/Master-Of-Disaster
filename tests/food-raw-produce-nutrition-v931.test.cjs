'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../food-nutrition-v711.js'),'utf8');
const anchor='  schedule(450);\n})();';
assert.ok(code.includes(anchor),'Calculator bootstrap marker must remain available');
const instrumented=code.replace(anchor,
  '  window.__modFoodNutritionV711.__v931Test={calculate,referenceFor,genericFamilyAllocation,nutritionProblem};\n'+anchor);
const win={},doc={documentElement:{},addEventListener(){}};
new Function('window','document','MutationObserver','setTimeout','clearTimeout',instrumented)(
  win,doc,class{observe(){}},()=>0,()=>0);
const {calculate,referenceFor,genericFamilyAllocation,nutritionProblem}=win.__modFoodNutritionV711.__v931Test;

function sample(name='Radieschen',family='Radieschen',kcal=18,profile={}) {
 const stock={id:'stock',name:name+' frisch · Test',family_name:family,
   quantity:250,unit:'g',is_active:true,created_at:'2026-11-21T11:00:00Z'};
 const product={id:'product',inventory_id:'stock',product_name:name,active:true,
   nutrition_per_100:{energy_kcal:kcal,protein_g:1.05,fat_g:0.14,carbohydrates_g:2.31},
   product_data:profile};
 const lots=[{id:'lot',inventory_id:'stock',product_id:'product',unopened_packages:1,
   opened_remaining_quantity:0,package_quantity:250,package_unit:'g',purchased_on:'2026-11-21'}];
 return {recipes:[],meals:[],inventory:[stock],products:[product],lots};
}

test('100 g radishes can be allocated against existing 250 g fresh stock, with all 4 macros',()=>{
 const data=sample('Radieschen','Radieschen',18,{nutrition_reference_only:true});
 const item={id:'ingredient',name:'Radieschen',quantity:100,unit:'g'};
 const allocation=genericFamilyAllocation(item,data);
 assert.equal(allocation.complete,true);
 assert.equal(allocation.remaining,0);
 assert.equal(allocation.allocations.length,1);
 assert.equal(allocation.allocations[0].take,100);
 assert.equal(allocation.allocations[0].stock.id,'stock');
 const n=calculate([item],1,data);
 assert.equal(n.complete,true);
 assert.equal(n.kcal,18);
 assert.equal(n.protein,1.05);
 assert.equal(n.fat,0.14);
 assert.equal(n.carbs,2.31);
 assert.equal(n.estimated,true,'BLS reference must be identifiable as an estimate');
 assert.equal(nutritionProblem(item,data),null);
});

test('documented BLS reference is available without creating fake physical inventory',()=>{
 const radish=referenceFor({name:'Radieschen',quantity:100,unit:'g'});
 const lettuce=referenceFor({name:'Feldsalat',quantity:100,unit:'g'});
 assert.equal(radish.nutrition.kcal,18);
 assert.equal(lettuce.nutrition.kcal,18);
 assert.equal(lettuce.nutrition.protein,1.9);
 assert.equal(radish.reference,true);
 assert.equal(lettuce.reference,true);
});

test('labelled exact manufacturer macros are not marked as reference or estimated',()=>{
 const data=sample('Radieschen','Radieschen',21,{nutrition_reference_only:false});
 const n=calculate([{id:'ing',name:'Radieschen',quantity:100,unit:'g'}],1,data);
 assert.equal(n.complete,true);
 assert.equal(n.kcal,21);
 assert.equal(n.estimated,false);
});
