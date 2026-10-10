const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const nutrition=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');

const a=food.indexOf('  function familyAllocationLotDate(inventoryId){');
const b=food.indexOf('\n  function specificAllocationForItem(',a);
assert(a>=0&&b>a,'App family allocation helpers not found');
const old={id:'old',name:'Gemüsepfanne Asiatische Art',quantity:110,unit:'g',sort_order:1023,family_name:'Asia-Gemüse'};
const bio={id:'bio',name:'Bio-Gemüsepfanne Asiatische Art',quantity:600,unit:'g',sort_order:1024,family_name:'Asia-Gemüse'};
const items=[old,bio];
const lots=[{inventory_id:'bio',purchased_on:'2026-10-10',unopened_packages:1,package_quantity:600}];
const ctx={
  state:{lots,inventory:items},
  num:Number,
  ingredientName:item=>item.name,
  inventoryFamilyStockInfo:()=>({family:true,familyMode:'generic',familyName:'Asia-Gemüse',rows:items}),
  inventoryFamilyRowsInfo:()=>({family:true,familyMode:'generic',familyName:'Asia-Gemüse',rows:items}),
  familyNeedModeFromName:()=>null,
  normalizedIngredient:x=>String(x||'').toLowerCase(),
  familyFrozenFirstFor:()=>false,
  familyRowMode:()=> 'neutral',
  inventoryQuantityInUnit:stock=>({available:Number(stock.quantity||0),unitMismatch:false}),
  familyAllocationStockParts:(stock,unit,take)=>[{label:stock.name,quantity:take,frozen:false}],
  familyAllocationProductLabel:stock=>stock.name
};
vm.createContext(ctx);
vm.runInContext(food.slice(a,b)+'\nthis.allocate=familyAllocationForItem;this.date=familyAllocationLotDate;',ctx);
assert.equal(ctx.date('old'),'0001-01-01','Untracked older normal vegetable must be prioritized');
assert.equal(ctx.date('bio'),'2026-10-10');
const allocation=ctx.allocate({name:'Asia-Gemüse',quantity:360,unit:'g'});
assert.equal(allocation.remaining,0);
assert.equal(allocation.allocations.length,2);
assert.equal(allocation.allocations[0].inventoryId,'old');
assert.equal(allocation.allocations[0].quantity,110);
assert.equal(allocation.allocations[1].inventoryId,'bio');
assert.equal(allocation.allocations[1].quantity,250);
assert.equal(allocation.allocations.reduce((sum,a)=>sum+a.quantity,0),360);

const first=nutrition.indexOf('  function lotDateForInventory(inventoryId,data){');
const last=nutrition.indexOf('\n  function displayProductForStock(',first);
assert(first>=0&&last>first);
const nctx={};
vm.createContext(nctx);
vm.runInContext(nutrition.slice(first,last)+'\nthis.nDate=lotDateForInventory;',nctx);
assert.equal(nctx.nDate('old',{lots,inventory:items}),'0001-01-01');
assert.equal(nctx.nDate('bio',{lots,inventory:items}),'2026-10-10');

const per100={old:{kcal:63,protein:2.2},bio:{kcal:46,protein:1.6}};
const sum=(k)=>allocation.allocations.reduce((total,part)=>
  total+Number(part.quantity)*per100[part.inventoryId][k]/100,0);
assert.equal(Number(sum('kcal').toFixed(2)),184.3,'110g normal + 250g Bio = 184.3 kcal');
assert.equal(Number(sum('protein').toFixed(2)),6.42,'110g normal + 250g Bio = 6.42g protein');
console.log('PASS: Asia vegetables share one family; old 110g before Bio 250g; calories/protein use variants');
