'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');

const start=source.indexOf('  const ingredientQuantityForDisplay=item=>{');
const end=source.indexOf('  const ingredientDisplay=item=>{',start);
assert.ok(start>0&&end>start,'whole slice UI formatter exists');
const fmtQty=(amount,unit)=>String(amount)+' '+String(unit||'');
const display=new Function('fmtQty',source.slice(start,end)+'return ingredientQuantityForDisplay;')(fmtQty);

test('single whole bread slice displays as one slice, not grams',()=>{
  assert.equal(display({name:'Vollkornbrot',quantity:56,unit:'g',label:'1 Scheibe Vollkornbrot (ca. 56 g)'}),'1 Scheibe');
});
test('two whole bread slices display as two slices',()=>{
  assert.equal(display({name:'Vollkornbrot',quantity:112,unit:'g',label:'2 Scheiben Vollkornbrot (ca. 112 g)'}),'2 Scheiben');
});
test('wraps retain their already correct whole piece count',()=>{
  assert.equal(display({name:'Wraps',quantity:2,unit:'Stück',label:'2 Stück Tortilla-Wrap'}),'2 Stück');
});
test('never invent a slice count from grams without a confirmed piece label',()=>{
  assert.equal(display({name:'Vollkornbrot',quantity:30,unit:'g',label:'30 g Vollkornbrot'}),'30 g');
  assert.equal(display({name:'Pita',quantity:45,unit:'g',label:'45 g Pita'}),'45 g');
});
test('declared piece weight must match grams stored for inventory accounting',()=>{
  assert.equal(display({name:'Vollkornbrot',quantity:30,unit:'g',label:'1 Scheibe Vollkornbrot (ca. 56 g)'}),'30 g');
  assert.equal(display({name:'Vollkornbrot',quantity:56,unit:'g',label:'1,5 Scheiben Vollkornbrot (ca. 56 g)'}),'56 g');
});
test('recipe and meal ingredient renderers use piece-aware formatter',()=>{
  assert.match(source,/return ingredientQuantityForDisplay\(item\)\+' '\+ingredientName\(item\)/);
  assert.match(source,/esc\(num\(item\.quantity\)===null\?'Menge offen':ingredientQuantityForDisplay\(item\)\)/);
  assert.match(source,/esc\(ingredientQuantityForDisplay\(item\)\)\+'<\/b>'/);
});
