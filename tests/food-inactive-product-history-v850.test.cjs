'use strict';
// Regression: deactivated catalogue products remain legitimate for existing physical lots.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const nutrition=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');

function between(src,start,end){
  const a=src.indexOf(start);
  const b=src.indexOf(end,a+start.length);
  assert(a>=0&&b>a,'Source segment missing: '+start);
  return src.slice(a,b);
}
test('Nutrition and Food fetch historical products rather than filtering active only',()=>{
  const n=between(nutrition,"supabase.from('shopping_products')","supabase.from('food_inventory_lots')");
  const f=between(food,"safeQuery('Produktstamm'","safeQuery('Kreatin-Einnahmen'");
  assert.match(n,/nutrition_per_100/);
  assert.doesNotMatch(n,/\.eq\('active',true\)/);
  assert.doesNotMatch(f,/\.eq\('active',true\)/);
});
test('Existing lot may resolve archived product while untracked stock only chooses selectable products',()=>{
  const ctx={chooseProduct:rows=>rows[0]||null,number:value=>Number(value)||0};
  vm.createContext(ctx);
  vm.runInContext(between(nutrition,'  function productForStock(','  function rowMode(')+'\nthis.findProduct=productForStock;',ctx);
  const old={id:'old',inventory_id:'berries',active:false};
  const live={id:'current',inventory_id:'berries',active:true};
  const stock={id:'berries'};
  assert.equal(ctx.findProduct(stock,{products:[old,live],lots:[{inventory_id:'berries',product_id:'old',unopened_packages:1}]}).id,'old');
  assert.equal(ctx.findProduct(stock,{products:[old,live],lots:[]}).id,'current');
});
test('Nutrition warning is not raised for inactive but existing product with valid nutrients',()=>{
  const ctx={
    ZERO_NAMES:new Set(),
    text:x=>String(x||'').toLowerCase(),
    itemName:x=>x.name,
    number:x=>Number(x),
    nutritionOf:p=>({kcal:p.nutrition_per_100?.energy_kcal??null,protein:p.nutrition_per_100?.protein_g??null}),
    mixedLotNutrition:()=>({complete:true}),
    genericFamilyNutrition:()=>null,
    sourceFor:()=>null,
    basisAmount:()=>100
  };
  vm.createContext(ctx);
  vm.runInContext(between(nutrition,'  function nutritionProblem(','  const alarmEscape=')+'\nthis.validate=nutritionProblem;',ctx);
  const ingredient={id:'breakfast-berries',name:'Himbeeren',inventory_id:'berries',quantity:125,unit:'g'};
  const stock={id:'berries',name:'Himbeeren'};
  const lot={id:'lot',inventory_id:'berries',product_id:'old',unopened_packages:1,package_quantity:125};
  const old={id:'old',active:false,brand:'Driscoll',product_name:'Himbeeren',nutrition_per_100:{energy_kcal:43,protein_g:1.3}};
  assert.equal(ctx.validate(ingredient,{inventory:[stock],lots:[lot],products:[old]}),null);
  assert.match(ctx.validate(ingredient,{inventory:[stock],lots:[lot],products:[]}).reason,/keinen gültigen Produktstamm/);
});
test('New FOOD lots continue to offer only active catalogue entries',()=>{
  assert.match(food,/Archived catalogue entries remain resolvable/);
  assert.match(food,/const products=\(state\?\.products\|\|\[\]\)\.filter\(p=>p\.active!==false&&String\(p\.inventory_id/);
});
