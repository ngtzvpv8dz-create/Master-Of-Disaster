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
  assert.ok(js.includes("+retailerLine\\n      +'</div>'".replace('\\n','\n')));
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
  // A cache-buster is deliberately versioned and must not hard-code yesterday's build.
  const scripts=[...runtime.matchAll(/shopping-v678\\.js\\?v=([a-zA-Z0-9-]+)/g)].map(match=>match[1]);
  assert.equal(scripts.length,2,'shopping loaded on both relevant app surfaces');
  assert.equal(new Set(scripts).size,1,'both surfaces use the same shopping script build');
  assert.match(html,/shopping-v678\\.css\\?v=[a-zA-Z0-9-]+/);
  assert.match(css,/\\.shopping-retailer-line-v851/);
  assert.match(css,/\\.shopping-retailer-badge-v851/);
});
