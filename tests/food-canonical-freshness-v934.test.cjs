
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const r=require('../food-stock-resolver-v746.js');
const p=require('../food-freshness-v913.js');
const inventory=[
 {id:'f',name:'Blattspinat TK',family_name:'Spinat',variant_label:'TK · Blattspinat',quantity:800,unit:'g'},
 {id:'s',name:'Blattspinat',family_name:'Spinat',variant_label:'frisch',quantity:0,unit:'g'},
 {id:'m',name:'Mango frisch',family_name:'Mango',quantity:1,unit:'Stück'},
 {id:'c',name:'Couscous',family_name:'Couscous',quantity:88,unit:'g'},
 {id:'r',name:'Parboiled Spitzenreis',family_name:'Reis',quantity:1000,unit:'g'},
 {id:'b',name:'Basmati Reis',family_name:'Reis',quantity:192,unit:'g'}
];
test('old and canonical spinach labels share frozen stock, not fresh stock',()=>{
 for(const name of ['Spinat TK','Blattspinat TK','TK-Blattspinat','Blattspinat, tiefgekühlt'])
  assert.equal(r.resolve({item:{name,unit:'g'},inventoryRows:inventory}).available,800);
 assert.equal(r.resolve({item:{name:'Blattspinat, frisch',unit:'g'},inventoryRows:inventory}).available,0);
});
test('fresh produce purchase slots are not shelf life',()=>{
 assert.equal(p.deadline('2026-11-25','fruit'),'2026-11-28');
 assert.equal(p.deadline('2026-11-28','fruit'),'2026-11-30');
 assert.equal(p.afterDeadline('2026-11-28','fruit','2026-12-01','dinner'),true);
 assert.equal(p.purchaseAllowed('2026-11-25','2026-11-25','snack'),false);
 const issues=p.planIssues({today:'2026-11-25',inventory,lots:[{inventory_id:'m',purchased_on:'2026-11-21',unopened_packages:1}],meals:[{meal_date:'2026-11-25',meal_type:'dinner',status:'planned',ingredients:[{name:'Mango (essbar)',quantity:170,unit:'g'}]}],resolveStock:use=>r.resolve({item:use,inventoryRows:inventory})});
 assert(issues.some(i=>i.type==='lot'&&!i.block));
});
test('shopping forecast integrates variants, provisional whole fruit and actual deficits',()=>{
 const w={__modFoodStockResolverV746:r,ModFoodFreshnessV913:p};
 const source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8').replace('window.__modFoodV544=api;','window.__testDerive=deriveShopping; window.__modFoodV544=api;');
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-11-25T18:00:00+01:00']));} static now(){return +new Date('2026-11-25T18:00:00+01:00');}}
 vm.runInNewContext(source,{window:w,document:{readyState:'loading',addEventListener(){}},MutationObserver:class{},Date:FixedDate,Intl,console});
 const meal=(date,name,quantity)=>({meal_date:date,meal_type:'dinner',status:'planned',ingredients:[{name,quantity,unit:'g'}]});
 const data={inventory,products:[],lots:[{inventory_id:'m',purchased_on:'2026-11-21',package_quantity:1,package_unit:'Stück',unopened_packages:1}],meals:[meal('2026-11-26','Spinat TK',300),meal('2026-11-27','Blattspinat, tiefgekühlt',50),meal('2026-11-25','Mango (essbar)',170),meal('2026-11-29','Couscous',100),meal('2026-11-27','Reis',45)]};
 const gaps=w.__testDerive(data);
 assert(!gaps.some(g=>/spinat|reis/i.test(g.label)));
 assert(gaps.some(g=>/mango/i.test(g.label)&&g.unit==='Stück'&&g.missing===1),'old fruit stays in physical stock but does not cover a meal beyond its planned freshness window');
 assert.equal(inventory.find(i=>i.id==='m').quantity,1);
 assert(gaps.some(g=>g.label==='Couscous'&&g.missing===12));
 const later=w.__testDerive({...data,meals:[meal('2026-12-01','Mango (essbar)',170)]});
 assert(later.some(g=>/mango/i.test(g.label)&&g.unit==='Stück'&&g.missing===1&&g.buyFrom==='2026-11-28'));
 assert(p.gapIssues(later[0],[]).some(i=>i.type==='window'&&i.block));
});

