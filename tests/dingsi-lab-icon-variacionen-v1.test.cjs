'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const load=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=load('dingsi-lab-icons.html'),lab=load('dingsi-lab.html');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
function boot(saved){
 const listeners={},attrs={};
 function button(kind,name){
  return {tagName:'BUTTON',dataset:{[kind]:name},setAttribute(k,v){attrs[kind+name+':'+k]=v;},
   addEventListener(type,fn){listeners[kind+name+':'+type]=fn;}};
 }
 const variants=['I01','I02','I03','I04','I05','I06','I07','I08','I09','I10','I11','I12'].map(x=>button('variant',x));
 const renderChoices=['I09','I10','I11','I12'].map(x=>button('renderChoice',x));
 const themes=['dark','pastel'].map(x=>button('theme',x));
 const bgs=['theme','checker','photo'].map(x=>button('bg',x));
 const elements={
  preview:{dataset:{},style:{setProperty(k,v){attrs[k]=v;}}},
  'icon-grid':{children:[],appendChild(el){this.children.push(el);}},
  photo:{files:[],addEventListener(k,fn){listeners['photo:'+k]=fn;}},
  'variant-title':{},'variant-description':{},
  fave:{setAttribute(k,v){attrs['fave:'+k]=v},addEventListener(k,fn){listeners['fave:'+k]=fn;}},
  'choose-style':{setAttribute(k,v){attrs['choose:'+k]=v},addEventListener(k,fn){listeners['choose:'+k]=fn;}},
  saved:{}
 };
 const storage=new Map(saved?Object.entries(saved):[]);
 const document={
  getElementById(id){return elements[id];},
  createElement(){return {dataset:{},innerHTML:'',className:''}},
  querySelectorAll(selector){
   return selector==='[data-variant]'?variants:selector==='[data-render-choice]'?renderChoices:selector==='[data-theme]'?themes:selector==='[data-bg]'?bgs:[];
  },
  querySelector(selector){
   assert.equal(selector,'meta[name="theme-color"]');
   return {setAttribute(k,v){attrs['meta:'+k]=v}};
  }
 };
 const localStorage={getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}};
 const URL={createObjectURL(){return 'blob:example-photo'},revokeObjectURL(){}};
 assert(script);
 vm.runInNewContext(script,{document,localStorage,URL,console});
 return {listeners,attrs,elements,storage};
}
test('Dingsi Lab has dedicated Icon-Ische Variacionen area and twelve stable numbered styles',()=>{
 assert.match(lab,/href="\.\/dingsi-lab-icons\.html\?v=43"/);
 assert.match(html,/Icon-Ische Variacionen/);
 for(const id of ['I01','I02','I03','I04','I05','I06','I07','I08','I09','I10','I11','I12'])assert(html.includes('data-variant="'+id+'"'));
 assert.match(html,/data-bg="checker"/);
 assert.match(html,/data-bg="photo"/);
 assert.match(html,/type="file" accept="image\/\*"/);
 assert.doesNotThrow(()=>new vm.Script(script));
});
test('original icon images are replaced by three transparent pure-vector prototype motifs',()=>{
 const x=boot();
 assert.equal(x.elements['icon-grid'].children.length,3);
 for(const item of x.elements['icon-grid'].children){
  assert.match(item.innerHTML,/<svg[^>]+viewBox="0 0 180 180"/);
  assert.match(item.innerHTML,/<\/svg>/);
  assert.doesNotMatch(item.innerHTML,/<image\b|data:image|<foreignObject\b/i);
  assert.doesNotMatch(item.innerHTML,/x="0" y="0" width="180" height="180"/);
 }
 assert.equal(x.elements.preview.dataset.variant,'I01');
 assert.equal(x.elements.preview.dataset.surface,'pastel');
});
test('variant number, dark/pastel theme, checkerboard, favorites and local persistence work',()=>{
 const x=boot();
 x.listeners['variantI03:click']();
 assert.equal(x.elements.preview.dataset.variant,'I03');
 x.listeners['themedark:click']();
 assert.equal(x.elements.preview.dataset.surface,'dark');
 x.listeners['bgchecker:click']();
 assert.equal(x.elements.preview.dataset.surface,'checker');
 x.listeners['fave:click']();
 assert.match(x.elements.saved.textContent,/#I03/);
 const record=JSON.parse(x.storage.get('mod-dingsi-lab-icon-variacionen-v1'));
 assert.equal(record.variant,'I03');
 assert.equal(record.theme,'dark');
 assert.deepEqual(Array.from(record.liked),['I03']);
 const reload=boot(Object.fromEntries(x.storage));
 assert.equal(reload.elements.preview.dataset.variant,'I03');
 assert.equal(reload.elements.preview.dataset.surface,'checker');
 assert.match(reload.elements.saved.textContent,/#I03/);
});
test('photo preview is local only and not uploaded; photo state is not resurrected after reload',()=>{
 const x=boot();
 x.elements.photo.files=[{type:'image/jpeg',size:10000}];
 x.listeners['photo:change']();
 assert.equal(x.elements.preview.dataset.surface,'photo');
 assert.match(x.attrs['--photo-background'],/blob:example-photo/);
 x.listeners['variantI02:click']();
 const reload=boot(Object.fromEntries(x.storage));
 assert.equal(reload.elements.preview.dataset.surface,'pastel');
 assert.equal(reload.elements.preview.dataset.variant,'I02');
 assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|supabase|FileReader/);
});

test('I05–I08 are independent relief-lit 3D motifs without any built-in image background',()=>{
 const x=boot();
 for(const variant of ['I05','I06','I07','I08']){
  x.listeners['variant'+variant+':click']();
  assert.equal(x.elements.preview.dataset.variant,variant);
  for(const fig of x.elements['icon-grid'].children){
   assert.match(fig.innerHTML,/class="model-extrusion"/);
   assert.match(fig.innerHTML,/class="model-face"/);
   assert.match(fig.innerHTML,/feSpecularLighting/);
   assert.match(fig.innerHTML,/<use[^>]+href="#model-(?:todo|food|kisto)"/);
   assert.doesNotMatch(fig.innerHTML,/<image\b|data:image|<foreignObject\b|base64,/i);
   assert.doesNotMatch(fig.innerHTML,/x="0" y="0" width="180" height="180"/i);
  }
  const saved=JSON.parse(x.storage.get('mod-dingsi-lab-icon-variacionen-v1'));
  assert.equal(saved.variant,variant);
 }
 x.listeners['variantI08:click']();
 x.listeners['themedark:click']();
 assert.equal(x.elements.preview.dataset.surface,'dark');
 x.listeners['bgchecker:click']();
 assert.equal(x.elements.preview.dataset.surface,'checker');
 x.listeners['fave:click']();
 assert.match(x.elements.saved.textContent,/#I08/);
 const restored=boot(Object.fromEntries(x.storage));
 assert.equal(restored.elements.preview.dataset.variant,'I08');
 assert.match(restored.elements['icon-grid'].children[0].innerHTML,/class="model-face"/);
 assert.match(restored.elements.saved.textContent,/#I08/);
});
test('Original I01–I04 remain usable, retaining the unmodified non-extruded model',()=>{
 const x=boot();
 for(const v of ['I01','I02','I03','I04']){
  x.listeners['variant'+v+':click']();
  assert.equal(x.elements.preview.dataset.variant,v);
  assert.doesNotMatch(x.elements['icon-grid'].children[0].innerHTML,/class="model-extrusion"/);
 }
});

test('The four approved original 3D images appear as real WebP-alpha assets',()=>{
 const x=boot();
 for(const id of ['I09','I10','I11','I12']){
  x.listeners['variant'+id+':click']();
  assert.equal(x.elements.preview.dataset.variant,id);
  const preview=x.elements['icon-grid'].children[0].innerHTML;
  assert.match(preview,new RegExp('icon-'+id.toLowerCase()+'-todo-3d-alpha\\.webp'));
  assert.match(preview,/class="icon-raster"/);
  assert.doesNotMatch(preview,/class="icon-svg"|class="model-face"/);
  assert.match(html,new RegExp('data-render-choice="'+id+'"'));
  assert.equal(x.attrs['renderChoice'+id+':aria-pressed'],'true');
  assert.equal(x.attrs['renderChoice'+(id==='I09'?'I10':'I09')+':aria-pressed'],'false');
 }
});
test('Gallery selection and explicit chosen variant survive a reload; old selections are preserved',()=>{
 const x=boot();
 x.listeners['renderChoiceI11:click']();
 assert.equal(x.elements.preview.dataset.variant,'I11');
 x.listeners['choose:click']();
 assert.match(x.elements.saved.textContent,/Deine Wahl: #I11/);
 assert.equal(x.attrs['choose:aria-pressed'],'true');
 x.listeners['fave:click']();
 const saved=JSON.parse(x.storage.get('mod-dingsi-lab-icon-variacionen-v1'));
 assert.equal(saved.chosen,'I11');
 assert.deepEqual(Array.from(saved.liked),['I11']);
 x.listeners['bgchecker:click']();
 assert.equal(x.elements.preview.dataset.surface,'checker');
 const reload=boot(Object.fromEntries(x.storage));
 assert.equal(reload.elements.preview.dataset.variant,'I11');
 assert.match(reload.elements.saved.textContent,/Deine Wahl: #I11/);
 assert.match(reload.elements['icon-grid'].children[0].innerHTML,/icon-i11-todo-3d-alpha\.webp/);
 reload.listeners['variantI02:click']();
 assert.match(reload.elements['icon-grid'].children[0].innerHTML,/<svg/);
 assert.match(reload.elements.saved.textContent,/Deine Wahl: #I11/);
});
