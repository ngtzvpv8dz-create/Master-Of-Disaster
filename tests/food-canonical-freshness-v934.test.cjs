
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
 assert(!gaps.some(g=>/spinat|mango|reis/i.test(g.label)));
 assert(gaps.some(g=>g.label==='Couscous'&&g.missing===12));
 const later=w.__testDerive({...data,meals:[meal('2026-12-01','Mango (essbar)',170)]});
 assert(later.some(g=>/mango/i.test(g.label)&&g.unit==='Stück'&&g.missing===1&&g.buyFrom==='2026-11-28'));
 assert(p.gapIssues(later[0],[]).some(i=>i.type==='window'&&i.block));
});
