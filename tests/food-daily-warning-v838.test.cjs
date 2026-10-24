'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const nut=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const extra=fs.readFileSync(path.join(__dirname,'..','food-extra-snacks-v828.js'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'..','area-runtime-v609.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

const extract=(source,start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert(a>=0&&b>a,'Required app helper not found: '+start);
  return source.slice(a,b);
};

test('extra with missing macros is an incomplete day, not a completed zero-calorie day',()=>{
  const src=extract(nut,'  function addConsumedExtrasToDays(','  function setText(');
  const ctx={number:x=>x===null||x===undefined||x===''?null:Number(x),
    formatNumber:(x,d=1)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(x)};
  vm.createContext(ctx);
  vm.runInContext(src+'\nthis.record=addConsumedExtrasToDays;this.daily=dailySummary;',ctx);
  const totals=ctx.record(new Map(),[
    {consumption_date:'2026-10-18',calories_kcal:210,protein_g:5},
    {consumption_date:'2026-10-18',calories_kcal:null,protein_g:null}
  ]);
  assert.equal(totals.get('2026-10-18').unresolved,1);
  const view=ctx.daily(totals.get('2026-10-18'));
  assert.equal(view.label,'Teilsumme');
  assert.equal(view.note,'⚠ 1 offen');
  assert.equal(view.kcal,'210 kcal');
});

test('red nutrition warning directs supplement extras to their actual entry',()=>{
  const src=extract(nut,'  const alarmEscape=','  function patchNutritionAlarm(');
  const ctx={};vm.createContext(ctx);
  vm.runInContext(src+'\nthis.show=mealNutritionWarningMarkup;',ctx);
  const output=ctx.show([{id:'supplement-123',title:'ProLife Vitamin C',type:'extra',extra:true,
    issues:[{name:'ProLife Vitamin C',reason:'Kalorien und Protein fehlen.'}]}]);
  assert.match(output,/WICHTIG: NÄHRWERTE FEHLEN/);
  assert.match(output,/data-food-extra-goto="supplement-123"/);
  assert.match(output,/Kalorien und Protein fehlen/);
  assert.match(output,/Zusatz-Snack \/ Getränk/);
  assert.doesNotMatch(output,/data-food-nutrition-goto="supplement-123"/);
});

test('today open count links to one missing entry; others stay navigable',()=>{
  assert(food.includes('data-food-day-summary-goto'));
  assert(nut.includes("unresolvedTargets.push({type:'extra'"));
  assert(nut.includes('openUnresolvedTarget(targets[0].type,targets[0].id)'));
  assert(nut.includes('extras?.openEntry'));
  assert(nut.includes("noteButton.hidden=!day.incomplete"));
  assert(nut.includes("missing.join(' und ')"));
});

test('editing an extra preserves its linked product catalog identity',()=>{
  assert(extra.includes("mode=linked?'catalog':'manual'"));
  assert(extra.includes("selected=linked?String(linked.id):''"));
  assert(extra.includes('async function openEntry(id)'));
  assert(extra.includes("data-food-extra-row"));
  assert(/food-nutrition-v711\.js\?v=\d+-/.test(runtime));
  assert(runtime.includes("food-extra-snacks-v828.js?v=873-auto-stock-snack"));
  assert(/version:'V\d+'/.test(index));
});
