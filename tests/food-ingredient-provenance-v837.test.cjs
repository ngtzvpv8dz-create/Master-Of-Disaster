const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'..','area-runtime-v609.js'),'utf8');

// Protect compound family labels against disappearing source allocations.
const start=food.indexOf('  const familyText=value=>');
const end=food.indexOf('  const familyRowMode=',start);
assert(start>=0&&end>start,'Family matching helpers found');
const context={
  FAMILY_FRESH_QUALIFIERS:new Set(['frisch','bio']),
  FAMILY_FROZEN_QUALIFIERS:new Set(['tk','gefroren'])
};
vm.createContext(context);
vm.runInContext(food.slice(start,end)+'\nthis.match=familyNeedMatch;',context);
for(const name of ['Feta / Hirtenkäse','Feta','Hirtenkäse']){
  assert.equal(context.match(name,'Feta / Hirtenkäse')?.matched,true,
    'Feta family must resolve for '+name);
}
assert.equal(context.match('Tomaten','Feta / Hirtenkäse'),null,
  'Different ingredients cannot be matched as Feta');

// Do not drop source information silently for ingredients without a link.
assert(food.includes('allocationMarkup(allocation,item)||missingIngredientSourceMarkup(item)'),
  'All planned and recipe ingredients need source display or explicit status');
assert(food.includes('missingIngredientSourceMarkup(item,true)'),
  'Unmatched historical ingredients show that provenance was not recorded');
assert(food.includes('snapshot?.sources'),
  'Historical sources must still use immutable saved meal snapshot');
assert(runtime.includes('food-v544.js?v=837-uniform-provenance'),
  'All FOOD entry points need updated cache version');
console.log('PASS: Feta whole/alias matching and consistent provenance fallbacks');
