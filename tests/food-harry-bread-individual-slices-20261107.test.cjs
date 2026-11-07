'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../food-nutrition-v711.js'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'../area-runtime-v609.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=source.indexOf('  function basisAmount(item,source){');
const end=source.indexOf('  function eggEdibleWeightFromKnownSize(product){',start);
assert.ok(start>=0&&end>start,'Actual live basisAmount function is present');
const num=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const lower=x=>String(x||'').trim().toLocaleLowerCase('de-DE');
const fn=new Function('number','text','eggEdibleWeightFromKnownSize',
  source.slice(start,end)+'\nreturn basisAmount;')(num,lower,()=>null);
const product={nutrition_per_100:{energy_kcal:241,protein_g:7.7},
  product_data:{numbered_slices:[52,58,50,53,56,56,59,55,56]
    .map((gross_weight_g,i)=>({slice_number:i+1,gross_weight_g}))}};
const amount=i=>fn({quantity:1,unit:'Scheiben',
  label:'Harry Vital+fit Brot · Scheibe Nr. '+i+' (genau gewogen)'},{product,stock:{note:''}});
test('Harry slice 1 consumes 1 slice but computes nutrition for exactly 52g',()=>{
  assert.equal(amount(1),52);
  assert.equal(product.nutrition_per_100.energy_kcal*amount(1)/100,125.32);
});
test('Harry slice 2 uses distinct measured 58g, not 52g nor 500/9 average',()=>{
  assert.equal(amount(2),58);
  assert.notEqual(amount(2),amount(1));
});
test('Missing numbered slice is NOT silently substituted with an average',()=>{
  assert.equal(amount(10),null);
});
test('Exact per-slice nutrition is referenced by the app loader and fresh cache key',()=>{
  assert.equal(runtime.split('food-nutrition-v711.js?v=20261107-harry-exact-slice-weights').length-1,4);
  assert.ok(html.includes('area-runtime-v609.js?v=20261107-harry-exact-slice-weights'));
});
