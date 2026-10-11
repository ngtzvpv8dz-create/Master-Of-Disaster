'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const a=source.indexOf('  function mealPrepStorageAdvice(meal){');
const b=source.indexOf('  function visibleMealNote(',a);
assert(a>=0&&b>a,'The common storage helper must exist');
const body=source.slice(a,b);
const day={id:'made',meal_date:'2026-10-11',prepared_servings:2,eaten_servings:1,
  note:'2 Portionen, nicht automatisch einfrieren.'};
const next=(date)=>({id:'next',source_meal_id:'made',meal_date:date,eaten_servings:1,status:'planned'});
function advice(dayRow,nextRow,tk=[]){
 const ctx={state:{meals:[dayRow,nextRow].filter(Boolean),mealPrepFreezer:tk},
 normalizedStatus:s=>s,fmtDate:s=>s,portionLabel:n=>n+' Portionen'};
 vm.createContext(ctx);
 vm.runInContext(body+'\nthis.check=mealPrepStorageAdvice;',ctx);
 return ctx.check(dayRow);
}
test('Meal prep tomorrow goes in refrigerator, not freezer',()=>{
 const v=advice(day,next('2026-10-12'));
 assert.match(v.title,/Kühlschrank/);
 assert.match(v.text,/2026-10-12/);
 assert.match(v.text,/Nicht einfrieren/);
});
test('Meal prep 2 days later stays chilled',()=>{
 assert.match(advice(day,next('2026-10-13')).title,/Kühlschrank/);
});
test('Meal prep 4 days later requires deliberate frozen confirmation',()=>{
 const v=advice(day,next('2026-10-15'));
 assert.match(v.text,/längere Lagerung/);
 assert.match(v.text,/Erst dann als TK bestätigen/);
});
test('Confirmed frozen meal prep is never presented as refrigerated',()=>{
 const v=advice(day,next('2026-10-12'),[{meal_id:'next',status:'frozen'}]);
 assert.doesNotMatch(v.text,/Nicht einfrieren/);
 assert.match(v.text,/tatsächlich eingefroren/);
});
test('One serving cooked and eaten produces no storage advice',()=>{
 assert.equal(advice({...day,prepared_servings:1,eaten_servings:1},null),null);
});
test('Negated word heuristic is gone from app',()=>{
 assert(!source.includes('function freezeInstruction(note)'));
 assert(!source.includes('function freezeInstructionMarkup(note)'));
 assert(source.includes('mealPrepStorageMarkup(meal)'));
});
