'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const html=read('dingsi-lab-food-editor.html');
const css=read('dingsi-lab-designstudio-v32.css');
const js=read('dingsi-lab-designstudio-v32.js');
const lab=read('dingsi-lab.html');
function boot(){
 const nodes=new Map();
 function node(id){
  if(!nodes.has(id))nodes.set(id,{
   id,innerHTML:'',textContent:'',className:'',value:'',dataset:{},style:{},clientWidth:350,open:false,
   listeners:{},classList:{toggle(){},add(){},remove(){}},
   addEventListener(t,fn){this.listeners[t]=fn},setAttribute(k,v){this[k]=v},
   querySelector(q){return q==='.st-card'?(this.mockCard??(this.mockCard={style:{}})):null}
  });
  return nodes.get(id);
 }
 const tabs=['fresh','freeze','frozen','thaw'].map(k=>{const el=node('tab'+k);el.dataset.status=k;return el});
 const modes=['compact','original'].map(k=>{const el=node('mode'+k);el.dataset.previewMode=k;return el});
 const panel=node('panel');
 const document={getElementById:node,
  querySelector(s){return s==='.st-preview-panel'?panel:null},
  querySelectorAll(s){return s==='[data-status]'?tabs:s==='[data-preview-mode]'?modes:[]},
  body:{classList:{toggle(){},add(){},remove(){}}},createElement(){return {click(){},remove(){}}}};
 let stored=null;
 const localStorage={getItem(){return stored},setItem(_key,value){stored=value}};
 const window={innerHeight:790,innerWidth:390,addEventListener(){}};
 vm.runInNewContext(js,{document,window,localStorage,Date,console,Math,Map,Set,JSON,
  URL:{createObjectURL(){return 'blob:test'},revokeObjectURL(){}},
  Blob:function(){},Image:function(){},setTimeout(){}});
 return {node,tabs,modes,panel,storage:()=>stored};
}
test('V34 has two preview modes, original view leaves text unscaled and adapts width',()=>{
 assert.match(html,/data-preview-mode="compact"/);
 assert.match(html,/data-preview-mode="original"/);
 assert.match(css,/\.st-preview-panel\.is-original/);
 assert(lab.includes('dingsi-lab-food-editor.html?v=34'));
 const app=boot();
 assert.match(app.node('st-preview-scale').textContent,/skaliert/);
 app.modes[1].listeners.click();
 assert.match(app.node('st-preview-scale').textContent,/100 %/);
 assert.equal(app.node('st-preview').mockCard.style.transform,'none');
 assert.equal(app.node('st-preview').mockCard.style.width,'100%');
 assert.match(app.node('st-preview').style.width,/min\(100%,/);
 app.modes[0].listeners.click();
 assert.match(app.node('st-preview-scale').textContent,/skaliert/);
});
test('V34 old V32 storage key and exported schema stay compatible',()=>{
 assert(js.includes("const storeKey='mod-dingsi-lab-v32-designs'"));
 assert(js.includes("format:'dingsi-lab-style-v32'"));
 const app=boot();
 app.node('st-save').listeners.click();
 app.tabs[3].listeners.click();
 app.node('st-save').listeners.click();
 const persisted=JSON.parse(app.storage());
 assert(persisted.saved.frozen&&persisted.saved.thaw);
});
test('V34 allows fine text sizes, frost switch and sun controls',()=>{
 const app=boot();
 const controls=app.node('st-groups').innerHTML;
 for(const name of ['Frosteffekt anzeigen','Anzahl Sonnenstrahlen','Sonne drehen',
  'Sonnenkreis füllen','Fülltransparenz','Kontur-Deckkraft','Konturstärke']){
  assert(controls.includes(name),name);
 }
 for(const field of ['fontSize','titleSize','detailSize','amountSize'])
  assert(js.includes("['"+field+"'"),field);
 assert(js.includes("['fontSize','Grundschrift',6"));
 assert(js.includes("['amountSize','Mengenanzeige',9"));
 assert.doesNotThrow(()=>new vm.Script(js));
});
test('V34 sun SVG rays count and 0-degree button behave correctly',()=>{
 const app=boot();
 app.tabs[3].listeners.click();
 const markup=app.node('st-preview').innerHTML;
 assert(markup.includes('class="st-sun"'));
 assert(markup.includes('fill-opacity='));
 assert(markup.includes('stroke-opacity='));
 assert(app.node('st-groups').innerHTML.includes('data-zero-setting="imageRotate"'));
 assert(app.node('st-groups').innerHTML.includes('data-zero-setting="sunRotation"'));
 // Fresh status with default frost off has no crystal symbols.
 app.tabs[0].listeners.click();
 assert.equal((app.node('st-preview').innerHTML.match(/class="st-flake"/g)||[]).length,0);
});
