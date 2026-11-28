'use strict';
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const source=read('food-v544.js').replace('window.__modFoodV544=api;','window.__testDerive=deriveShopping; window.__modFoodV544=api;');
async function run(engine,label,viewport){
 const browser=await engine.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport,timezoneId:'Europe/Berlin',serviceWorkers:'block'});
  const page=await ctx.newPage();
  await page.route('**/*',route=>route.abort());
  await page.setContent('<main class="app"><div id="viewContainer"></div></main>');
  await page.addScriptTag({content:read('food-stock-resolver-v746.js')});
  await page.addScriptTag({content:read('food-freshness-v913.js')});
  await page.evaluate(()=>{const D=Date;window.Date=class extends D{constructor(...args){super(...(args.length?args:['2026-11-25T18:00:00+01:00']));}static now(){return +new D('2026-11-25T18:00:00+01:00');}};});
  await page.addScriptTag({content:source});
  const actual=await page.evaluate(()=>{
   const inventory=[{id:'a',name:'Blattspinat TK',family_name:'Spinat',variant_label:'TK',quantity:800,unit:'g'},{id:'b',name:'Blattspinat',family_name:'Spinat',variant_label:'frisch',quantity:0,unit:'g'},{id:'c',name:'Mango frisch',family_name:'Mango',quantity:1,unit:'Stück'},{id:'d',name:'Couscous',family_name:'Couscous',quantity:88,unit:'g'},{id:'e',name:'Parboiled Spitzenreis',family_name:'Reis',quantity:1000,unit:'g'}];
   const meal=(date,name,quantity)=>({meal_date:date,meal_type:'dinner',status:'planned',ingredients:[{name,quantity,unit:'g'}]});
   const data={inventory,products:[],lots:[{inventory_id:'c',purchased_on:'2026-11-21',package_quantity:1,package_unit:'Stück',unopened_packages:1}],meals:[meal('2026-11-26','Spinat TK',300),meal('2026-11-27','Blattspinat, tiefgekühlt',50),meal('2026-11-25','Mango (essbar)',170),meal('2026-11-29','Couscous',100),meal('2026-11-27','Reis',45)]};
   const p=window.ModFoodFreshnessV913;
   const r=window.__modFoodStockResolverV746;
   const resolve=name=>r.resolve({item:{name,unit:'g'},inventoryRows:inventory}).available;
   const gaps=window.__testDerive(data);
   const later=window.__testDerive({...data,meals:[meal('2026-12-01','Mango (essbar)',170)]});
   return {gaps,later,laterIssues:p.gapIssues(later[0],[]),old:resolve('Spinat TK'),canonical:resolve('Blattspinat, tiefgekühlt'),fresh:resolve('Blattspinat, frisch'),wed:p.deadline('2026-11-25','fruit'),sat:p.deadline('2026-11-28','fruit')};
  });
  assert.equal(actual.old,800);assert.equal(actual.canonical,800);assert.equal(actual.fresh,0);
  assert.equal(actual.wed,'2026-11-28');assert.equal(actual.sat,'2026-11-30');
  assert.deepEqual(actual.gaps.map(g=>[g.label,g.missing]),[['Mango frisch',1],['Couscous',12]]);
  assert(actual.laterIssues.some(i=>i.type==='window'&&i.block));
  console.log('PASS '+label+' production resolver and grocery forecast');
 }finally{await browser.close();}
}
(async()=>{await run(chromium,'Chromium desktop',{width:1440,height:900});await run(chromium,'Chromium mobile',{width:390,height:844});await run(webkit,'WebKit iPhone',{width:390,height:844});})().catch(e=>{console.error(e);process.exitCode=1;});
