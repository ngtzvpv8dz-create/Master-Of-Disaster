'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const resolver = require('../food-stock-resolver-v746.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'food-v544.js'), 'utf8');

const dateBegin=source.indexOf('  const SHOPPING_DATE_OVERRIDES=');
const dateEnd=source.indexOf('  const fmtShortDate=',dateBegin);
assert(dateBegin>=0 && dateEnd>dateBegin, 'shop-day logic found');
const dates=source.slice(dateBegin,dateEnd);
const dateContext={
  plusDays(iso,offset){
    const d=new Date(iso+'T12:00:00Z');
    d.setUTCDate(d.getUTCDate()+offset);
    return d.toISOString().slice(0,10);
  },
  todayIso:()=> '2026-10-15'
};
vm.createContext(dateContext);
vm.runInContext(dates+'\nthis.regularShoppingDate=regularShoppingDate;',dateContext);
const regularShoppingDate=dateContext.regularShoppingDate;
assert.equal(regularShoppingDate('2026-11-07','dinner'),'2026-11-06','November 7 shopping moved to Friday November 6');
assert.equal(regularShoppingDate('2026-10-17','breakfast'),'2026-10-16',
  'Saturday breakfast must use the special Friday shopping window');
assert.equal(regularShoppingDate('2026-10-17','dinner'),'2026-10-16',
  'The entire Saturday coverage uses the Friday shopping override');
assert.equal(regularShoppingDate('2026-10-15','dinner'),'2026-10-14',
  'Normal Thursday dinner belongs to Wednesday evening shopping');

const begin=source.indexOf('  function deriveShopping(data){');
const end=source.indexOf('\n  function shoppingUsageTimeline(',begin);
assert(begin>=0 && end>begin, 'shopping computation found');
const context={
  num(value){const n=Number(value);return Number.isFinite(n)?n:null;},
  recentPlanningStartIso:()=> '2026-10-13',
  planningHorizonIso:()=> '2026-10-25',
  normalizedStatus:status=>status,
  ingredientName:item=>item.name||item.label,
  isNonShoppingIngredient:name=>['wasser','leitungswasser'].includes(String(name).toLowerCase()),
  normalizedIngredient:name=>String(name||'').trim().toLocaleLowerCase('de-DE'),
  regularShoppingDate,
  freshConsumptionWindowDays:()=>null,
  ingredientStockInfo:(need,inventoryRows)=>resolver.resolve({item:need,inventoryRows}),
};
vm.createContext(context);
vm.runInContext(source.slice(begin,end)+'\nthis.deriveShopping=deriveShopping;',context);
const deriveShopping=context.deriveShopping;

const eggs={id:'eggs',name:'Eier',quantity:2,unit:'Stück',is_active:true};
const wraps={id:'wraps',name:'Tortilla Wraps Vollkorn',quantity:0,unit:'Stück',is_active:true,consume_whole_unit:true};
const shakeLime={id:'shake-lime',name:'ESN Isoclear Whey Protein Isolate Strawberry Lime',quantity:25,unit:'g',is_active:true,family_name:'ESN Isoclear Whey Protein Isolate'};
const shakeCherry={id:'shake-cherry',name:'ESN Isoclear Whey Protein Isolate Fresh Cherry',quantity:300,unit:'g',is_active:true,family_name:'ESN Isoclear Whey Protein Isolate'};
const inventory=[eggs,wraps,shakeLime,shakeCherry];
const meal=(date,type,item)=>({meal_date:date,meal_type:type,status:'planned',ingredients:[item]});
const ingredient=(id,name,quantity,unit)=>({inventory_id:id,name,quantity,unit});

let gaps=deriveShopping({inventory,products:[],meals:[
  meal('2026-10-15','dinner',ingredient('eggs','Eier',2,'Stück')),
  meal('2026-10-17','breakfast',ingredient('eggs','Eier',1,'Stück')),
  meal('2026-10-17','breakfast',ingredient('wraps','Tortilla Wraps Vollkorn',1,'Stück')),
  meal('2026-10-15','snack',ingredient('shake-lime','ESN Isoclear Whey Protein Isolate Strawberry Lime',30,'g'))
]});
const eggGap=gaps.find(row=>row.label==='Eier');
assert(eggGap,'Egg shortage exists');
assert.equal(eggGap.missing,1);
assert.equal(eggGap.buyFrom,'2026-10-16','Eggs should be bought Friday, not Thursday');
const wrapGap=gaps.find(row=>row.label==='Tortilla Wraps Vollkorn');
assert(wrapGap,'wrap shortage exists');
assert.equal(wrapGap.buyFrom,'2026-10-16');
assert.equal(wrapGap.missing,1);
assert(!gaps.some(row=>String(row.label).includes('Isoclear')),
  'Both flavours contribute 325 g and cover 30 g demand');

gaps=deriveShopping({inventory,products:[],meals:[
  meal('2026-10-17','breakfast',ingredient('wraps','Tortilla Wraps Vollkorn',0.5,'Stück'))
]});
assert.equal(gaps[0].missing,1,'Legacy half-wrap requests must still yield whole purchase units');

gaps=deriveShopping({inventory,products:[],meals:[
  meal('2026-10-17','breakfast',ingredient('shake-lime','ESN Isoclear Whey Protein Isolate Strawberry Lime',170,'g')),
  meal('2026-10-17','snack',ingredient('shake-cherry','ESN Isoclear Whey Protein Isolate Fresh Cherry',170,'g')),
]});
assert.equal(gaps.length,1,'Shared Isoclear demand must be grouped, not double-counted');
assert.equal(gaps[0].missing,15,'340 g need against 325 g total leaves 15 g');
assert.equal(gaps[0].buyFrom,'2026-10-16');

const family=resolver.resolve({item:{name:'ESN Isoclear Whey Protein Isolate Strawberry Lime',inventory_id:'shake-lime',unit:'g'},inventoryRows:inventory});
assert.equal(family.available,325,'Referenced flavour still sees entire compatible family');

console.log('PASS: October 16 shopping window, 325 g Isoclear family and whole-wrap demand');
