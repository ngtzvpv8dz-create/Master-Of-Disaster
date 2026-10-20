'use strict';
// End-to-end FOOD lot safety checks with anonymized local fixtures.
// The database RPC is tested separately inside a rollback-only SQL transaction.
const {chromium,webkit}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const port=8898,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port)],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function scenario(browser,label){
 const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Berlin',serviceWorkers:'block'});
 try{
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*supabase.co/**',route=>route.abort());
  await page.goto(base+'/?check=food-lot-v848-'+label,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__modAreaRuntimeV609,{timeout:30000});
  await page.evaluate(()=>window.__modAreaRuntimeV609.openArea('food'));
  await page.waitForFunction(()=>window.__modFoodV544,{timeout:60000});
  await page.evaluate(async()=>{
    const stock={id:'beans',name:'Schwarze Bohnen',quantity:680,unit:'g',
      catalog_family_name:'Bohnen',catalog_variant_label:'Schwarze Bohnen',
      tone:'stock',opened:true,pending_weighing:false,use_priority:'later',
      is_active:true,sort_order:1,quantity_label:'680 g'};
    const opened={id:'open',inventory_id:'beans',product_id:'product',unopened_packages:0,
      opened_packages:1,opened_remaining_quantity:280,opened_remaining_unit:'g',
      package_quantity:400,package_unit:'g',best_before_label:'07/2031',
      created_at:'2026-09-30T10:00:00Z',updated_at:'2026-10-03T10:00:00Z'};
    const closed={id:'closed',inventory_id:'beans',product_id:'product',unopened_packages:1,
      opened_packages:0,opened_remaining_quantity:null,opened_remaining_unit:null,
      package_quantity:400,package_unit:'g',best_before_label:'10/2030',
      created_at:'2026-09-26T10:00:00Z',updated_at:'2026-09-26T10:00:00Z'};
    const fixture={food_inventory_overview:[stock],food_inventory_lots:[opened,closed],
      shopping_products:[{id:'product',inventory_id:'beans',brand:'Demo',product_name:'Schwarze Bohnen',variant:'400 g',category:'Konserven',active:true,product_data:{}}]};
    window.__foodLotTest={stock,opened,closed,fixture,actions:[]};
    window.getSupabaseClient=()=>({
      auth:{getSession:async()=>({data:{session:{user:{id:'demo'}}},error:null})},
      from(table){
        let q;
        q=new Proxy({}, {get(target,key){
          if(key==='then')return (done,fail)=>Promise.resolve({data:fixture[table]||[],error:null}).then(done,fail);
          return ()=>q;
        }});
        return q;
      },
      async rpc(name,payload){
        if(name!=='manage_food_inventory_lot_v848')return {data:null,error:{message:'unexpected RPC '+name}};
        window.__foodLotTest.actions.push({...payload});
        const current=fixture.food_inventory_lots.find(l=>l.id===payload.p_lot_id);
        const old=current?(Number(current.unopened_packages)||0)*(Number(current.package_quantity)||0)+(Number(current.opened_remaining_quantity)||0):0;
        if(payload.p_action==='create'){
          const newLot={...closed,id:'new',unopened_packages:payload.p_unopened,opened_packages:payload.p_opened_remaining>0?1:0,
            opened_remaining_quantity:payload.p_opened_remaining,package_quantity:payload.p_package_quantity,
            best_before_label:payload.p_best_before_label,created_at:'2026-10-20T10:00:00Z',updated_at:'2026-10-20T10:00:00Z'};
          fixture.food_inventory_lots.push(newLot);
        }else{
          current.unopened_packages=payload.p_action==='discard'?0:payload.p_unopened;
          current.opened_remaining_quantity=payload.p_action==='discard'?0:payload.p_opened_remaining;
          current.opened_packages=current.opened_remaining_quantity>0?1:0;
          current.package_quantity=payload.p_package_quantity;
          current.updated_at='2026-10-21T10:00:00Z';
        }
        const next=payload.p_action==='discard'?0:payload.p_unopened*payload.p_package_quantity+payload.p_opened_remaining;
        stock.quantity+=next-old;stock.quantity_label=stock.quantity+' g';
        return {data:{inventory_id:'beans',lot_id:payload.p_lot_id||'new',quantity:stock.quantity},error:null};
      }
    });
    window.__modFoodV544.open();
    await window.__modFoodV544.reload();
  });
  await page.waitForFunction(()=>window.__modFoodV544.getDataSources().lots==='cloud',{timeout:15000});
  await page.locator('[data-food-tab="inventory"]').click();
  const beans=page.locator('[data-food-stock-card="beans"]');
  await beans.waitFor({state:'visible'});
  let lots=beans.locator('[data-food-lot-id]');
  assert.equal(await lots.count(),2,'two independent inventory lot rows must appear');
  assert((await beans.locator('[data-food-lot-id="open"]').innerText()).includes('280 g'),'opened can not individually visible');
  assert((await beans.locator('[data-food-lot-id="closed"]').innerText()).includes('400 g'),'sealed can not individually visible');
  assert((await beans.locator('[data-food-lot-id="open"]').innerText()).includes('07/2031'),'opened MHD invisible');
  assert((await beans.locator('[data-food-lot-id="closed"]').innerText()).includes('10/2030'),'closed MHD invisible');
  assert.equal(await beans.locator('[data-food-adjust]').count(),0,'dangerous family-wide quantity editor must be hidden when lots exist');
  await beans.locator('[data-food-lot-id="open"] [data-food-discard-lot]').click();
  const modal=page.locator('.food-modal-v544');
  await modal.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>window.__foodLotTest.actions.length===1,{timeout:10000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-food-lot-id]').length===1,{timeout:10000});
  const afterDiscard=await page.evaluate(()=>({
    amount:window.__foodLotTest.stock.quantity,
    closed:window.__foodLotTest.closed.unopened_packages,
    p:window.__foodLotTest.actions[0]
  }));
  assert.equal(afterDiscard.p.p_lot_id,'open','discard must target selected lot id');
  assert.equal(afterDiscard.p.p_action,'discard');
  assert.equal(afterDiscard.amount,400,'only opened 280g can should be removed');
  assert.equal(afterDiscard.closed,1,'unopened can must remain untouched');
  await beans.locator('[data-food-lot-id="closed"] [data-food-edit-lot]').click();
  await modal.locator('input[name="unopened"]').fill('0');
  await modal.locator('input[name="opened_remaining"]').fill('180');
  await modal.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>window.__foodLotTest.actions.length===2,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('[data-food-lot-id="closed"]')?.textContent.includes('180 g'),{timeout:10000});
  const edited=await page.evaluate(()=>({quantity:window.__foodLotTest.stock.quantity,p:window.__foodLotTest.actions[1]}));
  assert.equal(edited.p.p_lot_id,'closed');
  assert.equal(edited.quantity,180);
  await beans.locator('[data-food-add-lot]').click();
  await modal.locator('input[name="package_quantity"]').fill('400');
  await modal.locator('input[name="unopened"]').fill('1');
  await modal.locator('input[name="opened_remaining"]').fill('0');
  await modal.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>window.__foodLotTest.actions.length===3,{timeout:10000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-food-lot-id]').length===2,{timeout:10000});
  const created=await page.evaluate(()=>({q:window.__foodLotTest.stock.quantity,p:window.__foodLotTest.actions[2]}));
  assert.equal(created.p.p_action,'create');
  assert.equal(created.q,580);
  assert.equal(errors.length,0,'javascript errors: '+errors.join('; '));
  console.log('FOOD INDIVIDUAL LOT UI PASS '+label+': two rows, independent MHD, discard opened 280, preserve unopened 400, edit selected, add new');
 } finally{await ctx.close();}
}
(async()=>{
 try{
  for(let i=0;i<40;i++){try{if((await fetch(base+'/index.html')).ok)break}catch(_){}await wait(180);}
  for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
    const browser=await engine.launch({headless:true});
    try{await scenario(browser,name);}finally{await browser.close();}
  }
  console.log('FOOD LOT BROWSER TESTS ALL PASS');
 }finally{server.kill('SIGTERM');}
})().catch(e=>{console.error('FOOD LOT BROWSER TEST FAIL',e);process.exitCode=1;});
