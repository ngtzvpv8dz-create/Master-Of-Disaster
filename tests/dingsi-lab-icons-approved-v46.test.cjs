'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const src=read('dingsi-lab-icons-fullset-v46.js');
const html=read('dingsi-lab-icons.html');
const hub=read('dingsi-lab.html');
const names=['todo','fitness','kistologie','food','einkauf','finanzen','kalender','progress','denkfabrik','outdoor','wohnung','werkstatt','reisen','backstage'];
const blobSha={
 todo:'0c1cb05f6dc130cc99d14e276d79339cf6dc4a18',
 fitness:'c5eeb7c101583d635c84aadca23a5cb6ac8d72b4',
 kistologie:'8ef32f6694512e6db901783470a6ddbd73f7edb9',
 food:'1e2dd4cac4ce9289290ab99bff04f8979e4e893a',
 einkauf:'0d86aa8a3e95324bdedb3d6031d650f67490c5a4',
 finanzen:'00aa49ae0d3b2141ee68aba3c1595ea00035d751',
 kalender:'e79ac02798476a88fced51b5ec641037101d31f6',
 progress:'e56daef7c032999f684f3f0d5d1c73274493fed3',
 denkfabrik:'7a5112e9830ce41fbebbdf0b9af4d2b01d9fbcdf',
 outdoor:'6738a3c622fb1b7636e8c4bb774bd3f0348520f2',
 wohnung:'435472d4e6aa773939399f52aa0efec7e531ba37',
 werkstatt:'fea50e4565fbed1cd772798fa3735e2b5f69944e',
 reisen:'a706c916392fa24de1084f27921372259bf83bea',
 backstage:'f914f53e0f703c18912f4f3f19c7f1a4a4cf8b66'
};
test('Dingsi Lab links to V46 and actual single-category images instead of a screenshot',()=>{
 assert.match(hub,/dingsi-lab-icons\.html\?v=46/);
 assert.match(html,/dingsi-lab-icons-fullset-v46\.js\?v=46/);
 assert.match(html,/id="fullset-toggle-v45" aria-expanded="false"/);
 assert.match(html,/id="fullset-panel-v45"[^>]+hidden/);
 assert.match(html,/id="fave"/);
 assert.match(html,/id="choose-style"/);
 assert.match(html,/dingsi-lab-icons-cloud-v44\.js\?v=44/);
 assert.doesNotThrow(()=>new vm.Script(src));
 const fromCode=[...src.matchAll(/approved-v46-([a-z]+)\.webp\?v=46/g)].map(x=>x[1]);
 assert.deepEqual(fromCode,names);
 assert.doesNotMatch(src,/i11-fullset-(?:fitness|kalender|denkfabrik)\.webp/);
 assert.doesNotMatch(src,/dingsi_lab_3d_iconvariationen|imagegen\.png|dingsi_lab_im_sonnenuntergang/);
});
test('all 14 specific approved artworks exist, have WebP alpha, and match original GitHub blobs',()=>{
 for(const n of names){
  const buf=fs.readFileSync(path.join(ROOT,'assets/dingsi-lab-icons/approved-v46-'+n+'.webp'));
  assert.equal(buf.toString('ascii',0,4),'RIFF',n);
  assert.equal(buf.toString('ascii',8,12),'WEBP',n);
  assert.equal(buf.toString('ascii',12,16),'VP8X',n);
  assert.notEqual(buf[20]&0x10,0,n+' alpha flag must be present');
  assert(buf.length>9000,n+' file unexpectedly small');
  const digest=crypto.createHash('sha1').update(Buffer.from('blob '+buf.length+'\0')).update(buf).digest('hex');
  assert.equal(digest,blobSha[n],n+' must match exact approved icon, not a substitute');
 }
});
test('v46 gallery toggles independently, shows 14 unique images and follows all four test backgrounds',()=>{
 const buttons=[];
 let observer;
 const records={};
 function el(){
  return {dataset:{},attributes:{},hidden:false,children:[],
   style:{setProperty(k,v){records['style:'+k]=v},getPropertyValue(){return 'url("blob:your-photo")'}},
   setAttribute(k,v){this.attributes[k]=v},
   addEventListener(k,fn){this.handlers??={};this.handlers[k]=fn},
   appendChild(child){this.children.push(child)},
   replaceChildren(){this.children=[]},
   querySelectorAll(){return buttons},
   scrollIntoView(){}};
 }
 const id={
  'fullset-toggle-v45':el(),
  'fullset-panel-v45':el(),
  'fullset-grid-v45':el(),
  'fullset-surface-v45':el(),
  preview:el(),
  'fullset-detail-v45':el(),
  'fullset-selected-v45':el()
 };
 id['fullset-panel-v45'].hidden=true;
 id.preview.dataset.surface='dark';
 const document={
  getElementById(name){return id[name]||null},
  createElement(tag){const x=el();x.tagName=tag.toUpperCase();if(tag==='button')buttons.push(x);return x;},
  addEventListener(){}
 };
 class MutationObserver{constructor(cb){observer=cb}observe(){}}
 vm.runInNewContext(src,{document,MutationObserver});
 id['fullset-toggle-v45'].handlers.click();
 assert.equal(id['fullset-panel-v45'].hidden,false);
 assert.equal(id['fullset-grid-v45'].children.length,14);
 const images=id['fullset-grid-v45'].children.map(t=>t.children[0].src);
 assert.equal(new Set(images).size,14);
 for(let i=0;i<names.length;i++)assert.match(images[i],new RegExp('approved-v46-'+names[i]+'\\.webp'));
 assert.equal(id['fullset-surface-v45'].dataset.surface,'dark');
 for(const mode of ['pastel','checker','photo']){
  id.preview.dataset.surface=mode;observer();
  assert.equal(id['fullset-surface-v45'].dataset.surface,mode);
 }
 assert.match(records['style:--photo-background'],/blob:your-photo/);
 const tile=id['fullset-grid-v45'].children[8];
 tile.handlers.click();
 assert.equal(id['fullset-detail-v45'].hidden,false);
 assert.match(id['fullset-detail-v45'].children[0].src,/approved-v46-denkfabrik\.webp/);
 assert.equal(tile.attributes['aria-pressed'],'true');
 id['fullset-toggle-v45'].handlers.click();
 assert.equal(id['fullset-panel-v45'].hidden,true);
});
test('gallery never changes saved preference or production icons',()=>{
 assert.doesNotMatch(src,/localStorage\.setItem|from\(['"]dingsi_lab_icon_choices|fetch\(|window\.location/);
});
