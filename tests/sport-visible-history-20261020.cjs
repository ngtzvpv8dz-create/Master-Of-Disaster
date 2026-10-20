'use strict';
// Browser checks with anonymous fixtures; no private names or production credentials.
const {chromium,webkit}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const port=8899, base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port)],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const activity=(id,session_id,name,kind,start,end,mins)=>({
  id,session_id,name,kind,sort_order:1,duration_minutes:mins,
  started_at:'2026-10-'+(session_id==='ski'?'17':'20')+'T'+start+':00+02:00',
  ended_at:'2026-10-'+(session_id==='ski'?'17':'20')+'T'+end+':00+02:00'
});
const session=(id,date,title,venue,start,end,mins)=>({
  id,user_id:'fake-user',session_date:date,title,venue,session_kind:'activity',
  session_status:'completed',duration_minutes:mins,source:'manual',
  started_at:date+'T'+start+':00+02:00',ended_at:date+'T'+end+':00+02:00'
});
const data={
  sport_sessions:[
    session('ski','2026-10-17','Skifahren','SnowWorld Testort','10:00','16:00',300),
    session('a','2026-10-20','functional x','FitX','18:00','18:40',40),
    session('b','2026-10-20','tour de x','FitX','19:00','19:50',50),
    session('c','2026-10-20','yogilatix','FitX','20:00','20:45',45)
  ],
  sport_activities:[
    activity('lesson','ski','Ski-Einsteigerkurs 1','course','10:00','14:00',240),
    activity('free','ski','Freies Skifahren','activity','15:00','16:00',60),
    activity('a1','a','functional x','course','18:00','18:40',40),
    activity('b1','b','tour de x','course','19:00','19:50',50),
    activity('c1','c','yogilatix','course','20:00','20:45',45)
  ],
  sport_activity_participants:[
    ...['Testperson A','Testperson B'].map(participant_name=>({activity_id:'a1',participant_name})),
    ...['Testperson A','Testperson B','Testperson C','Testperson D'].map(participant_name=>({activity_id:'b1',participant_name})),
    ...['Testperson C','Testperson D'].map(participant_name=>({activity_id:'c1',participant_name}))
  ],
  sport_session_participants:[]
};
async function run(engine,which,partial){
  const ctx=await engine.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Berlin',serviceWorkers:'block'});
  try {
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*supabase.co/**',route=>route.abort());
    await page.goto(base+'/?reg=ci-sport-'+which+'-'+String(partial),{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>!!window.__modAreaRuntimeV609,{timeout:25000});
    await page.evaluate(()=>window.__modAreaRuntimeV609.openArea('sport'));
    await page.waitForFunction(()=>!!window.__modSportV568,{timeout:60000});
    await page.evaluate(({data,partial})=>{
      window.getSupabaseClient=()=>({
        auth:{getSession:async()=>({data:{session:{user:{id:'fake-user'}}},error:null})},
        from(table){
          const query={select(){return query},eq(){return query},order(){return query},limit(){return query},
            then(yes,no){
              const response=partial&&table==='sport_course_catalog'
                ?{data:null,error:{message:'Optional query down'}}
                :{data:data[table]||[],error:null};
              return Promise.resolve(response).then(yes,no);
            }
          };
          return query;
        }
      });
      window.__modSportV568.saveSessions([{
        id:'old',session_date:'2026-10-01',title:'Veralteter Cache',
        venue:'FitX',session_kind:'activity',session_status:'completed',duration_minutes:20
      }]);
    },{data,partial});
    await page.evaluate(async()=>{
      window.__modSportV568.setMode('sport',{persist:false,animate:false});
      await window.__modSportV568.refresh();
      window.__modSportTabsV512.setTab('sessions',{animate:false,persist:false});
    });
    const state=await page.evaluate(()=>window.__modSportV568.getState());
    assert.equal(state.sessions,4,'cloud data must replace stale cache');
    assert.equal(state.source,partial?'partial':'supabase','must show honest live state: '+JSON.stringify(state));
    const units=page.locator('.sport-unit-detail-v635');
    assert.equal(await units.count(),2,'both dates must appear grouped in EINHEITEN');
    const gym=units.filter({hasText:'20.10'}),ski=units.filter({hasText:'17.10'});
    assert.equal(await gym.count(),1);assert.equal(await ski.count(),1);
    await gym.locator('summary').click();
    let gymText=await gym.innerText();
    for(const x of ['functional x','tour de x','yogilatix','Testperson A','Testperson B','Testperson C','Testperson D'])
      assert(gymText.includes(x),'missing shown course/person: '+x);
    const edit=gym.locator('[data-sport-edit-session]');
    assert.equal(await edit.count(),1,'course-only days must be editable');
    await edit.click();
    const picker=gym.locator('form[data-sport-activity-participants="b1"] [data-sport-multi-people]');
    await picker.waitFor({state:'attached'});
    assert.equal(await picker.locator('input[type="checkbox"]:checked').count(),4,'four companions pre-selected');
    await picker.locator('input[type="checkbox"][value="Testperson D"]').uncheck();
    assert(!((await picker.locator('input[name="participants"]').inputValue()).includes('Testperson D')),'checkbox sync must work');
    await ski.locator('summary').click();
    let skiText=await ski.innerText();
    for(const x of ['Ski-Einsteigerkurs 1','Freies Skifahren','PAUSE','10:00','14:00','15:00','16:00','AKTIVITÄT'])
      assert(skiText.includes(x),'missing shown ski step: '+x);
    assert((await ski.locator('summary').innerText()).includes('5:00 h'),'waiting must not count toward sports time');
    const refresh=page.getByRole('button',{name:/Sportdaten aktualisieren/});
    assert.equal(await refresh.count(),1);
    await refresh.click();
    await page.waitForFunction(expected=>window.__modSportV568.getState().source===expected,partial?'partial':'supabase',{timeout:20000});
    assert.equal(await units.count(),2);
    assert.deepEqual(errors,[],'No JS browser errors');
    console.log('VISIBLE SPORT PASS '+which+' '+(partial?'partial recovery':'full cloud')+': ski + break + active time + 3 courses + 8 participant relations + multi-select + refresh');
  } finally { await ctx.close(); }
}
(async()=>{
  try {
    for(let i=0;i<50;i++){try{if((await fetch(base+'/index.html')).ok)break}catch(_){}await pause(200);}
    for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
      const browser=await engine.launch({headless:true});
      try{await run(browser,name,false);await run(browser,name,true);}finally{await browser.close();}
    }
    console.log('ALL SPORT VISIBLE-HISTORY BROWSER TESTS PASS');
  } finally {server.kill('SIGTERM');}
})().catch(e=>{console.error('SPORT VISIBLE-HISTORY FAIL',e);process.exitCode=1;});
