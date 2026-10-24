'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'..','shopping-v678.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','shopping-v678.css'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'..','area-runtime-v609.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

const first=js.indexOf('  function shoppingRetailerHint(row){');
const last=js.indexOf('  function rowMarkup(row){',first);
assert.ok(first>=0&&last>first,'V851 retailer badge helper exists');
const getRetailer=new Function(js.slice(first,last)+'return shoppingRetailerHint;')();
const row=(store,source='general')=>({source,general:{purchase_data:{retailer_suggestion:store}}});

test('retailer recommendations are normalized and allowlisted',()=>{
  assert.equal(getRetailer(row('REWE')),'REWE');
  assert.equal(getRetailer(row(' EDEKA ')),'EDEKA');
  assert.equal(getRetailer(row('lidl')),'Lidl');
  assert.equal(getRetailer(row('Fachhandel')),'Fachhandel');
  assert.equal(getRetailer(row('<script>')),'');
  assert.equal(getRetailer(row('REWE','food-gap')),'');
  assert.equal(getRetailer({source:'general',general:{purchase_data:{}}}),'');
});
test('recommendation is placed on a dedicated compact secondary row, never into label',()=>{
  assert.match(js,/const retailerLine=retailer/);
  assert.match(js,/\+retailerLine\s*\+\x27<\\/div>\x27/);
  assert.match(js,/HÄNDLER-TIPP/);
  assert.match(js,/Empfehlung, keine bestätigte Filialverfügbarkeit/);
  assert.match(js,/esc\(retailer\)/);
  assert.match(css,/shopping-retailer-line-v851/);
  assert.match(css,/shopping-retailer-badge-v851/);
});
test('legacy notes store suggestion is hidden from visible notes to avoid duplicate',()=>{
  assert.match(js,/const cleanNotes=String\(item.notes\|\|\x27\x27\)/);
  assert.match(js,/startsWith\(\x27🏬 Empfehlung:\x27\)/u);
  assert.match(js,/\[cleanNotes,packageDetails\]/);
});
test('runtime and CSS fetch fresh retailer badge assets',()=>{
  assert.equal(runtime.match(/shopping-v678\.js\?v=851-retailer-badge/g)?.length,2);
  assert.match(html,/shopping-v678\.css\?v=851-retailer-badge/);
});
