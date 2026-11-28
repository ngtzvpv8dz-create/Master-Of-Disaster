const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const cut=code.indexOf('  const api={');
assert.ok(cut>0,'FOOD module export anchor');
const NativeDate=Date;
class FixedDate extends NativeDate {
  constructor(...args){super(...(args.length?args:['2026-11-14T08:00:00Z']));}
  static now(){return NativeDate.parse('2026-11-14T08:00:00Z');}
}
const window={addEventListener(){}};
const document={addEventListener(){},documentElement:{},body:{classList:{contains(){return false;}}}};
new Function('window','document','MutationObserver','Date',
  code.slice(0,cut)+
  'window.__tests={deriveShopping,familyAllocationForItem,regularShoppingDate,allocationMarkup,recipeNeedPreview,setState:v=>{state=v;plannedAllocationCacheState=null;plannedAllocationCache=null;}};})();'
)(window,document,class{},FixedDate);
const {deriveShopping,familyAllocationForItem,regularShoppingDate,allocationMarkup,recipeNeedPreview,setState}=window.__tests;
const stock=(id,name,family,quantity)=>({id,name,family_name:family,quantity,unit:'g',is_active:true});
const ingredient=(name,quantity,inventory_id=null)=>({name,quantity,unit:'g',inventory_id});
const meal=(date,items,type='dinner')=>({id:date+'-'+type,meal_date:date,meal_type:type,status:'planned',ingredients:items});
const lot=(id,stockId,qty,date,frozen=false)=>({
  id,inventory_id:stockId,purchased_on:date,opened_remaining_quantity:qty,
  opened_remaining_unit:'g',unopened_packages:0,package_quantity:qty,package_unit:'g',
  storage_location:frozen?'Tiefkühler':'Kühlschrank'
});
test('Tomatoes: older opened 35 g + newer 65 g, exact dated lots',()=>{
  setState({inventory:[stock('tom','Cherrytomaten','Tomaten',535)],lots:[
    lot('old','tom',35,'2026-11-09'),lot('new','tom',500,'2026-11-13')
  ],products:[],freezer:[]});
  const r=familyAllocationForItem(ingredient('Tomaten',100));
  assert.equal(r.remaining,0);
  assert.deepEqual(r.allocations.map(x=>x.quantity),[35,65]);
  assert.deepEqual(r.allocations.map(x=>x.lotId),['old','new']);
  assert.match(r.allocations[0].label,/09\.11\.2026/);
});
test('Tomato family: two variants satisfy 100 g in purchase order',()=>{
  setState({inventory:[stock('ch','Cherrytomaten','Tomaten',35),
    stock('dat','Datteltomaten','Tomaten',317)],lots:[
      lot('ch1','ch',35,'2026-11-09'),lot('dat1','dat',317,'2026-11-13')
    ],products:[],freezer:[]});
  const r=familyAllocationForItem(ingredient('Tomaten',100));
  assert.equal(r.remaining,0);
  assert.deepEqual(r.allocations.map(x=>x.quantity),[35,65]);
});
test('Frozen 240 g and 75 g cannot falsely supply an indivisible 280 g',()=>{
  setState({inventory:[stock('beef','Rinderhackfleisch Light','Rinderhackfleisch Light',315)],
    lots:[lot('big','beef',240,'2026-10-28',true),lot('small','beef',75,'2026-10-28',true)],
    products:[],freezer:[{frozen_lot_id:'big',status:'frozen'},{frozen_lot_id:'small',status:'frozen'}]});
  const wrong=familyAllocationForItem(ingredient('Rinderhackfleisch Light',280));
  assert.equal(wrong.remaining,40);
  assert.deepEqual(wrong.allocations.map(x=>x.quantity),[240]);
  const right=familyAllocationForItem(ingredient('Rinderhackfleisch Light',240));
  assert.equal(right.remaining,0);
  assert.deepEqual(right.allocations.map(x=>x.quantity),[240]);
});
test('Saturday purchase anticipates Monday 490 g after Saturday 240 g',()=>{
  const beef=stock('beef','Rinderhackfleisch Light','Rinderhackfleisch Light',315);
  const data={inventory:[beef],products:[],meals:[
    meal('2026-11-14',[ingredient('Rinderhackfleisch Light',240,'beef')]),
    meal('2026-11-16',[ingredient('Rinderhackfleisch Light',490,'beef')])
  ]};
  const gap=deriveShopping(data).find(x=>x.label==='Rinderhackfleisch Light');
  assert.equal(gap.missing,415);
  assert.equal(gap.buyFrom,'2026-11-14');
  assert.equal(gap.shortageDate,'2026-11-16');
});
test('Spoiled stock and changed meal quantity immediately recalculate gaps',()=>{
  const data={inventory:[stock('tom','Tomaten','Tomaten',500)],
    products:[],meals:[meal('2026-11-16',[ingredient('Tomaten',400,'tom')])]};
  assert.equal(deriveShopping(data).length,0);
  data.inventory[0].quantity=0;
  assert.equal(deriveShopping(data)[0].missing,400);
  data.meals[0].ingredients[0].quantity=300;
  assert.equal(deriveShopping(data)[0].missing,300);
});
test('Thursday fresh bread is assigned to Wednesday grocery trip',()=>{
  const gaps=deriveShopping({inventory:[],products:[],
    meals:[meal('2026-11-19',[{name:'Frisches Brot',quantity:4,unit:'Scheibe'}],'breakfast')]});
  assert.equal(gaps[0].buyFrom,'2026-11-18');
  assert.equal(regularShoppingDate('2026-11-16','dinner'),'2026-11-14');
});
test('Prepared leftovers do not consume source ingredients twice',()=>{
  const gaps=deriveShopping({inventory:[],products:[],meals:[
    meal('2026-11-16',[ingredient('Rinderhackfleisch Light',490)]),
    {...meal('2026-11-17',[]),source_meal_id:'source'}
  ]});
  assert.equal(gaps.length,1);
  assert.equal(gaps[0].required,490);
});
test('Unavailable ingredient is explicitly visible',()=>{
  const html=allocationMarkup(null,ingredient('Tomaten',100));
  assert.match(html,/Noch nicht im Vorrat vorhanden/);
  assert.match(html,/100 g/);
});

