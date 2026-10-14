'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'shopping-v678.js'), 'utf8');
const start = source.indexOf('  function checkoutSnapshot(){');
const end = source.indexOf('\n  function productOptions(', start);
assert.ok(start >= 0 && end > start, 'checkoutSnapshot source is present');
const snapshot = source.slice(start, end);

function checkout(substitution) {
  const row = {
    section:'cart', key:'stock:granny', source:'food-gap',
    label:'Granny Smith', category:'Lebensmittel',
    foodAction:{stockId:'granny-stock',stockQuantity:6,stockUnit:'Stück'},
    substitution
  };
  const products = [
    {id:'granny-product',inventory_id:'granny-stock'},
    {id:'pink-product',inventory_id:'pink-stock'}
  ];
  const execute = new Function(
    'rowMap', 'state', 'cartPlannedQuantity', 'cartPlannedUnit',
    'defaultProductForCartItem', 'defaultPackageCount',
    snapshot+'\nreturn checkoutSnapshot();'
  );
  return execute(
    new Map([['x',row]]), {products},
    item=>item.foodAction.stockQuantity,
    item=>item.foodAction.stockUnit,
    item=>products.find(product=>product.inventory_id===item.inventoryId)||null,
    ()=>1
  )[0];
}

test('original Granny Smith retains its own inventory and product', ()=>{
  const item=checkout(null);
  assert.equal(item.inventoryId, 'granny-stock');
  assert.equal(item.productId, 'granny-product');
});

test('unknown Pink Lady cannot inherit Granny Smith inventory or product', ()=>{
  const item=checkout({
    id:'replacement',replacement_label:'Pink Lady Äpfel',
    replacement_quantity:6,replacement_unit:'Stück',
    replacement_inventory_id:null,replacement_product_id:null,
    purchase_data:{piece_count:6,estimated_total_weight_g:1000}
  });
  assert.equal(item.inventoryId, null);
  assert.equal(item.productId, null);
  assert.equal(item.label, 'Pink Lady Äpfel');
  assert.equal(item.plannedQuantity, 6);
  assert.deepEqual(item.purchaseData, {piece_count:6,estimated_total_weight_g:1000});
});

test('explicit known Pink Lady product maps only to Pink Lady inventory', ()=>{
  const item=checkout({
    id:'replacement',replacement_label:'Pink Lady Äpfel',
    replacement_quantity:6,replacement_unit:'Stück',
    replacement_inventory_id:'pink-stock',replacement_product_id:'pink-product',
    purchase_data:{piece_count:6,estimated_total_weight_g:1000}
  });
  assert.equal(item.inventoryId, 'pink-stock');
  assert.equal(item.productId, 'pink-product');
});

test('checkout snapshot carries extra purchase data into saved checkout item', ()=>{
  assert.match(source, /purchase_data:item\.purchaseData\|\|\{\}/);
  assert.match(source, /purchase_data:payload\.purchaseData\|\|\{\}/);
  assert.match(source, /data-substitution-pieces/);
  assert.match(source, /data-substitution-weight/);
});
