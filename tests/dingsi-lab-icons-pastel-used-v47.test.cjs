'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const manifest=JSON.parse(read('assets/dingsi-lab-icons/pastel-used-v47-manifest.json'));
const js=read('dingsi-lab-icons-fullset-v47.js');
const html=read('dingsi-lab-icons.html'),hub=read('dingsi-lab.html');
const ids=['todo','fitness','kistologie','food','einkauf','finanzen','kalender','progress','denkfabrik','outdoor','wohnung','werkstatt','reisen','backstage'];
test('exactly 14 original standalone icons stored as reusable 1254px alpha WebP assets',()=>{
 assert.deepEqual(Object.keys(manifest.icons),ids);
 assert.equal(manifest.width,1254);assert.equal(manifest.height,1254);
 assert.equal(manifest.background,'transparent_alpha');
 for(const id of ids){
  const meta=manifest.icons[id];
  assert.equal(meta.path,'assets/dingsi-lab-icons/pastel-used-v47-'+id+'.webp');
  const buf=fs.readFileSync(path.join(root,meta.path));
  assert.equal(buf.toString('ascii',0,4),'RIFF',id);
  assert.equal(buf.toString('ascii',8,12),'WEBP',id);
  assert.equal(buf.toString('ascii',12,16),'VP8X',id);
  assert.notEqual(buf[20]&0x10,0,id+' should have alpha');
  assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),meta.sha256,id+' different icon than approved');
  assert(buf.length>200000,id+' unexpectedly tiny');
 }
 assert.match(manifest.icons.food.source_filename,/rustikale_küchenablage_mit_spaghetti_bolognese/);
 assert.match(manifest.icons.kistologie.source_filename,/röntgenakten/);
 assert.match(manifest.icons.fitness.source_filename,/fitness_icon/);
});
test('the real Dingsi Lab page defaults to newest icons and keeps the previous set selectable',()=>{
 assert.match(hub,/href="\.\/dingsi-lab-icons\.html\?v=47"/);
 assert.match(html,/dingsi-lab-icons-fullset-v47\.js\?v=47/);
 assert.match(html,/data-fullset-style-v47="new"/);
 assert.match(html,/data-fullset-style-v47="previous"/);
 assert.match(html,/fullset-styles-v47/);
 assert.match(html,/dingsi-lab-icons-cloud-v44\.js\?v=44/);
 assert.match(html,/id="choose-style"/);
 assert.match(html,/id="fave"/);
 assert.match(html,/data-bg="checker"/);
 assert.match(html,/id="photo"/);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.doesNotMatch(js,/localStorage\.setItem|fetch\(|dingsi_lab_icon_choices|supabase/);
});
test('series comparison switches all 14 actual images and follows chosen photo or dark/pastel/checker background',()=>{
 const callbacks={},added=[],surfaceProps={};
 function element(tag='div'){
  const x={tagName:tag.toUpperCase(),hidden:false,dataset:{},children:[],handlers:{},
   style:{getPropertyValue(k){return k==='--photo-background'?'url("blob:tester-background")':'';},
    setProperty(k,v){surfaceProps[k]=v;}},
   appendChild(child){this.children.push(child);},
   replaceChildren(){this.children=[];},
   addEventListener(event,fn){this.handlers[event]=fn;},
   setAttribute(k,v){(this.attributes??={})[k]=v;},
   querySelector(selector){if(selector==='img')return this.children.find(y=>y.tagName==='IMG')||null;return null;},
   querySelectorAll(selector){if(selector==='[data-fullset-id]')return this.children;return[];},
   scrollIntoView(){}
  };
  if(tag==='button')added.push(x);
  return x;
 }
 const toggle=element('button'),panel=element(),grid=element(),surface=element(),preview=element(),detail=element(),summary=element(),newBtn=element('button'),oldBtn=element('button');
 newBtn.dataset.fullsetStyleV47='new';oldBtn.dataset.fullsetStyleV47='previous';panel.hidden=true;
 preview.dataset.surface='dark';
 const lookup={'fullset-toggle-v45':toggle,'fullset-panel-v45':panel,'fullset-grid-v45':grid,
 'fullset-surface-v45':surface,preview,'fullset-detail-v45':detail,'fullset-selected-v45':summary};
 const document={getElementById:id=>lookup[id]||null,querySelectorAll:selector=>selector==='[data-fullset-style-v47]'?[newBtn,oldBtn]:[],createElement:element,addEventListener(k,v){callbacks[k]=v}};
 let mutation;
 class MutationObserver{constructor(fn){mutation=fn}observe(){}}
 vm.runInNewContext(js,{document,MutationObserver});
 assert.equal((newBtn.attributes||{})['aria-pressed'],'true');
 toggle.handlers.click();
 assert.equal(panel.hidden,false);
 assert.equal(grid.children.length,14);
 assert.equal(grid.children[0].children[0].src,'./assets/dingsi-lab-icons/pastel-used-v47-todo.webp?v=47');
 assert.equal(grid.children[3].children[0].src,'./assets/dingsi-lab-icons/pastel-used-v47-food.webp?v=47');
 assert.equal(grid.children[13].children[0].src,'./assets/dingsi-lab-icons/pastel-used-v47-backstage.webp?v=47');
 assert.equal(surface.dataset.surface,'dark');
 grid.children[2].handlers.click();
 assert.match(detail.children[0].src,/pastel-used-v47-kistologie\.webp/);
 oldBtn.handlers.click();
 assert.equal((oldBtn.attributes||{})['aria-pressed'],'true');
 assert.match(grid.children[3].children[0].src,/approved-v46-food\.webp/);
 assert.match(detail.children[0].src,/approved-v46-kistologie\.webp/);
 newBtn.handlers.click();
 assert.match(grid.children[3].children[0].src,/pastel-used-v47-food\.webp/);
 for(const mode of ['pastel','checker','photo']){
  preview.dataset.surface=mode;mutation();assert.equal(surface.dataset.surface,mode);
 }
 assert.match(surfaceProps['--photo-background'],/tester-background/);
 toggle.handlers.click();assert.equal(panel.hidden,true);
});
