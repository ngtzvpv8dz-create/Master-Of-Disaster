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
  assert.deepEqual(spiceInstructionsByTaste(steps),['Die Sauce mit Pfeffer schwarz und Salz würzen.']);
});
test('recipe editor persists unweighed kitchen spices and forces weight for other foods',()=>{
  assert.match(food,/const quantity=spice\?null:Number\(rawQuantity\)/);
  assert.match(food,/const unit=spice\?'nach Belieben'/);
  assert.match(food,/label:spice\?storedName:/);
  assert.match(food,/qty.disabled=true;qty.required=false/);
  assert.match(food,/!spice&&\(!rawQuantity\|\|!Number.isFinite\(quantity\)\|\|quantity<=0\)/);
  assert.match(food,/const quantityHtml=isOptionalSeasoning\s*\?''/);
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
  assert.match(tasks[0].tasks[0],/Fleisch marinieren/i);
  assert.match(tasks[1].tasks[0],/Bohnen einweichen/i);
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
  require('./food-release-cache-helper.cjs').verifyFoodReleaseCache(index,runtime);
});

test('actual planned ingredients determine concise preparation hints, not generic placeholders',()=>{
  const fnSrc=snippet(food,'  function plannedAheadPrepTasks(){','  function prepAheadAlertMarkup(){');
  const recipes=[
    {id:'o',instructions:'1. 43 g Zarte Haferflocken mit Ei und Milch verrühren und kurz quellen lassen.\n2. Ausbacken.'},
    {id:'p',instructions:'1. Mehl und Hefe zu einem Teig kneten; abgedeckt gehen lassen.\n2. Pizza backen.'},
    {id:'g',instructions:'1. Glasnudeln nach Packungsanleitung einweichen oder garen.\n2. Mit Gemüse mischen.'},
    {id:'c',instructions:'1. Couscous quellen lassen.\n2. Servieren.'}];
  const meals=recipes.map((r,i)=>({id:r.id,recipe_id:r.id,title:['Haferpfannkuchen','Gemüse-Pizza','Glasnudelpfanne','Couscous'][i],meal_date:'2026-11-28',status:'planned'}));
  meals.push({...meals[2],id:'leftover',title:'Meal Prep: Glasnudelpfanne',source_meal_id:'g'});
  const fn=new Function('state','todayIso','normalizedStatus','plusDays',fnSrc+';return plannedAheadPrepTasks')({meals,recipes},()=> '2026-11-27',x=>x,()=> '2026-11-27');
  assert.deepEqual(fn().map(t=>t.tasks[0]),[
    'Haferflocken-Teig kurz quellen lassen (morgen vor dem Ausbacken)',
    'Pizzateig kneten und gehen lassen (morgen vor dem Backen)',
    'Glasnudeln nach Packungsanleitung einweichen oder garen (morgen vor der Zubereitung)',
    'Couscous quellen lassen (morgen vor der Zubereitung)']);
});
test('new unweighed seasonings are accepted in UI and nutrition without treating sauces as free spices',()=>{
  const def=snippet(food,'  const seasoningByTaste=item=>{','  const ingredientQuantityForDisplay=item=>{');
  const fn=new Function(def+';return seasoningByTaste')();
  const nd=snippet(nutrition,'  const itemName=item=>','  function nutrient(');
  const nf=new Function('text',nd+';return toTasteSeasoning')(s=>String(s||'').trim().toLocaleLowerCase('de-DE'));
  for(const name of ['Bunter Pfeffer','Chiliflocken','Knoblauchgranulat','Ingwer gemahlen','Petersilie frisch','Schnittlauch','Safran','Kräuter der Provence']){
    assert.equal(fn({name,quantity:null,unit:'nach Belieben'}),true,name);
    assert.equal(nf({name,quantity:null,unit:'nach Belieben'}),true,name);
  }
  for(const name of ['Olivenöl','Sojasauce','Currypaste rot','Gochujang','Dressing']){
    assert.equal(fn({name}),false,name);
    assert.equal(nf({name,quantity:null,unit:'nach Belieben'}),false,name);
  }
  assert.equal(fn({name:'Ingwer gemahlen',quantity:10,unit:'g'}),false);
});
