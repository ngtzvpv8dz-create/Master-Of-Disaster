const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const begin=source.indexOf('  function deriveShopping(data){');
const end=source.indexOf('\n  function shoppingUsageTimeline(',begin);
assert(begin>=0&&end>begin,'Shopping derivation must be present');

const stockId='banana-inventory';
const dateToShopping={
  '2026-10-10':'2026-10-10',
  '2026-10-11':'2026-10-10',
  '2026-10-12':'2026-10-10',
  '2026-10-16':'2026-10-14',
  '2026-10-19':'2026-10-17',
  '2026-10-22':'2026-10-21'
};
const context={
  num:value=>{const n=Number(value);return Number.isFinite(n)?n:null;},
  recentPlanningStartIso:()=> '2026-10-09',
  planningHorizonIso:()=> '2026-10-24',
  normalizedStatus:status=>status,
  ingredientName:item=>item.name||item.label,
  isNonShoppingIngredient:name=>['wasser','leitungswasser'].includes(String(name).toLowerCase()),
  normalizedIngredient:name=>String(name||'').trim().toLocaleLowerCase('de-DE'),
  regularShoppingDate:date=>dateToShopping[date]||date,
  ingredientStockInfo:(need,_rows,byId)=>{
    const stock=byId.get(need.inventory_id);
    const unitMismatch=Boolean(stock&&stock.unit!==need.unit);
    return {stock,available:unitMismatch?0:Number(stock?.quantity||0),unitMismatch,family:false,converted:false};
  },
};
vm.createContext(context);
vm.runInContext(source.slice(begin,end)+'\nthis.deriveShopping=deriveShopping;',context);
const banana={id:stockId,name:'Bananen',quantity:5,unit:'Stück',is_active:true};
const plan=[
  ['2026-10-10',100,'g'],
  ['2026-10-11',1,'Stück'],
  ['2026-10-12',1,'Stück'],
  ['2026-10-16',1,'Stück'],
  ['2026-10-19',1,'Stück'],
  ['2026-10-22',1,'Stück']
];
const meals=plan.map(([date,quantity,unit])=>({
  meal_date:date,meal_type:'snack',status:'planned',
  ingredients:[{inventory_id:stockId,name:'Bananen',quantity,unit}]
}));
const gaps=context.deriveShopping({inventory:[banana],meals:meals.slice(0,3)});
assert.equal(gaps.length,0,'Five bananas cover the gram recipe and next two banana snacks');

const future=context.deriveShopping({inventory:[banana],meals});
assert.equal(future.length,1,'Six portions need exactly one additional banana');
assert.equal(future[0].unit,'Stück','Purchases must use stock unit');
assert.equal(future[0].missing,1);
assert.equal(future[0].buyFrom,'2026-10-21','Do not buy a banana on October 10 for the October 22 snack');
assert.equal(future[0].currentAvailable,5);
console.log('PASS: banana gram and piece demand shares the same inventory and shopping windows');