test('explicit variety and genuinely flexible family share physical stock once',()=>{
 const variants=[
 {id:'w',name:'Tortilla Wraps Vollkorn',family_name:'Wraps',unit:'Stück',quantity:5},
 {id:'c',name:'Karotten-Wraps · EDEKA Herzstücke',family_name:'Wraps',unit:'Stück',quantity:0},
 {id:'m',name:'Chio Dip Mild Salsa',family_name:'Chio Dip Salsa',unit:'ml',quantity:0},
 {id:'h',name:'Chio Dip Hot Salsa',family_name:'Chio Dip Salsa',unit:'ml',quantity:50},
 {id:'b',name:'Champignons braun',family_name:'Champignons',unit:'g',quantity:0},
 {id:'white',name:'Champignons weiß',family_name:'Champignons',unit:'g',quantity:100},
 {id:'corn',name:'Sonnenmais Konserve',family_name:'Mais',unit:'g',quantity:0},
 {id:'cob',name:'Maiskolben',family_name:'Mais',unit:'g',quantity:200}
 ];
 const exact=(name,label,unit)=>r.resolve({item:{name,label,unit},inventoryRows:variants});
 assert.equal(exact('Wraps','2 Stück Tortilla Wraps Vollkorn','Stück').available,5);
 assert.equal(exact('Wraps','2 Stück Wraps (Sorte nach MHD)','Stück').available,5);
 assert.equal(exact('Chio Dip Salsa','20 ml Chio Dip Mild Salsa','ml').available,0);
 assert.equal(exact('Champignons','100 g Champignons braun','g').available,0);
 assert.equal(exact('Mais','100 g Sonnenmais Konserve','g').available,0);
 assert.equal(exact('Salsa, scharf','Salsa, scharf','ml').available,50);
 const w={__modFoodStockResolverV746:r,ModFoodFreshnessV913:p};
 const source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8').replace('window.__modFoodV544=api;','window.__testDerive=deriveShopping; window.__modFoodV544=api;');
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-11-25T18:00:00+01:00']));}static now(){return +new Date('2026-11-25T18:00:00+01:00');}}
 vm.runInNewContext(source,{window:w,document:{readyState:'loading',addEventListener(){}},MutationObserver:class{},Date:FixedDate,Intl,console});
 const meal=(date,name,label,quantity,unit)=>({meal_date:date,meal_type:'dinner',status:'planned',ingredients:[{name,label,quantity,unit}]});
 const gaps=w.__testDerive({inventory:variants,products:[],lots:[],meals:[
 meal('2026-11-26','Wraps','3 Stück Wraps (Sorte nach MHD)',3,'Stück'),
 meal('2026-11-27','Wraps','4 Stück Tortilla Wraps Vollkorn',4,'Stück'),
 meal('2026-11-27','Chio Dip Salsa','20 ml Chio Dip Mild Salsa',20,'ml'),
 meal('2026-11-28','Mais','100 g Sonnenmais Konserve',100,'g')
 ]});
 assert(gaps.some(g=>g.label==='Wraps'&&g.missing===2));
 assert(gaps.some(g=>g.label==='Chio Dip Mild Salsa'&&g.missing===20));
 assert(gaps.some(g=>g.label==='Sonnenmais Konserve'&&g.missing===100));
 assert.equal(variants[0].quantity,5,'planning never mutates physical stock');
});

test('reduced-fat cheese never counts normal-fat sibling inventory',()=>{
 const variants=[
 {id:'light',name:'Hirtenkäse',family_name:'Feta / Hirtenkäse',quantity:0,unit:'g'},
 {id:'normal',name:'Hirtenkäse normal',family_name:'Feta / Hirtenkäse',quantity:200,unit:'g'}
 ];
 assert.equal(r.resolve({item:{name:'Feta / Hirtenkäse leicht',label:'65 g Feta / Hirtenkäse leicht',unit:'g'},inventoryRows:variants}).available,0);
 assert.equal(r.resolve({item:{name:'Feta / Hirtenkäse',unit:'g'},inventoryRows:variants}).available,200);
 assert.equal(r.resolve({item:{name:'Hirtenkäse normal',unit:'g'},inventoryRows:variants}).available,200);
});

test('measured bread uses remaining numbered slices and only future missing slices use a declared plan weight',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
 const cut=source.lastIndexOf("  document.addEventListener('click',event=>{");
 const w={addEventListener(){}};
 vm.runInNewContext(source.slice(0,cut)+"window.__testNutrition={numberedBreadPlan,nutritionProblem,plannedMealAllocationState};})();",{window:w,document:{readyState:'loading',addEventListener(){},querySelector(){return null}},MutationObserver:class{observe(){}},setTimeout(){},clearTimeout(){},Intl,console});
 const n=w.__testNutrition;
 const inventory=[{id:'bread',name:'Harry Vital+fit Brot',family_name:'Vollkornbrot',unit:'Scheiben',quantity:4}];
 const products=[{id:'p',inventory_id:'bread',active:true,package_quantity:500,package_unit:'g',nutrition_per_100:{energy_kcal:241,protein_g:7.7,fat_g:4.9,carbohydrates_g:38},product_data:{numbered_slices:[{slice_number:6,gross_weight_g:57},{slice_number:7,gross_weight_g:56},{slice_number:8,gross_weight_g:55},{slice_number:9,gross_weight_g:55}],latest_package_slice_count_declared:9}}];
 const lots=[{id:'l',inventory_id:'bread',product_id:'p',opened_remaining_quantity:4,unopened_packages:0,package_quantity:9,package_unit:'Scheiben',batch_data:{numbered_slices:products[0].product_data.numbered_slices,remaining_slice_numbers:[6,7,8,9]}}];
 const item={name:'Vollkornbrot',label:'1 Scheiben Harry Vital+fit Brot',quantity:1,unit:'Scheiben'};
 const data={inventory,products,lots};
 const one=n.numberedBreadPlan(item,data);
 assert.equal(one.estimated,false);assert(Math.abs(one.kcal-57*2.41)<1e-8);
 const second=n.numberedBreadPlan(item,{...data,inventory:[{...inventory[0],quantity:3}]});
 assert(Math.abs(second.kcal-56*2.41)<1e-8);
 const future=n.numberedBreadPlan(item,{...data,inventory:[{...inventory[0],quantity:0}]});
 assert.equal(future.estimated,true);assert(Math.abs(future.kcal-500/9*2.41)<1e-8);
 const missing=n.nutritionProblem({id:'new-mandu',name:'Mandu TK',unit:'g',quantity:120},{inventory:[],products:[],lots:[],purchaseExpectedIds:new Set(['new-mandu'])});
 assert.equal(missing.awaitingPurchase,true);assert.equal(missing.provisional,true);
 const regular=n.nutritionProblem({id:'new-pumpkin',name:'Hokkaido-Kürbis',unit:'g',quantity:100},{inventory:[],products:[],lots:[],purchaseExpectedIds:new Set(['new-pumpkin'])});
 assert.equal(regular,null,'normal documented food reference is not a broken product');
});
