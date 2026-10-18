'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const html=read('dingsi-lab-food-editor.html');
const css=read('dingsi-lab-designstudio-v32.css');
const js=read('dingsi-lab-designstudio-v32.js');
const lab=read('dingsi-lab.html');

function boot(){
 const nodes=new Map();
 const node=id=>{
   if(!nodes.has(id))nodes.set(id,{
     id,innerHTML:'',textContent:'',dataset:{},value:'',clientWidth:340,open:false,
     style:{},listeners:{},classList:{toggle(){},add(){},remove(){}},
     setAttribute(k,v){this[k]=v},
     addEventListener(type,handler){this.listeners[type]=handler},
     querySelector(selector){return selector==='.st-card'?(this.mockCard??(this.mockCard={style:{}})):null}
   });
   return nodes.get(id);
 };
 const tabs=['fresh','freeze','frozen','thaw'].map(key=>{const tab=node('tab'+key);tab.dataset.status=key;return tab});
 const window={innerHeight:760,innerWidth:390,listeners:{},addEventListener(t,fn){this.listeners[t]=fn}};
 const document={
   getElementById:node,
   querySelectorAll(selector){return selector==='[data-status]'?tabs:[]},
   body:{classList:{toggle(){},add(){},remove(){}}},
   createElement(){return {click(){},remove(){}}}
 };
 let stored=null;
 const localStorage={getItem(){return stored},setItem(_key,data){stored=data}};
 vm.runInNewContext(js,{document,window,localStorage,console,Date,Math,JSON,Array,Map,Set,
   URL:{createObjectURL(){return 'blob:mock'},revokeObjectURL(){}},
   setTimeout(){},Image:function(){},Blob:function(){}});
 return {node,tabs,window,storage:()=>stored};
}
test('V33 sticky preview is above settings and compact status dropdown replaces toolbar',()=>{
 assert(html.includes('id="st-status-picker"'));
 assert(html.includes('id="st-picker-label"'));
 assert(css.includes('.st-preview-panel{\n position:sticky'));
 assert(html.indexOf('id="st-demo-space"')<html.indexOf('id="st-groups"'));
 assert(html.indexOf('id="st-groups"')<html.indexOf('id="st-save"'));
 assert(html.indexOf('id="st-export"')<html.indexOf('id="st-save"'));
 assert(!html.includes('Deine Frost-Spielwiese:'));
 assert(lab.includes('dingsi-lab-food-editor.html?v=33'));
});
test('V33 app script parses and no localStorage schema change',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert(js.includes("const storeKey='mod-dingsi-lab-v32-designs'"));
});
test('V33 preview reacts to status changes, stays compact, retains separate saves',()=>{
 const app=boot();
 const px=parseInt(app.node('st-preview').style.height,10);
 assert(px>=140&&px<=245,'visual height capped by viewport');
 assert(app.node('st-preview').innerHTML.includes('Blattspinat TK'));
 assert.equal(app.node('st-picker-label').textContent,'Eingefroren');
 app.node('st-save').listeners.click();
 app.tabs[3].listeners.click();
 assert(app.node('st-preview').innerHTML.includes('Hackfleisch gemischt'));
 assert.equal(app.node('st-picker-label').textContent,'Auftauen läuft');
 assert.equal(app.node('st-status-picker').open,false);
 app.node('st-save').listeners.click();
 app.node('st-approve').listeners.click();
 const data=JSON.parse(app.storage());
 assert(data.saved.frozen);
 assert(data.saved.thaw);
 assert.equal(data.approved.thaw,true);
 assert(app.window.listeners.resize,'rescale listener attached');
});
