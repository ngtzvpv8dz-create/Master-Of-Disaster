'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const get=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const home=get('dingsi-lab.html');
const html=get('dingsi-lab-food-editor.html');
const js=get('dingsi-lab-designstudio-v32.js');
const css=get('dingsi-lab-designstudio-v32.css');

function boot(){
 const nodes=new Map(),listeners=new Map();
 function node(id){
  if(!nodes.has(id))nodes.set(id,{
   id,innerHTML:'',textContent:'',className:'',value:'',dataset:{},style:{},listeners:{},
   classList:{toggle(){},add(){},remove(){}},
   addEventListener(type,fn){this.listeners[type]=fn},
   setAttribute(k,v){this[k]=v},
   querySelector(){return null}
  });
  return nodes.get(id);
 }
 const tabs=['fresh','freeze','frozen','thaw'].map(key=>{const el=node('tab_'+key);el.dataset.status=key;return el;});
 const document={
   getElementById:node,
   querySelectorAll(selector){
     if(selector==='[data-status]')return tabs;
     if(selector.startsWith('details.st-group'))return [];
     return [];
   },
   body:{classList:{add(){},remove(){}}},
   createElement(tag){return {tagName:tag,click(){},remove(){}}},
 };
 let stored=null;
 const localStorage={getItem(){return stored},setItem(k,v){stored=v}};
 const window={};
 const context={document,localStorage,window,console,Date,Math,JSON,Number,String,Array,Map,Set,
  URL:{createObjectURL(){return 'blob:mock'},revokeObjectURL(){}},
  Blob:function(){},Image:function(){},setTimeout(){},clearTimeout(){}};
 vm.runInNewContext(js,context,{filename:'dingsi-lab-designstudio-v32.js'});
 return {nodes,tabs,node,storage:()=>stored};
}

test('V32 standalone preview files have all controls and four status tabs',()=>{
 for(const item of ['st-preview','st-save','st-load','st-reset','st-approve','st-groups','st-import','st-export','st-upload','st-compare-toggle'])assert(html.includes('id="'+item+'"'),item);
 assert.equal((html.match(/data-status="/g)||[]).length,4);
 assert(home.includes('dingsi-lab-food-editor.html?v=35'));
 assert(css.includes('.st-crystals')&&css.includes('.st-sunlight'));
});
test('V32 JavaScript is valid and uses no production food database',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert(!/(supabase\.|food_inventory|food_freezer_portions|XMLHttpRequest|fetch\()/.test(js));
});
test('all four variants render, switches work and save is persistent',()=>{
 const app=boot();
 assert.match(app.node('st-preview').innerHTML,/st-card/);
 assert.match(app.node('st-groups').innerHTML,/Kristallanzahl/);
 app.node('st-save').listeners.click();
 assert(app.storage()?.includes('"frozen"'));
 app.tabs[3].listeners.click();
 assert.match(app.node('st-preview').innerHTML,/Hackfleisch gemischt/);
 app.node('st-save').listeners.click();
 const saved=JSON.parse(app.storage());
 assert(saved.saved.frozen&&saved.saved.thaw);
 assert.equal(saved.saved.fresh,undefined);
 app.node('st-approve').listeners.click();
 assert.equal(JSON.parse(app.storage()).approved.thaw,true);
});
test('V32 independent configs, crystalline SVG, picture upload controls',()=>{
 const app=boot();
 assert((app.node('st-preview').innerHTML.match(/class="st-flake"/g)||[]).length>20);
 assert(app.node('st-groups').innerHTML.includes('Bildposition X'));
 assert(app.node('st-groups').innerHTML.includes('Rahmenfarbe 2'));
 assert(app.node('st-groups').innerHTML.includes('Sonnenposition X'));
 assert(app.node('st-groups').innerHTML.includes('Zufällige Anordnung'));
 app.tabs[0].listeners.click();
 assert.match(app.node('st-preview').innerHTML,/H-Milch/);
 assert.notEqual(app.node('st-preview').innerHTML,undefined);
});
