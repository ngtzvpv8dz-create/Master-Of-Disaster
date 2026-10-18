'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const get=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const index=get('dingsi-lab.html');
const home=get('dingsi-lab-home.html');
const food=get('dingsi-lab-food-status.html');
test('Dingsi Lab root lists existing homescreen and new food preview separately',()=>{
  assert.match(index,/href="\.\/dingsi-lab-home\.html\?v=32"/);
  assert.match(index,/href="\.\/dingsi-lab-food-editor\.html\?v=35"/);
  assert.match(index,/dingsi-lab-food-status\.html\?v=31/);
  assert.match(index,/Homescreen/);
  assert.match(index,/Lebensmittelkarten/);
});
test('existing icon homescreen remains and navigates back to Lab',()=>{
  assert.match(home,/data-id="todo"/);
  assert.match(home,/data-id="food"/);
  assert.match(home,/href="\.\/dingsi-lab\.html\?v=31"/);
});
test('preview contains four real CSS status surfaces and a reusable SVG crystal',()=>{
  for(const cssClass of ['status-fresh','status-freeze','status-frozen','status-thaw']) assert(food.includes('class="product '+cssClass+'"')||food.includes('class="product '+cssClass+' '),cssClass);
  assert.equal((food.match(/class="product status-/g)||[]).length,4);
  assert.match(food,/<symbol id="crystal-lab-v31"/);
  assert((food.match(/<use href="#crystal-lab-v31"/g)||[]).length>=12);
  assert.match(food,/radial-gradient\(ellipse 132% 118% at 108% 110%/);
  assert.match(food,/radial-gradient\(ellipse 72% 82% at 105% -4%/);
});
test('preview is standalone, read-only, and its control script parses',()=>{
  assert(!/supabase\.|fetch\(|XMLHttpRequest|localStorage/.test(food));
  const source=food.match(/<script>([\s\S]*?)<\/script>/);
  assert(source,'Inline preview logic present');
  assert.doesNotThrow(()=>new vm.Script(source[1]));
  assert(food.includes("root.style.setProperty('--ice-level'"));
});
