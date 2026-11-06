'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../shopping-v678.js'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'../area-runtime-v609.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const norm=x=>String(x||'').toLocaleLowerCase('de-DE').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const packStart=js.indexOf('  function skyrPackPurchasePlan(item){');
const packEnd=js.indexOf('  function buildRows(){',packStart);
assert.ok(packStart>0&&packEnd>packStart,'real product-pack planner found');
const skyrPackPurchasePlan=new Function('state','shoppingNormalize','familyText',
  js.slice(packStart,packEnd)+'\nreturn skyrPackPurchasePlan;')(
  {food:{inventory:[{id:'stock-skyr',family_name:'Skyr Natur',is_active:true}]},
    products:[{id:'milbona-500',inventory_id:'stock-skyr',package_quantity:500,package_unit:'g',active:true},
      {id:'edeka-1000',inventory_id:'stock-skyr',package_quantity:1000,package_unit:'g',active:true}]},
  norm,x=>String(x||'').trim().toLocaleLowerCase('de-DE'));
test('260 grams recipe need creates exactly one 500 gram shopping package',()=>{
  assert.deepEqual(skyrPackPurchasePlan({label:'Skyr Natur',missing:260,unit:'g'}),{quantity:500,packs:1});
  assert.deepEqual(skyrPackPurchasePlan({label:'Skyr Natur',missing:760,unit:'g'}),{quantity:1000,packs:2});
  assert.equal(skyrPackPurchasePlan({label:'Teriyaki-Sauce',missing:75,unit:'ml'}),null);
});

const anchor=js.indexOf('    const shoppingFamily=name=>');
const end=js.indexOf('    return included;',anchor);
assert.ok(anchor>0&&end>anchor,'real shopping row deduplication found');
const holidayStart=js.indexOf('  const effectiveShoppingDate=iso=>');
const holidayEnd=js.indexOf('  const fmtDate=iso=>',holidayStart);
const effectiveShoppingDate=new Function(js.slice(holidayStart,holidayEnd)+'\nreturn effectiveShoppingDate')();
const actualDedupe=new Function(
  'rows','todayIso','fmtDate','fmtQty','collator','food','inventory','shoppingFamilyLabel','effectiveShoppingDate','shoppingNormalize',
  'let rowMap;\n'+js.slice(anchor,end+'    return included;'.length)
);
const run=rows=>actualDedupe(rows,()=> '2026-11-06',x=>x,(v,u)=>v+' '+u,
  new Intl.Collator('de-DE'),{plannedShoppingUses:[]},[],x=>x,effectiveShoppingDate,norm);
test('Friday 500g Skyr buy covers Wednesday 260g recipe even five days later',()=>{
  const general={id:'skyr-buy',source:'general',section:'now',label:'Skyr Natur',
    general:{quantity:500,unit:'g',needed_by:'2026-11-06'},secondary:''};
  const gap={id:'skyr-gap',source:'food-gap',section:'now',label:'Skyr Natur',
    neededDate:'2026-11-11',foodAction:{stockQuantity:260,stockUnit:'g'}};
  const actual=run([gap,general]);
  assert.equal(actual.length,1,'must never show 500g plus 260g in one shopping window');
  assert.equal(actual[0].id,'skyr-buy');
  assert.equal(actual[0].general.quantity,500,'do not increase 500g package');
});
test('unconnected ingredients do not disappear under Skyr deduplication',()=>{
  const gap={id:'need-chicken',source:'food-gap',section:'now',label:'Hähnchenbrustfilet',
    neededDate:'2026-11-07',foodAction:{stockQuantity:360,stockUnit:'g'}};
  assert.equal(run([gap]).length,1);
});
test('latest app runtime references shopping source consistently',()=>{
  assert.equal((runtime.match(/shopping-v678\.js\?v=20261106-skyr-teriyaki-reconcile/g)||[]).length,2);
  assert.match(html,/area-runtime-v609\.js\?v=20261106-skyr-teriyaki-reconcile/);
});
