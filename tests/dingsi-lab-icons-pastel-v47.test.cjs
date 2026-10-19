'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('dingsi-lab-icons.html');
const lab=read('dingsi-lab.html');
const js=read('dingsi-lab-icons-fullset-v47.js');
const manifest=JSON.parse(read('assets/dingsi-lab-icons/pastel-used-v47-manifest.json'));
const names=['todo','fitness','kistologie','food','einkauf','finanzen','kalender','progress','denkfabrik','outdoor','wohnung','werkstatt','reisen','backstage'];
test('actual Dingsi Lab serves the v47 comparison gallery, without changing production assets',()=>{
 assert.match(lab,/dingsi-lab-icons\.html\?v=47/);
 assert.match(html,/dingsi-lab-icons-fullset-v47\.js\?v=47/);
 assert.match(html,/dingsi-lab-icons-fullset-v47\.css\?v=47/);
 assert.match(html,/data-fullset-style-v47="new"/);
 assert.match(html,/data-fullset-style-v47="previous"/);
 assert.match(html,/id="fullset-toggle-v45"/);
 assert.match(html,/id="cloud-status"/);
 assert.match(html,/dingsi-lab-icons-cloud-v44\.js/);
 assert.match(html,/data-bg="checker"/);
 assert.match(html,/id="photo"/);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.doesNotMatch(js,/localStorage\.setItem|dingsi_lab_icon_choices|\.upsert\(|window\.location|fetch\(/);
});
test('all fourteen standalone icons are original assets with authentic transparency and matching hashes',()=>{
 assert.equal(manifest.version,'v47');
 assert.equal(manifest.background,'transparent_alpha');
 assert.deepEqual(Object.keys(manifest.icons),names);
 assert.match(manifest.selection_notes.food,/variant 4/);
 assert.match(manifest.selection_notes.kistologie,/shoulder X-ray/);
 assert.match(manifest.selection_notes.fitness,/no FitX logo/);
 for(const name of names){
  const {path:asset,sha256}=manifest.icons[name];
  assert.equal(asset,'assets/dingsi-lab-icons/pastel-used-v47-'+name+'.webp');
  const buffer=fs.readFileSync(path.join(root,asset));
  assert(buffer.length>20000,name+' asset incomplete');
  assert.equal(buffer.toString('ascii',0,4),'RIFF');
  assert.equal(buffer.toString('ascii',8,12),'WEBP');
  assert.equal(buffer.toString('ascii',12,16),'VP8X');
  assert.notEqual(buffer[20]&0x10,0,name+' lacks alpha channel');
  assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),sha256,name+' source must not be replaced');
 }
});
test('tap new/bisherig and background switches; the 14 individual files and detail are correct',()=>{
 const attrs={},children=[];
 function elt(){
  return {dataset:{},hidden:false,style:{getPropertyValue(k){return k==='--photo-background'?'url("blob:own-photo")':'';},setProperty(k,v){attrs['style:'+k]=v;}},
   addEventListener(k,fn){this.handlers??={};this.handlers[k]=fn;},
   setAttribute(k,v){(this.attributes??={})[k]=v;},
   appendChild(x){this.children??=[];this.children.push(x);},
   replaceChildren(){this.children=[];},
   querySelectorAll(sel){if(sel==='[data-fullset-id]')return children;return [];},
   querySelector(sel){if(sel==='img')return this.children?.find(x=>x.tagName==='IMG')||null;return null;},
   scrollIntoView(){}};
 }
 const toggle=elt(),panel=elt(),grid=elt(),surface=elt(),preview=elt(),detail=elt(),summary=elt();
 panel.hidden=true;preview.dataset.surface='dark';
 const newButton=elt(),prevButton=elt();
 newButton.dataset.fullsetStyleV47='new';prevButton.dataset.fullsetStyleV47='previous';
 const controls=[newButton,prevButton];
 const nodes={'fullset-toggle-v45':toggle,'fullset-panel-v45':panel,'fullset-grid-v45':grid,
  'fullset-surface-v45':surface,preview,'fullset-detail-v45':detail,'fullset-selected-v45':summary};
 const document={getElementById(id){return nodes[id]||null;},
  querySelectorAll(sel){assert.equal(sel,'[data-fullset-style-v47]');return controls;},
  createElement(tag){const x=elt();x.tagName=tag.toUpperCase();if(tag==='button')children.push(x);return x;},
  addEventListener(){}};
 let changed;
 class MutationObserver{constructor(cb){changed=cb;}observe(){}}
 vm.runInNewContext(js,{document,MutationObserver});
 assert.equal(panel.hidden,true);
 toggle.handlers.click();
 assert.equal(panel.hidden,false);
 assert.equal(grid.children.length,14);
 assert.equal(grid.children[0].dataset.fullsetId,'todo');
 assert.equal(grid.children[3].dataset.fullsetId,'food');
 assert.match(grid.children[3].children[0].src,/pastel-used-v47-food\.webp\?v=47/);
 assert.equal(newButton.attributes['aria-pressed'],'true');
 assert.equal(surface.dataset.surface,'dark');
 grid.children[2].handlers.click();
 assert.equal(detail.hidden,false);
 assert.match(detail.children[0].src,/pastel-used-v47-kistologie\.webp/);
 prevButton.handlers.click();
 assert.equal(prevButton.attributes['aria-pressed'],'true');
 assert.match(grid.children[2].children[0].src,/approved-v46-kistologie\.webp\?v=46/);
 assert.match(detail.children[0].src,/approved-v46-kistologie\.webp\?v=46/);
 newButton.handlers.click();
 assert.match(detail.children[0].src,/pastel-used-v47-kistologie\.webp\?v=47/);
 for(const x of ['pastel','checker','photo']){preview.dataset.surface=x;changed();assert.equal(surface.dataset.surface,x);}
 assert.match(attrs['style:--photo-background'],/blob:own-photo/);
 toggle.handlers.click();assert.equal(panel.hidden,true);
});