test('Generic tomato family demand from different linked variants is not double-stocked',()=>{
  const a=stock('ch','Cherrytomaten','Tomaten',35);
  const b=stock('dat','Datteltomaten','Tomaten',317);
  const gaps=deriveShopping({inventory:[a,b],products:[],meals:[
    meal('2026-11-14',[ingredient('Tomaten',200,'ch')]),
    meal('2026-11-16',[ingredient('Tomaten',200,'dat')])
  ]});
  assert.equal(gaps.length,1);
  assert.equal(gaps[0].missing,48);
  assert.equal(gaps[0].required,400);
});

test('Bread topping prefers large tomatoes, regular meals retain FIFO',()=>{
  const cherry=stock('ch','Cherrytomaten','Tomaten',100);
  const large=stock('large','Fleischtomaten','Tomaten',300);
  const item={id:'topping',name:'Tomaten',quantity:100,unit:'g'};
  setState({inventory:[cherry,large],lots:[
    lot('ch-old','ch',100,'2026-11-09'),lot('large-new','large',300,'2026-11-13')
  ],products:[],freezer:[],meals:[{id:'m',title:'Vollkornbrot mit Tomaten',
    status:'planned',meal_date:'2026-11-14',ingredients:[item]}]});
  const topping=familyAllocationForItem(item);
  assert.equal(topping.allocations[0].inventoryId,'large');
  setState({inventory:[cherry,large],lots:[
    lot('ch-old','ch',100,'2026-11-09'),lot('large-new','large',300,'2026-11-13')
  ],products:[],freezer:[],meals:[]});
  const cooking=familyAllocationForItem(ingredient('Tomaten',100));
  assert.equal(cooking.allocations[0].inventoryId,'ch');
});

