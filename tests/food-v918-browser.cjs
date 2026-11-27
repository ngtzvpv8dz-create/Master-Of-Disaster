'use strict';
// Real V1 index.html + production FOOD module in Chromium and WebKit.
// Fictitious in-memory Supabase. NEVER logs in or writes actual user data.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const port=8896;
const base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port)],{stdio:'ignore'});
const wait=ms=>new Promise(done=>setTimeout(done,ms));

const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const t=new Date(today+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+1);
const tomorrow=t.toISOString().slice(0,10);

async function run(browser,label){
  const ctx=await browser.newContext({viewport:label.includes('desktop')?{width:1440,height:900}:{width:390,height:844},timezoneId:'Europe/Berlin',serviceWorkers:'block'});
  let page;
  try{
    page=await ctx.newPage();
    await page.goto(base+'/?food-v918-browser='+label,{waitUntil:'domcontentloaded',timeout:45000});
    await page.locator('main.app').waitFor({timeout:20000});
    await page.addScriptTag({url:base+'/food-v544.js?food-browser-test'});
    await page.evaluate(({today,tomorrow})=>{
      const todayMeal={id:'m-planned',meal_date:today,meal_type:'dinner',title:'Test-Abendessen',status:'planned',sort_order:4,prepared_servings:1,
        food_meal_ingredients:[
          {id:'i-onion',name:'TK-Zwiebeln',label:'80 g TK-Zwiebeln',quantity:80,unit:'g',sort_order:1},
          {id:'i-pepper',name:'Pfeffer schwarz',label:'Pfeffer schwarz nach Belieben',quantity:null,unit:'nach Belieben',sort_order:2}
        ]};
      const tasted={id:'m-done',meal_date:today,meal_type:'lunch',title:'Testgericht mit Tempeh',status:'completed',sort_order:2,prepared_servings:1,
        food_meal_ingredients:[{id:'i-tempeh',name:'Tempeh',quantity:100,unit:'g',sort_order:1}]};
      const prep={id:'m-tomorrow',meal_date:tomorrow,meal_type:'dinner',title:'Mariniertes Testgericht',status:'planned',sort_order:4,recipe_id:'r-prep',prepared_servings:1,food_meal_ingredients:[]};
      const db={
        food_meals:[todayMeal,tasted,prep],
        food_recipes:[{id:'r-prep',title:'Mariniertes Testgericht',meal_type:'dinner',servings:1,active:true,
          instructions:'1. Gemüse über Nacht marinieren. 2. Am Folgetag kurz garen.',food_recipe_ingredients:[]}],
        food_ingredient_preferences:[{id:'p-tempeh',ingredient_name:'Tempeh',preference:'Würde ich probieren',is_current_selection:true}],
        food_meal_ingredient_prep_checks:[],
        // Three independent confirmed extras on the same calendar day.
        food_extra_consumptions:[
          {id:'extra-drink',user_id:'test-user',consumption_date:today,kind:'drink',title:'Demo Energy Drink',quantity:1,unit:'Dose',calories_kcal:20,protein_g:0,source_reference:'fixture-drink'},
          {id:'extra-chips',user_id:'test-user',consumption_date:today,kind:'snack',title:'Demo Chips',quantity:40,unit:'g',calories_kcal:210,protein_g:3,source_reference:'fixture-chips'},
          {id:'extra-choc',user_id:'test-user',consumption_date:today,kind:'snack',title:'Demo Schokolade',quantity:20,unit:'g',calories_kcal:110,protein_g:2,source_reference:'fixture-choc'}
        ]
      };
      const actions=[];
      const selectRows=(table,filters=[])=>{
        let rows=[...(db[table]||[])];
        for(const [method,field,value] of filters){
          if(method==='eq')rows=rows.filter(item=>item[field]===value);
          if(method==='gte')rows=rows.filter(item=>String(item[field]||'')>=String(value));
          if(method==='lt')rows=rows.filter(item=>String(item[field]||'')<String(value));
        }
        return rows;
      };
      window.__foodV918Browser={db,actions};
      window.getSupabaseClient=()=>({
        auth:{getSession:async()=>({data:{session:{user:{id:'test-user'}}},error:null})},
        from(table){
          const filters=[];let mode='select';
          const query={
            select(){return query;},eq(field,value){filters.push(['eq',field,value]);return query;},
            gte(field,value){filters.push(['gte',field,value]);return query;},
            lte(){return query;},lt(field,value){filters.push(['lt',field,value]);return query;},
            gt(){return query;},neq(){return query;},in(){return query;},is(){return query;},
            order(){return query;},limit(){return query;},delete(){mode='delete';return query;},
            range(start,end){return Promise.resolve({data:selectRows(table,filters).slice(start,end+1),error:null});},
            upsert(item){
              actions.push({type:'upsert',table,item});
              if(table==='food_meal_ingredient_prep_checks'){
                db[table]=(db[table]||[]).filter(x=>x.ingredient_id!==item.ingredient_id);
                db[table].push({ingredient_id:item.ingredient_id,checked_at:item.checked_at,user_id:item.user_id});
              }
              return Promise.resolve({data:[item],error:null});
            },
            then(resolve,reject){
              if(mode==='delete'){
                actions.push({type:'delete',table,filters:[...filters]});
                db[table]=(db[table]||[]).filter(x=>!filters.every(([op,k,v])=>op!=='eq'||x[k]===v));
                return Promise.resolve({data:[],error:null}).then(resolve,reject);
              }
              return Promise.resolve({data:selectRows(table,filters),error:null}).then(resolve,reject);
            }
          };
          return query;
        },
        async rpc(name,payload){
          actions.push({type:'rpc',name,payload});
          if(name==='record_food_ingredient_taste_feedback'){
            const pref=db.food_ingredient_preferences.find(x=>x.id===payload.p_preference_id);
            if(!pref||!db.food_meals.some(x=>x.id===payload.p_meal_id&&x.status==='completed'))
              return {data:null,error:{message:'Invalid taste feedback context'}};
            pref.preference=payload.p_new_preference;
            return {data:{updated:true},error:null};
          }
          return {data:null,error:{message:'Unmocked RPC '+name}};
        }
      });
      window.__modFoodV544.open();
    },{today,tomorrow});
    await page.locator('#modFoodV544 .food-section-head-v544').waitFor({timeout:18000});
    const src=await page.evaluate(()=>window.__modFoodV544.getDataSources());
    assert.equal(src.prepChecks,'cloud','real FOOD code must trust the fixture synchronization');
    assert.equal(src.preferences,'cloud','taste preferences loaded from fixture');
    const reminder=page.locator('#modFoodV544 .food-prep-ahead-v918');
    await reminder.waitFor({state:'visible',timeout:12000});
    assert.match(await reminder.innerText(),/Für morgen vorbereiten/);
    await reminder.locator('summary').click();
    assert.match(await reminder.innerText(),/Mariniertes Testgericht/);
    assert.match(await reminder.innerText(),/marinieren/i);
    await page.locator('[data-food-meal-toggle="m-planned"]').click();
    const onion=page.locator('[data-food-prep-check="i-onion"]');
    await onion.waitFor({state:'visible',timeout:10000});
    assert.equal(await onion.getAttribute('aria-pressed'),'false');
    const pepperRow=page.locator('[data-food-ingredient-id="i-pepper"]');
    assert.match(await pepperRow.innerText(),/Pfeffer/i);
    assert.doesNotMatch(await pepperRow.innerText(),/nach Belieben|Menge offen/i);
    assert.equal(await pepperRow.locator('b').count(),0);
    const pepper=page.locator('[data-food-prep-check="i-pepper"]');
    await pepper.click();
    await page.waitForFunction(()=>document.querySelector('[data-food-prep-check="i-pepper"]')?.getAttribute('aria-pressed')==='true');
    await pepper.click();
    await page.waitForFunction(()=>document.querySelector('[data-food-prep-check="i-pepper"]')?.getAttribute('aria-pressed')==='false');
    await onion.click();
    await page.waitForFunction(()=>document.querySelector('[data-food-prep-check="i-onion"]')?.getAttribute('aria-pressed')==='true');
    assert(await page.locator('[data-food-ingredient-id="i-onion"]').evaluate(el=>el.classList.contains('food-prep-checked-v915')));
    await onion.click();
    await page.waitForFunction(()=>document.querySelector('[data-food-prep-check="i-onion"]')?.getAttribute('aria-pressed')==='false');
    assert.equal(await page.locator('[data-food-prep-check="i-onion"]').getAttribute('aria-pressed'),'false');
    const button=page.locator('[data-food-taste-feedback="m-done"]');
    await button.waitFor({state:'visible',timeout:10000});
    await button.click();
    const form=page.locator('.food-taste-form-v918');
    await form.waitFor({state:'visible',timeout:10000});
    await form.locator('[name="preference_id"]').selectOption('p-tempeh');
    await form.locator('[name="new_preference"]').selectOption('Gern');
    assert.equal(await form.locator('[name="really_tasted"]').isChecked(),false,'do not save unconfirmed tasting');
    await form.locator('[name="really_tasted"]').check();
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction(()=>window.__foodV918Browser.db.food_ingredient_preferences[0].preference==='Gern',{timeout:12000});
    const actions=await page.evaluate(()=>window.__foodV918Browser.actions);
    assert.deepEqual(actions.slice(0,2).map(x=>x.type),['upsert','delete']);
    assert(actions.some(x=>x.type==='rpc'&&x.name==='record_food_ingredient_taste_feedback'&&x.payload.p_meal_id==='m-done'),'tasting should use designated RPC');
    assert(actions.every(x=>x.table!=='food_inventory'&&x.table!=='food_inventory_lots'),'checkbox must not debit food');
    // Real extra-snack panel: the ordinary meal must remain, and 3 extras show separately.
    await page.addScriptTag({url:base+'/food-extra-snacks-v828.js?food-browser-test'});
    const extraPanel=page.locator('#food-extra-snacks-v828');
    await extraPanel.waitFor({state:'visible',timeout:15000});
    await page.waitForFunction(()=>window.__modFoodExtrasV828?.getStatus?.().ready===true,{timeout:15000});
    const extraText=await extraPanel.innerText();
    assert.match(extraText,/3 Zusatz-Snacks/);
    assert.match(extraText,/340 kcal/);
    assert.match(extraText,/Demo Energy Drink/);
    assert.match(extraText,/Demo Chips/);
    assert.match(extraText,/Demo Schokolade/);
    assert(await page.locator('[data-food-meal-card="m-planned"]').count(),'ordinary meal must not be replaced by extras');
    const dir=path.join(process.cwd(),'test-results');
    fs.mkdirSync(dir,{recursive:true});
    await page.screenshot({path:path.join(dir,'food-v918-'+label+'.png'),fullPage:true});
    console.log('PASS FOOD '+label+' prep reminder, spice display, ingredient check/undo, taste feedback, 3 independent extras including drink+chips+chocolate.');
  }catch(e){
    if(page){try{fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/food-v918-fail-'+label+'.png',fullPage:true});}catch(_){}}
    throw e;
  }finally{await ctx.close();}
}
(async()=>{
  try{
    for(let i=0;i<70;i++){try{if((await fetch(base)).ok)break;}catch(_){}await wait(120);}
    const chrome=await chromium.launch({headless:true,...(process.env.FOOD_TEST_USE_SYSTEM_CHROME==='1'?{channel:'chrome'}:{})});
    try{await run(chrome,'chromium-mobile');await run(chrome,'chromium-desktop');}
    finally{await chrome.close();}
    if(process.env.FOOD_TEST_SKIP_WEBKIT!=='1'){
      const wk=await webkit.launch({headless:true});
      try{await run(wk,'webkit-iphone');}finally{await wk.close();}
    }
  }finally{server.kill('SIGTERM');}
})().catch(err=>{console.error('FOOD V918 BROWSER FAILURE',err);process.exitCode=1;});
