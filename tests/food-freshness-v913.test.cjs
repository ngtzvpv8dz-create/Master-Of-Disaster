'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const p=require('../food-freshness-v913.js');
const read=filename=>fs.readFileSync(path.join(__dirname,'..',filename),'utf8');

test('fruit, vegetables, dairy, bread and long-storable exceptions',()=>{
  assert.equal(p.classify({name:'Avocado Hass'}),'fruit');
  assert.equal(p.classify({name:'Frische rote Blockpaprika'}),'vegetable');
  assert.equal(p.classify({name:'Körniger Frischkäse'}),'dairy');
  assert.equal(p.classify({name:'Magerquark'}),'dairy');
  assert.equal(p.classify({name:'Vollkornbrot'}),'bread');
  assert.equal(p.classify({name:'Vollkornwraps'}),'wrap');
  assert.equal(p.classify({name:'Kartoffeln'}),'durable');
  assert.equal(p.classify({name:'Zwiebeln'}),'durable');
  assert.equal(p.classify({name:'Knoblauch'}),'durable');
  assert.equal(p.classify({name:'TK-Erbsen'}),null);
});

test('Saturday shopping after breakfast and Wednesday after snack',()=>{
  assert.equal(p.purchaseAllowed('2026-11-21','2026-11-21','breakfast'),false);
  assert.equal(p.purchaseAllowed('2026-11-21','2026-11-21','lunch'),true);
  assert.equal(p.purchaseAllowed('2026-11-25','2026-11-25','snack'),false);
  assert.equal(p.purchaseAllowed('2026-11-25','2026-11-25','dinner'),true);
});

test('Dairy expires at following Saturday breakfast or Wednesday snack',()=>{
  assert.equal(p.deadline('2026-11-21','dairy'),'2026-11-28');
  assert.equal(p.afterDeadline('2026-11-21','dairy','2026-11-28','breakfast'),false);
  assert.equal(p.afterDeadline('2026-11-21','dairy','2026-11-28','lunch'),true);
  assert.equal(p.deadline('2026-11-25','dairy'),'2026-12-02');
  assert.equal(p.afterDeadline('2026-11-25','dairy','2026-12-02','snack'),false);
  assert.equal(p.afterDeadline('2026-11-25','dairy','2026-12-02','dinner'),true);
});

test('MHD overrides week and bread ideal week has up to 14 days max',()=>{
  assert.equal(p.deadline('2026-11-21','dairy',{mhd:'2026-11-24'}),'2026-11-24');
  assert.equal(p.afterDeadline('2026-11-21','dairy','2026-11-25','dinner',{mhd:'2026-11-24'}),true);
  assert.equal(p.deadline('2026-11-21','bread'),'2026-12-05');
  assert.equal(p.deadline('2026-11-21','wrap'),null);
  assert.equal(p.deadline('2026-11-21','durable'),null);
});

test('Opened canned item is due within seven days, unknown opening not invented',()=>{
  assert.equal(p.deadline('2026-11-21','canned',{openedOn:'2026-11-23'}),'2026-11-30');
  assert.equal(p.deadline('2026-11-21','canned'),null);
  assert.equal(p.deadline(null,'dairy',{mhd:'2026-11-25'}),'2026-11-25');
});

test('fruit grocery gaps get timely-use and pack-size warnings',()=>{
  const item={label:'Avocado Hass',inventory_id:'a',buyFrom:'2026-11-21',
    missing:1,unit:'Stück',uses:[{date:'2026-11-23',mealType:'dinner',quantity:1}]};
  const products=[{inventory_id:'a',package_unit:'Stück',package_quantity:5,active:true}];
  assert(p.gapIssues(item,products).some(i=>i.type==='pack'));
  assert.equal(p.gapIssues(item,[...products,{inventory_id:'a',package_unit:'Stück',package_quantity:1,active:true}]).length,0);
  assert(p.gapIssues({...item,uses:[{date:'2026-11-30',mealType:'dinner',quantity:1}]},[]).some(i=>i.type==='window'));
});