test('5 physically stocked avocado pieces do not display a false missing-stock warning for edible grams',()=>{
  const avocado={id:'avocado-stock',name:'Avocados Hass',family_name:'Avocado',
    quantity:5,unit:'Stück',is_active:true};
  const item={name:'Avocado',label:'70 g Avocado (essbar)',quantity:70,unit:'g',inventory_id:null};
  setState({inventory:[avocado],lots:[],products:[],freezer:[],aliases:[],meals:[]});
  const html=allocationMarkup(null,item);
  assert.match(html,/Vorrat vorhanden: 5 Stück/);
  assert.match(html,/70 g/);
  assert.doesNotMatch(html,/Noch nicht im Vorrat vorhanden/);
  const preview=recipeNeedPreview({servings:1,food_recipe_ingredients:[item]},1);
  assert.match(preview,/Vorrat da · Mengenprüfung offen/);
  assert.doesNotMatch(preview,/Kaufen 70 g/);
});

test('unmeasured edible avocado yield cannot be an automatic grocery order; zero fruit still is',()=>{
  const avocado={id:'avocado-stock',name:'Avocados Hass',family_name:'Avocado',
    quantity:5,unit:'Stück',is_active:true};
  const item={name:'Avocado',quantity:70,unit:'g',inventory_id:null};
  const data={inventory:[avocado],products:[{
    id:'avocado-18-11',inventory_id:avocado.id,active:true,
    product_data:{edible_mass_unconfirmed:true,individual_gross_weights_g:[146,151,140,142,146]}
  }],meals:[meal('2026-11-16',[item],'breakfast')]};
  setState({...data,lots:[],aliases:[],freezer:[]});
  assert.equal(deriveShopping(data).filter(gap=>/avocado/i.test(gap.label)).length,0);
  avocado.quantity=0;
  assert.ok(deriveShopping(data).some(gap=>/avocado/i.test(gap.label)&&gap.missing>0));
});

test('fresh stock respects purchase date plus two days; future stock is not consumed early',()=>{
 window.ModFoodFreshnessV913=require('../food-freshness-v913.js');
 try{
 const tomato=stock('tom','Tomaten','Tomaten',500);
 const data={inventory:[tomato],products:[],lots:[lot('fresh','tom',500,'2026-11-14')],meals:[meal('2026-11-16',[ingredient('Tomaten',300,'tom')]),meal('2026-11-17',[ingredient('Tomaten',200,'tom')])]};
 const gaps=deriveShopping(data);assert.equal(gaps.length,1);assert.equal(gaps[0].missing,200);assert.equal(gaps[0].shortageDate,'2026-11-17');
 data.lots=[lot('old','tom',500,'2026-11-10')];assert.equal(deriveShopping(data).reduce((s,x)=>s+x.missing,0),500);assert.equal(data.inventory[0].quantity,500,'forecast never disposes of stock');
 data.lots=[lot('new','tom',500,'2026-11-17')];const prior=deriveShopping(data);assert.equal(prior.length,1);assert.equal(prior[0].missing,300);
 data.lots=[{...lot('fresh','tom',500,'2026-11-14'),best_before_date:'2026-11-15'}];assert.equal(deriveShopping(data).reduce((s,x)=>s+x.missing,0),500);
 const avocado={id:'a',name:'Avocados Hass',family_name:'Avocado',quantity:3,unit:'Stück',is_active:true};
 const a={inventory:[avocado],products:[],lots:[{...lot('a1','a',3,'2026-11-14'),package_unit:'Stück',opened_remaining_unit:'Stück'}],meals:[meal('2026-11-17',[{name:'Avocado',quantity:1,unit:'Stück'}])]};
 assert.equal(deriveShopping(a).find(x=>/avocado/i.test(x.label)).missing,1);
 const chicken=stock('ch','Hähnchenbrustfilet','Hähnchenbrustfilet',5000);
 assert.equal(deriveShopping({inventory:[chicken],products:[],lots:[],meals:[meal('2026-11-16',[ingredient('Hähnchenbrustfilet',300,'ch')]),meal('2026-11-20',[ingredient('Hähnchenbrustfilet',300,'ch')])]}).length,0);
 }finally{delete window.ModFoodFreshnessV913;}
});

