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
const end=js.indexOf('    // Only dates of real planned recipes',anchor);
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

test('shopping cards show only the next recipe date and one useful package hint',()=>{
  const start=js.indexOf('  function shoppingCompactDescription(row){');
  const end=js.indexOf('  function rowMarkup(row){',start);
  assert.ok(start>0&&end>start);
  const describe=new Function(
    'state','fmtQty','fmtDate','shoppingNormalize',
    js.slice(start,end)+'\nreturn shoppingCompactDescription'
  )({food:{inventory:[]}},(q,u)=>q+' '+u,d=>d.slice(8,10)+'.'+d.slice(5,7),x=>String(x||'').toLowerCase());
  const repeated=Array.from({length:12},(_,i)=>'Rezeptbedarf '+i+': 3 g').join('\n');
  const pepper={
    source:'general',section:'later',label:'Pfeffer schwarz (ganze Körner)',
    nextUseDate:'2026-10-28',
    general:{source:'food-month-audit',label:'Pfeffer schwarz gemahlen'},
    secondary:repeated+'\n🏬 Empfehlung: REWE'
  };
  assert.equal(describe(pepper),'Nächster Bedarf: 28.10');
  const paprika={
    source:'food-gap',section:'later',label:'Paprika rot',
    nextUseDate:'2026-10-28',packHint:'Packungsvorschlag: 2 × 500 g Spitzpaprika',
    secondary:repeated
  };
  assert.equal(describe(paprika),'Nächster Bedarf: 28.10\nPackungsvorschlag: 2 × 500 g Spitzpaprika');
  assert.doesNotMatch(describe(pepper),/Gesamtkaufmenge|Rezeptbedarf|Filialbestand|Empfehlung|Packungsgröße prüfen/);
  assert.match(js,/compactDescription=shoppingCompactDescription\(row\)/);
  assert.match(css,/white-space:pre-line/);
  assert.match(css,/overflow-wrap:anywhere/);
  assert.match(html,/shopping-v678\.css\?v=866-shopping-unit-above-stock/);
  assert.match(runtime,/shopping-v678\.js\?v=868-grocery-layout-and-units/);
});


test('food labels use consistent categories across source tables',()=>{
  const prefix=js.slice(js.indexOf('  const shoppingNormalize=value=>'),js.indexOf('  function client(){'));
  const fn=js.slice(js.indexOf('  function shoppingCategory(row){'),js.indexOf('  function rowMarkup(row){'));
  const classify=new Function(prefix+fn+'\nreturn shoppingCategory')();
  for(const [label,expected] of [
    ['Birne','Obst'],['Blattsalat (frisch)','Gemüse'],['Salatgurke','Gemüse'],
    ['H-Milch 1,5 %','Milch'],['Naturjoghurt mild (1,5 % Fett)','Milchprodukte'],
    ['Langkornreis (lose, trocken)','Trockenwaren'],
    ['Naturreis (lose, trocken)','Trockenwaren'],['Paprika rot','Gemüse'],
    ['Hähnchenbrustfilet','Fleisch'],['Edamame TK (ohne Schote)','Tiefkühlkost']
  ]){
    assert.equal(classify({label,source:'food-gap',category:'Lebensmittel'}),expected,label);
  }
});

test('food shopping cards have only the cart action; warning has a full line above stock',()=>{
  const block=js.slice(js.indexOf('  function rowMarkup(row){'),js.indexOf('  function sectionMarkup('));
  assert.match(block,/data-shopping-cart/);
  assert.doesNotMatch(block,/data-shopping-food-complete|data-shopping-food-check|data-shopping-later/);
  assert.match(block,/shopping-unit-warning-v866/);
  assert.ok(block.indexOf('shopping-unit-warning-v866')<block.indexOf('shopping-current-stock-v701'));
  assert.doesNotMatch(block,/class="is-warn"/);
  assert.match(css,/\.shopping-item-meta-v643>\.shopping-unit-warning-v866/);
  assert.match(css,/white-space:normal/);
});
