'use strict';
// Browser smoke test of the ACTUAL V1 index.html, Food and Shopping modules.
// Starts a local HTTP server and injects fictitious datasets; no account login,
// Supabase write or real purchase happens. Supports SHOPPING_TEST_BASE_URL.
const {chromium,webkit}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const port=8897;
const base=String(process.env.SHOPPING_TEST_BASE_URL||('http://127.0.0.1:'+port)).replace(/[/]$/,'');
const server=process.env.SHOPPING_TEST_BASE_URL?null:
  spawn('python3',['-m','http.server',String(port)],{stdio:'ignore'});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const foodSource=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const fragment=foodSource.slice(foodSource.indexOf('(function(){'),foodSource.indexOf('function shoppingView(data)'));
assert(fragment.includes('function deriveShopping(data)'),'real Food shopping algorithm must be included');
const fixture={
  meals:[
    {meal_date:'2026-11-18',meal_type:'snack',status:'planned',ingredients:[
      {name:'Mandelmus',label:'20 g Mandelmus',quantity:20,unit:'g',inventory_id:null}]},
    {meal_date:'2026-11-18',meal_type:'dinner',status:'planned',ingredients:[
      {name:'Hähnchenbrustfilet',quantity:1080,unit:'g',inventory_id:null}]},
    {meal_date:'2026-11-19',meal_type:'breakfast',status:'planned',ingredients:[
      {name:'Buchweizen',label:'Buchweizenmehl aus Körnern',quantity:65,unit:'g',inventory_id:null}]},
    {meal_date:'2026-11-21',meal_type:'breakfast',status:'planned',ingredients:[
      {name:'Körniger Frischkäse',label:'150 g körniger Frischkäse leicht',quantity:150,unit:'g',inventory_id:null}]},
    {meal_date:'2026-11-22',meal_type:'dinner',status:'planned',ingredients:[
      {name:'Hähnchenbrustfilet',quantity:1010,unit:'g',inventory_id:null}]}
  ],
  inventory:[
    {id:'almond',name:'REWE Bio Mandelmus weiß',family_name:'Mandelmus weiß',quantity:250,unit:'g',is_active:true},
    {id:'cottage',name:'Körniger Frischkäse',family_name:'Körniger Frischkäse',quantity:300,unit:'g',is_active:true},
    {id:'buckwheat',name:'Buchweizenkörner (Menge noch prüfen)',family_name:'Buchweizen',quantity:0,unit:'g',is_active:true,shopping_excluded:true,pending_weighing:true},
    {id:'chicken',name:'Hähnchenbrustfilet',family_name:'Hähnchenbrustfilet',quantity:281,unit:'g',is_active:true}
  ],
  products:[
    {id:'cottage-light',inventory_id:'cottage',active:true,brand:'Milbona',product_name:'Körniger Frischkäse',variant:'leicht · 0,4 % Fett',
      category:'Milchprodukte',package_unit:'g',package_quantity:300,product_data:{}}
  ],
  general:[
    {id:'obsolete',label:'Naturjoghurt mild (1,5 % Fett)',quantity:500,unit:'g',
      source:'food-plan',status:'now',category:'Lebensmittel',needed_by:'2026-11-18',
      notes:'Stale automated forecast, not a purchase',purchase_data:{}},
    {id:'manual',label:'Scheibenenteiser',quantity:1,unit:'Stück',source:'manual',
      status:'now',category:'Non-Food',needed_by:'2026-11-11',notes:'Manual wish',purchase_data:{}}
  ]
};

