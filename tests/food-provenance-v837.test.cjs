'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const nutrition=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');

function between(source,start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert(a>=0&&b>a,'Expected FOOD source section not found: '+start);
  return source.slice(a,b);
}
function context(overrides={}){
  const ctx={
    FAMILY_FRESH_QUALIFIERS:new Set(['frisch','frische','frischer','frisches','bio']),
    FAMILY_FROZEN_QUALIFIERS:new Set(['tk','tiefkühl','tiefgekühlt','tiefgefroren','gefroren']),
    ...overrides
  };
  vm.createContext(ctx);
  vm.runInContext(between(food,'  const familyText=','  const familyRowMode=')+
    '\nthis.matchFamily=familyNeedMatch;',ctx);
  return ctx;
}

test('compound family labels and either synonym remain resolvable in FOOD',()=>{
  const c=context();
  for(const name of ['Feta / Hirtenkäse','Feta','Hirtenkäse']){
    assert.equal(c.matchFamily(name,'Feta / Hirtenkäse')?.matched,true,name);
  }
  assert.equal(c.matchFamily('TK Feta','Feta / Hirtenkäse')?.mode,'frozen');
  assert.equal(c.matchFamily('Tomaten','Feta / Hirtenkäse'),null);
});

test('nutrition uses the same compound/synonym family matching',()=>{
  const c={text:value=>String(value||'').trim().toLocaleLowerCase('de-DE')};
  vm.createContext(c);
  vm.runInContext(between(nutrition,'  function familyMatch(','  function lotDateForInventory(')+
    '\nthis.match=familyMatch;',c);
  for(const name of ['Feta / Hirtenkäse','Feta','Hirtenkäse'])
    assert.equal(c.match(name,'Feta / Hirtenkäse'),'generic');
  assert.equal(c.match('Frischkäse leicht','Körniger Frischkäse'),null);
});

test('planned Feta displays the actual catalog product, lot status and source arrow',()=>{
  const stock={id:'feta',name:'Hirtenkäse',family_name:'Feta / Hirtenkäse',quantity:250,unit:'g'};
  const product={id:'feta-product',inventory_id:'feta',brand:'GUT&GÜNSTIG',product_name:'Hirtenkäse',variant:'leicht · 27 % Fett i. Tr.'};
  const lot={inventory_id:'feta',product_id:'feta-product',unopened_packages:1,opened_remaining_quantity:0,package_quantity:250,package_unit:'g'};
  const c=context({
    state:{inventory:[stock],products:[product],lots:[lot]},
    esc:value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
    num:value=>Number(value),
    ingredientName:item=>item.name,
    fmtQty:(value,unit)=>value+' '+unit,
    editableAllocationContext:()=>null,
    manualAllocationForItem:()=>null,
    specificAllocationForItem:()=>null,
    sourceIsReal:()=>true,
    normalizedIngredient:value=>String(value||'').toLowerCase()
  });
  vm.runInContext(between(food,'  function familyAllocationProductText(','  function familyAllocationConvertQuantity(')+
    '\nthis.productLabel=familyAllocationProductLabel;',c);
  c.familyAllocationForItem=item=>({
    allocations:[{inventoryId:'feta',label:c.productLabel(stock)+' · neue Packung',quantity:item.quantity,unit:'g'}],
    remaining:0
  });
  vm.runInContext(between(food,'  function allocationMarkup(','  // Verbrauchsbuchungen')+
    '\nthis.renderAllocation=allocationMarkup;',c);
  vm.runInContext(between(food,'  const ingredientQuantityForDisplay=item=>{','  const ingredientDisplay=item=>{'),c);
  vm.runInContext(between(food,'  function missingIngredientSourceMarkup(','  function splitMealIngredients(')+
    '\nthis.renderList=ingredientListMarkup;this.missing=missingIngredientSourceMarkup;',c);
  const html=c.renderList([{id:'meal-feta',name:'Feta / Hirtenkäse',quantity:60,unit:'g'}]);
  assert.match(html,/60 g/);
  assert.match(html,/GUT&amp;GÜNSTIG Hirtenkäse/);
  assert.match(html,/neue Packung/);
  assert.match(html,/food-allocation-arrow-v741/);
  assert.doesNotMatch(html,/nicht eindeutig zugeordnet/);
  assert.match(c.missing({name:'Feta / Hirtenkäse',unit:'g'},true),/Zubereitungszeitpunkt nicht dokumentiert/);
  assert.match(c.missing({name:'Wasser',unit:'ml'}),/keine Handelscharge/);
});

test('unresolved sources are visibly flagged rather than disappearing',()=>{
  assert(food.includes('allocationMarkup(allocation,item)||missingIngredientSourceMarkup(item)'));
  assert(food.includes('const itemRows=original.filter(item=>item?.eaten_only_extra!==true)'));
  assert(food.includes('Produktstamm/Charge nicht eindeutig zugeordnet'));
  assert(food.includes('is-single-source-v741'));
});
