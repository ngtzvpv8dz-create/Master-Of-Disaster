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
  'window.__tests={deriveShopping,familyAllocationForItem,regularShoppingDate,allocationMarkup,setState:v=>{state=v;plannedAllocationCacheState=null;plannedAllocationCache=null;}};})();'
)(window,document,class{},FixedDate);
const {deriveShopping,familyAllocationForItem,regularShoppingDate,allocationMarkup,setState}=window.__tests;
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
