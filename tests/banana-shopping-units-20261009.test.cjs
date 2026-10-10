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
const bananaProduct={inventory_id:stockId,product_data:{edible_weight_per_piece_g:118}};
assert.equal(183-65,118,'Measured banana standard must be 118 g edible portion');
assert.equal(banana.quantity*bananaProduct.product_data.edible_weight_per_piece_g,590);
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
const gaps=context.deriveShopping({inventory:[banana],products:[bananaProduct],meals:meals.slice(0,3)});
assert.equal(gaps.length,0,'Five bananas cover the gram recipe and next two banana snacks');

const future=context.deriveShopping({inventory:[banana],products:[bananaProduct],meals});
assert.equal(future.length,1,'Six portions need exactly one additional banana');
assert.equal(future[0].unit,'Stück','Purchases must use stock unit');
assert.equal(future[0].missing,1);
assert.equal(future[0].buyFrom,'2026-10-21','Do not buy a banana on October 10 for the October 22 snack');
assert.equal(future[0].currentAvailable,5);
const gramsMeal=quantity=>({
  meal_date:'2026-10-10',meal_type:'lunch',status:'planned',
  ingredients:[{inventory_id:stockId,name:'Bananen',quantity,unit:'g'}]
});
assert.equal(context.deriveShopping({inventory:[banana],products:[bananaProduct],meals:[gramsMeal(500)]}).length,0,
  'Five bananas represent 590 g edible and cover a 500 g recipe');
const oneFruitShort=context.deriveShopping({inventory:[banana],products:[bananaProduct],meals:[gramsMeal(591)]});
assert.equal(oneFruitShort[0].missing,1,'Buy a whole banana if even a small edible weight gap remains');
const modifiedProduct={inventory_id:stockId,product_data:{edible_weight_per_piece_g:80}};
const overridden=context.deriveShopping({inventory:[banana],products:[modifiedProduct],meals:[gramsMeal(500)]});
assert.equal(overridden[0].missing,2,'Shopping conversion must read the product standard, not hard-code 118 g');
// Apples use their OWN saved average: Granny Smith 150 g, never the banana weight.
const appleId='apple-inventory';
const apple={id:appleId,name:'Granny Smith',quantity:1,unit:'Stück',is_active:true};
const appleProduct={inventory_id:appleId,product_data:{piece_weight_g:150}};
const appleMeal=grams=>({
  meal_date:'2026-10-10',meal_type:'snack',status:'planned',
  ingredients:[{inventory_id:appleId,name:'Granny Smith',quantity:grams,unit:'g'}]
});
assert.equal(context.deriveShopping({inventory:[apple],products:[appleProduct],meals:[appleMeal(120)]}).length,0,
  'A 150 g Granny Smith must cover a 120 g plan');
const appleShort=context.deriveShopping({inventory:[apple],products:[appleProduct],meals:[appleMeal(151)]});
assert.equal(appleShort.length,1);
assert.equal(appleShort[0].unit,'Stück');
assert.equal(appleShort[0].missing,1,'Shopping must round apple purchase up to one whole apple');

const nutritionSource=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const basisStart=nutritionSource.indexOf('  function basisAmount(item,source){');
const basisEnd=nutritionSource.indexOf('\n  function calculate(',basisStart);
assert(basisStart>=0&&basisEnd>basisStart);
const nctx={
  number:value=>{const n=Number(value);return Number.isFinite(n)?n:null;},
  text:value=>String(value||'').trim().toLocaleLowerCase('de-DE')
};
vm.createContext(nctx);
vm.runInContext(nutritionSource.slice(basisStart,basisEnd)+'\nthis.basisAmount=basisAmount;',nctx);
assert.equal(nctx.basisAmount({quantity:1,unit:'Stück'},{product:{product_data:{edible_weight_per_piece_g:118}}}),118,
  'One banana must contribute 118 g to per-100g nutrition');
assert.equal(nctx.basisAmount({quantity:2.5,unit:'Stück'},{product:{product_data:{edible_weight_per_piece_g:118}}}),295,
  'Two and a half bananas must contribute 295 g');
assert.equal(nctx.basisAmount({quantity:1,unit:'Stück'},{product:{product_data:{piece_weight_g:150}}}),150,
  'One Granny Smith contributes 150 g');
console.log('PASS: fruit piece standards drive both nutrition and shopping (banana 118 g, Granny Smith 150 g)');