async function check(browser,label,width,height){
  const ctx=await browser.newContext({viewport:{width,height},timezoneId:'Europe/Berlin',serviceWorkers:'block'});
  let page,failures=[];
  try{
    page=await ctx.newPage();
    page.on('pageerror',e=>failures.push(e.message));
    await page.goto(base+'/?shopping-browser-smoke='+label,
      {waitUntil:'domcontentloaded',timeout:60000});
    await page.locator('main.app').waitFor({timeout:20000});
    // Load the same production modules and styles the actual app uses.
    // Area-runtime loads them lazily; explicit loading isolates the shopping
    // behavior from unrelated account widgets.
    await page.addScriptTag({url:base+'/food-v544.js?shopping-smoke=1'});
    await page.addScriptTag({url:base+'/shopping-v678.js?shopping-smoke=1'});
    await page.evaluate(async({fragment,fixture})=>{
      const OriginalDate=window.Date;
      const fixed='2026-11-18T13:00:00Z';
      window.Date=class extends OriginalDate {
        constructor(...args){super(...(args.length?args:[fixed]));}
        static now(){return OriginalDate.parse(fixed);}
      };
      const fakeDb={
        shopping_items:fixture.general,
        shopping_products:fixture.products,
        shopping_receipt_reviews:[],
        shopping_receipt_aliases:[],
        shopping_substitutions:[],
        shopping_day_skips:[],
        shopping_checkouts:[],
        finance_transactions:[]
      };
      window.getSupabaseClient=()=>({
        auth:{getSession:async()=>({data:{session:{user:{id:'test-user'}}},error:null})},
        from(table){
          const result={data:fakeDb[table]||[],error:null};
          let q;
          q=new Proxy({}, {get(_target,method){
            if(method==='then')return (done,fail)=>Promise.resolve(result).then(done,fail);
            return ()=>q;
          }});
          return q;
        }
      });
      // Exercise the production Food calculation, then feed its result to
      // the actual Shopping module through its normal API boundary.
      const partial=new Function('window','document','return '+fragment+
        'return {deriveShopping,regularShoppingDate};})();')({},{});
      const gaps=partial.deriveShopping(fixture);
      window.__shoppingSmokeGaps=gaps;
      window.__modFoodV544.getShoppingSnapshot=async()=>({
        gaps,inventory:fixture.inventory,products:fixture.products,
        plannedShoppingUses:fixture.meals.flatMap(m=>
          m.ingredients.map(i=>({name:i.name,date:m.meal_date,unit:i.unit}))),
        manualFood:[],cartKeys:[],inventoryLots:[],inventoryAliases:[],
        overdueMeals:[]
      });
      window.__modShoppingV678.open();
    },{fragment,fixture});
    const root=page.locator('#modShoppingV643');
    await root.waitFor({state:'visible',timeout:15000});
    await page.waitForFunction(()=>{
      const x=window.__modShoppingV678?.getState?.();
      return Array.isArray(x?.food?.gaps)&&x.food.gaps.length>=3;
    },{timeout:20000});
    // Later shopping dates are collapsed by default. Open the actual
    // date group as a user would, then verify its visible purchase amounts.
    const later=page.locator('#modShoppingV643 details.shopping-date-group-v678');
    if(await later.count())await later.first().locator('summary').click();
    const text=await root.innerText();
    assert.match(text,/EINKAUFSLISTE/);
    assert.match(text,/Hähnchenbrustfilet/);
    assert.match(text,/799 g/,'281 g chicken must reduce the 1080 g Wednesday need');
    assert.match(text,/1[.]010 g/,'Saturday chicken needs 1010 g, not duplicate Wednesday stock');
    assert.match(text,/Buchweizen/);
    assert.match(text,/65 g/);
    assert.match(text,/Bestand prüfen/);
    assert.match(text,/nicht gewogen/);
    assert.doesNotMatch(text,/Mandelmus/i,'confirmed almond butter must not be rebought');
    assert.doesNotMatch(text,/Körniger Frischkäse/i,'confirmed light cottage cheese must not be rebought');
    assert.doesNotMatch(text,/Naturjoghurt mild/i,'old automatic yoghurt entry must disappear');
    assert.match(text,/Scheibenenteiser/i,'manual shopping wish must remain');
    const api=await page.evaluate(()=>{
      const d=window.__modShoppingV678.getState();
      return {version:window.__modShoppingV678.version,
        gaps:d.food.gaps.map(g=>({name:g.label,missing:g.missing,buyFrom:g.buyFrom,unverified:g.stockUnverified}))};
    });
    assert.equal(api.version,'V816','real merged shopping JS must be loaded');
    const actual=api.gaps.find(g=>g.name==='Buchweizen');
    assert(actual?.unverified===true,'unweighed stock warning must survive browser rendering');
    const dir=path.join(process.cwd(),'test-results');
    fs.mkdirSync(dir,{recursive:true});
    await page.screenshot({path:path.join(dir,'shopping-v1-'+label+'.png'),fullPage:true});
    console.log('PASS '+label+' '+width+'×'+height+' rendered shopping UI. '+
      'Wednesday chicken 799 g, Saturday chicken 1010 g, Buchweizen 65 g check; '+
      'verified products and stale yoghurt excluded.');
    if(failures.length)console.warn('Unrelated page JS errors:',failures.slice(0,5));
  }catch(error){
    try{
      fs.mkdirSync(path.join(process.cwd(),'test-results'),{recursive:true});
      if(page)await page.screenshot({path:path.join(process.cwd(),'test-results','shopping-failed-'+label+'.png'),fullPage:true});
    }catch(_){}
    throw error;
  }finally{await ctx.close();}
}
async function main(){
  try{
    if(server)for(let i=0;i<50;i++){
      try{const r=await fetch(base);if(r.ok)break;}catch(_){}
      await wait(150);
    }
    const chrome=await chromium.launch({headless:true});
    try{
      await check(chrome,'chromium-mobile',390,844);
      await check(chrome,'chromium-desktop',1440,900);
    }finally{await chrome.close();}
    const wk=await webkit.launch({headless:true});
    try{await check(wk,'webkit-iphone',390,844);}
    finally{await wk.close();}
  }finally{if(server)server.kill('SIGTERM');}
}
main().catch(error=>{console.error('SHOPPING BROWSER FAILURE',error);process.exitCode=1;});
