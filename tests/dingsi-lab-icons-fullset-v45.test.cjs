'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('dingsi-lab-icons-fullset-v45.js');
const css=read('dingsi-lab-icons-fullset-v45.css');
const html=read('dingsi-lab-icons.html');
const hub=read('dingsi-lab.html');
test('I11 complete set is behind a new selectable button and retains the 12 individual variants',()=>{
 assert.match(hub,/dingsi-lab-icons\.html\?v=46/);
 assert.match(html,/id="fullset-toggle-v45" aria-expanded="false"/);
 assert.match(html,/id="fullset-panel-v45"[^>]+hidden/);
 assert.match(html,/dingsi-lab-icons-fullset-v46\.js\?v=46/);
 assert.match(html,/dingsi-lab-icons-fullset-v45\.css\?v=45/);
 assert.match(html,/data-variant="I11"/);
 assert.match(html,/id="choose-style"/);
 assert.match(html,/id="fave"/);
 assert.match(js,/icon-i11-todo-3d-alpha\.webp\?v=45/);
 assert.doesNotThrow(()=>new vm.Script(js));
});
test('all 13 new Glass 3D WebP assets have a physical file with true alpha channel',()=>{
 const found=[...new Set([...js.matchAll(/i11-fullset-([a-z]+)\.webp/g)].map(x=>x[1]))];
 assert.deepEqual(found,[
 'fitness','kistologie','food','einkauf','finanzen','kalender','progress',
 'denkfabrik','outdoor','wohnung','werkstatt','reisen','backstage'
 ]);
 for(const name of found){
  const buffer=fs.readFileSync(path.join(root,'assets/dingsi-lab-icons/i11-fullset-'+name+'.webp'));
  assert.equal(buffer.toString('ascii',0,4),'RIFF',name);
  assert.equal(buffer.toString('ascii',8,12),'WEBP',name);
  assert.equal(buffer.toString('ascii',12,16),'VP8X',name);
  assert.notEqual(buffer[20]&0x10,0,name+' alpha flag absent');
  assert(buffer.byteLength>8000,name+' not a complete asset');
 }
});
test('gallery toggle shows all 14 and follows dark, light, checkerboard or uploaded photo',()=>{
 const handlers={},buttons=[],attrs={};
 function element(){
  return {dataset:{},style:{setProperty(k,v){attrs['style:'+k]=v;},getPropertyValue(k){return k==='--photo-background'?'url("blob:example")':''}},
   setAttribute(k,v){attrs[k]=v;},addEventListener(k,fn){this.handlers??={};this.handlers[k]=fn;},
   appendChild(v){this.children??=[];this.children.push(v);},replaceChildren(){this.children=[]},
   querySelectorAll(){return buttons;},hidden:false,scrollIntoView(){}};
 }
 const button=element(),panel=element(),grid=element(),surface=element(),preview=element(),detail=element(),selected=element();
 panel.hidden=true;
 preview.dataset.surface='dark';
 const map={'fullset-toggle-v45':button,'fullset-panel-v45':panel,'fullset-grid-v45':grid,
  'fullset-surface-v45':surface,preview,'fullset-detail-v45':detail,'fullset-selected-v45':selected};
 const document={
  getElementById(id){return map[id]||null;},
  createElement(tag){const e=element();e.tagName=tag.toUpperCase();if(tag==='button')buttons.push(e);return e;},
  addEventListener(){}
 };
 let mutation;
 class MutationObserver{constructor(cb){mutation=cb}observe(){}}
 vm.runInNewContext(js,{document,MutationObserver,console});
 assert.equal(panel.hidden,true);
 button.handlers.click();
 assert.equal(panel.hidden,false);
 assert.equal(grid.children.length,14);
 assert.equal(grid.children[0].dataset.fullsetId,'todo');
 assert.equal(grid.children[13].dataset.fullsetId,'backstage');
 assert.equal(surface.dataset.surface,'dark');
 assert.match(selected.textContent,/#I11/);
 preview.dataset.surface='pastel';mutation();assert.equal(surface.dataset.surface,'pastel');
 preview.dataset.surface='checker';mutation();assert.equal(surface.dataset.surface,'checker');
 preview.dataset.surface='photo';mutation();assert.equal(surface.dataset.surface,'photo');
 assert.match(attrs['style:--photo-background'],/blob:example/);
 grid.children[1].handlers.click();
 assert.equal(detail.hidden,false);
 assert.equal(detail.children[0].src,'./assets/dingsi-lab-icons/i11-fullset-fitness.webp?v=45');
 button.handlers.click();assert.equal(panel.hidden,true);
});
test('no code writes gallery preference to production home or changes current favorite',()=>{
 assert.doesNotMatch(js,/localStorage\.setItem|supabase|dingsi_lab_icon_choices|window\.location|fetch\(/);
 assert.match(css,/\.fullset-surface-v45\[data-surface="checker"\]/);
 assert.match(css,/\.fullset-surface-v45\[data-surface="photo"\]/);
});
