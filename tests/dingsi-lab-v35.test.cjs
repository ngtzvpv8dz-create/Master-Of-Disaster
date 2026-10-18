'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'),vm=require('node:vm');
const read=n=>fs.readFileSync(path.resolve(__dirname,'..',n),'utf8');
const html=read('dingsi-lab-food-editor.html');
const css=read('dingsi-lab-designstudio-v32.css');
const js=read('dingsi-lab-designstudio-v32.js');
const lab=read('dingsi-lab.html');
function boot(localData){
 const nodes=new Map();
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{
   id,innerHTML:'',textContent:'',className:'',value:'',dataset:{},style:{},clientWidth:350,open:false,listeners:{},
   classList:{toggle(){},add(){},remove(){}},setAttribute(k,v){this[k]=v},
   addEventListener(type,fn){this.listeners[type]=fn},
   querySelector(selector){return selector==='.st-card'?(this.mockCard??(this.mockCard={style:{}})):null}
  });
  return nodes.get(id);
 };
 const tabs=['fresh','freeze','frozen','thaw'].map(k=>{const tab=node('tab'+k);tab.dataset.status=k;return tab});
 const document={
  getElementById:node,
  querySelectorAll(s){return s==='[data-status]'?tabs:[]},
  body:{classList:{add(){},remove(){},toggle(){}}},createElement(){return{click(){},remove(){}}}
 };
 const window={innerHeight:780,innerWidth:390,addEventListener(){}};
 let data=localData??null;
 const localStorage={getItem(k){return k==='mod-dingsi-lab-v32-designs'?data:null},setItem(_k,v){data=v}};
 vm.runInNewContext(js,{document,window,localStorage,Date,console,Math,JSON,Map,Set,
  URL:{createObjectURL(){return 'blob:mock'},revokeObjectURL(){}},Blob:function(){},Image:function(){},setTimeout(){}});
 return {node,tabs,getStorage:()=>data};
}
test('only controls pane scrolls; fixed preview is always true size',()=>{
 assert.match(css,/#studio\{[\s\S]*?height:100dvh/);
 assert.match(css,/\.st-controls-scroll\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/\.st-demo-space\{[\s\S]*?overflow-y:auto/);
 assert(!html.includes('data-preview-mode='));
 assert(html.indexOf('id="st-demo-space"')<html.indexOf('id="st-controls-scroll"'));
 assert(html.indexOf('id="st-groups"')<html.indexOf('id="st-save"'));
 assert(lab.includes('dingsi-lab-food-editor.html?v=35'));
});
test('card is not zoomed while viewport can limit only width',()=>{
 const app=boot();const view=app.node('st-preview');
 assert.match(view.style.width,/min\(100%,/);
 assert.equal(view.style.height,'auto');
 assert.equal(view.mockCard.style.transform,'none');
 assert.equal(view.mockCard.style.width,'100%');
 assert.equal(view.mockCard.style.height,'auto');
});
test('all states can be edited and saved using old V32 key',()=>{
 const app=boot();
 app.node('st-save').listeners.click();
 app.tabs[3].listeners.click();
 assert.match(app.node('st-preview').innerHTML,/Hackfleisch gemischt/);
 assert.equal(app.node('st-picker-label').textContent,'Auftauen läuft');
 assert.equal(app.node('st-preview').mockCard.style.transform,'none');
 app.node('st-save').listeners.click();
 app.node('st-approve').listeners.click();
 const data=JSON.parse(app.getStorage());
 assert(data.saved.frozen);
 assert(data.saved.thaw);
 assert.equal(data.approved.thaw,true);
 const loaded=boot(app.getStorage());
 assert.match(loaded.node('st-preview').innerHTML,/Blattspinat TK/);
 assert.equal(loaded.node('st-preview').mockCard.style.transform,'none');
});
test('only Lab view changed, all styling controls and source imports remain intact',()=>{
 assert(js.includes("const storeKey='mod-dingsi-lab-v32-designs'"));
 assert(js.includes("format:'dingsi-lab-style-v32'"));
 assert(html.includes('id="st-save"')&&html.includes('id="st-export"'));
 assert(html.includes('id="st-status-picker"'));
 assert.doesNotThrow(()=>new vm.Script(js));
 assert(!/(supabase\.|food_freezer_portions|XMLHttpRequest|fetch\()/.test(js));
});
