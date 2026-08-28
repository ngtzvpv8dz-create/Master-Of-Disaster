const assert=require('assert');

let selectedBlock='block-1';
let renders=0;
let saves=0;

global.window=global;
global.currentTab='today';
global.tasks=[
  {id:1,text:'A',status:'open',todayDate:'2026-08-28',todayOrder:1,todayWorkBlockId:'block-1'},
  {id:2,text:'B',status:'open',todayDate:'2026-08-28',todayOrder:2,todayWorkBlockId:'block-1'},
  {id:3,text:'C',status:'running',todayDate:'2026-08-28',todayOrder:3,todayWorkBlockId:'block-1'}
];

global.getBerlinDateKey=()=> '2026-08-28';
global.saveTasks=()=>{saves++;};
global.render=()=>{renders++;};
global.document={
  addEventListener(){},
  getElementById(id){
    if(id==='editWorkBlockV474')return {value:selectedBlock};
    if(id==='viewContainer')return {contains(){return true;}};
    return null;
  }
};
global.addEventListener=()=>{};

global.saveEdit=function(id){
  const row=tasks.find(x=>x.id===id);
  if(selectedBlock==='block-1'){
    const others=tasks
      .filter(x=>x.todayDate==='2026-08-28'&&x.id!==id)
      .sort((a,b)=>a.todayOrder-b.todayOrder);
    others.forEach((x,i)=>x.todayOrder=i+1);
    row.todayWorkBlockId='block-1';
    row.todayOrder=others.length+1;
  }else{
    row.todayWorkBlockId=selectedBlock;
    row.todayOrder=99;
  }
};

global.pauseTask=function(id){
  const row=tasks.find(x=>x.id===id);
  row.status='paused';
};

require('../today-interaction-stability-v503.js');

saveEdit(2);
assert.deepStrictEqual(tasks.map(x=>[x.id,x.todayOrder,x.todayWorkBlockId]),[
  [1,1,'block-1'],
  [2,2,'block-1'],
  [3,3,'block-1']
]);

selectedBlock='block-2';
saveEdit(2);
assert.strictEqual(tasks[1].todayWorkBlockId,'block-2');
assert.strictEqual(tasks[1].todayOrder,99);

selectedBlock='block-1';
assert.strictEqual(window.__modTodayInteractionStabilityV503.removeFromToday(1),true);
assert.strictEqual(tasks[0].todayDate,null);
assert.strictEqual(tasks[0].todayOrder,null);
assert.strictEqual(tasks[0].todayWorkBlockId,null);

assert.strictEqual(window.__modTodayInteractionStabilityV503.pauseImmediately(3),true);
assert.strictEqual(tasks[2].status,'paused');
assert.ok(renders>=2);
assert.ok(saves>=2);

console.log('V503 today interaction regression PASS');
