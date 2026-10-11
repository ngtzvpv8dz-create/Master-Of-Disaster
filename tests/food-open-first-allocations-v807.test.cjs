'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const a=source.indexOf('  function familyAllocationStockParts(');
const b=source.indexOf('  function familyAllocationLotDate(',a);
assert(a>=0&&b>a,'General meal source allocation must exist');

function arrange(stock,lots,freezer=[]){
  const ctx={
    state:{lots,freezer,products:[{id:'product',brand:'Test',product_name:stock.name}]},
    inventoryQuantityInUnit:()=>({available:Number(stock.quantity),unitMismatch:false}),
    familyAllocationLotQuantity:()=>0,
    familyAllocationConvertQuantity:(v,from,to)=>{
      if(from===to)return v;
      if(from==='kg'&&to==='g')return v*1000;
      if(from==='g'&&to==='kg')return v/1000;
      if(from==='l'&&to==='ml')return v*1000;
      if(from==='ml'&&to==='l')return v/1000;
      return null;
    },
    familyFrozenFirstFor:s=>/hack|fleisch|huhn/i.test(s.name),
    frozenStorageLocation:s=>/tiefkühl|gefrier|frozen/i.test(String(s||'')),
    familyAllocationProductLabel:s=>s.name,
    familyAllocationProductText:()=>stock.name,
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(a,b)+'\nthis.split=familyAllocationStockParts;',ctx);
  return (quantity,skipped=0)=>ctx.split(stock,'g',quantity,skipped)
    .map(p=>({grams:p.quantity,label:p.label,wasFrozen:p.frozen}));
}

test('actual thawing meat first, 100g frozen reserved for separate later meal',()=>{
  const stock={id:'hack',name:'Hackfleisch gemischt',quantity:831,unit:'g'};
  const lots=[
    {id:'thaw',inventory_id:'hack',opened_remaining_quantity:40,opened_remaining_unit:'g',opened_packages:1,unopened_packages:0,package_quantity:40,package_unit:'g',storage_location:'Kühlschrank',best_before_date:'2026-10-06',product_id:'product'},
    {id:'fresh',inventory_id:'hack',opened_remaining_quantity:691,opened_remaining_unit:'g',opened_packages:1,unopened_packages:0,package_quantity:800,package_unit:'g',storage_location:null,best_before_date:'2026-10-17',product_id:'product'},
    {id:'wrap',inventory_id:'hack',opened_remaining_quantity:100,opened_remaining_unit:'g',opened_packages:1,unopened_packages:0,package_quantity:100,package_unit:'g',storage_location:'Tiefkühler',best_before_date:'2026-10-17',product_id:'product'}
  ];
  const freezer=[
    {frozen_lot_id:'thaw',status:'thawing',meal_ingredient_id:'lasagne'},
    {frozen_lot_id:'wrap',status:'frozen',meal_ingredient_id:'wrap'}
  ];
  const split=arrange(stock,lots,freezer);
  const today=split(490);
  assert.deepEqual(today.map(p=>p.grams),[40,450]);
  assert(today[0].label.includes('ältere TK-Portion'));
  assert(today[1].label.includes('angebrochene Packung'));
  assert.deepEqual(split(241,490).map(p=>p.grams),[241]);
  assert.deepEqual(split(100,731).map(p=>p.grams),[100]);
  assert.equal(split(100,731)[0].wasFrozen,true);
});

test('passierte Tomaten: 44g from opened pack, 256g from untouched pack in same lot',()=>{
  const stock={id:'tomato',name:'Passierte Tomaten',quantity:1044,unit:'g'};
  const lots=[{id:'one',inventory_id:'tomato',opened_remaining_quantity:44,opened_remaining_unit:'g',
    opened_packages:1,unopened_packages:2,package_quantity:500,package_unit:'g',
    storage_location:null,best_before_date:'2028-05-14',product_id:'product'}];
  const split=arrange(stock,lots)(300);
  assert.deepEqual(split.map(x=>x.grams),[44,256]);
  assert(split[0].label.includes('angebrochene Packung'));
  assert(split[1].label.includes('neue Packung'));
});

test('Mozzarella: 25g of older opened cheese and 75g of sealed new pack',()=>{
  const stock={id:'cheese',name:'Mozzarella Light',quantity:150,unit:'g'};
  const lots=[
    {id:'old',inventory_id:'cheese',opened_remaining_quantity:25,opened_remaining_unit:'g',unopened_packages:0,package_quantity:125,package_unit:'g',product_id:'product'},
    {id:'new',inventory_id:'cheese',opened_remaining_quantity:null,opened_remaining_unit:null,unopened_packages:1,package_quantity:125,package_unit:'g',product_id:'product'}];
  const split=arrange(stock,lots)(100);
  assert.deepEqual(split.map(x=>x.grams),[25,75]);
  assert(split[0].label.includes('angebrochene Packung'));
  assert(split[1].label.includes('neue Packung'));
});

test('new open pack outranks older sealed pack, not only for Sunday lasagne',()=>{
  const stock={id:'x',name:'Generic product',quantity:300,unit:'g'};
  const lots=[
    {id:'opened',inventory_id:'x',opened_remaining_quantity:35,opened_remaining_unit:'g',
      unopened_packages:0,package_quantity:100,package_unit:'g',best_before_date:'2027-02-01'},
    {id:'sealed',inventory_id:'x',opened_remaining_quantity:null,unopened_packages:1,
      package_quantity:265,package_unit:'g',best_before_date:'2026-11-01'}];
  assert.deepEqual(arrange(stock,lots)(80).map(x=>x.grams),[35,45]);
});
