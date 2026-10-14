'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const original=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const anchor='  schedule(450);\n})();';
assert.ok(original.includes(anchor),'nutrition module remains testable');
const instrumented=original.replace(anchor,
  '  window.__modFoodNutritionV711.__test={genericFamilyAllocation,genericFamilyNutrition,calculate};\n  schedule(450);\n})();');
const win={};
const doc={documentElement:{},addEventListener(){}};
new Function('window','document','MutationObserver','setTimeout','clearTimeout',instrumented)(
  win,doc,class{observe(){}},()=>0,()=>0);
const {genericFamilyAllocation,calculate}=win.__modFoodNutritionV711.__test;
const item={name:'Apfel',quantity:1,unit:'Stück',inventory_id:null};
function data(pinkQuantity,pinkNutrition={},pinkWeight=null,grannyQuantity=0){
  return {
    inventory:[
      {id:'granny',name:'Granny Smith',quantity:grannyQuantity,unit:'Stück',family_name:'Apfel',is_active:true,sort_order:12},
      {id:'pink',name:'Pink Lady',quantity:pinkQuantity,unit:'Stück',family_name:'Apfel',is_active:true,sort_order:1098}
    ],
    products:[
      {id:'gp',inventory_id:'granny',nutrition_per_100:{energy_kcal:58,protein_g:.4},product_data:{piece_weight_g:150},package_unit:'g'},
      {id:'pp',inventory_id:'pink',nutrition_per_100:pinkNutrition,product_data:pinkWeight?{piece_weight_g:pinkWeight}:{},package_unit:'Stück'}
    ],
    lots:[]
  };
}
test('Apple recipe selects available Granny Smith without hard-coded inventory ID',()=>{
  const d=data(0,{},null,6);
  assert.equal(genericFamilyAllocation(item,d).allocations[0].stock.name,'Granny Smith');
  const result=calculate([item],1,d);
  assert.equal(result.complete,true);
  assert.equal(result.kcal,87);
});
test('Unknown Pink Lady nutrition is reported instead of silently using Granny Smith values',()=>{
  const d=data(6);
  assert.equal(genericFamilyAllocation(item,d).allocations[0].stock.name,'Pink Lady');
  const result=calculate([item],1,d);
  assert.equal(result.complete,false);
  assert.match(result.missing.join(' '),/Nährwertprodukt ungeklärt/);
});
test('Known Pink Lady nutrition uses its actual product and piece weight',()=>{
  const d=data(6,{energy_kcal:52,protein_g:.3},167);
  const result=calculate([item],1,d);
  assert.equal(result.complete,true);
  assert.ok(Math.abs(result.kcal-86.84)<.001);
  assert.ok(Math.abs(result.protein-.501)<.001);
});
test('No purchased apples yet does not set planned calorie amount to zero',()=>{
  const result=calculate([item],1,data(0));
  assert.equal(result.complete,true);
  assert.equal(result.kcal,87);
});
