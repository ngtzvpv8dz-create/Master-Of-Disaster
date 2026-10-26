'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','food-planned-extras-v880.js'),'utf8');

function harness(){
  let panel=null,style=false,callback=null,authCalls=0,queryCalls=0,mutations=0;
  const waiters=[];
  const genericNode={nodeType:1,id:'generated-child',querySelector(){return null;}};
  function emit(node){
    if(++mutations>30)throw new Error('Recursive mutation overflow');
    queueMicrotask(()=>callback?.([{addedNodes:[node]}]));
  }
  function el(){
    let html='';
    return {
      nodeType:1,id:'',className:'',setAttribute(){},
      get innerHTML(){return html;},
      set innerHTML(value){html=value;emit(genericNode);}
    };
  }
  const root={getAttribute(){return 'false';}};
  const extra={insertAdjacentElement(where,node){
    assert.equal(where,'afterend');panel=node;emit(node);
  }};
  const document={
    readyState:'complete',documentElement:{},head:{append(){style=true;}},
    getElementById(id){
      if(id==='modFoodV544')return root;
      if(id==='food-extra-snacks-v828')return extra;
      if(id==='food-planned-extras-v880')return panel;
      if(id==='food-planned-extras-style-v880')return style?{}:null;
      return null;
    },
    createElement(){return el();},
    addEventListener(){}
  };
  const fakeQuery={
    select(){return this;},eq(){return this;},order(){return this;},
    limit(){queryCalls++;return Promise.resolve({data:[],error:null});}
  };
  const window={getSupabaseClient(){return {
    auth:{getSession(){authCalls++;return new Promise(resolve=>waiters.push(resolve));}},
    from(table){assert.equal(table,'food_planned_extras');return fakeQuery;}
  };}};
  const MutationObserver=class{constructor(fn){callback=fn;}observe(){}};
  vm.runInNewContext(source,{window,document,MutationObserver,Intl,Date,Number,String,Math,Promise,Array,Boolean,setTimeout,clearTimeout,console});
  return {get authCalls(){return authCalls;},get queryCalls(){return queryCalls;},
    get mutations(){return mutations;},get panel(){return panel;},
    flushAuth(){assert.equal(waiters.length>0,true);waiters.shift()({data:{session:{user:{id:'test-user'}}},error:null});},
    reopen(){panel=null;emit({nodeType:1,id:'food-extra-snacks-v828'});},
    redraw(){emit(genericNode);}
  };
}
async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}

test('rendering own panel never recursively starts auth requests while a session is pending',async()=>{
  const app=harness();
  await flush();
  assert.equal(app.authCalls,1,'exactly one auth request while pending');
  assert.ok(app.mutations<=4,'no repeated redraw loop');
  for(let i=0;i<5;i++)app.redraw();
  await flush();
  assert.equal(app.authCalls,1,'unrelated DOM changes never start more requests');
  app.flushAuth();await flush();
  assert.equal(app.queryCalls,1);
  assert.equal(app.authCalls,1);
});

test('reopening FOOD while auth request is pending reuses one request',async()=>{
  const app=harness();
  await flush();
  app.reopen();await flush();
  assert.equal(app.authCalls,1);
  app.flushAuth();await flush();
  assert.equal(app.queryCalls,1);
  assert.match(app.panel.innerHTML,/Geplante Genuss-Extras/);
});
