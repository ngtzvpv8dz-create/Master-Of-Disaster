'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Exercise the real date calculation from the Food source, not a duplicated
// reimplementation in the test. Only extract the pure date helper declarations.
const code = fs.readFileSync(path.join(__dirname, '..', 'food-v544.js'), 'utf8');
const start = code.indexOf('  const monthlyPlanningCutoff=');
const end = code.indexOf('  const planningHorizonIso=', start);
assert.ok(start > 0 && end > start, 'Food date planning helpers available');
const segment = code.slice(start, end);
const monthlyPlanningCutoff = new Function('todayIso', 'plusDays',
  segment + '\nreturn monthlyPlanningCutoff;'
)(() => '2026-10-24', () => { throw Error('unexpected invalid date fallback'); });

test('cutoff on 24 Oct must open next planning cycle through 25 Nov', () => {
  assert.equal(monthlyPlanningCutoff('2026-10-24'), '2026-11-25');
  assert.equal(monthlyPlanningCutoff('2026-10-25'), '2026-11-25');
});

test('day before current cutoff remains in current cycle', () => {
  assert.equal(monthlyPlanningCutoff('2026-10-23'), '2026-10-24');
});

test('next shopping cutoff itself shows following cycle, never an empty plan', () => {
  assert.equal(monthlyPlanningCutoff('2026-11-25'), '2026-12-23');
  assert.equal(monthlyPlanningCutoff('2026-11-24'), '2026-11-25');
});

test('client date fetch, upcoming Plan and food priority use same horizon', () => {
  assert.match(code, /\.lte\('meal_date',planningHorizonIso\(\)\)/);
  assert.match(code, /meal\.meal_date<=horizon/);
  assert.match(code, /<h3>Geplant bis '\+esc\(fmtDate\(horizon\)\)/);
});


// Whole-unit review uses the original gross-weight convention.
{
 const begin=code.indexOf('  function wholeUnitReviewAction('),end=code.indexOf('  function mealCard(',begin);
 assert.ok(begin>=0&&end>begin);
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const calls=[],modals=[];
 const sourceState={meals:'cloud'};
 const meal={id:'meal',status:'planned',ingredients:[{id:'i'}]};
 const state={meals:[meal]};
 const rpc=async(name,args)=>{calls.push({name,args});return {data:[{ingredient_name:'Mango',quantity:753,unit:'g',review_status:'whole_use_check_required'}]};};
 const api=new Function('esc','fmtQty','normalizedStatus','sourceState','state','client','withTimeout','addModal',code.slice(begin,end)+';return {wholeUnitReviewAction,wholeUnitReviewMarkup,openWholeUnitReview};')(esc,(q,u)=>q+' '+u,s=>s,sourceState,state,()=>({rpc}),p=>p,(title,body)=>modals.push({title,body}));
 test('Whole-unit review only offered for unbooked planned meals',()=>{
   assert.match(api.wholeUnitReviewAction(meal),/data-food-whole-review="meal"/);
   assert.equal(api.wholeUnitReviewAction({...meal,status:'completed'}),'');
   assert.equal(api.wholeUnitReviewAction({...meal,inventory_booked_at:'x'}),'');
 });
 test('Review distinguishes flexible quantities, whole eggs and gross weight',()=>{
   const html=api.wholeUnitReviewMarkup([{ingredient_name:'Salatgurke',quantity:100,unit:'g',review_status:'flexible'},{ingredient_name:'Eier',quantity:1.5,unit:'Stück',review_status:'whole_egg_required_review'},{ingredient_name:'Mango',quantity:753,unit:'g',review_status:'whole_use_check_required'},{ingredient_name:'<script>',review_status:'unresolved'}]);
   assert.match(html,/Flexible Menge/);assert.match(html,/Nur ganze Eier/);assert.match(html,/gespeicherten Bruttogewicht/);assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>'));
   assert.throws(()=>api.wholeUnitReviewMarkup(null));
 });
 test('No separate edible weighing or conversion action in FOOD',()=>{
   assert.ok(!code.includes('data-food-measure-produce'));
   assert.ok(!code.includes('food_convert_measured_produce_piece'));
   assert.ok(!code.includes('name="edible"'));
 });
 test('Read-only review never starts a fruit conversion',async()=>{
   await api.openWholeUnitReview('meal');
   assert.equal(calls.length,1);
   assert.equal(calls[0].name,'food_plan_whole_unit_review');
   assert.match(modals[0].body,/753 g/);
   assert.match(modals[0].body,/Bruttogewicht/);
 });
}