test('frozen family stays frozen in shopping and is not subject to fresh-stock expiry',()=>{
 window.ModFoodFreshnessV913=require('../food-freshness-v913.js');
 try{
 const frozen=stock('s','Blattspinat TK','Spinat',800);
 const fresh=stock('sf','Spinat frisch','Spinat',200);
 const data={inventory:[frozen,fresh],products:[],lots:[lot('s1','s',800,'2026-10-01',true),lot('sf1','sf',200,'2026-11-10')],meals:[meal('2026-11-16',[ingredient('Spinat TK',500)]),meal('2026-11-17',[ingredient('Spinat TK',400)])]};
 const gaps=deriveShopping(data);assert.equal(gaps.length,1);assert.equal(gaps[0].missing,100);assert.equal(gaps[0].freshWindowDays,null);assert.match(gaps[0].label,/TK/);
 }finally{delete window.ModFoodFreshnessV913;}
});

test('an orange cannot be supplied by a drink flavour with an unrelated alias',()=>{
 window.ModFoodFreshnessV913=require('../food-freshness-v913.js');
 const old=window.__modFoodStockResolverV746;
 const holy={id:'holy',name:'HOLY Hydration Orange',family_name:'HOLY Hydration Orange',quantity:50,unit:'Stück',is_active:true};
 window.__modFoodStockResolverV746={resolve:()=>({available:50,unitMismatch:false,family:true,familyName:holy.family_name,rows:[holy],stock:null})};
 try{const g=deriveShopping({inventory:[holy],products:[],lots:[],meals:[meal('2026-11-16',[{name:'Orange',quantity:2,unit:'Stück'}])]});assert.equal(g[0].label,'Orange');assert.equal(g[0].missing,2);}
 finally{delete window.ModFoodFreshnessV913;window.__modFoodStockResolverV746=old;}
});

test('a freshly purchased named apple variety counts against the apple family',()=>{
 window.ModFoodFreshnessV913=require('../food-freshness-v913.js');
 try{const apple={id:'a',name:'Pink Lady',family_name:'Apfel',quantity:2,unit:'Stück',is_active:true};const data={inventory:[apple],products:[],lots:[{...lot('a1','a',2,'2026-11-14'),package_unit:'Stück',opened_remaining_unit:'Stück'}],meals:[meal('2026-11-16',[{name:'Apfel',quantity:2,unit:'Stück'}])]};assert.equal(deriveShopping(data).length,0);}
 finally{delete window.ModFoodFreshnessV913;}
});

test('Verified frozen portions stay reserved for their linked meal; no earlier phantom stock',()=>{
 const chicken=stock('ch','Hähnchenbrustfilet','Hähnchenbrustfilet',903);
 const data={inventory:[chicken],products:[],lots:[
  lot('fridge','ch',300,'2026-11-14'),
  lot('sunday','ch',350,'2026-11-14',true),
  lot('friday','ch',253,'2026-11-14',true)
 ],freezer:[
  {inventory_id:'ch',frozen_lot_id:'sunday',meal_ingredient_id:'sun',quantity:350,unit:'g',status:'frozen'},
  {inventory_id:'ch',frozen_lot_id:'friday',meal_ingredient_id:'fri',quantity:253,unit:'g',status:'frozen'}
 ],meals:[
  meal('2026-11-14',[{...ingredient('Hähnchenbrustfilet',300,'ch'),id:'sat'}]),
  meal('2026-11-15',[{...ingredient('Hähnchenbrustfilet',550,'ch'),id:'sun'}]),
  meal('2026-11-20',[{...ingredient('Hähnchenbrustfilet',253,'ch'),id:'fri'}])
 ]};
 const gaps=deriveShopping(data);
 assert.equal(gaps.length,1);assert.equal(gaps[0].missing,200);
 assert.equal(gaps[0].buyFrom,'2026-11-14');assert.equal(gaps[0].shortageDate,'2026-11-15');
 assert.equal(chicken.quantity,903);
 // A duplicate reservation cannot create or consume the same lot twice.
 data.freezer.push({...data.freezer[1]});
 assert.deepEqual(deriveShopping(data),gaps);
});
