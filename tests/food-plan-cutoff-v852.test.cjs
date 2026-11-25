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
 const begin=code.indexOf('  function measuredFruitChoices('),end=code.indexOf('  function mealCard(',begin);
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

test('Whole fruit proposal checks exact IDs and original gross weight; no silent partial allocation',()=>{
 const begin=code.indexOf('  function measuredFruitChoices('),end=code.indexOf('  function mealCard(',begin);
 const sourceState={meals:'cloud',inventory:'cloud',lots:'cloud'};
 const state={inventory:[{id:'stock',name:'Avocados Hass',family_name:'Avocado',unit:'Stück',quantity:4}]};
 const api=new Function('state','sourceState','normalizedStatus','esc',code.slice(begin,end)+';return {measuredFruitChoices,verifiedFruitProposal,measuredFruitPlanAction};')(state,sourceState,s=>s,s=>String(s));
 const meal={id:'m',status:'planned',ingredients:[{id:'i',name:'Avocado',quantity:100,unit:'g'}]};
 assert.equal(api.measuredFruitChoices(meal).length,1);
 assert.match(api.measuredFruitPlanAction(meal),/data-food-fruit-plan/);
 assert.equal(api.measuredFruitChoices({...meal,status:'completed'}).length,0);
 assert.equal(api.measuredFruitChoices({...meal,calories_kcal_per_serving_override:12}).length,0);
 assert.equal(api.measuredFruitChoices({...meal,ingredients:[{...meal.ingredients[0],allocation_override:[{piece_id:'p'}]}]}).length,0);
 const a={piece_id:'p',lot_id:'l',product_id:'prod',inventory_id:'stock',quantity:1,unit:'Stück',gross_weight_g:151,actual_weight_g:151};
 const data={status:'proposal_only',gross_g:151,allocation:[a]};
 assert.equal(api.verifiedFruitProposal(data,'stock',1).gross,151);
 assert.equal(api.verifiedFruitProposal({status:'insufficient_verified_fresh_pieces'},'stock',1),null);
 assert.throws(()=>api.verifiedFruitProposal({...data,gross_g:150},'stock',1));
 assert.throws(()=>api.verifiedFruitProposal({...data,gross_g:302,allocation:[a,a]},'stock',2));
 assert.throws(()=>api.verifiedFruitProposal(data,'different',1));
 sourceState.lots='stale';assert.equal(api.measuredFruitChoices(meal).length,0);
});

test('Fruit planning interaction: only explicit, current and calorie-safe confirmation writes',async()=>{
 const start=code.indexOf('  function measuredFruitChoices('),end=code.indexOf('  function wholeUnitReviewAction(',start);
 const state={inventory:[{id:'stock',name:'Avocados Hass',family_name:'Avocado',unit:'Stück',quantity:4}],meals:[{id:'m',meal_date:'2026-11-25',status:'planned',ingredients:[{id:'i',name:'Avocado',quantity:100,unit:'g'}]}]};
 const sourceState={meals:'cloud',inventory:'cloud',lots:'cloud'};
 const proposal={status:'proposal_only',gross_g:151,allocation:[{piece_id:'p',lot_id:'l',product_id:'prod',inventory_id:'stock',quantity:1,unit:'Stück',gross_weight_g:151,actual_weight_g:151}]};
 for(const scenario of ['success','over_budget','fraction_over_budget','incomplete','unknown_extra','changed','unavailable','weekend']){
   const calls=[],modals=[];let previews=0,reloads=0;
   state.meals[0].meal_date=scenario==='weekend'?'2026-11-28':'2026-11-25';
   const sb={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='food_propose_measured_fruit_pieces'?(scenario==='unavailable'?{status:'insufficient_verified_fresh_pieces'}:proposal):{status:'planned_not_consumed'}};},from:()=>({select:()=>({eq:()=>({eq:async()=>({data:[{calories_kcal:scenario==='unknown_extra'?null:100}]})})})})};
   const win={__modFoodNutritionV711:{previewMeasuredFruitDayCalories:async(...args)=>{previews++;assert.equal(args[1],'i');assert.equal(args[4].gross,151);return {before:{complete:true,kcal:1500},after:{complete:scenario!=='incomplete',kcal:scenario==='over_budget'?1800:scenario==='fraction_over_budget'?1700.1:scenario==='weekend'?2000:scenario==='changed'&&previews>1?1601:1600}};}}};
   const api=new Function('state','sourceState','normalizedStatus','esc','fmtQty','client','withTimeout','addModal','window','expandedMeals','mutate',code.slice(start,end)+';return {openMeasuredFruitPlan};')(state,sourceState,x=>x,x=>String(x),(q,u)=>q+' '+u,()=>sb,p=>p,(title,body,submit)=>modals.push({title,body,submit}),win,new Set(),async fn=>{reloads++;return fn();});
   await api.openMeasuredFruitPlan('m');assert.equal(calls.length,0);
   await modals[0].submit(new Map([['choice','0'],['count','1']]));
   assert.equal(calls.length,1);
   if(['success','weekend','changed'].includes(scenario)){
     assert.equal(typeof modals[1].submit,'function');
     if(scenario==='changed'){
       await assert.rejects(()=>modals[1].submit(),/Tagesplanung geändert/);
       assert.equal(calls.length,1);
     }else{
       await modals[1].submit();
       assert.equal(calls.length,2);
       assert.equal(calls[1].name,'food_apply_measured_fruit_proposal');
       assert.equal(calls[1].args.p_expected_gross_g,151);
       assert.equal(calls[1].args.p_expected_quantity,100);
       assert.equal(reloads,1);
     }
   }else{
     assert.equal(modals[1].submit,undefined);
     assert.equal(reloads,0);
   }
 }
});

