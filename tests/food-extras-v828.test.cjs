'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const src=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const start=src.indexOf('  function addConsumedExtrasToDays(');
const end=src.indexOf('  function dailySummary(',start);
assert.ok(start>=0&&end>start,'Extra-Tagesintegration vorhanden');
const addExtras=new Function('number',src.slice(start,end)+'return addConsumedExtrasToDays;')(
  value=>value===null||value===undefined||value===''?null:Number(value)
);
const s=src.indexOf('  function dailySummary('),e=src.indexOf('  function setText(',s);
const dailySummary=new Function('formatNumber',src.slice(s,e)+'return dailySummary;')(
  (v,max=1)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:max}).format(v)
);

test('gespeicherter Red Bull wird zu Mahlzeiten addiert, nicht ersetzt',()=>{
  const totals=new Map([['2026-10-16',{kcal:410,protein:29,meals:2,unresolved:0}]]);
  addExtras(totals,[{consumption_date:'2026-10-16',calories_kcal:112.5,protein_g:0}]);
  const day=totals.get('2026-10-16');
  assert.equal(day.kcal,522.5);
  assert.equal(day.protein,29);
  assert.equal(day.extras,1);
  assert.equal(dailySummary(day).kcal,'523 kcal');
  assert.equal(dailySummary(day).label,'Tag gesamt');
});

test('Zusatz-Snack auch ohne geplante Mahlzeiten sichtbar',()=>{
  const totals=addExtras(new Map(),[{consumption_date:'2026-10-16',calories_kcal:112.5,protein_g:0}]);
  const day=dailySummary(totals.get('2026-10-16'));
  assert.equal(day.kcal,'113 kcal');
  assert.equal(day.protein,'0 g Protein');
  assert.equal(day.note,'','V831: extras are shown separately, not duplicated in the total note');
});

test('unvollständige Mahlzeit verdeckt bestätigte Zusatzkalorien nicht',()=>{
  const totals=new Map([['2026-10-16',{kcal:0,protein:0,meals:1,unresolved:1}]]);
  addExtras(totals,[{consumption_date:'2026-10-16',calories_kcal:120,protein_g:6}]);
  const summary=dailySummary(totals.get('2026-10-16'));
  assert.equal(summary.label,'Teilsumme');
  assert.equal(summary.kcal,'120 kcal');
  assert.equal(summary.protein,'6 g Protein');
  assert.match(summary.note,/offen/);
});

test('separate Tagesdaten bleiben getrennt, erneutes Rechnen startet frisch',()=>{
  const rows=[{consumption_date:'2026-10-16',calories_kcal:112.5,protein_g:0},
    {consumption_date:'2026-10-17',calories_kcal:45,protein_g:1.5}];
  const first=addExtras(new Map(),rows);
  const second=addExtras(new Map(),rows);
  assert.equal(first.get('2026-10-16').kcal,112.5);
  assert.equal(second.get('2026-10-16').kcal,112.5);
  assert.equal(second.get('2026-10-17').protein,1.5);
});

test('ungültiges Datum wird ignoriert',()=>{
  const totals=addExtras(new Map(),[{consumption_date:'falsch',calories_kcal:999,protein_g:5}]);
  assert.equal(totals.size,0);
});

test('Milka Pralinen use whole pieces in Heute extra snack, not manual 5.7g',()=>{
  const extra=fs.readFileSync(path.join(__dirname,'..','food-extra-snacks-v828.js'),'utf8');
  const start=extra.indexOf('  function productName(');
  const end=extra.indexOf('  function panel(){',start);
  assert.ok(start>0&&end>start);
  const product={
    id:'milka',inventory_unit:'g',package_quantity:114,package_unit:'g',
    brand:'Milka',product_name:'Danke – Pralinen',variant:'Milchcreme-Karamell',
    nutrition_per_100:{energy_kcal:503,protein_g:4.9,carbohydrates_g:59,fat_g:30},
    product_data:{net_weight_g:114,pieces_per_box:20,grams_per_piece:5.7}
  };
  const make=new Function('products','nf','valid',
    extra.slice(start,end)+'\nreturn {bases,countedPieceWeight,initialQty,valuesFromCatalog,displayPieceQuantity,extraQuantityDisplay};');
  const lib=make([product],(v,d=1)=>Number(v).toLocaleString('de-DE',{maximumFractionDigits:d}),
    v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0);
  assert.equal(lib.bases(product),'Stück');
  assert.equal(lib.countedPieceWeight(product),5.7);
  assert.equal(lib.initialQty(product),1);
  assert.equal(lib.valuesFromCatalog(product,1).calories_kcal,28.67);
  assert.equal(lib.valuesFromCatalog(product,2).calories_kcal,57.34);
  assert.equal(lib.displayPieceQuantity(product,11.4,'g'),2);
  assert.equal(lib.extraQuantityDisplay({product_id:'milka',unit:'g',quantity:11.4}),'2 Stück');
  assert.match(extra,/if\(countedPieceWeight\(p\)&&!Number.isInteger\(qty\)\)/);
  assert.match(extra,/Anzahl Pralinen/);
  assert.match(extra,/quantity:qty,unit:bases\(p\)/);
});
test('planned snack accepts pieces but sends underlying recipe in grams',()=>{
  const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
  assert.match(food,/data-food-planned-piece-hint/);
  assert.match(food,/unit:pieces\?'g':unit/);
  assert.match(food,/entered\*pieces\.weight/);
});
