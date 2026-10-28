'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const food=read('food-v544.js');
const loader=read('area-runtime-v609.js');
const css=read('food-v544.css');
const sql=read('supabase/migrations/20261027050204_food_rating_notes_v887.sql');

function isolatedHistory(){
  const from=food.indexOf('  function extraHistoryCard(extra){');
  const to=food.indexOf('\n  function inventoryNoteHtml(note){',from);
  assert.ok(from>=0&&to>from,'history code boundaries');
  const ctx={
    todayIso:()=> '2026-10-27',
    fmtQty:(quantity,unit)=>String(quantity)+' '+String(unit),
    fmtDay:date=>date,
    fmtDate:date=>date,
    num:x=>x===null||x===undefined?null:Number(x),
    esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
    mealCard:meal=>'<article class="meal">'+String(meal.title)+'</article>',
    expandedHistoryDays:new Set()
  };
  vm.createContext(ctx);
  vm.runInContext(food.slice(from,to)+'\nthis.historyView=historyView;',ctx);
  return ctx;
}

test('Confirmed extra snack is visible on its original date even without a meal',()=>{
  const ctx=isolatedHistory();
  const html=ctx.historyView({meals:[],extras:[{
    id:'snack-1',consumption_date:'2026-10-25',kind:'snack',
    title:'Barebells Caramel Peanut',quantity:55,unit:'g',
    calories_kcal:205.15,protein_g:17
  }]});
  assert.match(html,/Barebells Caramel Peanut/);
  assert.match(html,/2026-10-25/);
  assert.match(html,/data-food-history-day/);
  assert.match(html,/food-history-extra-v887/);
  assert.match(html,/0 Mahlzeiten · 1 Extras/);
  assert.doesNotMatch(html,/Noch keine vergangenen Mahlzeiten/);
});

test('History shows combined days, preserves toggled state and excludes today',()=>{
  const ctx=isolatedHistory();
  ctx.expandedHistoryDays.add('2026-10-24');
  const html=ctx.historyView({meals:[{meal_date:'2026-10-24',title:'Mittag',sort_order:2}],
    extras:[
      {id:'extra-a',consumption_date:'2026-10-24',title:'Extra',quantity:1,unit:'Stück',calories_kcal:null,protein_g:null},
      {id:'extra-b',consumption_date:'2026-10-27',title:'Heute-Snack',quantity:1,unit:'Stück'}]});
  assert.match(html,/data-food-history-day="2026-10-24" open/);
  assert.match(html,/Mittag/);
  assert.match(html,/Extra/);
  assert.match(html,/Kalorien unbekannt/);
  assert.doesNotMatch(html,/Heute-Snack/);
});

test('Food feedback is separately stored from existing ratings and meal notes',()=>{
  assert.match(sql,/add column if not exists rating_note text/g);
  assert.match(food,/rating,rating_updated_at,rating_note/);
  assert.match(food,/display_note,rating,rating_updated_at,rating_note/);
  assert.match(food,/update\(\{rating_note:value\|\|null\}\)/);
  assert.match(food,/data-food-rating-note-form/);
  assert.match(food,/ratingNoteControl\(historyRecipe\|\|meal/);
  assert.match(food,/recipeRatingControl\(recipe\)\+ratingNoteControl\(recipe\)/);
});

test('Extras are cloud-sourced and paginated rather than inferred from meal assignments',()=>{
  assert.match(food,/loadExtraHistory\(supabase,user\.id\)/);
  assert.match(food,/from\('food_extra_consumptions'\)/);
  assert.match(food,/range\(offset,offset\+pageSize-1\)/);
  assert.match(food,/extras:take\('extras',13,rows=>rows\)/);
  assert.match(loader,/food-v544\.js\?v=\d+-/);
  assert.match(css,/food-history-extra-v887/);
});
