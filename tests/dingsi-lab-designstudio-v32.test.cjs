'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const get=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const html=get('dingsi-lab-food-editor.html');
const css=get('dingsi-lab-designstudio-v32.css');
const source=get('dingsi-lab-designstudio-v32.js');
const root=get('dingsi-lab.html');

function fakeLab(storage){
 const elements=new Map(),listeners=new Map();
 const el=id=>{
  if(!elements.has(id))elements.set(id,{
   id,innerHTML:'',textContent:'',className:'',value:'',style:{},files:[],dataset:{},
   parentElement:{querySelector:()=>null},classList:{toggle(){},add(){},remove(){}},
   addEventListener(type,fn){listeners.set(id+':'+type,fn)},
   setAttribute(){},querySelectorAll(){return []}
  });
  return elements.get(id);
 };
 const tabs=['fresh','freeze','frozen','thaw'].map(k=>{let x=el('tab-'+k);x.dataset.status=k;return x});
 const document={getElementById:el,documentElement:{style:{setProperty(){}}},body:{classList:{toggle(){}}},
  querySelectorAll(selector){return selector==='[data-status]'?tabs:[]}};
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val)};
 vm.runInNewContext(source,{document,localStorage,Date,JSON,Math,Number,String,Map,Object,Array,parseInt,setTimeout});
 return {el,listeners,storage};
}
test('V32 studio has status selector, preview, save, import and image field',()=>{
 assert.match(root,/href="\.\/dingsi-lab-food-editor\.html\?v=32"/);
 assert.match(html,/st-preview/);
 assert.match(html,/st-save/);
 assert.match(html,/st-import/);
 assert.match(html,/st-upload/);
 assert.match(html,/st-compare/);
 assert.match(html,/dingsi-lab-food-status\.html\?v=31/);
});
test('V32 JavaScript parses and initializes four statuses',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 const lab=fakeLab(new Map());
 assert.match(lab.el('st-preview').innerHTML,/Blattspinat TK/);
 assert.match(lab.el('st-groups').innerHTML,/Kristallanzahl/);
 assert.match(lab.el('st-groups').innerHTML,/Rahmen-Verlaufstyp/);
 assert.match(lab.el('st-groups').innerHTML,/Sonnenposition X/);
 assert.match(lab.el('st-groups').innerHTML,/Bildposition X/);
});
test('V32 saves and restores separate variants across a reload',()=>{
 const storage=new Map(),first=fakeLab(storage);
 first.listeners.get('st-save:click')();
 assert.match(first.el('st-save-status').textContent,/Gespeichert: Eingefroren/);
 first.listeners.get('tab-thaw:click')();
 first.listeners.get('st-save:click')();
 const data=JSON.parse(storage.get('mod-dingsi-lab-v32-designs'));
 assert.equal(data.version,32);
 assert(data.saved.frozen);
 assert(data.saved.thaw);
 assert(!data.saved.fresh);
 const second=fakeLab(storage);
 assert.match(second.el('st-save-status').textContent,/Gespeichert: Eingefroren/);
});
test('V32 has real inline SVG frost, no uploaded-image dependency or stock calls',()=>{
 assert.match(html,/<symbol id="st-crystal"/);
 assert.match(source,/function rand\(seed\)/);
 assert.match(source,/function flakes\(p\)/);
 assert.match(source,/function mixedGradient\(p\)/);
 assert.match(source,/function borderGradient\(p\)/);
 assert.match(source,/function sanitize\(candidate,key\)/);
 assert.match(source,/function downloadJSON\(\)/);
 assert.match(source,/function importJSON\(file\)/);
 assert.match(source,/canvas\.toDataURL\('image\/jpeg',.72\)/);
 assert(!/supabase\.|https?:\/\/api\./.test(source));
 assert.match(css,/--border-bg/);
 assert.match(css,/--main-gradient/);
});
