'use strict';
// V1 live shopping browser regression with isolated fixtures, NO personal data writes.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const base=String(process.env.FOOD_SHOPPING_TEST_BASE_URL||'https://ngtzvpv8dz-create.github.io/Master-Of-Disaster').replace(/\/$/,'');
async function run(browser,label,explicitPurchase){
 const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Berlin',serviceWorkers:'allow'});
 try{
  const page=await ctx.newPage(),errs=[];
  page.on('pageerror',e=>errs.push(e.stack||e.message));
  await page.clock.setFixedTime(new Date('2026-11-14T10:00:00+01:00'));
  await page.route('**/*supabase.co/**',route=>route.abort());
  await page.goto(base+'/?check=shopping-live-v905-'+label,{waitUntil:'networkidle',timeout:60000});
  await page.locator('main.app').waitFor({timeout:20000});
  // Use actual production FOOD and SHOPPING scripts, as in the passing shopping browser suite.
  // This targeted fixture test does not depend on unrelated staged module readiness.
  await page.addScriptTag({url:base+'/food-v544.js?shopping-audit=1'});
  await page.addScriptTag({url:base+'/shopping-v678.js?shopping-audit=1'});
  await page.evaluate(explicitPurchase=>{
   const food={
     inventory:[
       {id:'bread',name:'Harry Vital+fit Brot',quantity:13,unit:'Scheiben',family_name:'Vollkornbrot',is_active:true},
       {id:'onion',name:'ELO Frost Zwiebelwürfel TK',quantity:860,unit:'g',family_name:'Zwiebeln TK gewürfelt',is_active:true},
       {id:'mustard',name:'Senf',quantity:171,unit:'ml',family_name:'Senf',is_active:true},
       {id:'hack-stock',name:'Rinderhackfleisch Light',quantity:315,unit:'g',family_name:'Rinderhackfleisch Light',is_active:true},
       {id:'paprika',name:'Paprikastreifen TK bunt',quantity:660,unit:'g',family_name:'Paprika TK bunt',is_active:true}
     ],
     gaps:[
       {label:'Rinderhackfleisch Light',unit:'g',required:490,missing:415,available:75,currentAvailable:315,buyFrom:'2026-11-14',shortageDate:'2026-11-16',uses:[{date:'2026-11-16',quantity:490}]},
       {label:'Tomaten',unit:'g',required:250,missing:250,available:0,currentAvailable:0,buyFrom:'2026-11-14',shortageDate:'2026-11-16',uses:[{date:'2026-11-16',quantity:250}]}
     ],
     inventoryLots:[],manualFood:[],cartKeys:[],plannedShoppingUses:[
       {name:'Rinderhackfleisch Light',date:'2026-11-16',unit:'g'},
       {name:'Tomaten',date:'2026-11-16',unit:'g'}
     ],mealPlanVerified:true
   };
   const fixtures={
     shopping_items:[{id:'planned-hack',label:'Rinderhackfleisch Light (5 % Fett)',quantity:500,unit:'g',category:'Lebensmittel',status:'now',source:'food-plan-audit',source_key:'meal-2026-11-16-rinderhack-light',needed_by:'2026-11-14',notes:'Einmal 500 g zur Deckung des Hackbedarfs.',sort_order:1,created_at:'2026-11-14T08:00:00Z'}],
     shopping_products:[],shopping_receipt_reviews:[],shopping_receipt_aliases:[],
     shopping_substitutions:[],shopping_day_skips:[],shopping_checkouts:[],finance_transactions:[]
   };
   if(explicitPurchase)fixtures.shopping_items.push({...fixtures.shopping_items[0],id:'actual-hack',source:'manual',source_key:'manual-hack',notes:'Verbindlicher separater Einkauf 500 g.'});
   window.getSupabaseClient=()=>({
    auth:{getSession:async()=>({data:{session:{user:{id:'demo'}}},error:null})},
    from(table){
      let q;
      q=new Proxy({}, {get(target,key){
       if(key==='then')return (ok,fail)=>Promise.resolve({data:fixtures[table]||[],error:null}).then(ok,fail);
       return ()=>q;
      }});
      return q;
    }
   });
   window.__modFoodV544.getShoppingSnapshot=async()=>food;
  },explicitPurchase);
  const loaded=await page.evaluate(async()=>{
   if(!window.__modShoppingV678)return {err:'shopping not loaded'};
   window.__modShoppingV678.open();
   await window.__modShoppingV678.reload({refreshFood:false});
   return {ready:true,hasFood:!!window.__modShoppingV678.getState().food};
  });
  assert(loaded.ready&&loaded.hasFood,'shopping module and food bridge ready '+JSON.stringify(loaded));
  await page.locator('#modShoppingV643 .shopping-item-v643').first().waitFor({state:'visible',timeout:20000});
  const cards=await page.locator('#modShoppingV643 .shopping-item-v643').allTextContents();
  const joined=cards.join(' | ');
  assert.equal(cards.filter(v=>/Rinderhack/i.test(v)).length,1,'one lean mince purchase, not duplicate: '+joined);
  const hack=cards.find(v=>/Rinderhack/i.test(v));
  const expected=explicitPurchase?500:415;
  assert(hack&&hack.includes('Kaufen '+expected+' g'),(explicitPurchase?'Explicit purchase must cover the deficit':'Historical audit must not override current deficit')+': '+joined);
  assert(hack.includes('Aktuell im Vorrat 315 g'),'current stock is not the purchase quantity: '+joined);
  assert(/Tomaten \(frisch\)/.test(joined),'Tomatoes generic label displayed: '+joined);
  assert(!/Sorte prüfen/.test(joined),'remove confusing tomato warning');
  assert(!/Harry Vital\+fit/.test(joined),'existing bread should not become purchase');
  assert(!/TK-Zwiebel|Zwiebelwürfel/i.test(joined),'sufficient frozen onions should not become purchase');
  assert(!/Löwensenf|Senf extra/i.test(joined),'existing mustard should not become purchase');
  assert.equal(errs.length,0,'page errors: '+errs.join(' | '));
  console.log('SHOPPING LIVE MOBILE PASS '+label+': one '+expected+'g lean mince ('+(explicitPurchase?'explicit purchase':'audit ignored')+'); tomatoes without warning; no duplicate bread/onions/mustard purchase');
 } finally{await ctx.close()}
}
(async()=>{
 for(const [label,engine] of [['Chromium',chromium],['WebKit',webkit]]){
  const b=await engine.launch({headless:true});
  try{await run(b,label,false);await run(b,label,true)}finally{await b.close()}
 }
 console.log('SHOPPING V1 LIVE MOBILE BROWSER TESTS ALL PASS');
})().catch(e=>{console.error('SHOPPING V1 LIVE MOBILE BROWSER FAIL',e);process.exitCode=1});