test('wrong shopping-slot cannot be silently bought for a prior meal',()=>{
  const gap={label:'Magerquark',buyFrom:'2026-11-25',missing:200,unit:'g',
    uses:[{date:'2026-11-25',mealType:'snack',quantity:200}]};
  assert(p.gapIssues(gap,[]).some(i=>i.type==='slot'&&i.block));
});

test('MHD-limited lot audit has no phantom certainty when unknown',()=>{
  const data={
    today:'2026-11-22',
    inventory:[{id:'q',name:'Magerquark',quantity:300,unit:'g'}],
    meals:[{meal_date:'2026-11-24',meal_type:'dinner',status:'planned',
      ingredients:[{inventory_id:'q',name:'Magerquark',quantity:100,unit:'g'}]}],
    lots:[{inventory_id:'q',unopened_packages:1,purchased_on:'2026-10-24',
      best_before_date:'2026-11-02',opened_remaining_quantity:0}]
  };
  assert(p.planIssues(data).some(i=>i.type==='lot'&&i.block));
  assert.equal(p.planIssues({...data,lots:[{inventory_id:'q',unopened_packages:1,best_before_date:null,purchased_on:null}]}).length,0);
});

test('automatic reserve without proven consumption is blocked, matching consumption allowed',()=>{
  const row={label:'Avocado Hass',general:{source:'food-stockup',needed_by:'2026-11-25'}};
  assert.equal(p.stockupIssues(row,[])[0].block,true);
  assert.equal(p.stockupIssues(row,[{name:'Avocado Hass',date:'2026-11-27'}]).length,0);
  assert.equal(p.stockupIssues({...row,general:{source:'manual'}},[]).length,0);
});

test('V1 uses one policy in both area loaders and displays actionable warnings',()=>{
  const loader=read('area-runtime-v609.js');
  const food=read('food-v544.js');
  const shopping=read('shopping-v678.js');
  assert.match(loader,/food-freshness-v913\.js/);
  assert.match(food,/ModFoodFreshnessV913\?\.auditPlan/);
  assert.match(food,/ModFoodFreshnessV913\?\.classify/);
  assert.match(shopping,/freshness\.stockupIssues/);
  assert.match(shopping,/row\.blockPurchase/);
  assert.match(shopping,/Einkauf gestoppt/);
});

test('V1 opening date is shown or explicitly unknown and editable without guessed dates',()=>{
  const food=read('food-v544.js');
  assert.match(food,/Öffnungsdatum unbekannt/);
  assert.match(food,/data-food-opened-date-lot/);
  assert.match(food,/openedDateInventoryLotModal/);
  assert.match(food,/batch_data:metadata/);
  assert.match(food,/\.eq\('updated_at',lot\.updated_at\)/);
  assert.match(food,/openedOn>todayIso\(\)/);
});

test('refrigerated meat only up to two days, frozen meat is handled separately',()=>{
  assert.equal(p.classify({name:'Hähnchenbrustfilet'}),'meat');
  assert.equal(p.deadline('2026-11-21','meat'),'2026-11-23');
  const gap={label:'Hähnchenbrustfilet',buyFrom:'2026-11-21',missing:300,unit:'g',
    uses:[{date:'2026-11-25',mealType:'dinner',quantity:300}]};
  assert(p.gapIssues(gap,[]).some(i=>i.type==='freeze'&&!i.block));
});

test('shelf-stable automatic buffer is not mistaken for unused fresh food',()=>{
  assert.equal(p.stockupIssues({label:'Langkornreis trocken',general:{source:'food-stockup',needed_by:'2026-11-25'}},[]).length,0);
  assert.equal(p.stockupIssues({label:'Avocado Hass',general:{source:'food-stockup',needed_by:'2026-11-25'}},[])[0].block,true);
});

test('fresh produce has exactly three inclusive calendar days',()=>{
  assert.equal(p.deadline('2026-11-25','fruit'),'2026-11-27');
  assert.equal(p.deadline('2026-11-25','vegetable'),'2026-11-27');
  assert.equal(p.afterDeadline('2026-11-25','vegetable','2026-11-27','dinner'),false);
  assert.equal(p.afterDeadline('2026-11-25','vegetable','2026-11-28','lunch'),true);
  assert.equal(p.deadline('2026-11-25','fruit',{mhd:'2026-11-26'}),'2026-11-26');
});