test('Manual fruit stock withdrawal uses exact piece IDs, selected reason and current count',async()=>{
 const begin=code.indexOf('  function isMeasuredFruitStock('),end=code.indexOf('  function inventoryCard(',begin);
 const state={inventory:[{id:'stock',name:'Avocado',family_name:'Avocado',unit:'Stück',quantity:2}]};
 for(const scenario of ['consume','spoilage','remove','duplicate','wrong_piece','ambiguous','lot_filter','stale']){
  const calls=[],modals=[];let reloads=0,fresh=true;
  const sb={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='food_available_measured_whole_pieces'?(scenario==='ambiguous'?[{piece_id:'a',lot_id:'l1',gross_weight_g:151}]:[{piece_id:'a',lot_id:'l1',piece_index:1,gross_weight_g:151},{piece_id:'b',lot_id:'l2',piece_index:2,gross_weight_g:142}]):{inventory_id:'stock',kind:args.p_kind,remaining_pieces:1}};}};
  const api=new Function('state','requireFreshLotStock','client','withTimeout','esc','fmtQty','addModal','mutate',code.slice(begin,end)+';return {openMeasuredFruitWithdrawal,isMeasuredFruitStock};')(state,()=>{if(!fresh)throw new Error('stale');},()=>sb,p=>p,x=>String(x),(q,u)=>q+' '+u,(title,body,submit)=>{modals.push({title,body,submit});return null;},async fn=>{reloads++;return fn();});
  await api.openMeasuredFruitWithdrawal('stock',scenario==='lot_filter'?'l1':null);
  assert.equal(calls.length,1);
  if(scenario==='ambiguous'){assert.equal(modals[0].submit,undefined);continue;}
  const selected=scenario==='duplicate'?['a','a']:scenario==='wrong_piece'?['z']:scenario==='lot_filter'?['b']:['a'];
  const kind=['consume','spoilage','remove'].includes(scenario)?scenario:'consume';
  if(scenario==='stale')fresh=false;
  const form={getAll:()=>selected,get:()=>kind};
  if(['duplicate','wrong_piece','lot_filter','stale'].includes(scenario)){
   await assert.rejects(()=>modals[0].submit(form),/eindeutige|stale/);assert.equal(calls.length,1);
  }else{
   await modals[0].submit(form);assert.equal(calls.length,2);assert.equal(calls[1].name,'food_withdraw_measured_whole_pieces');assert.equal(calls[1].args.p_expected_quantity,2);assert.equal(calls[1].args.p_piece_ids[0],'a');assert.equal(calls[1].args.p_kind,kind);assert.equal(reloads,1);
  }
 }
});
