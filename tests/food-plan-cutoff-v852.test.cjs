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


// Whole-unit review and measured produce: exercise actual client functions.
{
 const begin=code.indexOf('  function wholeUnitReviewAction('),end=code.indexOf('  function mealCard(',begin);
 assert.ok(begin>=0&&end>begin);
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const calls=[],modals=[];
 const sourceState={meals:'cloud',inventory:'cloud',lots:'cloud'};
 const stock={id:'m',name:'Mango frisch',family_name:'Mango',unit:'Stück',is_active:true};
 const lot={id:'l',inventory_id:'m',product_id:'p',unopened_packages:1,opened_packages:0,package_quantity:1,package_unit:'Stück',batch_data:{reported_weight_gross_g:753}};
 const meal={id:'meal',status:'planned',ingredients:[{id:'i'}]};
 const state={inventory:[stock],lots:[lot],meals:[meal]};
 const rpc=async(name,args)=>{calls.push({name,args});return {data:name==='food_plan_whole_unit_review'?[{ingredient_name:'Mango',quantity:170,unit:'g',review_status:'whole_use_check_required'}]:{ok:true}};};
 const api=new Function('esc','fmtQty','normalizedStatus','sourceState','state','client','withTimeout','addModal','mutate',code.slice(begin,end)+';return {wholeUnitReviewAction,wholeUnitReviewMarkup,openWholeUnitReview,measuredProduceGross,measuredProduceAction,validateMeasuredProduceWeight,measuredProduceModal};')(esc,(q,u)=>q+' '+u,s=>s,sourceState,state,()=>({rpc}),p=>p,(title,body,submit)=>modals.push({title,body,submit}),async fn=>fn());
 test('Whole-unit review only offered for unbooked planned meals',()=>{
   assert.match(api.wholeUnitReviewAction(meal),/data-food-whole-review="meal"/);
   assert.equal(api.wholeUnitReviewAction({...meal,status:'completed'}),'');
   assert.equal(api.wholeUnitReviewAction({...meal,inventory_booked_at:'x'}),'');
 });
 test('Review labels distinguish flexible quantities, fractional eggs and preferred whole use',()=>{
   const html=api.wholeUnitReviewMarkup([{ingredient_name:'Salatgurke',quantity:100,unit:'g',review_status:'flexible'},{ingredient_name:'Eier',quantity:1.5,unit:'Stück',review_status:'whole_egg_required_review'},{ingredient_name:'Mango',quantity:170,unit:'g',review_status:'whole_use_check_required'},{ingredient_name:'<script>',review_status:'unresolved'}]);
   assert.match(html,/Flexible Menge/);assert.match(html,/Nur ganze Eier/);assert.match(html,/Ganzverbrauch bevorzugt/);assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>'));
   assert.throws(()=>api.wholeUnitReviewMarkup(null));
 });
 test('Measured produce action restricted to supported individual gross-weighed lots',()=>{
   assert.equal(api.measuredProduceGross(stock,lot),753);
   assert.match(api.measuredProduceAction(stock,lot),/data-food-measure-produce="l"/);
   for(const bad of [{...lot,unopened_packages:2},{...lot,opened_packages:1},{...lot,inventory_id:'other'},{...lot,batch_data:{}},{...lot,batch_data:{reported_weight_gross_g:753,converted_edible_lot_id:'x'}}])assert.equal(api.measuredProduceAction(stock,bad),'');
   assert.equal(api.measuredProduceAction({...stock,family_name:'Gurke'},lot),'');
 });
 test('Measured edible input rejects unknown, zero, excessive and nonfinite weights',()=>{
   for(const bad of ['',0,-1,754,'Infinity','NaN'])assert.throws(()=>api.validateMeasuredProduceWeight(bad,753));
   assert.equal(api.validateMeasuredProduceWeight('500',753),500);
 });
 test('Read-only review uses server RPC; explicit conversion only writes after submission',async()=>{
   await api.openWholeUnitReview('meal');
   assert.equal(calls[0].name,'food_plan_whole_unit_review');
   assert.match(modals[0].body,/Ganzverbrauch bevorzugt/);
   api.measuredProduceModal('l');
   assert.equal(calls.length,1);
   await assert.rejects(()=>modals[1].submit({get:()=>754}));
   assert.equal(calls.length,1);
   await modals[1].submit({get:()=>500});
   assert.equal(calls.length,2);
   assert.deepEqual(calls[1],{name:'food_convert_measured_produce_piece',args:{p_lot_id:'l',p_edible_g:500}});
 });
}
