'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','shopping-v678.js'),'utf8');

const start=source.indexOf('  function shoppingProductSearchKey(');
const end=source.indexOf('  function openModal(){',start);
assert.ok(start>=0&&end>start,'V813 shopping helpers are available');
const products=[
  {id:'pink',product_name:'Pink Lady Äpfel',category:'Lebensmittel',inventory_id:'pink-stock',package_unit:'Stück',package_quantity:null,active:true},
  {id:'granny',product_name:'Granny Smith',category:'Lebensmittel',inventory_id:'granny-stock',package_unit:'g',active:true},
  ...Array.from({length:500},(_,i)=>({id:'dummy'+i,product_name:'Beispielprodukt '+i,category:'Sonstiges',active:true}))
];
const state={products};
const helpers=new Function('state','productLabel','fmtQty','esc',source.slice(start,end)+
  'return {matchingKnownShoppingProducts,parseShoppingExtraData,shoppingPackageSummary,shoppingExtraFieldsHtml};')(
  state,p=>p.product_name,(q,u)=>q+' '+u,s=>String(s)
);
const {matchingKnownShoppingProducts:match,parseShoppingExtraData:parse,shoppingPackageSummary:summary}=helpers;

test('autocomplete searches an existing product amongst 500+ entries without guessing IDs',()=>{
  assert.deepEqual(match('Pink La').map(x=>x.product.id),['pink']);
  assert.deepEqual(match('Granny').map(x=>x.product.id),['granny']);
  assert.deepEqual(match('does-not-exist'),[]);
});

test('six apples plus approximate kilogram remain six inventory pieces',()=>{
  const d=parse({pieceCount:'6',estimatedWeightG:'1000',outerPackages:'1'},6,'Stück');
  assert.deepEqual(d,{piece_count:6,estimated_total_weight_g:1000,outer_package_count:1});
  assert.match(summary(d),/1000 g/);
});

test('one outer package with four 150-g rice bags has 600 g total',()=>{
  const d=parse({outerPackages:'1',innerPerOuter:'4',innerQuantity:'150',innerUnit:'g'},600,'g');
  assert.equal(d.inner_units_total,4);
  assert.equal(d.inner_unit_quantity,150);
  assert.equal(d.inner_unit_unit,'g');
  assert.equal(d.inner_units_openable,true);
});

test('reject inconsistent piece or nested package counts',()=>{
  assert.throws(()=>parse({pieceCount:'5'},6,'Stück'),/übereinstimmen/);
  assert.throws(()=>parse({outerPackages:'1',innerPerOuter:'4',innerQuantity:'150',innerUnit:'g'},500,'g'),/Gesamtmenge/);
});

const ss=source.indexOf('  function checkoutSnapshot(){');
const se=source.indexOf('  function productOptions(',ss);
assert.ok(ss>=0&&se>ss);
const snapshot=new Function('rowMap','state','cartPlannedQuantity','cartPlannedUnit','defaultProductForCartItem','defaultPackageCount',
  source.slice(ss,se)+'return checkoutSnapshot();');

function run(general){
  const row={section:'cart',source:'general',key:'general:1',label:general.label,category:'Lebensmittel',general};
  return snapshot(new Map([['general:1',row]]),state,r=>r.general.quantity,r=>r.general.unit,()=>null,()=>null)[0];
}

test('selected Pink Lady stays linked to the real product & stock through checkout',()=>{
  const d=parse({pieceCount:'6',estimatedWeightG:'1000',outerPackages:'1'},6,'Stück');
  const item=run({label:'Pink Lady Äpfel',quantity:6,unit:'Stück',product_id:'pink',purchase_data:d,notes:'In einer Tüte'});
  assert.equal(item.productId,'pink');
  assert.equal(item.inventoryId,'pink-stock');
  assert.equal(item.packageCount,1);
  assert.equal(item.purchaseData.estimated_total_weight_g,1000);
  assert.equal(item.note,'In einer Tüte');
});

test('four inner rice bags become four lots but only 600 g inventory',()=>{
  const d=parse({outerPackages:'1',innerPerOuter:'4',innerQuantity:'150',innerUnit:'g'},600,'g');
  const item=run({label:'Reis',quantity:600,unit:'g',product_id:null,purchase_data:d,notes:null});
  assert.equal(item.plannedQuantity,600);
  assert.equal(item.packageCount,4);
  assert.equal(item.inventoryId,null);
});

test('purchase metadata survives checkout item persistence',()=>{
  assert.match(source,/purchase_data:item\.purchaseData\|\|\{\}/);
  assert.match(source,/product_id:chosenProductId,purchase_data:purchaseData/);
  assert.match(source,/product_id,purchase_data'\)/);
});
