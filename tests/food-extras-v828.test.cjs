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