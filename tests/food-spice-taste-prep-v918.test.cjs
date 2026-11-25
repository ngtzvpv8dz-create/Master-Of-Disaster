'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const nutrition=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'..','area-runtime-v609.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function snippet(src,begin,end){
  const a=src.indexOf(begin),b=src.indexOf(end,a+begin.length);
  assert(a>=0&&b>a,'Missing isolated snippet: '+begin);
  return src.slice(a,b);
}
test('only actual spices are classified as free seasoning, not oil or sauces',()=>{
  const definitions=snippet(food,'  const seasoningByTaste=item=>{','  const ingredientQuantityForDisplay=item=>{');
  const {seasoningByTaste,spiceInstructionsByTaste}=new Function(definitions+';return {seasoningByTaste,spiceInstructionsByTaste}')( );
  assert.equal(seasoningByTaste({name:'Pfeffer schwarz'}),true);
  assert.equal(seasoningByTaste({name:'Kreuzkümmel gemahlen'}),true);
  assert.equal(seasoningByTaste({name:'Paprikapulver edelsüß'}),true);
  assert.equal(seasoningByTaste({name:'Olivenöl'}),false);
  assert.equal(seasoningByTaste({name:'Gochujang-Paste'}),false);
  const steps=['Die Sauce mit 1 g Pfeffer schwarz und 2 g Salz würzen.'];
  assert.deepEqual(spiceInstructionsByTaste(steps),['Die Sauce mit Pfeffer schwarz nach Belieben und Salz nach Belieben würzen.']);
});
test('recipe editor persists unweighed kitchen spices and forces weight for other foods',()=>{
  assert.match(food,/const quantity=spice\?null:Number\(rawQuantity\)/);
  assert.match(food,/const unit=spice\?'nach Belieben'/);
  assert.match(food,/spice\?storedName\+' nach Belieben'/);
  assert.match(food,/qty.disabled=true;qty.required=false/);
  assert.match(food,/!spice&&\(!rawQuantity\|\|!Number.isFinite\(quantity\)\|\|quantity<=0\)/);
  assert.match(food,/optionalSeasoning\?'<small>Nach Belieben/);
  assert.match(food,/Keine Mengenbuchung/);
  assert.match(food,/preparedMeal\?recipeInstructions\(recipe\):spiceInstructionsByTaste/);
});
test('nutrition audit does not treat deliberately unweighed spices as missing data',()=>{
  const definitions=snippet(nutrition,'  const itemName=item=>','  function nutrient(');
  const fn=new Function('text',definitions+';return toTasteSeasoning')(
    s=>String(s||'').trim().toLocaleLowerCase('de-DE'));
  assert.equal(fn({name:'Currypulver',unit:'nach Belieben',quantity:null}),true);
  assert.equal(fn({name:'Salz',unit:'nach Belieben',quantity:null}),true);
  assert.equal(fn({name:'Olivenöl',unit:'nach Belieben',quantity:null}),false);
  assert.equal(fn({name:'Kichererbsen',unit:'g',quantity:100}),false);
  assert.match(nutrition,/if\(toTasteSeasoning\(item\)\)continue/);
});
test('previous-evening prep tasks detect planned marinating and avoid historical or unrelated meals',()=>{
  const fnSrc=snippet(food,'  function plannedAheadPrepTasks(){','  function prepAheadAlertMarkup(){');
  const meals=[
    {id:'mar',meal_date:'2026-11-23',status:'planned',recipe_id:'r1',title:'Marinadegericht'},
    {id:'done',meal_date:'2026-11-23',status:'completed',recipe_id:'r1',title:'Fertig'},
    {id:'plain',meal_date:'2026-11-23',status:'planned',recipe_id:'r2',title:'Brotzeit'},
    {id:'soak',meal_date:'2026-11-23',status:'planned',recipe_id:'r3',title:'Bohnen'}
  ];
  const state={meals,recipes:[
    {id:'r1',instructions:'1. Fleisch über Nacht marinieren.\n2. Morgen garen.'},
    {id:'r2',instructions:'1. Brot belegen.\n2. Aufessen.'},
    {id:'r3',instructions:'1. Bohnen über Nacht einweichen.\n2. Kochen.'}
  ]};
  const plusDays=(date,days)=>{
    const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);
    return d.toISOString().slice(0,10);
  };
  const fn=new Function('state','todayIso','normalizedStatus','plusDays',fnSrc+';return plannedAheadPrepTasks')(
    state,()=> '2026-11-22',x=>x,plusDays);
  const tasks=fn();
  assert.deepEqual(tasks.map(t=>t.mealId),['mar','soak']);
  assert.equal(tasks.every(t=>t.dueDate==='2026-11-22'),true);
  assert.match(tasks[0].tasks[0],/Marinier/);
  assert.match(tasks[1].tasks[0],/Einweich/);
  assert.match(food,/thawTodayAlertsMarkup\(\)\+prepAheadAlertMarkup\(\)/);
});
test('taste feedback only after a completed meal and explicit user confirmation',()=>{
  assert.match(food,/data-food-taste-feedback/);
  assert.match(food,/status==='completed'&&pendingTastes.length/);
  assert.match(food,/really_tasted/);
  assert.match(food,/record_food_ingredient_taste_feedback/);
  assert.match(food,/row.preference==='Würde ich probieren'/);
  assert.match(food,/sourceIsReal\('preferences'\)/);
  assert.match(food,/preferences:take\('preferences',15/);
});
test('V1 food, nutrition and style assets are cache-busted in each import context',()=>{
  assert.equal(runtime.split('./food-v544.js?v=20261125-fresh-three-days-932').length-1,4);
  assert.equal(runtime.split('./food-nutrition-v711.js?v=20261123-raw-reference-931').length-1,4);
  assert.match(index,/food-v544\.css\?v=20261122-tasteprep-918/);
  assert.match(index,/area-runtime-v609\.js\?v=20261125-fresh-three-days-932/);
});
