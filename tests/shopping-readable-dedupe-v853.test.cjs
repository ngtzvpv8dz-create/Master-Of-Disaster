'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const js=fs.readFileSync(path.join(__dirname,'../shopping-v678.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../shopping-v678.css'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'../area-runtime-v609.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

const anchor=js.indexOf('    const shoppingFamily=name=>');
const end=js.indexOf('    const providers=rows.filter',anchor);
assert.ok(anchor>0&&end>anchor,'dedupe shopping family resolver in real source');
const shoppingFamily=new Function(js.slice(anchor,end)+'\nreturn shoppingFamily')();

test('known true duplicates use one shopping family; different beef cuts stay separate',()=>{
  assert.equal(shoppingFamily('Mageres Hackfleisch'),'lean_beef_mince');
  assert.equal(shoppingFamily('Mageres Rinderhack 5 %'),'lean_beef_mince');
  assert.equal(shoppingFamily('Rinderhack mager'),'lean_beef_mince');
  assert.notEqual(shoppingFamily('Mageres Rindfleisch (für Streifen)'),'lean_beef_mince');
  assert.equal(shoppingFamily('Kreuzkümmel gemahlen'),'cumin');
  assert.equal(shoppingFamily('Hähnchenbrust frisch'),'chicken_breast');
  assert.equal(shoppingFamily('Hähnchenbrust'),'chicken_breast');
  assert.equal(shoppingFamily('Karotten'),'carrots');
  assert.equal(shoppingFamily('Naturjoghurt 1,5 %'),'plain_yogurt');
});

test('shopping UI merges by product, purchase date, safety window and actual uncovered amount',()=>{
  assert.match(js,/entry\.family!==family/);
  assert.match(js,/entry\.remaining-=covered/);
  assert.match(js,/const days=dayDifference\(needed,entry\.shopDate\)/);
  assert.match(js,/entry\.remaining-=covered/);
  assert.match(js,/if\(uncovered<=0\.0001\)continue/);
  assert.match(js,/rowMap=new Map\(included\.map/);
  assert.match(js,/data-shopping-cart/);
});

test('date and notes get their own readable lines on narrow screens',()=>{
  assert.match(js,/Einkauf vorgesehen am /);
  assert.match(js,/shopping-secondary-v853/);
  assert.match(js,/shopping-timing-v853/);
  assert.match(css,/\.shopping-item-meta-v643>\.shopping-secondary-v853/);
  assert.match(css,/white-space:pre-line/);
  assert.match(css,/overflow-wrap:anywhere/);
  assert.match(html,/shopping-v678\.css\?v=853-readable-shopping-cards/);
  assert.match(runtime,/shopping-v678\.js\?v=862-shopping-recipe-family-validation/);
});
